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
  skillId: string;
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
    name: "DreamWorks Storyboard",
    owner: "dreamworks",
    status: "ONLINE",
    description: "Storyboard agent with workflow-level model configuration.",
    defaultWorkflowId: "episode-split",
    workflows: [
      {
        id: "episode-split",
        name: "Script To Episodes",
        description: "Split screenplay into episode-level storyboard plan.",
        skillId: "storyboard-episode-split",
        modelProfile: "mock-default",
      },
      {
        id: "extract-roles",
        name: "Extract Episode Roles",
        description: "Extract key character roles from screenplay text.",
        skillId: "storyboard-extract-roles",
        modelProfile: "openai-gpt-4o-mini",
      },
    ],
    skills: [
      {
        id: "storyboard-episode-split",
        name: "Storyboard Episode Split",
        promptTemplate:
          "You are a professional storyboard planner. Split screenplay into episodes with hooks, conflict and cliffhangers.",
      },
      {
        id: "storyboard-extract-roles",
        name: "Storyboard Extract Roles",
        promptTemplate:
          "Extract the core roles from the screenplay. Return role names and short role summaries.",
      },
    ],
  },
  {
    id: "default-agent",
    name: "Default Agent",
    owner: "plane",
    status: "ONLINE",
    description: "General-purpose fallback agent.",
    defaultWorkflowId: "summarize",
    workflows: [
      {
        id: "summarize",
        name: "Summarize Text",
        description: "Generic summarization workflow.",
        skillId: "summarize-text",
        modelProfile: "mock-default",
      },
    ],
    skills: [
      {
        id: "summarize-text",
        name: "Summarize Text",
        promptTemplate: "You summarize user input into concise bullet points with clear structure.",
      },
    ],
  },
];
