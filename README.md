# fun-ai-agent

Frontend admin console for managing agent workflow config and skill prompt templates.

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

## Current capabilities

- Structure layer visualization: `Agent -> Workflows -> Skills`
- Workflow-level model profile display and selection context
- Skill prompt template editing with local persistence (`localStorage`)
- Connectivity check request to plane using:
  - `agent_id`
  - `workflow_id`
  - `skill_prompt_override`
  - `prompt`

## Config source

Static config is defined in:

- `config/agent-config.ts`

This file includes:

- Agent metadata
- Workflow definitions (bind skill + model profile)
- Skill prompt templates
