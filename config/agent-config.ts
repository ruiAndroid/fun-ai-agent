export type AgentStatus = "ONLINE" | "DEGRADED" | "OFFLINE";

export type SkillPromptConfig = {
  id: string;
  name: string;
  prompt: string;
};

export type AgentConfig = {
  id: string;
  name: string;
  owner: string;
  status: AgentStatus;
  description: string;
  skills: SkillPromptConfig[];
};

// 大模型配置集中放这里，前端页面只读展示，不提供编辑入口。
export const AGENT_MODEL_CONFIG: Record<string, string> = {
  "agent-writer": "gpt-4.1",
  "agent-ops": "gpt-4.1-mini",
  "agent-support": "gpt-4o-mini",
};

export const DEFAULT_AGENT_CONFIGS: AgentConfig[] = [
  {
    id: "agent-writer",
    name: "写作助手",
    owner: "content-team",
    status: "ONLINE",
    description: "用于长文撰写、改写和结构化总结。",
    skills: [
      {
        id: "skill_summarization",
        name: "摘要总结",
        prompt: "请先提炼关键事实，再输出分点总结，并附上可执行建议。",
      },
      {
        id: "skill_fact_check",
        name: "事实核验",
        prompt: "对不确定信息给出风险提示，必要时明确标注需要人工复核。",
      },
      {
        id: "skill_style_transfer",
        name: "风格改写",
        prompt: "保持原意不变，改写为简洁、专业、可直接对外发布的表达。",
      },
    ],
  },
  {
    id: "agent-ops",
    name: "运维助手",
    owner: "platform-team",
    status: "DEGRADED",
    description: "用于日志分析、问题定位和变更建议。",
    skills: [
      {
        id: "skill_log_analysis",
        name: "日志分析",
        prompt: "优先定位异常时间窗口，按错误级别输出高到低的排查清单。",
      },
      {
        id: "skill_change_plan",
        name: "变更方案",
        prompt: "输出变更步骤时必须附带回滚步骤和影响评估。",
      },
      {
        id: "skill_auto_fix",
        name: "自动修复建议",
        prompt: "仅给出低风险可回滚操作，并明确前置检查条件。",
      },
    ],
  },
  {
    id: "agent-support",
    name: "客服助手",
    owner: "cx-team",
    status: "ONLINE",
    description: "用于工单分类、知识检索和回复草拟。",
    skills: [
      {
        id: "skill_ticket_classify",
        name: "工单分类",
        prompt: "按业务线和紧急程度分类，并给出推荐 SLA 等级。",
      },
      {
        id: "skill_knowledge_recall",
        name: "知识检索",
        prompt: "仅引用已审核知识库内容，禁止推测式回答。",
      },
      {
        id: "skill_reply_draft",
        name: "回复草拟",
        prompt: "回复语气保持专业礼貌，先结论后步骤，长度控制在 200 字内。",
      },
    ],
  },
];
