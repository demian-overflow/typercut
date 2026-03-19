# lernpunkt

AI-powered speed typing practice. Pick a topic, Claude generates the text, you type it.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 19 + TypeScript + Vite + Tailwind |
| Backend  | Rust + Axum |
| Auth     | Google OAuth 2.0 + JWT |
| Database | PostgreSQL + SeaORM |
| AI       | Anthropic Claude (claude-opus-4-6) |

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- A Google OAuth client — [create one here](https://console.cloud.google.com/apis/credentials)
  - Set authorized redirect URI to `http://localhost:3001/auth/google/callback`
- An [Anthropic API key](https://console.anthropic.com/)

---

## Setup

### 1. Backend env

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```
DATABASE_URL=postgres://lernpunkt:lernpunkt@localhost:5432/lernpunkt
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
JWT_SECRET=$(openssl rand -hex 32)
```

### 2. Frontend env

```bash
cp frontend/.env.local.example frontend/.env.local
```

Edit `frontend/.env.local`:

```
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_API_URL=http://localhost:3001
```

---

## Running (Docker — recommended)

Starts PostgreSQL, the Rust backend, and the Vite dev server together with hot reload:

```bash
docker compose -f docker-compose.dev.yaml up --build
```

| Service  | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:3001 |

**First startup is slow** — Rust compiles ~280 crates. Subsequent starts are fast (build cache is persisted in a Docker volume).

Stop everything:

```bash
docker compose -f docker-compose.dev.yaml down
```

---

## Running (local, without Docker)

### Database only

```bash
docker compose up -d   # starts PostgreSQL on port 5432
```

### Backend

```bash
cd backend
cargo run
```

Migrations run automatically on startup.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Project structure

```
lernpunkt/
├── backend/                  Rust/Axum API server
│   ├── src/
│   │   ├── auth/             Google OAuth + JWT
│   │   ├── db/               SeaORM queries
│   │   ├── entity/           SeaORM entities (mirrors DB schema)
│   │   └── config.rs         Env-based config
│   ├── migrations/           Raw SQL migration files
│   └── .env.example
│
├── frontend/                 React + Vite app
│   ├── src/
│   │   ├── auth/             AuthContext, LoginPage, callback hook
│   │   ├── components/       SpeedTyper, TextGenerator, ResultsPanel
│   │   └── lib/              auth.ts, textGenerator.ts (Anthropic)
│   └── .env.local.example
│
├── docker-compose.yaml       PostgreSQL only
├── docker-compose.dev.yaml   Full dev stack (db + backend + frontend)
└── SPEC.md                   Product spec
```

---

## Auth flow

```
Browser → GET /auth/google
        → redirect to Google consent
        → Google redirects to /auth/google/callback?code=...
        → backend upserts user in DB, mints JWT
        → redirect to frontend/?token=<jwt>
        → frontend stores token in localStorage
```

Subsequent requests include `Authorization: Bearer <token>`.

---

## Adding npm packages

```bash
docker compose -f docker-compose.dev.yaml exec frontend npm install <package>
```
