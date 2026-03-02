"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { AGENT_MODEL_CONFIG, DEFAULT_AGENT_CONFIGS, type AgentConfig, type AgentStatus } from "@/config/agent-config";

type TaskCreateResponse = {
  task_id?: string;
  detail?: string;
};

type StoredSkillPrompts = {
  agents: Array<{
    id: string;
    skills: Array<{
      id: string;
      prompt: string;
    }>;
  }>;
};

const STORAGE_KEY = "fun-agent-skill-prompts-v2";
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/fun-agents/api").replace(/\/$/, "");

function deepCloneAgents(source: AgentConfig[]): AgentConfig[] {
  return source.map((agent) => ({
    ...agent,
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
        const skill = skillRaw as { id?: unknown; prompt?: unknown; notes?: unknown };
        if (typeof skill.id !== "string") continue;

        if (typeof skill.prompt === "string") {
          skillMap.set(skill.id, skill.prompt);
        } else if (typeof skill.notes === "string") {
          // 兼容上一版数据结构（notes 字段）。
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
        const storedPrompt = skillMap.get(skill.id);
        return typeof storedPrompt === "string" ? { ...skill, prompt: storedPrompt } : skill;
      }),
    };
  });
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

function buildStoragePayload(agents: AgentConfig): StoredSkillPrompts;
function buildStoragePayload(agents: AgentConfig[]): StoredSkillPrompts;
function buildStoragePayload(agents: AgentConfig | AgentConfig[]): StoredSkillPrompts {
  const list = Array.isArray(agents) ? agents : [agents];
  return {
    agents: list.map((agent) => ({
      id: agent.id,
      skills: agent.skills.map((skill) => ({
        id: skill.id,
        prompt: skill.prompt,
      })),
    })),
  };
}

export default function Home() {
  const [agents, setAgents] = useState<AgentConfig[]>(() => deepCloneAgents(DEFAULT_AGENT_CONFIGS));
  const [selectedAgentId, setSelectedAgentId] = useState<string>(DEFAULT_AGENT_CONFIGS[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const merged = applyStoredPrompts(
      deepCloneAgents(DEFAULT_AGENT_CONFIGS),
      localStorage.getItem(STORAGE_KEY)
    );
    setAgents(merged);
    if (!merged.find((agent) => agent.id === selectedAgentId)) {
      setSelectedAgentId(merged[0]?.id ?? "");
    }
  }, [selectedAgentId]);

  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => setBanner(null), 2500);
    return () => window.clearTimeout(timer);
  }, [banner]);

  const filteredAgents = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return agents;
    return agents.filter((agent) => {
      const model = AGENT_MODEL_CONFIG[agent.id] ?? "";
      return [agent.id, agent.name, agent.owner, agent.description, model].join(" ").toLowerCase().includes(keyword);
    });
  }, [agents, search]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  );

  const onlineCount = useMemo(() => agents.filter((agent) => agent.status === "ONLINE").length, [agents]);
  const totalSkillCount = useMemo(() => agents.reduce((total, agent) => total + agent.skills.length, 0), [agents]);

  const updateSkillPrompt = (skillId: string, prompt: string) => {
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === selectedAgentId
          ? {
              ...agent,
              skills: agent.skills.map((skill) => (skill.id === skillId ? { ...skill, prompt } : skill)),
            }
          : agent
      )
    );
    setDirty(true);
  };

  const saveToLocal = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildStoragePayload(agents)));
    setDirty(false);
    setBanner("已保存到浏览器本地配置。");
  };

  const resetSelectedAgent = () => {
    const fallback = DEFAULT_AGENT_CONFIGS.find((agent) => agent.id === selectedAgentId);
    if (!fallback) return;

    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === selectedAgentId
          ? {
              ...fallback,
              skills: fallback.skills.map((skill) => ({ ...skill })),
            }
          : agent
      )
    );
    setDirty(true);
    setBanner("当前 Agent 的 Skill 提示词已恢复默认。");
  };

  const verifyPipeline = async () => {
    if (!selectedAgent) return;
    setChecking(true);
    setCheckMessage(null);

    const promptSummary = selectedAgent.skills
      .map((skill) => `${skill.name}(${skill.id}): ${skill.prompt}`)
      .join("\n");

    try {
      const response = await fetch(`${API_BASE_URL}/v1/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "fun-agent-admin",
          agentId: selectedAgent.id,
          prompt: `请执行连通性校验。\n当前技能提示词如下：\n${promptSummary}`,
          idempotencyKey: `verify-${selectedAgent.id}-${Date.now()}`,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as TaskCreateResponse;
      if (!response.ok) {
        throw new Error(payload.detail ?? `请求失败（${response.status}）`);
      }

      setCheckMessage(payload.task_id ? `连通性任务已创建：${payload.task_id}` : "连通性请求成功。");
    } catch (error) {
      setCheckMessage(error instanceof Error ? `连通性检查失败：${error.message}` : "连通性检查失败。");
    } finally {
      setChecking(false);
    }
  };

  if (!selectedAgent) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-8">
        <Card>
          <CardHeader>
            <CardTitle>未找到 Agent</CardTitle>
            <CardDescription>当前配置中没有可用 Agent，请检查配置文件。</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const selectedModel = AGENT_MODEL_CONFIG[selectedAgent.id] ?? "未配置";

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
      <section className="panel-enter mb-6 rounded-3xl border border-border/70 bg-card/85 p-6 shadow-lg backdrop-blur md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Badge className="bg-primary text-primary-foreground">Fun Agent 管理平台</Badge>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
              Fun Agent
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
              大模型配置来自独立 config 文件；页面仅支持维护 Skill 提示词。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs md:text-sm">
            <Badge variant="outline">API: {API_BASE_URL}</Badge>
            <Badge variant="outline">在线 Agent: {onlineCount}</Badge>
            <Badge variant="outline">总 Agent: {agents.length}</Badge>
            <Badge variant="outline">总 Skill: {totalSkillCount}</Badge>
          </div>
        </div>
      </section>

      {banner ? (
        <p className="panel-enter mb-4 rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-sm">{banner}</p>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
          <CardHeader>
            <CardTitle>可用 Agent</CardTitle>
            <CardDescription>选择一个 Agent 进行 Skill 提示词配置。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="搜索 Agent（id / 名称 / 团队 / 模型）"
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
                      <span>Skill {agent.skills.length} 项</span>
                      <span>{AGENT_MODEL_CONFIG[agent.id] ?? "未配置"}</span>
                    </div>
                  </button>
                );
              })}
              {filteredAgents.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
                  没有匹配的 Agent。
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>Agent 信息（只读）</CardTitle>
              <CardDescription>大模型配置固定读取自 `config/agent-config.ts`。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 rounded-xl border border-border/70 bg-background/50 p-3 md:grid-cols-2">
                <p><span className="text-muted-foreground">Agent ID：</span>{selectedAgent.id}</p>
                <p><span className="text-muted-foreground">名称：</span>{selectedAgent.name}</p>
                <p><span className="text-muted-foreground">归属团队：</span>{selectedAgent.owner}</p>
                <p><span className="text-muted-foreground">状态：</span>{statusText(selectedAgent.status)}</p>
                <p className="md:col-span-2">
                  <span className="text-muted-foreground">大模型：</span>
                  <span className="font-mono">{selectedModel}</span>
                </p>
                <p className="md:col-span-2">
                  <span className="text-muted-foreground">描述：</span>{selectedAgent.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={saveToLocal}>保存提示词配置</Button>
                <Button type="button" variant="outline" onClick={resetSelectedAgent}>恢复当前 Agent 默认提示词</Button>
              </div>
              <p className="text-xs text-muted-foreground">{dirty ? "当前有未保存修改。" : "当前为已保存状态。"}</p>
            </CardContent>
          </Card>

          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>Skill 提示词配置</CardTitle>
              <CardDescription>仅允许编辑提示词内容，其他参数不可编辑。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedAgent.skills.map((skill) => (
                <div key={skill.id} className="rounded-xl border border-border/70 bg-background/50 p-3">
                  <div className="mb-2">
                    <p className="text-sm font-semibold">{skill.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{skill.id}</p>
                  </div>
                  <Textarea
                    rows={3}
                    value={skill.prompt}
                    onChange={(event) => updateSkillPrompt(skill.id, event.target.value)}
                    placeholder="请输入该 Skill 的提示词"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>链路连通性检查</CardTitle>
              <CardDescription>从前端触发 API 到 plane 的测试任务，验证服务链路是否正常。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={verifyPipeline} disabled={checking}>
                  {checking ? "检查中..." : "执行连通性检查"}
                </Button>
                {checkMessage ? <p className="text-sm text-muted-foreground">{checkMessage}</p> : null}
              </div>
              <Separator />
              <pre className="max-h-72 overflow-auto rounded-xl border border-border/70 bg-background/60 p-3 font-mono text-xs">
                {JSON.stringify(selectedAgent.skills, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
