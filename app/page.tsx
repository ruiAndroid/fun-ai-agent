"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_AGENT_CONFIGS, type AgentConfig, type AgentStatus } from "@/config/agent-config";

type TaskCreateResponse = {
  task_id?: string;
  detail?: string;
};

type StoredSkillPrompts = {
  agents: Array<{
    id: string;
    skills: Array<{
      id: string;
      promptTemplate: string;
    }>;
  }>;
};

const STORAGE_KEY = "fun-agent-skill-prompts-v3";
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/fun-agents/api").replace(/\/$/, "");

function deepCloneAgents(source: AgentConfig[]): AgentConfig[] {
  return source.map((agent) => ({
    ...agent,
    workflows: agent.workflows.map((workflow) => ({ ...workflow })),
    skills: agent.skills.map((skill) => ({ ...skill })),
  }));
}

function toPromptMapFromStorage(raw: string | null): Map<string, Map<string, string>> {
  const result = new Map<string, Map<string, string>>();
  if (!raw) return result;

  try {
    const parsed = JSON.parse(raw) as StoredSkillPrompts | unknown[];
    const records = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as StoredSkillPrompts).agents)
        ? (parsed as StoredSkillPrompts).agents
        : [];

    for (const item of records) {
      if (!item || typeof item !== "object") continue;
      const agent = item as { id?: unknown; skills?: unknown };
      if (typeof agent.id !== "string" || !Array.isArray(agent.skills)) continue;

      const skillMap = new Map<string, string>();
      for (const skillRaw of agent.skills) {
        if (!skillRaw || typeof skillRaw !== "object") continue;
        const skill = skillRaw as {
          id?: unknown;
          promptTemplate?: unknown;
          prompt?: unknown;
          notes?: unknown;
        };
        if (typeof skill.id !== "string") continue;

        if (typeof skill.promptTemplate === "string") {
          skillMap.set(skill.id, skill.promptTemplate);
        } else if (typeof skill.prompt === "string") {
          skillMap.set(skill.id, skill.prompt);
        } else if (typeof skill.notes === "string") {
          skillMap.set(skill.id, skill.notes);
        }
      }
      result.set(agent.id, skillMap);
    }
  } catch {
    return result;
  }

  return result;
}

function applyStoredPrompts(base: AgentConfig[], raw: string | null): AgentConfig[] {
  const promptMap = toPromptMapFromStorage(raw);
  if (promptMap.size === 0) return base;

  return base.map((agent) => {
    const skillMap = promptMap.get(agent.id);
    if (!skillMap) return agent;
    return {
      ...agent,
      skills: agent.skills.map((skill) => {
        const stored = skillMap.get(skill.id);
        return typeof stored === "string" ? { ...skill, promptTemplate: stored } : skill;
      }),
    };
  });
}

function buildStoragePayload(agents: AgentConfig[]): StoredSkillPrompts {
  return {
    agents: agents.map((agent) => ({
      id: agent.id,
      skills: agent.skills.map((skill) => ({
        id: skill.id,
        promptTemplate: skill.promptTemplate,
      })),
    })),
  };
}

function badgeVariantByStatus(status: AgentStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ONLINE") return "default";
  if (status === "DEGRADED") return "secondary";
  if (status === "OFFLINE") return "destructive";
  return "outline";
}

function statusText(status: AgentStatus): string {
  if (status === "ONLINE") return "ONLINE";
  if (status === "DEGRADED") return "DEGRADED";
  if (status === "OFFLINE") return "OFFLINE";
  return status;
}

export default function Home() {
  const [agents, setAgents] = useState<AgentConfig[]>(() => deepCloneAgents(DEFAULT_AGENT_CONFIGS));
  const [selectedAgentId, setSelectedAgentId] = useState<string>(DEFAULT_AGENT_CONFIGS[0]?.id ?? "");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const merged = applyStoredPrompts(
      deepCloneAgents(DEFAULT_AGENT_CONFIGS),
      localStorage.getItem(STORAGE_KEY),
    );
    setAgents(merged);
    setSelectedAgentId((prev) => (merged.find((agent) => agent.id === prev) ? prev : (merged[0]?.id ?? "")));
  }, []);

  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => setBanner(null), 2500);
    return () => window.clearTimeout(timer);
  }, [banner]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );

  useEffect(() => {
    if (!selectedAgent) {
      setSelectedWorkflowId("");
      return;
    }
    const fallbackWorkflowId = selectedAgent.defaultWorkflowId || selectedAgent.workflows[0]?.id || "";
    const workflowExists = selectedAgent.workflows.some((workflow) => workflow.id === selectedWorkflowId);
    if (!workflowExists) {
      setSelectedWorkflowId(fallbackWorkflowId);
    }
  }, [selectedAgent, selectedWorkflowId]);

  const selectedWorkflow = useMemo(() => {
    if (!selectedAgent) return null;
    return selectedAgent.workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null;
  }, [selectedAgent, selectedWorkflowId]);

  const selectedSkill = useMemo(() => {
    if (!selectedAgent || !selectedWorkflow) return null;
    return selectedAgent.skills.find((skill) => skill.id === selectedWorkflow.skillId) ?? null;
  }, [selectedAgent, selectedWorkflow]);

  const filteredAgents = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return agents;
    return agents.filter((agent) => {
      const workflowText = agent.workflows
        .map((workflow) => `${workflow.id} ${workflow.name} ${workflow.modelProfile} ${workflow.skillId}`)
        .join(" ");
      const skillText = agent.skills.map((skill) => `${skill.id} ${skill.name}`).join(" ");
      return [agent.id, agent.name, agent.owner, agent.description, workflowText, skillText]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [agents, search]);

  const onlineCount = useMemo(() => agents.filter((agent) => agent.status === "ONLINE").length, [agents]);
  const totalWorkflowCount = useMemo(
    () => agents.reduce((sum, agent) => sum + agent.workflows.length, 0),
    [agents],
  );
  const totalSkillCount = useMemo(() => agents.reduce((sum, agent) => sum + agent.skills.length, 0), [agents]);

  const updateSkillPrompt = (skillId: string, promptTemplate: string) => {
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === selectedAgentId
          ? {
              ...agent,
              skills: agent.skills.map((skill) =>
                skill.id === skillId ? { ...skill, promptTemplate } : skill,
              ),
            }
          : agent,
      ),
    );
    setDirty(true);
  };

  const saveToLocal = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildStoragePayload(agents)));
    setDirty(false);
    setBanner("Saved skill prompt templates to local storage.");
  };

  const resetSelectedAgent = () => {
    const fallback = DEFAULT_AGENT_CONFIGS.find((agent) => agent.id === selectedAgentId);
    if (!fallback) return;
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === selectedAgentId
          ? {
              ...fallback,
              workflows: fallback.workflows.map((workflow) => ({ ...workflow })),
              skills: fallback.skills.map((skill) => ({ ...skill })),
            }
          : agent,
      ),
    );
    setDirty(true);
    setBanner("Reset current agent workflow and skill prompt settings.");
  };

  const verifyPipeline = async () => {
    if (!selectedAgent || !selectedWorkflow || !selectedSkill) return;
    setChecking(true);
    setCheckMessage(null);

    const prompt = [
      "Run connectivity check for workflow execution.",
      `Agent: ${selectedAgent.id}`,
      `Workflow: ${selectedWorkflow.id}`,
      `Skill: ${selectedSkill.id}`,
      "Input: INT. CLASSROOM - DAY. A teacher asks students to design a short adventure storyboard.",
    ].join("\n");

    try {
      const response = await fetch(`${API_BASE_URL}/v1/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: "fun-agent-admin",
          agent_id: selectedAgent.id,
          workflow_id: selectedWorkflow.id,
          skill_prompt_override: selectedSkill.promptTemplate,
          prompt,
          idempotency_key: `verify-${selectedAgent.id}-${selectedWorkflow.id}-${Date.now()}`,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as TaskCreateResponse;
      if (!response.ok) {
        throw new Error(payload.detail ?? `Request failed: ${response.status}`);
      }
      setCheckMessage(payload.task_id ? `Task created: ${payload.task_id}` : "Connectivity check passed.");
    } catch (error) {
      setCheckMessage(error instanceof Error ? `Connectivity check failed: ${error.message}` : "Connectivity check failed.");
    } finally {
      setChecking(false);
    }
  };

  if (!selectedAgent) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-8">
        <Card>
          <CardHeader>
            <CardTitle>No Agent Found</CardTitle>
            <CardDescription>Check `config/agent-config.ts` to provide at least one agent.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
      <section className="panel-enter mb-6 rounded-3xl border border-border/70 bg-card/85 p-6 shadow-lg backdrop-blur md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Badge className="bg-primary text-primary-foreground">Fun Agent Admin</Badge>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">Agent Workflow Console</h1>
            <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
              Structure layer: Agent - Workflows - Skills. Config layer: workflow model profile. Capability layer: skill prompt template.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs md:text-sm">
            <Badge variant="outline">API: {API_BASE_URL}</Badge>
            <Badge variant="outline">Online Agents: {onlineCount}</Badge>
            <Badge variant="outline">Workflows: {totalWorkflowCount}</Badge>
            <Badge variant="outline">Skills: {totalSkillCount}</Badge>
          </div>
        </div>
      </section>

      {banner ? (
        <p className="panel-enter mb-4 rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-sm">{banner}</p>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
          <CardHeader>
            <CardTitle>Agents</CardTitle>
            <CardDescription>Select an agent to configure workflows and skill prompts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search by id, owner, workflow, model..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
              {filteredAgents.map((agent) => {
                const active = selectedAgentId === agent.id;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={[
                      "w-full rounded-xl border p-3 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/8 shadow-sm"
                        : "border-border/70 bg-background/45 hover:border-primary/50",
                    ].join(" ")}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{agent.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{agent.id}</p>
                      </div>
                      <Badge variant={badgeVariantByStatus(agent.status)}>{statusText(agent.status)}</Badge>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{agent.description}</p>
                    <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                      <span>W:{agent.workflows.length}</span>
                      <span>S:{agent.skills.length}</span>
                    </div>
                  </button>
                );
              })}
              {filteredAgents.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
                  No matching agents.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>Agent Overview</CardTitle>
              <CardDescription>Agent prompt remains non-configurable. Only workflow and skill-level settings are editable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 rounded-xl border border-border/70 bg-background/50 p-3 md:grid-cols-2">
                <p><span className="text-muted-foreground">Agent ID: </span>{selectedAgent.id}</p>
                <p><span className="text-muted-foreground">Name: </span>{selectedAgent.name}</p>
                <p><span className="text-muted-foreground">Owner: </span>{selectedAgent.owner}</p>
                <p><span className="text-muted-foreground">Status: </span>{statusText(selectedAgent.status)}</p>
                <p><span className="text-muted-foreground">Default Workflow: </span>{selectedAgent.defaultWorkflowId}</p>
                <p><span className="text-muted-foreground">Workflow Count: </span>{selectedAgent.workflows.length}</p>
                <p className="md:col-span-2"><span className="text-muted-foreground">Description: </span>{selectedAgent.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={saveToLocal}>Save Skill Prompts</Button>
                <Button type="button" variant="outline" onClick={resetSelectedAgent}>Reset Current Agent</Button>
              </div>
              <p className="text-xs text-muted-foreground">{dirty ? "You have unsaved changes." : "All changes are saved locally."}</p>
            </CardContent>
          </Card>

          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>Workflows</CardTitle>
              <CardDescription>Workflow-level model profile is configurable. Select one workflow to inspect its bound skill.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2">
                {selectedAgent.workflows.map((workflow) => {
                  const active = selectedWorkflow?.id === workflow.id;
                  return (
                    <button
                      key={workflow.id}
                      type="button"
                      onClick={() => setSelectedWorkflowId(workflow.id)}
                      className={[
                        "rounded-xl border p-3 text-left transition-colors",
                        active
                          ? "border-primary bg-primary/8 shadow-sm"
                          : "border-border/70 bg-background/45 hover:border-primary/50",
                      ].join(" ")}
                    >
                      <p className="text-sm font-semibold">{workflow.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{workflow.id}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{workflow.description}</p>
                      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                        skill={workflow.skillId} model={workflow.modelProfile}
                      </p>
                    </button>
                  );
                })}
              </div>
              {selectedWorkflow ? (
                <div className="rounded-xl border border-border/70 bg-background/50 p-3 text-sm">
                  <p><span className="text-muted-foreground">Workflow ID: </span>{selectedWorkflow.id}</p>
                  <p><span className="text-muted-foreground">Skill ID: </span>{selectedWorkflow.skillId}</p>
                  <p><span className="text-muted-foreground">Model Profile: </span><span className="font-mono">{selectedWorkflow.modelProfile}</span></p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>Skill Prompt Template</CardTitle>
              <CardDescription>Skill prompt is configurable and can be overridden per task.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedSkill ? (
                <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                  <div className="mb-2">
                    <p className="text-sm font-semibold">{selectedSkill.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{selectedSkill.id}</p>
                  </div>
                  <Textarea
                    rows={4}
                    value={selectedSkill.promptTemplate}
                    onChange={(event) => updateSkillPrompt(selectedSkill.id, event.target.value)}
                    placeholder="Enter skill prompt template..."
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a workflow first.</p>
              )}
            </CardContent>
          </Card>

          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>Connectivity Check</CardTitle>
              <CardDescription>Create a plane task with selected agent/workflow and current skill prompt override.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={verifyPipeline} disabled={checking || !selectedWorkflow || !selectedSkill}>
                  {checking ? "Running..." : "Run Check"}
                </Button>
                {checkMessage ? <p className="text-sm text-muted-foreground">{checkMessage}</p> : null}
              </div>
              <Separator />
              <pre className="max-h-72 overflow-auto rounded-xl border border-border/70 bg-background/60 p-3 font-mono text-xs">
                {JSON.stringify(
                  {
                    agent: selectedAgent.id,
                    workflow: selectedWorkflow?.id ?? null,
                    skill: selectedSkill?.id ?? null,
                    model: selectedWorkflow?.modelProfile ?? null,
                    skillPromptTemplate: selectedSkill?.promptTemplate ?? null,
                  },
                  null,
                  2,
                )}
              </pre>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
