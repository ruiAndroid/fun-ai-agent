# fun-ai-agent

Fun Agent 管理前端，提供 Agent 列表展示与 Skill 提示词可视化配置。

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

- 中文化管理界面，展示可用 Agent 列表
- 大模型配置固定读取 `config/agent-config.ts`
- Skill 区域仅允许编辑提示词
- 支持本地保存提示词配置并发起 API -> plane 连通性检查
