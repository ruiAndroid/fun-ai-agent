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
    description: "剧本分镜智能体，支持串行流程：剧本智能分集 -> 提取分镜角色。",
    defaultWorkflowId: "storyboard-pipeline",
    workflows: [
      {
        id: "storyboard-pipeline",
        name: "剧本分镜全流程",
        description: "先分集，再基于分集结果提取角色。",
        modelProfile: "mock-default",
      },
      {
        id: "episode-split-only",
        name: "仅剧本分集",
        description: "只执行剧本智能分集。",
        modelProfile: "mock-default",
      },
      {
        id: "extract-roles-only",
        name: "仅角色提取",
        description: "只执行角色提取。",
        modelProfile: "mock-default",
      },
    ],
    skills: [
      {
        id: "storyboard-episode-split",
        name: "剧本分集",
        promptTemplate:
          "你是专业分镜策划，请将输入剧本拆分为分集规划，给出每集开场钩子、核心冲突、结尾悬念和场景拆分。",
      },
      {
        id: "storyboard-extract-roles",
        name: "角色提取",
        promptTemplate:
          "请基于输入内容提取角色信息，输出角色名称和一句话角色定位描述。",
      },
    ],
  },
  {
    id: "dreamworks-novel-to-script",
    name: "梦工厂-小说转剧本",
    owner: "dreamworks",
    status: "ONLINE",
    description: "小说转剧本智能体，当前已接入小说输入接收与标准化。",
    defaultWorkflowId: "novel-intake",
    workflows: [
      {
        id: "novel-intake",
        name: "小说输入接收",
        description: "接收并标准化小说输入 JSON。",
        modelProfile: "mock-default",
      },
    ],
    skills: [
      {
        id: "novel-intake-parse",
        name: "小说输入解析",
        promptTemplate:
          "你是小说转剧本任务的输入解析器。请读取 JSON 输入中的 novel_content、target_audience、expected_episode_count，并输出结构化的标准化摘要，供后续步骤使用。",
      },
    ],
  },
];
