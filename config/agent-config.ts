export type AgentStatus = "ONLINE" | "DEGRADED" | "OFFLINE";

export type SkillConfig = {
  id: string;
  name: string;
  promptTemplate: string;
  promptVariants?: Record<string, string>;
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
          "你是小说转剧本任务的输入解析器。请读取 JSON 输入中的 novel_content、novel_type、target_audience、expected_episode_count，并输出结构化的标准化摘要，供后续步骤使用。",
      },
      {
        id: "novel-story-synopsis-generate",
        name: "故事梗概生成",
        promptTemplate:
          "基于小说原文和受众，输出适合改编为剧本的故事梗概：包含主题、主线冲突、情绪基调、卖点与改编注意事项。",
      },
      {
        id: "novel-character-profile-generate",
        name: "角色设定生成",
        promptTemplate:
          "基于故事梗概，生成核心角色设定：角色目标、动机、关系、成长弧线、对白风格与视觉标签。",
      },
      {
        id: "novel-episode-outline-generate",
        name: "分集大纲生成",
        promptTemplate:
          "按照期望集数输出分集大纲：每集主冲突、关键转折、结尾悬念、人物推进和主题呼应。",
      },
      {
        id: "novel-full-script-generate",
        name: "全集剧本生成",
        promptTemplate:
          "基于分集大纲产出全集剧本草案，按集输出场景、人物对白、舞台提示与节奏控制建议。",
      },
    ],
  },
];
