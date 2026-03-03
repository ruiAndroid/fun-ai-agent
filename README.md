# fun-ai-agent

Frontend console for configuring agent workflows and running storyboard tests.

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

Default env values:

- `NEXT_PUBLIC_API_BASE_URL=/fun-agents/api`
- `NEXT_BASE_PATH=/fun-agents`

## Current capabilities

- Agent/workflow/skill configuration view
- Workflow model selection UI
- Skill prompt editing with local storage persistence
- Storyboard test entry:
  - input script text
  - create task by selected workflow
  - stream execution logs (`step_started` / `step_completed` etc.)
  - stream final output token-by-token

## API request fields used by frontend

`POST /v1/tasks`

- `tenant_id`
- `agent_id`
- `workflow_id`
- `skill_id` (optional, backward compatibility)
- `skill_prompt_override` (optional, backward compatibility)
- `skill_prompt_overrides` (recommended, per-skill prompt map)
- `prompt`
- `idempotency_key`

## Static config source

- `config/agent-config.ts`
