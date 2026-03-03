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