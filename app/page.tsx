"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type AgentStatus = "ONLINE" | "DEGRADED" | "OFFLINE";
type SkillMode = "SAFE" | "BALANCED" | "AGGRESSIVE";

type SkillConfig = {
  id: string;
  name: string;
  enabled: boolean;
  mode: SkillMode;
  priority: number;
  timeoutSeconds: number;
  notes: string;
};

type AgentConfig = {
  id: string;
  name: string;
  owner: string;
  model: string;
  status: AgentStatus;
  description: string;
  skills: SkillConfig[];
  updatedAt: string;
};

type TaskCreateResponse = {
  task_id?: string;
  detail?: string;
};

const STORAGE_KEY = "fun-agent-management-config-v1";
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/fun-agents/api").replace(/\/$/, "");

const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: "agent-writer",
    name: "Writer Agent",
    owner: "content-team",
    model: "gpt-4.1",
    status: "ONLINE",
    description: "Long-form content drafting and rewrite pipeline.",
    updatedAt: "2026-03-02T00:00:00.000Z",
    skills: [
      {
        id: "skill_summarization",
        name: "Summarization",
        enabled: true,
        mode: "BALANCED",
        priority: 90,
        timeoutSeconds: 20,
        notes: "Prefer concise summaries with clear action bullets.",
      },
      {
        id: "skill_fact_check",
        name: "Fact Check",
        enabled: true,
        mode: "SAFE",
        priority: 95,
        timeoutSeconds: 30,
        notes: "Block uncertain claims; require source links.",
      },
      {
        id: "skill_style_transfer",
        name: "Style Transfer",
        enabled: false,
        mode: "BALANCED",
        priority: 50,
        timeoutSeconds: 15,
        notes: "Apply brand tone only for approved tenants.",
      },
    ],
  },
  {
    id: "agent-ops",
    name: "Ops Agent",
    owner: "platform-team",
    model: "gpt-4.1-mini",
    status: "DEGRADED",
    description: "Operational diagnostics and runbook execution assistant.",
    updatedAt: "2026-03-02T00:00:00.000Z",
    skills: [
      {
        id: "skill_log_analysis",
        name: "Log Analysis",
        enabled: true,
        mode: "SAFE",
        priority: 88,
        timeoutSeconds: 25,
        notes: "Redact secrets before returning output.",
      },
      {
        id: "skill_change_plan",
        name: "Change Plan",
        enabled: true,
        mode: "BALANCED",
        priority: 80,
        timeoutSeconds: 25,
        notes: "Always output rollback steps.",
      },
      {
        id: "skill_auto_fix",
        name: "Auto Fix",
        enabled: false,
        mode: "AGGRESSIVE",
        priority: 60,
        timeoutSeconds: 20,
        notes: "Only available for staging environments.",
      },
    ],
  },
  {
    id: "agent-support",
    name: "Support Agent",
    owner: "cx-team",
    model: "gpt-4o-mini",
    status: "ONLINE",
    description: "Customer issue triage, classification, and response drafting.",
    updatedAt: "2026-03-02T00:00:00.000Z",
    skills: [
      {
        id: "skill_ticket_classify",
        name: "Ticket Classify",
        enabled: true,
        mode: "BALANCED",
        priority: 92,
        timeoutSeconds: 18,
        notes: "Map each ticket to standard SLA tier.",
      },
      {
        id: "skill_knowledge_recall",
        name: "Knowledge Recall",
        enabled: true,
        mode: "SAFE",
        priority: 90,
        timeoutSeconds: 20,
        notes: "Only cite approved knowledge base entries.",
      },
      {
        id: "skill_reply_draft",
        name: "Reply Draft",
        enabled: true,
        mode: "BALANCED",
        priority: 70,
        timeoutSeconds: 12,
        notes: "Produce concise drafts for manual review.",
      },
    ],
  },
];

function deepCloneAgents(source: AgentConfig[]): AgentConfig[] {
  return source.map((agent) => ({
    ...agent,
    skills: agent.skills.map((skill) => ({ ...skill })),
  }));
}

function parseStoredAgents(raw: string | null): AgentConfig[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AgentConfig[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function badgeVariantByStatus(status: AgentStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ONLINE") return "default";
  if (status === "DEGRADED") return "secondary";
  if (status === "OFFLINE") return "destructive";
  return "outline";
}

function safeNumber(input: string, fallback: number): number {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function Home() {
  const [agents, setAgents] = useState<AgentConfig[]>(() => deepCloneAgents(DEFAULT_AGENTS));
  const [selectedAgentId, setSelectedAgentId] = useState<string>(DEFAULT_AGENTS[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const stored = parseStoredAgents(localStorage.getItem(STORAGE_KEY));
    if (!stored) return;
    setAgents(stored);
    if (!stored.find((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(stored[0].id);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => setBanner(null), 2500);
    return () => window.clearTimeout(timer);
  }, [banner]);

  useEffect(() => {
    if (agents.length === 0) return;
    if (!agents.some((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  const filteredAgents = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return agents;
    return agents.filter((agent) =>
      [agent.id, agent.name, agent.owner, agent.model].join(" ").toLowerCase().includes(keyword)
    );
  }, [agents, search]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  );

  const onlineCount = useMemo(() => agents.filter((agent) => agent.status === "ONLINE").length, [agents]);
  const totalSkillCount = useMemo(
    () => agents.reduce((total, agent) => total + agent.skills.length, 0),
    [agents]
  );
  const enabledSkillCount = useMemo(
    () => agents.reduce((total, agent) => total + agent.skills.filter((skill) => skill.enabled).length, 0),
    [agents]
  );

  const mutateSelectedAgent = (updater: (agent: AgentConfig) => AgentConfig) => {
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === selectedAgentId
          ? {
              ...updater(agent),
              updatedAt: new Date().toISOString(),
            }
          : agent
      )
    );
    setDirty(true);
  };

  const updateSkill = (skillId: string, patch: Partial<SkillConfig>) => {
    mutateSelectedAgent((agent) => ({
      ...agent,
      skills: agent.skills.map((skill) => (skill.id === skillId ? { ...skill, ...patch } : skill)),
    }));
  };

  const saveToLocal = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
    setDirty(false);
    setBanner("Configuration saved to browser storage.");
  };

  const resetSelectedAgent = () => {
    const fallback = DEFAULT_AGENTS.find((agent) => agent.id === selectedAgentId);
    if (!fallback) return;
    mutateSelectedAgent(() => ({
      ...fallback,
      skills: fallback.skills.map((skill) => ({ ...skill })),
    }));
    setBanner("Selected agent reset to default template.");
  };

  const setAllSkills = (enabled: boolean) => {
    mutateSelectedAgent((agent) => ({
      ...agent,
      skills: agent.skills.map((skill) => ({ ...skill, enabled })),
    }));
  };

  const exportSelectedAgent = async () => {
    if (!selectedAgent) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(selectedAgent, null, 2));
      setBanner("Selected agent config copied to clipboard.");
    } catch {
      setBanner("Copy failed. Browser may block clipboard access.");
    }
  };

  const verifyPipeline = async () => {
    if (!selectedAgent) return;
    setChecking(true);
    setCheckMessage(null);

    const enabledSkills = selectedAgent.skills
      .filter((skill) => skill.enabled)
      .map((skill) => `${skill.id}:${skill.mode}`)
      .join(", ");

    try {
      const response = await fetch(`${API_BASE_URL}/v1/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "fun-agent-admin",
          agentId: selectedAgent.id,
          prompt: `Validate profile for ${selectedAgent.id}. Enabled skills: ${enabledSkills || "none"}.`,
          idempotencyKey: `verify-${selectedAgent.id}-${Date.now()}`,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as TaskCreateResponse;
      if (!response.ok) {
        throw new Error(payload.detail ?? `request failed (${response.status})`);
      }

      setCheckMessage(payload.task_id ? `Pipeline check task queued: ${payload.task_id}` : "Pipeline request succeeded.");
    } catch (error) {
      setCheckMessage(error instanceof Error ? `Pipeline check failed: ${error.message}` : "Pipeline check failed.");
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
            <CardDescription>Current configuration has no available agent records.</CardDescription>
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
            <Badge className="bg-primary text-primary-foreground">Fun Agent Management Platform</Badge>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
              Manage available agents and configure skill policies visually
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
              Select an agent, tune skill behavior, and validate API to plane connectivity from one place.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs md:text-sm">
            <Badge variant="outline">API: {API_BASE_URL}</Badge>
            <Badge variant="outline">ONLINE: {onlineCount}</Badge>
            <Badge variant="outline">AGENTS: {agents.length}</Badge>
            <Badge variant="outline">SKILLS: {enabledSkillCount}/{totalSkillCount}</Badge>
          </div>
        </div>
      </section>

      {banner ? (
        <p className="panel-enter mb-4 rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-sm">{banner}</p>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
          <CardHeader>
            <CardTitle>Available Agents</CardTitle>
            <CardDescription>Browse and pick the target agent profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search by id / name / owner / model"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
              {filteredAgents.map((agent) => {
                const enabled = agent.skills.filter((skill) => skill.enabled).length;
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
                      <Badge variant={badgeVariantByStatus(agent.status)}>{agent.status}</Badge>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{agent.description}</p>
                    <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                      <span>skills {enabled}/{agent.skills.length}</span>
                      <span>{agent.model}</span>
                    </div>
                  </button>
                );
              })}
              {filteredAgents.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
                  No agent matches current keyword.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>Agent Profile</CardTitle>
              <CardDescription>Basic metadata and global controls for the selected agent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  value={selectedAgent.name}
                  onChange={(event) => mutateSelectedAgent((agent) => ({ ...agent, name: event.target.value }))}
                  placeholder="Agent name"
                />
                <Input
                  value={selectedAgent.owner}
                  onChange={(event) => mutateSelectedAgent((agent) => ({ ...agent, owner: event.target.value }))}
                  placeholder="Owner team"
                />
                <Input
                  value={selectedAgent.model}
                  onChange={(event) => mutateSelectedAgent((agent) => ({ ...agent, model: event.target.value }))}
                  placeholder="Model"
                />
                <select
                  value={selectedAgent.status}
                  onChange={(event) =>
                    mutateSelectedAgent((agent) => ({ ...agent, status: event.target.value as AgentStatus }))
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="ONLINE">ONLINE</option>
                  <option value="DEGRADED">DEGRADED</option>
                  <option value="OFFLINE">OFFLINE</option>
                </select>
              </div>
              <Textarea
                rows={3}
                value={selectedAgent.description}
                onChange={(event) => mutateSelectedAgent((agent) => ({ ...agent, description: event.target.value }))}
                placeholder="Agent description"
              />

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setAllSkills(true)}>
                  Enable All Skills
                </Button>
                <Button type="button" variant="outline" onClick={() => setAllSkills(false)}>
                  Disable All Skills
                </Button>
                <Button type="button" variant="outline" onClick={resetSelectedAgent}>
                  Reset Selected Agent
                </Button>
                <Button type="button" onClick={saveToLocal}>
                  Save Config
                </Button>
                <Button type="button" variant="outline" onClick={exportSelectedAgent}>
                  Export JSON
                </Button>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                updated_at: {selectedAgent.updatedAt} {dirty ? "(unsaved changes)" : "(saved)"}
              </p>
            </CardContent>
          </Card>

          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>Skill Configuration</CardTitle>
              <CardDescription>Visual policy editor for each skill bound to this agent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedAgent.skills.map((skill) => (
                <div key={skill.id} className="rounded-xl border border-border/70 bg-background/50 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{skill.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{skill.id}</p>
                    </div>
                    <Button
                      type="button"
                      variant={skill.enabled ? "default" : "outline"}
                      onClick={() => updateSkill(skill.id, { enabled: !skill.enabled })}
                    >
                      {skill.enabled ? "Enabled" : "Disabled"}
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Mode</p>
                      <select
                        value={skill.mode}
                        onChange={(event) => updateSkill(skill.id, { mode: event.target.value as SkillMode })}
                        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="SAFE">SAFE</option>
                        <option value="BALANCED">BALANCED</option>
                        <option value="AGGRESSIVE">AGGRESSIVE</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Priority ({skill.priority})</p>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={skill.priority}
                        onChange={(event) =>
                          updateSkill(skill.id, { priority: safeNumber(event.target.value, skill.priority) })
                        }
                        className="h-9 w-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Timeout Seconds</p>
                      <Input
                        type="number"
                        min={1}
                        max={120}
                        value={skill.timeoutSeconds}
                        onChange={(event) =>
                          updateSkill(skill.id, { timeoutSeconds: safeNumber(event.target.value, skill.timeoutSeconds) })
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Policy Notes</p>
                    <Textarea
                      rows={2}
                      value={skill.notes}
                      onChange={(event) => updateSkill(skill.id, { notes: event.target.value })}
                      placeholder="Guardrail, fallback behavior, and scope constraints"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>Connectivity Check</CardTitle>
              <CardDescription>Send a test request through API -&gt; plane for this agent profile.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={verifyPipeline} disabled={checking}>
                  {checking ? "Checking..." : "Verify API to Plane"}
                </Button>
                {checkMessage ? <p className="text-sm text-muted-foreground">{checkMessage}</p> : null}
              </div>
              <Separator />
              <pre className="max-h-72 overflow-auto rounded-xl border border-border/70 bg-background/60 p-3 font-mono text-xs">
                {JSON.stringify(selectedAgent, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
