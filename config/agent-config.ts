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
export const AGENT_MODEL_CONFIG: Record<string, string> = {};

// 默认不内置任何 Agent/Skill 假数据。
// 请在接入后端接口后由服务端下发，或在本文件中按需手工配置真实数据。
export const DEFAULT_AGENT_CONFIGS: AgentConfig[] = [];
