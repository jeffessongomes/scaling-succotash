> Review anterior substituído em 2026-05-12.

# Review: Backend — Engine do Jogo (WebSocket + Redis)

**Branch:** `feat/planka-1773039018817094784-backend-engine-jogo`
**Ticket:** `planka-1773039018817094784`
**PR:** #7
**Spec:** `docs/specs/planka-1773039018817094784-spec.md`
**Data:** 2026-05-12

---

## Critérios de Aceite

| # | Critério | Status | Evidência no código |
|---|---|---|---|
| CA1 | `POST /api/sessions { quizId }` com quiz publicado → 201 com `{ pin, sessionId, status: "LOBBY" }`, PIN salvo no Redis e PostgreSQL | OK | `game.router.ts:9-21`, `game.service.ts:88-95` |
| CA2 | `player:join { pin, nickname, avatarId }` → `session:player-joined` para toda a sala com `{ participant, totalPlayers }` | OK | `game.socket.ts:225-276` |
| CA3 | `game:start` → LOBBY→ACTIVE→QUESTION, `session:question-start` sem `isCorrect`, timer agendado no servidor | OK | `game.socket.ts:308-351`, `game.socket.ts:76-144` |
| CA4 | `player:answer` → pontuação salva no Redis Hash, `session:answer-received` emitido apenas ao host | OK | `game.socket.ts:498-543`, `game-state.cache.ts:33-45` |
| CA5 | Timer expira → REVEAL automático, `session:answers-revealed` emitido | OK | `game.socket.ts:132-143` |
| CA6 | `game:reveal-answers` → timer cancelado, REVEAL, `session:answers-revealed` emitido | OK | `game.socket.ts:394-428` |
| CA7 | `game:show-leaderboard` → LEADERBOARD, `session:leaderboard` com ranking ordenado | OK | `game.socket.ts:430-469` |
| CA8 | `game:end` → resultados persistidos no PostgreSQL, Redis limpo, `session:ended` emitido | OK | `game.socket.ts:471-496`, `game.service.ts:144-222` |
| CA9 | `GET /api/sessions/:pin` → 200 com estado atual sem dados sensíveis | OK | `game.router.ts:23-35` — `hostSocketId` e `hostDisconnectedAt` removidos |

---

## Análise Qualitativa

### Resolução dos 5 bloqueantes do review anterior

Todos os bloqueantes foram corrigidos:

**B1 — `optionId` descartado em `player:answer` (CORRIGIDO)**

`game.socket.ts:533` agora passa `optionId` corretamente:
```typescript
const saved = await saveAnswer(pin, questionId, participant.id, optionId, answeredInMs)
```
`game-state.cache.ts:40-45` armazena `optionId:answeredInMs` como string; `getAnswers` (`:55-62`) desserializa via `indexOf(':')`. A distribuição em `revealAnswers` e o `isCorrect` em `finalizeSession` são agora corretos.

**B2 — `finalizeSession` com dados incorretos (CORRIGIDO)**

`game.service.ts:174-192` usa `answer.optionId` e `answer.answeredInMs` da estrutura `AnswerRecord`. `isCorrect` é calculado comparando `answer.optionId === correctOption?.id`. Três novos testes em `game.service.test.ts:189-246` cobrem `optionId`, `isCorrect = false` e `isCorrect = true`.

**B3 — `getAllActiveSessions()` stub vazio (CORRIGIDO)**

O handler `disconnect` foi reescrito para usar `socketPinMap.get(socket.id)` (`game.socket.ts:546`). O `socketPinMap` é populado no `player:join` (`:270`) e `host:join` (`:304`). Sem dependência de stub — o PIN do socket desconectado é acessível imediatamente.

**B4 — DELETE sem verificação de owner (CORRIGIDO)**

`game.router.ts:44-47` verifica `session.authorId !== req.user!.id` e retorna 403. O campo `authorId` foi adicionado a `GameSessionState` (`game.types.ts:8`) e salvo no estado Redis ao criar a sessão (`game.service.ts:79`). Teste de 403 adicionado em `game.router.test.ts:196-217`.

**B5 — Sleep no teste (CORRIGIDO)**

Nenhum `sleep` ou `setTimeout` em `game.socket.test.ts`. O helper `waitForEvent` (`game.socket.test.ts:83-91`) usa `Promise + clearTimeout`. O `joinRoom` (`game.socket.test.ts:97-102`) agora usa o ack callback do Socket.io para garantir que o `host:join` foi processado antes de prosseguir.

---

### Sugestões (não bloqueantes)

**S1 — `pointsEarned` armazena score acumulado em vez de pontos por resposta**

`game.service.ts:185`:
```typescript
pointsEarned: participant.score,  // score total acumulado, não pontos desta pergunta
```
O campo `GameAnswer.pointsEarned` semanticamente representa os pontos ganhos **naquela resposta específica**. Para um jogador com 2 perguntas respondidas corretamente, o `pointsEarned` do primeiro `GameAnswer` ficaria com o score total (que inclui os pontos da segunda pergunta também). O correto:
```typescript
pointsEarned: isCorrect ? calculateScore(question.points, timeLimitMs, answer.answeredInMs) : 0,
```
Não bloqueia o MVP (endpoint de histórico fora do escopo desta sprint), mas os dados persistidos estarão incorretos para analytics futuras.

**S2 — `void hostUserId` em `game.socket.ts:586`**

`hostUserId` é declarado em `:213` mas nunca utilizado — o controle de host é feito via `session.hostSocketId`. O `void hostUserId` existe para silenciar o compilador. A variável pode ser removida completamente.

**S3 — `gameNs as unknown as Server` em múltiplos handlers**

O cast em `:345`, `:386`, `:427` e `:464` é necessário porque `handleQuestionStart` e `revealAnswers` recebem `Server` mas o namespace é `Namespace`. Uma alternativa mais limpa seria extrair a interface mínima necessária:
```typescript
type Emitter = { to: (room: string) => { emit: (ev: string, data: unknown) => void } }
```

**S4 — DELETE sem teste 401**

`game.router.test.ts` cobre 204, 404 e 403 para DELETE, mas não o 401 (sem autenticação). O `requireAuth` já garante esse comportamento na prática, mas o teste está ausente para completar a cobertura da spec.

---

## Aderência a Práticas TypeScript (backend)

| Convenção | Status | Evidência |
|---|---|---|
| TypeScript strict (sem `any`) | OK | Nenhum `any` encontrado; mocks em testes tipados com `satisfies Record<string, AnswerRecord>` |
| Sem valores hardcoded (env vars, constantes) | OK | Usa `env.JWT_SECRET`, `env.GAME_SESSION_TTL`, `env.GAME_WS_RATE_LIMIT` |
| Estrutura de arquivos (`features/`, `infrastructure/`, `shared/`) | OK | Segue exatamente a arquitetura da spec |
| Imutabilidade | N/A | Backend — mutação direta de campos de estado é aceitável no contexto do handler |

---

## Aderência a React Testing (testes backend)

| Convenção | Status | Evidência | Bloqueante |
|---|---|---|---|
| Testes em inglês | OK | Todos os `describe`/`it` em inglês | -- |
| Factory functions tipadas | OK | `createLobbySession`, `createQuizWithQuestions`, `createSession(overrides?)` com tipos explícitos; `satisfies` nos mocks de resposta | -- |
| Sem `any` em mocks | OK | `satisfies Record<string, AnswerRecord>` em `game.socket.test.ts:287`, `game.service.test.ts:193`; type assertions tipadas | -- |
| `vi.hoisted()` para mocks com referências cruzadas | OK | `game.socket.test.ts:8-18`, `game.service.test.ts:4-44` | -- |
| Sem `sleep`/`setTimeout` nos testes | OK | Helper `waitForEvent` com `Promise + clearTimeout` | -- |
| Cobertura de transições de estado | OK | `game.socket.test.ts` cobre: join, nickname duplicado, sessão não aceitando, start, quiz vazio, não-host, answer, reveal correto/errado/zero respostas, end | -- |
| `data-testid` / `userEvent` / `findBy*` | N/A | Backend — não aplicável | -- |

---

## Veredicto

**Aprovado com comentários**

```
Veredicto: Aprovado com comentários

Os 5 bloqueantes do review anterior foram todos corrigidos:
- optionId agora é persistido e usado corretamente em saveAnswer, revealAnswers e finalizeSession
- finalizeSession persiste optionId e answeredInMs corretos com isCorrect calculado adequadamente
- handler disconnect usa socketPinMap (sem dependência de stub getAllActiveSessions)
- DELETE /sessions/:pin verifica session.authorId === req.user.id antes de finalizar
- nenhum sleep nos testes — joinRoom usa ack callback do Socket.io

Comentários não bloqueantes:
(1) pointsEarned em finalizeSession armazena score acumulado em vez de pontos
    por resposta — usar calculateScore antes da sprint de analytics.
(2) hostUserId declarado mas nunca utilizado — remover variável e void hostUserId.
(3) gameNs as unknown as Server pode ser refatorado com tipo Emitter mínimo.
(4) Teste 401 ausente para DELETE /api/sessions/:pin.

PR pronto para merge.
```
