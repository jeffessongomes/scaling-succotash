# Review: feat/planka-1773039018473161850-crud-usuarios

**Ticket:** `planka-1773039018473161850`
**Branch:** `feat/planka-1773039018473161850-crud-usuarios`
**Review gerado em:** 2026-05-12
**Spec:** `docs/specs/planka-1773039018473161850-spec.md`

---

## Critérios de Aceite

| # | Critério | Status | Evidência no código |
|---|---|---|---|
| CA1 | Sem Authorization header → GET /api/users/me → 401 | OK | [require-auth.ts:18-20](apps/api/src/shared/middleware/require-auth.ts#L18) |
| CA2 | ADMIN com JWT → POST /api/users com dados válidos → 201 com UserPublic (sem passwordHash) | OK | [user.router.ts:10-22](apps/api/src/features/user/user.router.ts#L10), [user.service.ts:13-31](apps/api/src/features/user/user.service.ts#L13) |
| CA3 | TEACHER → POST /api/users → 403 Forbidden | OK | [require-admin.ts:5-9](apps/api/src/shared/middleware/require-admin.ts#L5) |
| CA4 | ADMIN → POST /api/users com email existente → 409 Conflict | OK | [user.service.ts:23-24](apps/api/src/features/user/user.service.ts#L23) |
| CA5 | Usuário autenticado → GET /api/users/me → 200 com UserPublic | OK | [user.router.ts:24-31](apps/api/src/features/user/user.router.ts#L24) |
| CA6 | TEACHER como A → PATCH /api/users/:idDoB → 403 Forbidden | OK | [user.service.ts:44-46](apps/api/src/features/user/user.service.ts#L44) |
| CA7 | TEACHER → PATCH próprio ID com dados válidos → 200 | OK | [user.service.ts:44-46](apps/api/src/features/user/user.service.ts#L44) |
| CA8 | ADMIN → DELETE /api/users/:id → 204 + isActive = false | OK | [user.router.ts:47-53](apps/api/src/features/user/user.router.ts#L47), [user.service.ts:70-78](apps/api/src/features/user/user.service.ts#L70) |
| CA9 | TEACHER → DELETE /api/users/:id → 403 Forbidden | OK | [require-admin.ts:5-9](apps/api/src/shared/middleware/require-admin.ts#L5) |
| CA10 | Usuário desativado → POST /auth/login com credenciais corretas → 401 "Conta desativada" | OK | [auth.service.ts:28](apps/api/src/features/auth/auth.service.ts#L28) |

**Todos os 10 critérios de aceite implementados e verificáveis.**

---

## Análise Qualitativa

### Aderência à spec

A implementação cobre integralmente o escopo definido:

- **CRUD completo:** as 4 rotas REST (`POST`, `GET /me`, `PATCH /:id`, `DELETE /:id`) estão implementadas com semânticas corretas.
- **JWT no login:** `auth.service.ts` agora retorna `{ token, user }` após validar credenciais e `isActive`.
- **Middlewares:** `requireAuth` verifica JWT, busca o usuário no banco a cada requisição para validar `isActive`, e injeta `req.user`. `requireAdmin` verifica `req.user.role`.
- **Soft delete:** `deleteUser` faz `isActive = false` sem remover o registro. ✅
- **Schema Prisma:** campo `isActive Boolean @default(true)` e `@@index([isActive])` adicionados. ✅
- **Migration:** `20260512060000_add_user_is_active` — nome difere ligeiramente do sugerido na spec (`000000` vs `060000`), mas reflete a hora real de criação. Sem impacto funcional.

### Cobertura de edge cases

Todos os 10 edge cases da spec foram cobertos:

| Edge case | Status |
|---|---|
| Token expirado → 401 "Token expirado" | OK — `require-auth.ts:28-30`, teste `require-auth.test.ts:107` |
| Token malformado → 401 "Token inválido" | OK — `require-auth.ts:31`, teste `require-auth.test.ts:124` |
| Authorization header formato errado → 401 | OK — `require-auth.ts:18-20`, teste `require-auth.test.ts:97` |
| PATCH com email já usado → 409 | OK — `user.service.ts:53-55`, teste `user.router.test.ts:301` |
| PATCH/DELETE de usuário inexistente → 404 | OK — `user.service.ts:49,72`, testes `user.router.test.ts:318,371` |
| PATCH sem nenhum campo → 400 | OK — `user.schemas.ts:15-17` (refine), teste `user.router.test.ts:332` |
| POST /users sem password → 400 | OK — `CreateUserBodySchema`, teste `user.router.test.ts:182` |
| DELETE único ADMIN → permitido | OK — sem restrição por design |
| JWT válido mas usuário desativado → 401 | OK — `require-auth.ts:35-37`, teste `require-auth.test.ts:141` |
| PATCH com `role` no body → ignorado | OK — `UpdateUserBodySchema` não inclui o campo |

### Qualidade da implementação

- **`USER_SELECT` constante** em `user.service.ts:13-20` é uma boa prática: garante que `passwordHash` nunca vaze em nenhuma resposta do serviço. Correto.
- **`updateUser`** em `user.service.ts:39-68` lida corretamente com a separação `password` vs campos de perfil via desestruturação. Correto.
- **`require-auth`** faz lookup no banco a cada request para verificar `isActive` — aderente ao edge case 9 da spec.

### Sugestões (não bloqueantes)

1. **`user.router.ts:40`** — `req.params['id'] as string`: Express garante que o parâmetro existe quando a rota casou, então o `as string` é seguro. Alternativa mais explícita: `req.params['id']!`. Ambos equivalentes; sem impacto.

2. **`user.service.ts:58`** — `const updateData: { name?: string; email?: string; passwordHash?: string } = { ...profileFields }`: o tipo explícito está correto mas poderia ser inferido automaticamente pelo TypeScript via o tipo de `profileFields`. Não é uma violação.

3. **Migration duplica índice em `email`**: o campo `email` já tem um índice implícito via `@unique`. O `@@index([email])` da spec (e a migration correspondente `User_email_idx`) adicionam um segundo índice. No PostgreSQL, isso é redundante mas inofensivo — e segue o que a spec determina explicitamente.

---

## Aderência a React Practices

> N/A — este PR é backend puro (Express). Regras de componentes, hooks e Tailwind não se aplicam.

| Convenção | Status | Evidência |
|---|---|---|
| TypeScript strict (sem `any`) | OK | Nenhum `any` encontrado nos arquivos de produção |
| Hardcoded (URLs, env vars) | OK | JWT_SECRET e JWT_EXPIRES_IN via `env` config |
| Estrutura de arquivos (features/shared) | OK | `features/user/`, `shared/middleware/` |
| Imutabilidade | OK | Sem mutação de objetos |

---

## Aderência a React Testing

> Regras de frontend (data-testid, userEvent, findBy) são N/A para testes de integração HTTP com Supertest. As convenções aplicáveis ao contexto backend são avaliadas abaixo.

| Convenção | Status | Evidência | Bloqueante |
|---|---|---|---|
| Factory functions tipadas | OK | `createUserRecord`, `createUserPublic`, `createActiveUser` com tipos explícitos | -- |
| Testes em inglês | OK | Todos os `describe`/`it` em inglês | -- |
| Sem mock de fetch/axios direto | OK | Mocks na fronteira: `prisma`, `argon2`, `jsonwebtoken` | -- |
| TypeScript strict em mocks | OK | Sem `any`; usa `unknown` e `ReturnType<typeof ...>` | -- |
| `data-testid` | N/A | Backend — sem elementos DOM interativos | -- |
| `userEvent` do test-utils | N/A | Backend — sem interação de usuário | -- |
| `findBy*` em vez de `waitFor + getBy*` | N/A | Backend — sem queries de DOM assíncronas | -- |

Nenhuma violação bloqueante.

### Cobertura dos cenários de teste exigidos pela spec

**`user.router.test.ts` — 17/17 cenários** ✅

| Cenário obrigatório | Status |
|---|---|
| ADMIN cria professor com dados válidos → 201 + UserPublic | ✅ linha 129 |
| TEACHER tenta criar → 403 | ✅ linha 152 |
| Email duplicado → 409 | ✅ linha 166 |
| Body inválido (sem email) → 400 | ✅ linha 182 |
| Sem token → 401 | ✅ linha 195 |
| Token válido → 200 + UserPublic | ✅ linha 213 |
| Token expirado → 401 | ✅ linha 229 |
| Sem token (GET /me) → 401 | ✅ linha 240 |
| TEACHER atualiza a si mesmo → 200 | ✅ linha 254 |
| TEACHER tenta atualizar outro → 403 | ✅ linha 272 |
| ADMIN atualiza qualquer usuário → 200 | ✅ linha 284 |
| Email já usado (PATCH) → 409 | ✅ linha 301 |
| Usuário não encontrado (PATCH) → 404 | ✅ linha 318 |
| Body vazio (PATCH) → 400 | ✅ linha 332 |
| ADMIN desativa usuário → 204 | ✅ linha 346 |
| TEACHER tenta deletar → 403 | ✅ linha 361 |
| Usuário não encontrado (DELETE) → 404 | ✅ linha 371 |

**`auth.router.test.ts` — novos cenários** ✅

| Cenário obrigatório | Status |
|---|---|
| Login com credenciais válidas → `{ token, user }` | ✅ linha 125 |
| Login com usuário desativado → 401 | ✅ linha 146 |

**`require-auth.test.ts` — 7/7 cenários** ✅

**`require-admin.test.ts` — 3 cenários extras** ✅ (não exigidos pela spec, mas bem-vindos)

---

## Veredicto

**Aprovado com comentários**

```
Veredicto: Aprovado com comentários

Implementação completa e de alta qualidade. Todos os 10 critérios de aceite estão
implementados e cobertos por testes. Os 10 edge cases da spec foram tratados
corretamente. Nenhuma violação bloqueante encontrada.

Os comentários são sugestões menores (type assertions, índice redundante na
migration) que não bloqueiam merge. O PR está pronto para merge.
```
