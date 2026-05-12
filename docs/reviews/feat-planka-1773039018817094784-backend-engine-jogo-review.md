# Review: feat/planka-1773039018817094784-backend-engine-jogo

**ticket_id:** `planka-1773039018817094784`
**Branch:** `feat/planka-1773039018817094784-backend-engine-jogo`
**PR:** #7
**Data:** 2026-05-12

---

## Critérios de Aceite

| # | Critério | Status | Evidência no código |
|---|---|---|---|
| CA1 | `POST /api/sessions { quizId }` com quiz publicado → 201 com `{ pin, sessionId, status: "LOBBY" }`, PIN salvo no Redis e PostgreSQL | OK | `game.router.ts`, `game.service.ts:createSession` |
| CA2 | `player:join { pin, nickname, avatarId }` → `session:player-joined` emitido para toda a sala com `{ participant, totalPlayers }` | OK | `game.socket.ts:player:join` |
| CA3 | `game:start` → status `LOBBY→ACTIVE→QUESTION`, `session:question-start` emitido sem `isCorrect` nas opções, timer agendado no servidor | OK | `game.socket.ts:handleQuestionStart` — opções buscadas sem `isCorrect` |
| CA4 | `player:answer` → pontuação calculada e salva no Redis Hash, `session:answer-received` emitido apenas ao host | **Parcial** | `game.socket.ts` — `optionId` descartado via `void optionId`; distribuição e `isCorrect` incorretos (ver Bug 1) |
| CA5 | Timer expira → transição automática para `REVEAL`, `session:answers-revealed` emitido | OK | `game.socket.ts:autoRevealTimer` chama `revealAnswers` |
| CA6 | `game:reveal-answers` → timer cancelado, status → `REVEAL`, `session:answers-revealed` emitido para sala | OK | `game.socket.ts:game:reveal-answers` |
| CA7 | `game:show-leaderboard` → status → `LEADERBOARD`, `session:leaderboard` emitido com ranking ordenado por score | OK | `game.socket.ts:game:show-leaderboard` |
| CA8 | `game:end` → resultados persistidos no PostgreSQL, Redis limpo, `session:ended` emitido com ranking final | **Parcial** | `finalizeSession`: `GameAnswer.optionId` persiste ms em vez de ID da opção; `isCorrect` sempre `false` (ver Bug 2) |
| CA9 | `GET /api/sessions/:pin` → 200 com estado atual sem dados sensíveis | OK | `game.router.ts` — remove `hostSocketId` e `hostDisconnectedAt` da resposta |

---

## Análise Qualitativa

### Aderência à spec — pontos fortes

A implementação cobre corretamente a estrutura geral: state machine explícita com `VALID_TRANSITIONS`, REST endpoints registrados em `/api`, namespace Socket.io `/game`, Redis cache com TTL, e a maior parte dos eventos de controle do jogo. A separação em `game.state-machine.ts`, `game-state.cache.ts` e `shared/utils/` segue a arquitetura da spec. O gerenciamento de timers com `Map<string, ReturnType<typeof setTimeout>>` e limpeza via `clearGameTimers` é correto.

### Bugs críticos — gaps da spec

---

**Bug 1 — `optionId` descartado em `player:answer`**

`game.socket.ts`, handler `player:answer`:

```typescript
const saved = await saveAnswer(pin, questionId, participant.id, answeredInMs)
void optionId  // optionId descartado — suprime o warning de variável não usada
```

O Redis armazena apenas `participantId → answeredInMs`. A opção escolhida pelo jogador é perdida. Isso quebra dois comportamentos críticos:

**a) Distribuição incorreta em `revealAnswers`:**
```typescript
const optId = String(answeredInMs)  // ex: '5000' — nunca vai bater em 'opt-1', 'opt-2'
if (optId in distribution) {        // distribution sempre fica com zeros
  distribution[optId] = (distribution[optId] ?? 0) + 1
}
```
`session:answers-revealed.distribution` sempre terá zeros para todas as opções.

**b) `isCorrect` sempre verdadeiro para qualquer resposta:**
```typescript
const isCorrect = answers[participantId] !== undefined && correctOptionId !== ''
// sempre true se o participante respondeu qualquer coisa
```
Pontos são atribuídos a qualquer jogador que respondeu, independente da opção ser a correta.

**Correção sugerida:** Alterar `saveAnswer` para incluir `optionId` no valor armazenado (ex: `participantId → "optionId:answeredInMs"` ou usar dois campos do Hash). Em `revealAnswers`, recuperar e separar `optionId` e `answeredInMs` para checar `isCorrect` corretamente e contabilizar a distribuição.

---

**Bug 2 — `finalizeSession` persiste dados incorretos**

`game.service.ts`, função `finalizeSession`:

```typescript
const chosenOptionId = Object.keys(answers).find((k) => k === participantId)
const isCorrect = chosenOptionId === correctOption?.id
// Object.keys(answers) são IDs de participantes, nunca igual a correctOption.id
// → isCorrect sempre false

optionId: answers[participantId]?.toString() ?? '',
// answers[participantId] é o answeredInMs (número), não o optionId
// → GameAnswer.optionId gravado com '5000', '12000' etc.
```

Todo `GameAnswer` persistido no PostgreSQL terá `isCorrect: false` e `optionId` com o tempo de resposta em ms. Isso corrompe o histórico de partidas.

**Correção:** Depende da correção do Bug 1 — com o `optionId` disponível no Redis, `finalizeSession` pode recuperá-lo corretamente.

---

**Bug 3 — `getAllActiveSessions()` stub vazio — disconnect handler inoperante**

`game.socket.ts`, ao final do arquivo:

```typescript
async function getAllActiveSessions(): Promise<[string, GameSessionState][]> {
  return []  // stub — sempre retorna vazio
}
```

O handler `disconnect` itera sobre `getAllActiveSessions()` para encontrar se o socket desconectado era um host ou jogador. Como a função retorna `[]`, o handler nunca encontra nada, quebrando completamente:

- **Edge Case #6 da spec** — "Desconexão do host: aguardar 30s via setTimeout. Se o host não reconectar, emitir `session:error HOST_DISCONNECTED` e finalizar a sessão." — **não funciona**.
- **Edge Case #10 da spec** — "Desconexão de jogador: manter na sessão com `isConnected: false`." — **não funciona**.

**Correção sugerida:** Manter um `Map<socketId, pin>` atualizado no processo (ou buscar via `redis.keys('game:session:*')`) para localizar rapidamente qual sessão pertence ao socket desconectado. A segunda opção tem custo de scan no Redis em cada disconnect — a primeira é preferível.

---

**Bug 4 — DELETE `/sessions/:pin` sem verificação de owner**

`game.router.ts`:

```typescript
gameRouter.delete('/sessions/:pin', requireAuth, async (req, res, next) => {
  const session = await getSessionByPin(req.params['pin'] as string)
  if (!session) { ... }
  await finalizeSession(session)  // qualquer professor autenticado encerra qualquer sessão
  res.status(204).send()
})
```

A spec define `DELETE /api/sessions/:pin → requireAuth, owner` e o test plan inclui `DELETE não-owner → 403`. O endpoint não verifica se `req.user.id` é o criador da sessão. O `GameSession` no Prisma não tem campo `authorId/userId` — precisará ser adicionado ao schema ou armazenado no `GameSessionState` do Redis.

---

**Bug 5 — Rate limiting de socket não implementado**

A Regra de Negócio #12 da spec define: "máx. `env.GAME_WS_RATE_LIMIT` (10) eventos/socket/segundo". Nenhuma lógica de rate limiting foi implementada no handler de conexão ou nos event handlers do namespace `/game`.

---

### Sugestões não bloqueantes

- `game.socket.ts:revealAnswers` — o parâmetro `_correctOptionId` é recebido mas ignorado (o correto é buscado do Prisma internamente). O parâmetro pode ser removido para clareza.
- `game.socket.ts:game:start` — ao fazer a dupla transição `LOBBY→ACTIVE→QUESTION` em sequência sem `await saveSession` entre elas, o estado intermediário `ACTIVE` nunca é persistido. Baixo impacto (a transição é atômica no processo), mas pode confundir em debug.
- `game.socket.ts` — mutação direta em `participant.score += points` e `session.participants[p].isConnected = false` em vez de criar novos objetos. Funcional para backend, mas inconsistente com a regra de imutabilidade do projeto.

---

## Aderência a Práticas TypeScript (backend)

| Convenção | Status | Evidência |
|---|---|---|
| TypeScript strict (sem `any`) | OK | Nenhum `any` detectado; `unknown` em payloads de socket — correto |
| Sem valores hardcoded (env vars, constantes) | OK | Usa `env.GAME_SESSION_TTL`, `env.GAME_WS_RATE_LIMIT` |
| Estrutura de arquivos (features/infrastructure/shared) | OK | Segue a arquitetura da spec |
| Imutabilidade | Violação | `game.socket.ts` — mutação direta de `participant.score`, `participant.isConnected`, `session.status` sem criar novos objetos |

A violação de imutabilidade não é bloqueante para backend, mas vale adequar.

---

## Aderência a React Testing (testes do backend)

| Convenção | Status | Evidência | Bloqueante |
|---|---|---|---|
| Factory functions tipadas | OK | `createLobbySession`, `createQuizWithQuestions`, `createSession` em cache test | -- |
| Mock apenas na fronteira (prisma, redis) | OK | Todos os testes mockam a camada de dados — nunca `fetch`/`axios` diretamente | -- |
| Testes em inglês | OK | Todos os `describe`/`it` em inglês | -- |
| Sem `setTimeout`/sleep nos testes | **Violação** | `game.socket.test.ts` — função `joinRoom` usa `await new Promise((r) => setTimeout(r, 80))` | Sim (novo) |
| Cobertura: disconnect/reconnect do host | Ausente | Definido no test plan da spec (`game.socket.test.ts`), não implementado | Não (ausência de caso) |
| `data-testid` / `userEvent` / `findBy*` | N/A | Backend — não aplicável | -- |

**Sobre o sleep no teste:** A regra proíbe `setTimeout` e `sleep` em testes. A alternativa para socket.io é usar eventos de confirmação (ack callbacks do socket.io) ou estruturar `host:join` para retornar um ack e aguardá-lo. O `setTimeout(80)` é frágil — pode falhar em CI lento.

---

## Veredicto

**Solicitar mudanças**

Cinco bloqueantes precisam ser resolvidos antes do merge:

1. **Bug 1** — `optionId` descartado em `player:answer` → distribuição incorreta e `isCorrect` sempre verdadeiro.
2. **Bug 2** — `finalizeSession` persiste `GameAnswer.optionId` com ms e `isCorrect: false` para todos.
3. **Bug 3** — `getAllActiveSessions()` stub vazio → disconnect handler completamente inoperante (Edge Cases #6 e #10 da spec não entregues).
4. **Bug 4** — `DELETE /sessions/:pin` sem verificação de owner → qualquer professor pode encerrar sessão de outro.
5. **Bug 5 (teste)** — sleep em `game.socket.test.ts:joinRoom` → violação de convenção de teste (arquivo novo).

O Bug 5 (rate limiting de socket) é real mas pode ser tratado como issue separado se houver restrição de prazo — registrar como dívida técnica nesse caso.
