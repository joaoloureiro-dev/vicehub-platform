# 🚀 ViceHub

ViceHub is a **modular SaaS ecosystem for online gaming communities**, initially focused on GTA VI, designed to scale into a multi-game platform.

It acts as a **second screen for players**, combining social networking, progression systems, crew management, server ecosystems, real-time economy and a full digital marketplace.

---

## 🧠 Vision

To become the central platform where gaming communities interact, grow, compete and trade — all in one unified ecosystem.

---

## ⚙️ Core Features (Planned)

### 👤 Players
- XP & Level system
- Reputation & Prestige
- Badges & Achievements
- Friends & Social graph
- Activity tracking

### 🏴 Crews
- Crew progression system
- Economy & treasury
- Events & missions
- Recruitment system
- Ranking system

### 🌐 Servers
- Server profiles
- Activity tracking
- Leaderboards
- Events integration
- Community engagement metrics

### 🛒 Marketplace
- Digital services trading
- Escrow system
- Stripe Connect integration
- Reviews & reputation system

### 🎮 Events System
- Live events
- Rewards & XP distribution
- Competitive challenges
- History tracking

---

## 🏗️ Architecture

- Monorepo (npm workspaces)
- Node.js + TypeScript
- Fastify backend (planned)
- PostgreSQL + Prisma 7
- Redis for real-time systems
- BullMQ for background jobs
- Stripe for payments
- Discord API integration

---

## 🔐 Security

- JWT + Refresh Tokens
- RBAC (Role-Based Access Control)
- Soft delete + audit logs
- Rate limiting
- Input validation (Zod)

---

## 🎨 UI/UX

- Neon cyberpunk theme inspired by Vice City
- Dark mode first
- Glassmorphism HUD interface
- Mobile-first design
- Real-time dashboard experience

---

## 🛠️ Desenvolvimento

### Requisitos

- Node.js 24 ou superior
- npm 11 ou superior
- PostgreSQL (local ou Neon)

### Arranque

```bash
npm ci
cp apps/api/.env.example .env   # preencher DATABASE_URL e os segredos JWT
npm run db:generate
npm run db:migrate:dev
npm run dev
```

O `.env` é lido a partir da raiz do monorepo.

### Verificação

```bash
npm run build      # packages antes de apps, por ordem de dependência
npm run typecheck
npm run test       # não precisa de base de dados
```

Os testes usam duplos em memória em vez do Prisma, por isso correm em
qualquer máquina sem preparação. O mesmo conjunto de comandos corre no CI,
em `.github/workflows/ci.yml`.

### Nota sobre as optionalDependencies da raiz

O `package.json` da raiz declara explicitamente os binários de plataforma do
`esbuild` e do `rolldown`. **Não os remover.**

O npm só escreve no `package-lock.json` o binário da plataforma onde o
install é executado. Sem esta declaração, um lockfile gerado em Windows
deixa o `npm ci` em Linux sem os binários necessários, e o `tsx` e o
`vitest` passam a falhar no CI com um erro de módulo em falta. Declará-los
garante que o lockfile fica completo, seja gerada em que plataforma for.

Ao atualizar o `vitest` ou o `tsx`, confirmar se as versões do `esbuild` e do
`rolldown` mudaram e acertar estas versões em conformidade.

---

## 📦 Current Status

🚧 Early development stage  
✔ Database core architecture implemented  
✔ Authentication implemented: sessões validadas na base de dados, refresh
token com rotação e deteção de reutilização, cookie HttpOnly e logout global  
🚀 Gestão de utilizadores e RBAC a seguir  

---

## 📜 License

Private / Commercial (to be defined)