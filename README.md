# fun-ai-agent

Frontend management console for agent catalog and skill policy configuration.

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

- Show available agents with status and ownership metadata
- Visual configuration editor for each agent's skills
- Save config to browser local storage and export JSON
- Trigger API -> plane connectivity check from selected agent profile
