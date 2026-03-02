# fun-ai-agent

用于管理智能体工作流配置与技能提示词模板的前端控制台。

## 技术栈

- Next.js（App Router）
- TypeScript
- Tailwind CSS + shadcn/ui

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

默认接口配置：

- `NEXT_PUBLIC_API_BASE_URL=/fun-agents/api`
- `NEXT_BASE_PATH=/fun-agents`

## 当前能力

- 结构层可视化：`智能体 -> 工作流 -> 技能`
- 工作流级模型配置展示与选择
- 技能提示词模板可视化编辑（本地存储）
- 从前端发起到 plane 的连通性检查请求，包含：
  - `agent_id`
  - `workflow_id`
  - `skill_prompt_override`
  - `prompt`

## 配置来源

静态配置定义在：

- `config/agent-config.ts`

文件包含：

- 智能体元数据
- 工作流定义（绑定技能与模型）
- 技能提示词模板
