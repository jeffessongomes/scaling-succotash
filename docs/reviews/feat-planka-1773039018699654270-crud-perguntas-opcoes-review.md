# Review — feat/planka-1773039018699654270-crud-perguntas-opcoes

**PR:** #5 — feat: CRUD de Perguntas e Opções de Resposta  
**Branch:** `feat/planka-1773039018699654270-crud-perguntas-opcoes`  
**Card Planka:** `1773039018699654270`  
**Data:** 2026-05-12  
**Spec:** `docs/specs/planka-1773039018699654270-spec.md`

---

## Critérios de Aceite

### POST /api/quizzes/:quizId/questions

| # | Critério | Status | Evidência no código |
|---|---|---|---|
| CA1 | TEACHER autenticado e autor → 201 com QuestionPublic | OK | `question.router.ts:18-30` / `question.router.test.ts:91` |
| CA2 | Quiz não pertence ao TEACHER → 403 | OK | `question.service.ts:31-33` / `question.router.test.ts:126` |
| CA3 | Quiz não existe → 404 | OK | `question.service.ts:30` / `question.router.test.ts:143` |
| CA4 | timeLimitSecs < 5 → 400 | OK | `question.schemas.ts:8` / `question.router.test.ts:180` |

### PATCH /api/questions/:id

| # | Critério | Status | Evidência no código |
|---|---|---|---|
| CA5 | Campos parciais válidos → 200 com QuestionPublic | OK | `question.router.ts:32-44` / `question.router.test.ts:243` |
| CA6 | Body vazio → 400 | OK | `question.schemas.ts:25` / `question.router.test.ts:266` |
| CA7 | Pergunta não existe → 404 | OK | `question.service.ts:41` / `question.router.test.ts:276` |
| CA8 | TEACHER não é autor → 403 | OK | `question.service.ts:42-44` / `question.router.test.ts:290` |

### DELETE /api/questions/:id

| # | Critério | Status | Evidência no código |
|---|---|---|---|
| CA9 | TEACHER é autor → 204 + cascade via schema | OK | `question.router.ts:46-53` / `question.router.test.ts:311` |
| CA10 | TEACHER não é autor → 403 | OK | `question.service.ts:42-44` / `question.router.test.ts:327` |
| CA11 | Pergunta não existe → 404 | OK | `question.service.ts:41` / `question.router.test.ts:341` |

### PATCH /api/questions/:id/reorder

| # | Critério | Status | Evidência no código |
|---|---|---|---|
| CA12 | TEACHER é autor, order válido → 200 | OK | `question.router.ts:55-67` / `question.router.test.ts:358` |

### POST /api/questions/:questionId/options

| # | Critério | Status | Evidência no código |
|---|---|---|---|
| CA13 | < 4 opções → 201 com AnswerOptionPublic | OK | `option.service.ts:47-78` / `option.router.test.ts:91` |
| CA14 | isCorrect: true reseta demais opções → 201 | OK | `option.service.ts:61-72` + `$transaction` / `option.router.test.ts:134` |
| CA15 | 4 opções existentes → 422 com mensagem | OK | `option.service.ts:54-57` / `option.router.test.ts:115` |
| CA16 | TEACHER não é autor → 403 | OK | `option.service.ts:25-27` / `option.router.test.ts:173` |

### PATCH /api/options/:id

| # | Critério | Status | Evidência no código |
|---|---|---|---|
| CA17 | isCorrect: true reseta demais → 200 | OK | `option.service.ts:87-99` + `$transaction` / `option.router.test.ts:220` |
| CA18 | Body vazio → 400 | OK | `option.schemas.ts:17` / `option.router.test.ts:246` |
| CA19 | Opção não existe → 404 | OK | `option.service.ts:35` / `option.router.test.ts:256` |
| CA20 | TEACHER não é autor → 403 | OK | `option.service.ts:36-38` / `option.router.test.ts:270` |

### DELETE /api/options/:id

| # | Critério | Status | Evidência no código |
|---|---|---|---|
| CA21 | TEACHER é autor → 204 | OK | `option.router.ts:37-44` / `option.router.test.ts:291` |
| CA22 | TEACHER não é autor → 403 | OK | `option.service.ts:36-38` / `option.router.test.ts:307` |
| CA23 | Opção não existe → 404 | OK | `option.service.ts:35` / `option.router.test.ts:322` |

---

## Análise Qualitativa

### Aderência à spec

A implementação atende integralmente à spec. Todos os 23 critérios de aceite foram verificados no código. Os 32 cenários de teste documentados na spec (18 para `question` + 14 para `option`) estão implementados e passando.

Pontos de destaque positivos:

- `assertQuizOwnership`, `assertQuestionOwnership`, `assertQuestionOptionOwnership` e `assertOptionOwnership` encapsulam corretamente a lógica de autorização com bypass para ADMIN (`user.role !== 'ADMIN'`)
- `prisma.$transaction` usado corretamente nas operações de reset de `isCorrect`
- `getNextOrder` calcula `MAX(order) ?? 0 + 1`, cobrindo o edge case de quiz vazio com `order = 1`
- `UnprocessableEntityError` (422) adicionado corretamente ao `http-errors.ts`
- Rotas registradas em `app.ts` exatamente como definido na spec

### Gaps identificados

**1. Edge case não testado: `mediaType` sem `mediaUrl`**  
A spec (Edge Case 10) exige que `mediaType` sem `mediaUrl` retorne `400`. Há teste para `mediaUrl` sem `mediaType`, mas não o inverso. O schema cobre ambos via `refine`, mas o caso não está explicitamente testado.

**2. Comportamento do ADMIN não testado**  
A spec (RN2 / Edge Case 8) define que ADMIN pode editar/deletar perguntas e opções de qualquer quiz. A implementação tem o bypass correto, mas não há nenhum teste de integração verificando esse comportamento.

**3. Duplicação de `AnswerOptionPublic`**  
A interface é declarada em dois arquivos: `question.types.ts:13` e `option.types.ts:1`. Os tipos são idênticos. Qualquer evolução futura exige atualização em dois lugares. Sugestão: mover para `packages/shared/` ou reutilizar de `question.types.ts` no módulo `option`.

**4. Race condition hipotética em `createOption`**  
`createOption` faz duas queries de contagem independentes: uma para verificar `>= 4` e outra em `getNextOptionOrder`. Em ambiente com requisições concorrentes, uma 5ª opção poderia ser inserida antes da verificação. Aceitável para o MVP offline no RPi, mas vale registrar para revisão quando o sistema for exposto a múltiplos usuários simultâneos.

### Sugestões (não-bloqueantes)

- Adicionar os dois testes ausentes (`mediaType` sem `mediaUrl` e ADMIN bypass) em follow-up
- Avaliar consolidar `AnswerOptionPublic` em `packages/shared/types` junto com as demais interfaces compartilhadas
- No `reorderQuestion`, a spec diz "retorna 200 com apenas o campo `order` atualizado" — a implementação retorna o `QuestionPublic` completo via `QUESTION_SELECT`. Isso não é um problema (é mais informativo), mas diverge levemente da linguagem da spec

---

## Aderência a React Practices

> Esta tarefa é **100% backend** (API REST). As convenções de componentes, hooks e estrutura de frontend são N/A.

| Convenção | Status | Evidência |
|---|---|---|
| TypeScript strict (sem `any`) | OK | Nenhum `any` encontrado nos arquivos de implementação |
| Sem hardcoded (URLs, valores sensíveis) | OK | Nenhum valor hardcoded identificado |
| Estrutura de arquivos (features/question, features/option) | OK | Exatamente conforme definido na spec |
| Imutabilidade | OK | Nenhuma mutação direta de objetos |
| Erros tratados explicitamente | OK | `try/catch` em todos os route handlers, erros tipados via `AppError` |

---

## Aderência a React Testing

> Projeto backend — sem `data-testid`, `userEvent` ou React Testing Library. Convenções avaliadas: TypeScript strict em mocks, naming de testes, factory functions, fronteira de mock.

| Convenção | Status | Evidência | Bloqueante |
|---|---|---|---|
| Testes em inglês | OK | `it('should return 201...')` em todos os arquivos | -- |
| Factory functions tipadas | OK | `createQuestionRecord`, `createOptionRecord` com `Partial<T>` e valores pt-BR | -- |
| Mock apenas na fronteira (Prisma + requireAuth) | OK | `vi.mock('../../../config/database.js')` e `vi.mock('../../../shared/middleware/require-auth.js')` | -- |
| Sem `any` em mocks | Atenção | `as never` usado em vários `mockResolvedValueOnce` (`question.router.test.ts:97`, `option.router.test.ts:99`) — não é `any` explícito, mas escapa do type-safety | Não (legado de padrão já estabelecido) |
| Describes agrupados por rota/cenário | OK | `describe('POST /api/...')`, `describe('PATCH /api/...')`, etc. | -- |
| Limpeza com `vi.clearAllMocks()` no `beforeEach` | OK | `question.router.test.ts:84`, `option.router.test.ts:84` | -- |

---

## Veredicto

**Aprovado com comentários**

```
Veredicto: Aprovado com comentários

Implementação sólida e completa. Todos os 23 critérios de aceite estão cobertos no código,
e todos os 32 cenários de teste da spec estão implementados e passando (78 testes no total).
A lógica de autorização (ADMIN bypass, ownership checks), transações atômicas para reset de
isCorrect, e cálculo de order estão corretos.

Pontos a endereçar em follow-up (não bloqueiam o merge):
1. Adicionar teste para o edge case "mediaType sem mediaUrl" (Edge Case 10 da spec)
2. Adicionar teste verificando que ADMIN pode editar pergunta/opção de outro professor
3. Avaliar consolidar AnswerOptionPublic em packages/shared para evitar duplicação

A race condition em createOption é aceitável para o MVP offline no RPi e pode ser
endereçada quando o sistema for exposto a concorrência real.
```

---

*Review gerado automaticamente via `/proj-review`. Revisar e ajustar veredicto se necessário.*
