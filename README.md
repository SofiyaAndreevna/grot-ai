# Fullstack chat project

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express

## Run locally

Open two terminals.

1) Backend:

```bash
cd backend
npm run dev
```

2) Frontend:

```bash
cd frontend
npm run dev
```

Frontend starts on `http://localhost:5173`, backend on `http://localhost:3001`.

## API

- `POST /api/chat`
  - body: `{ "message": "text", "topic": "Topic title" }`
  - response: `{ "reply": "..." }`
