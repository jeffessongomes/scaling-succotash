# Azimute — Guia do Projeto para Claude

Sistema de quiz interativo para viagens escolares. Inspirado no Kahoot, offline-first no Raspberry Pi 4.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind CSS v4 + shadcn/ui |
| Backend | Express.js v5 + Socket.io v4 |
| Banco | PostgreSQL 16 via Prisma 6 |
| Cache / PubSub | Redis 7 via ioredis |
| Auth | Auth.js v5 (NextAuth) — professores; PIN — alunos |
| Testes | Vitest + React Testing Library (frontend) |
| Monorepo | pnpm workspaces + Turborepo |
| Infra | Docker Compose + Nginx (reverse proxy) |

---

## Estrutura do Monorepo

```
apps/
  web/    → Next.js 15 (porta 3000)
  api/    → Express.js (porta 4000)
packages/
  shared/ → tipos e schemas Zod compartilhados
infra/
  nginx/  → nginx.conf
  raspberry/ → scripts de setup do RPi
docs/
  ARCHITECTURE.md   → documentação técnica completa
  specs/            → specs geradas por /proj-spec
  plans/            → planos gerados por /proj-impl
  reviews/          → reviews gerados por /proj-review
```

---

## Regras Obrigatórias

- **TypeScript strict** — `any` é proibido em todo o projeto
- **Testes:** ver `.claude/rules/react-testing.md`
- **Práticas React:** ver `.claude/rules/react-practices.md`
- **Planka:** ver `.claude/rules/planka-integration.md`
- Antes de marcar qualquer tarefa como pronta: `pnpm lint && pnpm type-check && pnpm test`

---

## Skills Disponíveis

| Skill | Uso |
|---|---|
| `/proj-preflight` | Verifica pré-condições antes de começar |
| `/proj-spec <ticket-id \| cards/<id>>` | Gera spec técnica |
| `/proj-impl <ticket-id \| cards/<id>>` | Implementa spec aprovada (TDD) |
| `/proj-review <branch \| PR# \| cards/<id>>` | Revisa PR/branch |
| `/proj-e2e <ticket-id>` | Gera testes E2E Playwright |

---

## Integração com Planka (Kanban)

O projeto usa o **Planka** como board Kanban. Ao passar `cards/<id>` para qualquer skill, o Claude lê automaticamente o contexto do card e move o card entre os estágios.

**Fluxo:**

```
A Fazer  →  Em Andamento  →  Em Revisão / Teste  →  Concluído ✅
  ↑               ↑                   ↑                    ↑
/proj-spec    /proj-impl          /proj-review          aprovado
(gera spec)   (abre PR)         (review aprovado)
```

**Acessar o Planka:** http://localhost:3333
**Iniciar:** `cd ~/Documents/Projetos/planka && docker compose up -d`

### Como passar uma tarefa

1. Abra o Planka em http://localhost:3333
2. Copie o ID do card da URL (ex: `cards/1773039018078897268`)
3. Use com as skills:
   ```
   /proj-spec cards/1773039018078897268
   /proj-impl cards/1773039018078897268
   /proj-review cards/1773039018078897268
   ```

O Claude lê a descrição e comentários do card, gera a spec/plano/review, e move o card para o próximo estágio automaticamente.

---

## Convenções de Branch e Arquivos

| Artefato | Padrão |
|---|---|
| Branch (ticket normal) | `feat/<ticket-id>-<descricao>` |
| Branch (card Planka) | `feat/planka-<card-id>-<descricao>` |
| Spec | `docs/specs/planka-<card-id>-spec.md` |
| Plano | `docs/plans/planka-<card-id>-plan.md` |
| Review | `docs/reviews/feat-planka-<card-id>-review.md` |

---

## Desenvolvimento Local

```bash
# Subir infra (postgres + redis)
docker compose -f docker-compose.dev.yml up -d

# Iniciar todos os apps
pnpm dev

# Testes
pnpm test          # unit + integração
pnpm test:watch    # modo watch
pnpm lint          # ESLint
pnpm type-check    # TypeScript
pnpm build         # build completo
```

---

## Documentação Técnica

Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para:
- Diagrama de arquitetura completo
- Schema do banco (Prisma)
- Eventos Socket.io
- Fluxo completo do jogo
- Configuração do Raspberry Pi
- Roadmap em fases
