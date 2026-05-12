# Azimute — Documentação de Arquitetura

> Sistema de quiz interativo para viagens escolares. Inspirado no Kahoot, otimizado para rodar offline em Raspberry Pi via rede WiFi local.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Estrutura de Monorepo](#4-estrutura-de-monorepo)
5. [Frontend — Estrutura Detalhada](#5-frontend--estrutura-detalhada)
6. [Backend — Estrutura Detalhada](#6-backend--estrutura-detalhada)
7. [Banco de Dados — Schema](#7-banco-de-dados--schema)
8. [Comunicação em Tempo Real](#8-comunicação-em-tempo-real)
9. [Fluxo do Jogo](#9-fluxo-do-jogo)
10. [Telas e Responsabilidades](#10-telas-e-responsabilidades)
11. [Considerações para Raspberry Pi](#11-considerações-para-raspberry-pi)
12. [Segurança](#12-segurança)
13. [Docker & Ambientes](#13-docker--ambientes)
14. [Roadmap — Fases](#14-roadmap--fases)

---

## 1. Visão Geral

O **Azimute** é uma plataforma de quiz gamificado para viagens escolares. Professores criam quizzes com perguntas sobre o destino da viagem (história, geografia, cultura), e os alunos competem em tempo real pelo celular durante o trajeto ou na chegada ao local.

### Capacidade e Contexto

| Parâmetro | Valor |
|---|---|
| Alunos simultâneos por sessão | até 45 |
| Infraestrutura alvo | Raspberry Pi 4 (2–4 GB RAM) |
| Conectividade | WiFi local gerado pelo Raspberry Pi (offline-first) |
| Tipos de mídia suportados | texto, imagem (JPG/PNG/WebP), vídeo (MP4) |
| Idioma do código | Inglês (obrigatório) |
| Idioma desta documentação | Português |

---

## 2. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                     Raspberry Pi 4                          │
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Next.js    │    │  Express.js  │    │  PostgreSQL  │  │
│  │  (web)      │◄──►│  API + WS    │◄──►│  (database)  │  │
│  │  :3000      │    │  :4000       │    │  :5432       │  │
│  └─────────────┘    └──────┬───────┘    └──────────────┘  │
│                            │                               │
│                     ┌──────▼───────┐                       │
│                     │    Redis     │                       │
│                     │  (sessions)  │                       │
│                     │  :6379       │                       │
│                     └──────────────┘                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Nginx (reverse proxy)  :80             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└───────────────────────────┬─────────────────────────────────┘
                            │ WiFi AP (hostapd)
                   ─────────┴─────────
                   │                 │
              📱 Aluno 1       📱 Aluno N
              (responder)      (responder)
                            📺 Projetor
                            (display)
```

### Componentes

| Componente | Tecnologia | Porta | Responsabilidade |
|---|---|---|---|
| Web App | Next.js 15 (App Router) | 3000 | UI do professor, aluno e display |
| API + WebSocket | Express.js v5 + Socket.io | 4000 | REST API + eventos em tempo real |
| Banco de Dados | PostgreSQL 16 | 5432 | Persistência de quizzes, usuários, sessões |
| Cache / PubSub | Redis 7 | 6379 | Estado da partida em tempo real, sessões |
| Proxy Reverso | Nginx | 80 | Roteamento, compressão, HTTPS (futuro) |

---

## 3. Stack Tecnológico

### Frontend (`apps/web`)

| Categoria | Tecnologia | Justificativa |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR/SSG, roteamento de layouts, Server Components |
| Estilo | Tailwind CSS v4 + shadcn/ui | Componentes acessíveis, customizáveis e rápidos |
| Estado assíncrono | TanStack Query v5 | Cache de dados, sincronização, loading/error states |
| Estado global | Zustand | Simples e performático para estado do jogo no cliente |
| Validação | Zod | Schemas compartilháveis com o backend |
| Testes | Vitest + React Testing Library | Ver `.claude/rules/react-testing.md` |
| WebSocket client | Socket.io-client | Eventos em tempo real |

### Backend (`apps/api`)

| Categoria | Tecnologia | Justificativa |
|---|---|---|
| Runtime | Node.js 22 LTS | Melhor suporte a ESM, performance |
| Framework HTTP | Express.js v5 | Estável, leve, adequado para Raspberry Pi |
| ORM | Prisma 6 | Type-safe, migrations, compatível com PostgreSQL |
| Geração de tipos | zod-prisma-types | Gera schemas Zod a partir do Prisma schema |
| Validação | Zod | Validação de request/response + tipos compartilhados |
| Autenticação | Auth.js v5 (NextAuth) | Sessions para professores; alunos entram com PIN |
| Cache / PubSub | ioredis | Cliente Redis para estado de partida e pub/sub |
| WebSocket | Socket.io v4 | Eventos bidirecionais em tempo real |
| Senhas | Argon2 | Hashing seguro (melhor que bcrypt) |
| Segurança HTTP | Helmet | Headers de segurança padrão |
| CORS | cors | Controle de origem entre web e API |
| Documentação API | swagger-jsdoc + swagger-ui-express | OpenAPI 3.1 auto-gerada |
| Testes | Vitest | Unit + integração |

---

## 4. Estrutura de Monorepo

```
azimute/                          # raiz do monorepo
├── apps/
│   ├── web/                      # Next.js frontend
│   │   └── Dockerfile            # build multi-stage (turbo prune + standalone)
│   └── api/                      # Express.js backend
│       └── Dockerfile            # build multi-stage (turbo prune + Prisma)
├── packages/
│   └── shared/                   # tipos e schemas Zod compartilhados
├── infra/
│   ├── nginx/
│   │   └── nginx.conf            # reverse proxy (web + api + socket.io + uploads)
│   └── raspberry/                # scripts de setup do Raspberry Pi (hostapd, dnsmasq)
├── docs/
│   └── ARCHITECTURE.md           # este documento
├── docker-compose.yml            # PRODUÇÃO: todos os serviços containerizados
├── docker-compose.dev.yml        # DEV: apenas postgres + redis (apps rodam nativamente)
├── .dockerignore
├── .env.example
├── pnpm-workspace.yaml
├── turbo.json                    # Turborepo (build pipeline)
└── package.json
```

### Por que monorepo?

- Compartilhamento de tipos (`packages/shared`) entre frontend e backend sem duplicação
- Um único `pnpm install` para subir tudo
- Turborepo otimiza builds em paralelo e cache

---

## 5. Frontend — Estrutura Detalhada

```
apps/web/
├── public/
│   └── assets/                   # imagens estáticas, ícones
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # layout raiz (fontes, providers)
│   │   ├── page.tsx              # landing page (/)
│   │   ├── (auth)/               # grupo: rotas de autenticação
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/          # grupo: área do professor (autenticada)
│   │   │   ├── layout.tsx        # sidebar + header do dashboard
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx      # visão geral dos quizzes
│   │   │   └── quizzes/
│   │   │       ├── page.tsx      # lista de quizzes
│   │   │       ├── create/
│   │   │       │   └── page.tsx  # criar novo quiz
│   │   │       └── [id]/
│   │   │           ├── page.tsx  # editar quiz
│   │   │           └── host/
│   │   │               └── page.tsx  # tela de host (lobby + controle)
│   │   ├── game/
│   │   │   ├── join/
│   │   │   │   └── page.tsx      # aluno digita o PIN / aponta QR Code
│   │   │   ├── play/
│   │   │   │   └── [pin]/
│   │   │   │       └── page.tsx  # tela do aluno (responder perguntas)
│   │   │   └── display/
│   │   │       └── [pin]/
│   │   │           └── page.tsx  # tela de projeção (perguntas + placar)
│   │   └── api/                  # Next.js route handlers (Auth.js callbacks)
│   │       └── auth/
│   │           └── [...nextauth]/
│   │               └── route.ts
│   ├── components/
│   │   ├── ui/                   # shadcn/ui (gerados pelo CLI, não editar manualmente)
│   │   ├── game/                 # componentes específicos do jogo
│   │   │   ├── AnswerButton.tsx
│   │   │   ├── QuestionCard.tsx
│   │   │   ├── Leaderboard.tsx
│   │   │   ├── CountdownTimer.tsx
│   │   │   ├── ScoreBar.tsx
│   │   │   └── WaitingLobby.tsx
│   │   ├── quiz/                 # componentes de edição de quiz
│   │   │   ├── QuestionForm.tsx
│   │   │   ├── AnswerOptionForm.tsx
│   │   │   └── MediaUpload.tsx
│   │   └── shared/               # componentes transversais
│   │       ├── QRCodeDisplay.tsx
│   │       ├── AvatarSelector.tsx
│   │       └── ErrorBoundary.tsx
│   ├── features/                 # lógica de domínio por feature
│   │   ├── auth/
│   │   │   ├── hooks/
│   │   │   │   └── useSession.ts
│   │   │   └── api/
│   │   │       └── auth.api.ts
│   │   ├── quiz/
│   │   │   ├── hooks/
│   │   │   │   ├── useQuizzes.ts
│   │   │   │   └── useQuizEditor.ts
│   │   │   ├── api/
│   │   │   │   └── quiz.api.ts
│   │   │   └── types/
│   │   │       └── quiz.types.ts
│   │   └── game/
│   │       ├── hooks/
│   │       │   ├── useGameSocket.ts     # gerencia conexão Socket.io
│   │       │   ├── useHostGame.ts       # lógica do professor host
│   │       │   └── usePlayerGame.ts    # lógica do aluno
│   │       ├── stores/
│   │       │   └── game.store.ts       # Zustand: estado local do jogo
│   │       └── api/
│   │           └── game.api.ts
│   ├── hooks/                    # hooks compartilhados
│   │   └── useMediaQuery.ts
│   ├── lib/
│   │   ├── api-client.ts         # instância axios/fetch + interceptors
│   │   ├── socket.ts             # instância Socket.io-client
│   │   └── query-client.ts      # configuração TanStack Query
│   ├── stores/                   # Zustand stores globais
│   │   └── ui.store.ts
│   ├── types/                    # tipos TypeScript do frontend
│   │   └── index.ts
│   ├── constants/
│   │   ├── routes.ts
│   │   └── game.ts               # duração de rodadas, pontuações etc.
│   └── test/
│       ├── setup.ts
│       └── test-utils.tsx
├── .env.local
├── next.config.ts
├── tailwind.config.ts
├── vitest.config.ts
└── tsconfig.json
```

---

## 6. Backend — Estrutura Detalhada

```
apps/api/
├── prisma/
│   ├── schema.prisma             # definição do banco de dados
│   ├── migrations/               # histórico de migrations
│   └── seed.ts                   # dados iniciais
├── src/
│   ├── app.ts                    # configuração do Express (middlewares globais)
│   ├── server.ts                 # entrypoint: HTTP + Socket.io
│   ├── config/
│   │   ├── env.ts                # validação de variáveis de ambiente com Zod
│   │   ├── database.ts           # instância do Prisma Client
│   │   └── redis.ts              # instância do ioredis
│   ├── modules/                  # domínios da aplicação
│   │   ├── auth/
│   │   │   ├── auth.router.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.schemas.ts   # Zod schemas de request/response
│   │   ├── user/
│   │   │   ├── user.router.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── user.service.ts
│   │   │   └── user.schemas.ts
│   │   ├── quiz/
│   │   │   ├── quiz.router.ts
│   │   │   ├── quiz.controller.ts
│   │   │   ├── quiz.service.ts
│   │   │   └── quiz.schemas.ts
│   │   ├── question/
│   │   │   ├── question.router.ts
│   │   │   ├── question.controller.ts
│   │   │   ├── question.service.ts
│   │   │   └── question.schemas.ts
│   │   ├── media/
│   │   │   ├── media.router.ts
│   │   │   ├── media.controller.ts
│   │   │   ├── media.service.ts   # upload local (Raspberry) ou S3 (cloud)
│   │   │   └── media.schemas.ts
│   │   └── game/
│   │       ├── game.router.ts
│   │       ├── game.controller.ts
│   │       ├── game.service.ts    # lógica de negócio da partida
│   │       ├── game.schemas.ts
│   │       └── game.socket.ts     # handlers Socket.io por evento
│   ├── shared/
│   │   ├── middleware/
│   │   │   ├── authenticate.ts    # verifica JWT/session
│   │   │   ├── validate.ts        # middleware genérico Zod
│   │   │   ├── error-handler.ts   # handler global de erros Express v5
│   │   │   └── rate-limiter.ts    # express-rate-limit
│   │   ├── errors/
│   │   │   ├── AppError.ts        # classe base de erro tipado
│   │   │   └── http-errors.ts     # NotFound, Unauthorized, BadRequest...
│   │   └── utils/
│   │       ├── pin-generator.ts   # gera PIN de 6 dígitos único
│   │       ├── qrcode.ts          # gera QR Code como base64
│   │       └── scoring.ts        # lógica de pontuação por tempo
│   ├── infrastructure/
│   │   ├── database/
│   │   │   └── prisma.ts          # singleton do PrismaClient
│   │   ├── cache/
│   │   │   ├── redis.ts           # singleton do ioredis
│   │   │   └── game-state.cache.ts  # get/set do estado do jogo no Redis
│   │   └── socket/
│   │       ├── socket-server.ts   # inicialização do Socket.io + namespaces
│   │       └── socket-auth.ts     # middleware de autenticação do socket
│   ├── docs/
│   │   └── openapi.ts            # configuração swagger-jsdoc
│   └── types/
│       └── express.d.ts          # extensão de tipos do Express (req.user)
├── .env
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Padrão de Módulo

Cada módulo segue a camada `router → controller → service`:

```
router       — define rotas e aplica middlewares (validate, authenticate)
controller   — extrai dados do request, chama service, formata response
service      — lógica de negócio pura, acessa Prisma/Redis
schemas      — Zod schemas de entrada e saída (validação + OpenAPI types)
```

---

## 7. Banco de Dados — Schema

```prisma
// packages/shared ou prisma/schema.prisma

model User {
  id           String      @id @default(cuid())
  name         String
  email        String      @unique
  passwordHash String
  role         Role        @default(TEACHER)
  quizzes      Quiz[]
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
}

model Quiz {
  id          String      @id @default(cuid())
  title       String
  description String?
  coverImage  String?     // path/URL da imagem de capa
  isPublished Boolean     @default(false)
  author      User        @relation(fields: [authorId], references: [id])
  authorId    String
  questions   Question[]
  sessions    GameSession[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model Question {
  id            String         @id @default(cuid())
  quiz          Quiz           @relation(fields: [quizId], references: [id], onDelete: Cascade)
  quizId        String
  text          String
  mediaType     MediaType?     // IMAGE | VIDEO | null
  mediaUrl      String?        // path/URL da mídia
  timeLimitSecs Int            @default(30)
  points        Int            @default(1000)
  order         Int
  options       AnswerOption[]
  gameAnswers   GameAnswer[]
}

model AnswerOption {
  id         String     @id @default(cuid())
  question   Question   @relation(fields: [questionId], references: [id], onDelete: Cascade)
  questionId String
  text       String
  isCorrect  Boolean
  color      OptionColor // RED | BLUE | YELLOW | GREEN (estética Kahoot)
  order      Int
}

model GameSession {
  id           String          @id @default(cuid())
  quiz         Quiz            @relation(fields: [quizId], references: [id])
  quizId       String
  pin          String          @unique  // 6 dígitos
  status       SessionStatus   @default(LOBBY)
  currentQuestionIndex Int     @default(0)
  participants GameParticipant[]
  answers      GameAnswer[]
  startedAt    DateTime?
  endedAt      DateTime?
  createdAt    DateTime        @default(now())
}

model GameParticipant {
  id        String      @id @default(cuid())
  session   GameSession @relation(fields: [sessionId], references: [id])
  sessionId String
  nickname  String
  avatarId  String      // ID do avatar selecionado
  score     Int         @default(0)
  answers   GameAnswer[]
  joinedAt  DateTime    @default(now())

  @@unique([sessionId, nickname])
}

model GameAnswer {
  id            String          @id @default(cuid())
  session       GameSession     @relation(fields: [sessionId], references: [id])
  sessionId     String
  participant   GameParticipant @relation(fields: [participantId], references: [id])
  participantId String
  question      Question        @relation(fields: [questionId], references: [id])
  questionId    String
  optionId      String          // ID da AnswerOption escolhida
  isCorrect     Boolean
  pointsEarned  Int
  answeredInMs  Int             // tempo de resposta em milissegundos
  answeredAt    DateTime        @default(now())

  @@unique([participantId, questionId])
}

enum Role         { TEACHER ADMIN }
enum SessionStatus { LOBBY ACTIVE QUESTION REVEAL LEADERBOARD FINISHED }
enum MediaType    { IMAGE VIDEO }
enum OptionColor  { RED BLUE YELLOW GREEN }
```

---

## 8. Comunicação em Tempo Real

### Namespaces Socket.io

| Namespace | Usuário | Propósito |
|---|---|---|
| `/game` | host + alunos + display | Todos os eventos da partida |

### Eventos: Host → Server

| Evento | Payload | Ação |
|---|---|---|
| `game:start` | `{ pin }` | Inicia a partida, sai do lobby |
| `game:next-question` | `{ pin }` | Avança para próxima pergunta |
| `game:reveal-answers` | `{ pin }` | Revela respostas da rodada atual |
| `game:show-leaderboard` | `{ pin }` | Exibe top 3 da rodada |
| `game:end` | `{ pin }` | Encerra a partida |

### Eventos: Aluno → Server

| Evento | Payload | Ação |
|---|---|---|
| `player:join` | `{ pin, nickname, avatarId }` | Entra no lobby |
| `player:answer` | `{ pin, questionId, optionId, answeredInMs }` | Submete resposta |

### Eventos: Server → Clientes

| Evento | Destino | Payload |
|---|---|---|
| `session:player-joined` | host + display | `{ nickname, avatarId, totalPlayers }` |
| `session:question-start` | todos | `{ question, timeLimit, questionIndex, totalQuestions }` |
| `session:timer-tick` | todos | `{ remaining }` |
| `session:answer-received` | host | `{ totalAnswered, totalPlayers }` |
| `session:answers-revealed` | todos | `{ correctOptionId, stats }` |
| `session:leaderboard` | todos | `{ top3, playerRank, playerScore }` |
| `session:ended` | todos | `{ finalLeaderboard }` |
| `session:error` | remetente | `{ message }` |

### Estado no Redis

O estado "vivo" da partida fica no Redis (TTL de 4 horas) para não sobrecarregar o PostgreSQL com escritas a cada tick:

```
game:session:{pin}          → JSON do estado atual (status, currentQuestionIndex, startedAt)
game:answers:{pin}:{qId}    → Hash { participantId: optionId } — respostas da rodada
game:scores:{pin}           → Sorted Set — ranking em tempo real
```

---

## 9. Fluxo do Jogo

```
Professor                           Aluno                        Display
────────────────────────────────────────────────────────────────────────
1. Cria quiz no dashboard
2. Clica em "Iniciar Partida"
   ← PIN gerado (ex: 482915)
   ← QR Code exibido na tela
                                3. Aponta câmera / digita PIN
                                4. Escolhe nickname + avatar
                                   → player:join
                                                             5. Exibe PIN + avatares chegando
6. Vê lobby com alunos
7. Clica "Começar"
   → game:start
   ← session:question-start     ← session:question-start    ← session:question-start
   (vê contagem de respostas)   (vê pergunta + 4 opções)    (projeção da pergunta)
                                8. Toca uma opção
                                   → player:answer
                                   ← feedback instantâneo
                                   (certo ✓ / errado ✗)
9. Clica "Revelar"
   → game:reveal-answers        ← session:answers-revealed  ← session:answers-revealed
10. Clica "Ver Placar"
    → game:show-leaderboard     ← session:leaderboard       ← session:leaderboard
    (top 3 da rodada)           (posição do aluno)          (top 3 animado)
11. Próxima pergunta...
    (repete 7–10)
12. Clica "Encerrar"
    → game:end                  ← session:ended             ← session:ended
                                (placar final)              (pódio final)
```

### Pontuação

Inspirado no Kahoot: quanto mais rápido a resposta correta, mais pontos.

```
pontos = points_base × (time_limit - answered_in_ms) / time_limit
pontos mínimos = points_base × 0.5  (resposta nos últimos 50% do tempo)
resposta errada = 0 pontos
```

---

## 10. Telas e Responsabilidades

### Professor — Host (`/quizzes/[id]/host`)

- Exibe PIN da sessão + QR Code para os alunos escanearem
- Lobby: lista de participantes em tempo real
- Durante o quiz: botões "Próxima Pergunta", "Revelar", "Ver Placar", "Encerrar"
- Mostra contagem de quantos alunos já responderam

### Aluno — Play (`/game/play/[pin]`)

- Tela de entrada: digitar nickname + escolher avatar
- Tela de espera no lobby (aguardando professor iniciar)
- Tela de pergunta: exibe texto + mídia + 4 botões coloridos (apenas cores/ícones, sem texto — igual ao Kahoot)
- Feedback pós-resposta: certo/errado + pontos ganhos
- Placar após cada rodada: "Você está em Xº lugar"

### Display — Projeção (`/game/display/[pin]`)

- Sem interação, apenas exibição
- Exibe PIN + QR Code no lobby
- Projeção da pergunta com countdown visual
- Revelar respostas com barra de porcentagem por opção
- Top 3 animado após cada rodada
- Pódio final com confetes

### Dashboard — Professor

- `GET /dashboard` — visão geral (total de quizzes, sessões recentes)
- `GET /quizzes` — lista de quizzes com ações
- `GET /quizzes/create` — formulário de criação
- `GET /quizzes/[id]` — editor de perguntas (drag-and-drop para reordenar)

---

## 11. Considerações para Raspberry Pi

### Hardware Recomendado

- Raspberry Pi 4 Model B (4 GB RAM)
- Cartão SD de 32 GB (Classe 10 / A2)
- Adaptador WiFi USB extra (um para internet, um como AP) — opcional se usar cabo ethernet para internet

### Configuração de Rede

O Raspberry Pi atua como Access Point WiFi usando `hostapd` + `dnsmasq`:

```
SSID: Azimute-Viagem
Senha: azimute2025
IP do Raspberry: 192.168.4.1
Range DHCP: 192.168.4.2 – 192.168.4.50  (suporta 48 dispositivos)
```

Alunos acessam: `http://192.168.4.1` → Nginx redireciona para o Next.js.

### Limites e Otimizações

| Recurso | Limite | Estratégia |
|---|---|---|
| RAM total | ~3 GB disponível | Node.js com `--max-old-space-size=512` por processo |
| Conexões WS simultâneas | 50 (45 alunos + host + display) | Socket.io lida tranquilamente |
| Uploads de mídia | Armazenamento local (`/uploads`) | Limite de 50 MB por vídeo, 5 MB por imagem |
| PostgreSQL | leve para 45 usuários | Pool de conexões Prisma: máx 10 |
| Redis | modo single-instance | Sem cluster, TTL conservador |

### Deploy no Raspberry Pi

```bash
# infra/raspberry/setup.sh
# 1. Instalar Node.js 22, PostgreSQL 16, Redis 7, Nginx
# 2. Configurar hostapd + dnsmasq para o AP WiFi
# 3. pm2 para manter os processos rodando
# 4. pnpm install && pnpm build && pnpm start
```

---

## 12. Segurança

| Risco | Mitigação |
|---|---|
| Acesso não autorizado ao dashboard | Auth.js (JWT/session) + middleware `authenticate` |
| Aluno entrando com PIN de outra sessão | PIN válido apenas enquanto sessão estiver em `LOBBY` ou `ACTIVE` |
| Flood de eventos WebSocket | Rate limiting por socket (10 eventos/segundo por conexão) |
| Injeção de dados | Zod valida 100% dos inputs no controller |
| Headers HTTP | Helmet (CSP, HSTS, X-Frame-Options etc.) |
| Senhas | Argon2id (custo mínimo: tempo=3, memória=64MB) |
| CORS | Apenas origem do Next.js permitida na API |
| Upload de arquivos | Validação de MIME type + tamanho máximo + nome sanitizado |

---

## 13. Docker & Ambientes

O projeto usa **dois contextos Docker distintos** para não forçar o desenvolvedor a reconstruir imagens a cada mudança de código em desenvolvimento.

### Dois arquivos Compose

| Arquivo | Uso | Serviços |
|---|---|---|
| `docker-compose.dev.yml` | Desenvolvimento local | `postgres`, `redis`, `pgadmin` (opcional) |
| `docker-compose.yml` | Produção / Raspberry Pi | todos os 5 serviços |

### Ambiente de Desenvolvimento

As aplicações (`web` e `api`) rodam **nativamente** via `pnpm dev` para hot reload. Apenas a infraestrutura (PostgreSQL + Redis) sobe via Docker.

```bash
# Subir infra
docker compose -f docker-compose.dev.yml up -d

# Subir pgAdmin (opcional, para inspecionar o banco)
docker compose -f docker-compose.dev.yml --profile tools up -d

# Iniciar as aplicações (em terminais separados ou com Turborepo)
pnpm dev
```

Variáveis relevantes para desenvolvimento (em `.env`):
```
DATABASE_URL=postgresql://azimute:azimute_dev@localhost:5432/azimute_db
REDIS_URL=redis://localhost:6379
```

### Ambiente de Produção (Raspberry Pi)

Todos os serviços sobem containerizados. O Nginx resolve o roteamento interno via DNS do Docker Compose (nomes de serviço como `web:3000`, `api:4000`).

```bash
# Construir imagens e subir tudo
docker compose up -d --build

# Ver logs
docker compose logs -f api web

# Parar tudo
docker compose down

# Destruir volumes (apaga banco e uploads — cuidado)
docker compose down -v
```

Variáveis relevantes para produção (em `.env`):
```
DATABASE_URL=postgresql://azimute:<senha>@postgres:5432/azimute_db
REDIS_URL=redis://redis:6379
NEXTAUTH_URL=http://192.168.4.1
NEXT_PUBLIC_API_URL=http://192.168.4.1/api
NEXT_PUBLIC_WS_URL=http://192.168.4.1
```

### Estratégia de Build — Turborepo Prune

Ambos os Dockerfiles usam `turbo prune` na primeira etapa. Isso isola apenas os arquivos necessários para o app alvo (ex: `@azimute/api`), eliminando código do frontend do contexto de build da API e vice-versa. Resultado: imagens menores e build mais rápido.

```
Stage 1 (pruner)    → turbo prune @azimute/api  →  isolates api + shared
Stage 2 (installer) → pnpm install --frozen-lockfile
Stage 3 (builder)   → prisma generate + tsc build
Stage 4 (runner)    → imagem mínima de produção
```

### Roteamento Nginx

| Rota | Destino | Observação |
|---|---|---|
| `/uploads/*` | volume Docker `uploads` (direto) | Servido pelo Nginx — não passa pelo Node.js |
| `/socket.io/*` | `api:4000` | `Upgrade: websocket` + `Connection: upgrade` + timeout 2h |
| `/api/*` | `api:4000` | Timeout curto (30s) — chamadas REST |
| `/*` | `web:3000` | Next.js com suporte a SSE (RSC streaming) |

### Redes Docker

| Rede | Tipo | Membros |
|---|---|---|
| `internal` | bridge (isolada) | `postgres`, `redis`, `api`, `web` |
| `external` | bridge (pública) | `nginx` (único serviço com porta exposta) |

O Nginx é o **único ponto de entrada** exposto na porta 80. Os demais serviços ficam na rede `internal` e são inacessíveis diretamente de fora do container.

### Limites de Memória (Raspberry Pi 4 — 4 GB)

| Serviço | Limite | Justificativa |
|---|---|---|
| `postgres` | 256 MB | Banco leve para até 45 usuários |
| `redis` | 128 MB | `maxmemory 128mb` + política `allkeys-lru` |
| `api` | 512 MB | Node.js com `--max-old-space-size=512` |
| `web` | 512 MB | Next.js standalone |
| `nginx` | 32 MB | Proxy puro |
| **Total** | **~1,44 GB** | Sobra ~1,5 GB para o SO + headroom |

### Next.js — Configuração Obrigatória para Docker

O `apps/web/Dockerfile` depende do modo standalone do Next.js. Adicionar em `apps/web/next.config.ts`:

```typescript
const nextConfig = {
  output: 'standalone',
  // ...demais configurações
}
```

Sem isso, o build do container falhará ao tentar copiar `.next/standalone`.

### Volumes Persistentes

| Volume | Conteúdo | Backup |
|---|---|---|
| `postgres_data` | Todo o banco de dados | **Crítico** — fazer backup regular |
| `redis_data` | Estado do Redis (TTL 4h) | Descartável — Redis se recupera sozinho |
| `uploads` | Imagens e vídeos das perguntas | **Importante** — mídia dos quizzes |

Para backup no Raspberry Pi:
```bash
# Backup do banco
docker exec azimute-postgres-1 pg_dump -U azimute azimute_db > backup_$(date +%Y%m%d).sql

# Backup dos uploads
tar -czf uploads_$(date +%Y%m%d).tar.gz $(docker volume inspect azimute_uploads --format '{{.Mountpoint}}')
```

---

## 14. Roadmap — Fases

### Fase 1 — MVP (core funcional)

- [ ] Setup do monorepo (pnpm workspaces + Turborepo)
- [ ] Backend: CRUD de usuários + quizzes + perguntas
- [ ] Backend: engine do jogo (WebSocket + Redis)
- [ ] Frontend: dashboard (criar/editar quiz)
- [ ] Frontend: tela host + tela do aluno + display
- [ ] Integração completa de uma partida com texto simples
- [ ] Deploy básico no Raspberry Pi

### Fase 2 — Mídia e Polimento

- [ ] Upload de imagens nas perguntas
- [ ] Upload de vídeos (MP4, com player inline)
- [ ] Animações e transições (Framer Motion)
- [ ] Top 3 animado com confetes
- [ ] QR Code para entrada dos alunos

### Fase 3 — Experiência e Histórico

- [ ] Histórico de partidas no dashboard
- [ ] Relatório por sessão (acertos por pergunta, tempo médio)
- [ ] Modo "pré-carregar mídia" nos dispositivos antes da partida (evitar lag)
- [ ] Suporte a múltiplas sessões simultâneas (turmas diferentes)

### Fase 4 — Cloud (opcional)

- [ ] Deploy em VPS/cloud para uso online
- [ ] CDN para mídia
- [ ] Convite de professores por organização (escola)

---

*Documento gerado em: 2026-05-11 | Versão: 1.1.0 (Docker adicionado)*
