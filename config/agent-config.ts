export type AgentStatus = "ONLINE" | "DEGRADED" | "OFFLINE";

export type SkillConfig = {
  id: string;
  name: string;
  promptTemplate: string;
};

export type WorkflowConfig = {
  id: string;
  name: string;
  description: string;
  modelProfile: string;
};

export type AgentConfig = {
  id: string;
  name: string;
  owner: string;
  status: AgentStatus;
  description: string;
  defaultWorkflowId: string;
  workflows: WorkflowConfig[];
  skills: SkillConfig[];
};

export const DEFAULT_AGENT_CONFIGS: AgentConfig[] = [
  {
    id: "dreamworks-storyboard",
    name: "梦工厂-智能分镜",
    owner: "dreamworks",
    status: "ONLINE",
    description: "支持按工作流选择模型并按技能维护提示词的智能分镜智能体。",
    defaultWorkflowId: "episode-split",
    workflows: [
      {
        id: "episode-split",
        name: "剧本智能分集",
        description: "将剧本拆分为分集级别的分镜规划结果。",
        modelProfile: "mock-default",
      },
      {
        id: "extract-roles",
        name: "提取分集角色",
        description: "从剧本文本中提取关键角色和候选角色信息。",
        modelProfile: "openai-gpt-4o-mini",
      },
    ],
    skills: [
      {
        id: "storyboard-episode-split",
        name: "分镜-剧本分集",
        promptTemplate:
          "你是一名专业分镜策划，请把剧本拆分为多集，并给出每集开场钩子、核心冲突、结尾悬念与场景分配。",
      },
      {
        id: "storyboard-extract-roles",
        name: "分镜-角色提取",
        promptTemplate:
          "请从剧本中提取核心角色，输出角色名称与简短角色定位描述。",
      },
    ],
  },
];
