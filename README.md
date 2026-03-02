# fun-ai-agent

Frontend console for managing and observing agent tasks.

## Tech stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Default API endpoint:

- `NEXT_PUBLIC_API_BASE_URL=/fun-agents/api`
- `NEXT_BASE_PATH=/fun-agents`

## Features

- Create task from web UI
- Stream task events with SSE
- Show task queue status and live output
- Cancel running task
