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
  if (status === "ONLINE") return "在线";
  if (status === "DEGRADED") return "降级";
  if (status === "OFFLINE") return "离线";
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
    setBanner("已保存技能提示词到本地存储。");
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
    setBanner("已恢复当前智能体的工作流和技能提示词默认值。");
  };

  const verifyPipeline = async () => {
    if (!selectedAgent || !selectedWorkflow || !selectedSkill) return;
    setChecking(true);
    setCheckMessage(null);

    const prompt = [
      "执行链路连通性检查。",
      `智能体: ${selectedAgent.id}`,
      `工作流: ${selectedWorkflow.id}`,
      `技能: ${selectedSkill.id}`,
      "输入: INT. 教室 - 白天。一位老师让学生设计短篇冒险分镜。",
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
        throw new Error(payload.detail ?? `请求失败: ${response.status}`);
      }
      setCheckMessage(payload.task_id ? `任务已创建: ${payload.task_id}` : "连通性检查通过。");
    } catch (error) {
      setCheckMessage(error instanceof Error ? `连通性检查失败: ${error.message}` : "连通性检查失败。");
    } finally {
      setChecking(false);
    }
  };

  if (!selectedAgent) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-8">
        <Card>
          <CardHeader>
            <CardTitle>未找到可用智能体</CardTitle>
            <CardDescription>请检查 `config/agent-config.ts` 是否配置了至少一个智能体。</CardDescription>
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
            <Badge className="bg-primary text-primary-foreground">Fun Agent 管理台</Badge>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">智能体工作流控制台</h1>
            <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
              结构层: 智能体 - 工作流 - 技能。可配层: 工作流模型。能力层: 技能提示词模板。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs md:text-sm">
            <Badge variant="outline">接口: {API_BASE_URL}</Badge>
            <Badge variant="outline">在线智能体: {onlineCount}</Badge>
            <Badge variant="outline">工作流数: {totalWorkflowCount}</Badge>
            <Badge variant="outline">技能数: {totalSkillCount}</Badge>
          </div>
        </div>
      </section>

      {banner ? (
        <p className="panel-enter mb-4 rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-sm">{banner}</p>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
          <CardHeader>
            <CardTitle>智能体列表</CardTitle>
            <CardDescription>选择一个智能体进行工作流与技能提示词配置。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="按 ID、团队、工作流、模型搜索"
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
                  没有匹配的智能体。
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>智能体概览</CardTitle>
              <CardDescription>智能体级提示词不可配置，仅支持工作流模型和技能提示词配置。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 rounded-xl border border-border/70 bg-background/50 p-3 md:grid-cols-2">
                <p><span className="text-muted-foreground">智能体 ID: </span>{selectedAgent.id}</p>
                <p><span className="text-muted-foreground">名称: </span>{selectedAgent.name}</p>
                <p><span className="text-muted-foreground">团队: </span>{selectedAgent.owner}</p>
                <p><span className="text-muted-foreground">状态: </span>{statusText(selectedAgent.status)}</p>
                <p><span className="text-muted-foreground">默认工作流: </span>{selectedAgent.defaultWorkflowId}</p>
                <p><span className="text-muted-foreground">工作流数量: </span>{selectedAgent.workflows.length}</p>
                <p className="md:col-span-2"><span className="text-muted-foreground">描述: </span>{selectedAgent.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={saveToLocal}>保存技能提示词</Button>
                <Button type="button" variant="outline" onClick={resetSelectedAgent}>恢复当前智能体默认值</Button>
              </div>
              <p className="text-xs text-muted-foreground">{dirty ? "当前有未保存修改。" : "当前配置已保存到本地。"}</p>
            </CardContent>
          </Card>

          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>工作流配置</CardTitle>
              <CardDescription>每个工作流绑定一个模型与一个技能，可在此选择查看。</CardDescription>
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
                        技能={workflow.skillId} 模型={workflow.modelProfile}
                      </p>
                    </button>
                  );
                })}
              </div>
              {selectedWorkflow ? (
                <div className="rounded-xl border border-border/70 bg-background/50 p-3 text-sm">
                  <p><span className="text-muted-foreground">工作流 ID: </span>{selectedWorkflow.id}</p>
                  <p><span className="text-muted-foreground">技能 ID: </span>{selectedWorkflow.skillId}</p>
                  <p><span className="text-muted-foreground">模型配置: </span><span className="font-mono">{selectedWorkflow.modelProfile}</span></p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>技能提示词模板</CardTitle>
              <CardDescription>支持可视化编辑技能提示词，执行任务时将覆盖默认模板。</CardDescription>
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
                    placeholder="请输入技能提示词模板"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">请先选择一个工作流。</p>
              )}
            </CardContent>
          </Card>

          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>链路连通性检查</CardTitle>
              <CardDescription>使用当前智能体、工作流和技能提示词，向 plane 发起一条测试任务。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={verifyPipeline} disabled={checking || !selectedWorkflow || !selectedSkill}>
                  {checking ? "执行中..." : "执行连通性检查"}
                </Button>
                {checkMessage ? <p className="text-sm text-muted-foreground">{checkMessage}</p> : null}
              </div>
              <Separator />
              <pre className="max-h-72 overflow-auto rounded-xl border border-border/70 bg-background/60 p-3 font-mono text-xs">
                {JSON.stringify(
                  {
                    智能体: selectedAgent.id,
                    工作流: selectedWorkflow?.id ?? null,
                    技能: selectedSkill?.id ?? null,
                    模型: selectedWorkflow?.modelProfile ?? null,
                    技能提示词模板: selectedSkill?.promptTemplate ?? null,
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
