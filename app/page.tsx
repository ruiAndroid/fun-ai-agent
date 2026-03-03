"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_AGENT_CONFIGS, type AgentConfig, type AgentStatus } from "@/config/agent-config";

type TaskCreateResponse = {
  task_id?: string;
  status?: string;
  detail?: string;
  error?: string;
};

type TaskEventEnvelope = {
  event_type?: string;
  payload?: Record<string, unknown>;
};

type ConfigAgentsResponse = {
  agents?: unknown;
  detail?: string;
  error?: string;
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

type RunLogEntry = {
  id: string;
  at: string;
  message: string;
  level: "info" | "step" | "error";
};

type StepPanel = {
  stepId: string;
  stepName: string;
  skillId: string;
  stepIndex: number;
  stepTotal: number;
  status: "pending" | "running" | "completed";
  output: string;
  outputChars: number;
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

function normalizeStatus(value: unknown): AgentStatus {
  const status = asString(value)?.toUpperCase();
  if (status === "ONLINE" || status === "DEGRADED" || status === "OFFLINE") {
    return status;
  }
  return "ONLINE";
}

function normalizeAgentConfigs(raw: unknown): AgentConfig[] {
  if (!Array.isArray(raw)) return [];

  const result: AgentConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const id = asString(entry.id)?.trim();
    if (!id) continue;

    const workflowsRaw = Array.isArray(entry.workflows) ? entry.workflows : [];
    const workflows = workflowsRaw
      .map((workflow) => {
        if (!workflow || typeof workflow !== "object") return null;
        const row = workflow as Record<string, unknown>;
        const workflowId = asString(row.id)?.trim();
        if (!workflowId) return null;
        return {
          id: workflowId,
          name: asString(row.name)?.trim() || workflowId,
          description: asString(row.description)?.trim() || "",
          modelProfile: asString(row.modelProfile)?.trim() || "",
        };
      })
      .filter((workflow): workflow is AgentConfig["workflows"][number] => workflow !== null);

    const skillsRaw = Array.isArray(entry.skills) ? entry.skills : [];
    const skills = skillsRaw
      .map((skill) => {
        if (!skill || typeof skill !== "object") return null;
        const row = skill as Record<string, unknown>;
        const skillId = asString(row.id)?.trim();
        if (!skillId) return null;
        return {
          id: skillId,
          name: asString(row.name)?.trim() || skillId,
          promptTemplate: asString(row.promptTemplate)?.trim() || "",
        };
      })
      .filter((skill): skill is AgentConfig["skills"][number] => skill !== null);

    const defaultWorkflowId = asString(entry.defaultWorkflowId)?.trim() || workflows[0]?.id || "";
    result.push({
      id,
      name: asString(entry.name)?.trim() || id,
      owner: asString(entry.owner)?.trim() || "",
      status: normalizeStatus(entry.status),
      description: asString(entry.description)?.trim() || "",
      defaultWorkflowId,
      workflows,
      skills,
    });
  }

  return result;
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

function asString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function parseEventEnvelope(raw: string): TaskEventEnvelope | null {
  const parseJson = (input: string): unknown => {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  };

  let candidate = raw.trim();
  if (!candidate) return null;
  if (candidate.startsWith("data:")) {
    candidate = candidate.slice(5).trim();
  }

  let parsed = parseJson(candidate);
  if (typeof parsed === "string") {
    parsed = parseJson(parsed);
  }
  if (!parsed || typeof parsed !== "object") return null;

  const envelope = parsed as Record<string, unknown>;
  return {
    event_type: asString(envelope.event_type) ?? undefined,
    payload:
      envelope.payload && typeof envelope.payload === "object"
        ? (envelope.payload as Record<string, unknown>)
        : {},
  };
}

export default function Home() {
  const streamAbortRef = useRef<AbortController | null>(null);
  const baselineAgentsRef = useRef<AgentConfig[]>(deepCloneAgents(DEFAULT_AGENT_CONFIGS));

  const [agents, setAgents] = useState<AgentConfig[]>(() => deepCloneAgents(DEFAULT_AGENT_CONFIGS));
  const [selectedAgentId, setSelectedAgentId] = useState<string>(DEFAULT_AGENT_CONFIGS[0]?.id ?? "");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [scriptInput, setScriptInput] = useState("");
  const [novelContent, setNovelContent] = useState("");
  const [novelAudience, setNovelAudience] = useState("");
  const [novelExpectedEpisodes, setNovelExpectedEpisodes] = useState("");
  const [runTaskId, setRunTaskId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string>("IDLE");
  const [runOutput, setRunOutput] = useState("");
  const [runLogs, setRunLogs] = useState<RunLogEntry[]>([]);
  const [stepPanels, setStepPanels] = useState<StepPanel[]>([]);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fallbackAgents = applyStoredPrompts(
      deepCloneAgents(DEFAULT_AGENT_CONFIGS),
      localStorage.getItem(STORAGE_KEY),
    );

    const loadAgentConfigs = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/v1/config/agents`, { method: "GET" });
        const payload = (await response.json().catch(() => ({}))) as ConfigAgentsResponse;
        if (!response.ok) {
          throw new Error(payload.detail ?? payload.error ?? `读取配置失败: ${response.status}`);
        }

        const fromApi = normalizeAgentConfigs(payload.agents);
        const resolved = fromApi.length > 0 ? fromApi : fallbackAgents;
        if (cancelled) return;

        baselineAgentsRef.current = deepCloneAgents(resolved);
        setAgents(resolved);
        setSelectedAgentId((prev) => (resolved.find((agent) => agent.id === prev) ? prev : (resolved[0]?.id ?? "")));

        if (fromApi.length === 0) {
          setBanner("数据库暂无配置，已回退到本地默认配置。");
        }
      } catch {
        if (cancelled) return;
        baselineAgentsRef.current = deepCloneAgents(fallbackAgents);
        setAgents(fallbackAgents);
        setSelectedAgentId((prev) =>
          fallbackAgents.find((agent) => agent.id === prev) ? prev : (fallbackAgents[0]?.id ?? ""),
        );
        setBanner("读取数据库配置失败，已使用本地配置。");
      }
    };

    void loadAgentConfigs();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(() => setBanner(null), 2500);
    return () => window.clearTimeout(timer);
  }, [banner]);

  useEffect(
    () => () => {
      if (streamAbortRef.current) {
        streamAbortRef.current.abort();
        streamAbortRef.current = null;
      }
    },
    [],
  );

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

  useEffect(() => {
    if (!selectedAgent) {
      setSelectedSkillId("");
      return;
    }
    const fallbackSkillId = selectedAgent.skills[0]?.id || "";
    const skillExists = selectedAgent.skills.some((skill) => skill.id === selectedSkillId);
    if (!skillExists) {
      setSelectedSkillId(fallbackSkillId);
    }
  }, [selectedAgent, selectedSkillId]);

  const selectedWorkflow = useMemo(() => {
    if (!selectedAgent) return null;
    return selectedAgent.workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null;
  }, [selectedAgent, selectedWorkflowId]);

  const selectedSkill = useMemo(() => {
    if (!selectedAgent) return null;
    return selectedAgent.skills.find((skill) => skill.id === selectedSkillId) ?? null;
  }, [selectedAgent, selectedSkillId]);

  const isNovelToScriptAgent = selectedAgent?.id === "dreamworks-novel-to-script";

  const filteredAgents = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return agents;
    return agents.filter((agent) => {
      const workflowText = agent.workflows
        .map((workflow) => `${workflow.id} ${workflow.name} ${workflow.modelProfile}`)
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

  const appendLog = (message: string, level: RunLogEntry["level"] = "info") => {
    const entry: RunLogEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      at: new Date().toLocaleTimeString(),
      message,
      level,
    };
    setRunLogs((prev) => [...prev, entry]);
  };

  const upsertStepPanel = (nextPanel: StepPanel) => {
    setStepPanels((prev) => {
      const idx = prev.findIndex((item) => item.stepId === nextPanel.stepId);
      if (idx === -1) {
        return [...prev, nextPanel].sort((a, b) => a.stepIndex - b.stepIndex);
      }
      const merged = [...prev];
      merged[idx] = nextPanel;
      return merged.sort((a, b) => a.stepIndex - b.stepIndex);
    });
  };

  const stopStreaming = () => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
  };

  const clearRunPanel = () => {
    stopStreaming();
    setRunning(false);
    setRunTaskId(null);
    setRunStatus("IDLE");
    setRunOutput("");
    setRunLogs([]);
    setStepPanels([]);
    setRunError(null);
  };

  const cancelCurrentRun = async () => {
    const currentTaskId = runTaskId;
    stopStreaming();
    if (!currentTaskId) {
      setRunning(false);
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/v1/tasks/${currentTaskId}/cancel`, { method: "POST" });
      setRunStatus("CANCEL_REQUESTED");
      appendLog("已发送取消任务请求。", "error");
    } catch (error) {
      const message = error instanceof Error ? error.message : "取消任务请求失败。";
      appendLog(message, "error");
    } finally {
      setRunning(false);
    }
  };

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

  const saveToDatabase = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/config/agents`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agents }),
      });
      const payload = (await response.json().catch(() => ({}))) as ConfigAgentsResponse;
      if (!response.ok) {
        throw new Error(payload.detail ?? payload.error ?? `保存失败: ${response.status}`);
      }

      const persistedAgents = normalizeAgentConfigs(payload.agents);
      const finalAgents = persistedAgents.length > 0 ? persistedAgents : deepCloneAgents(agents);
      setAgents(finalAgents);
      baselineAgentsRef.current = deepCloneAgents(finalAgents);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildStoragePayload(finalAgents)));
      setDirty(false);
      setBanner("已保存配置到数据库。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存数据库配置失败。";
      setBanner(message);
    }
  };

  const resetSelectedAgent = () => {
    const fallback = baselineAgentsRef.current.find((agent) => agent.id === selectedAgentId);
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
    setBanner("已恢复当前智能体到最近一次保存版本。");
  };

  const handleTaskEvent = (event: TaskEventEnvelope) => {
    const eventType = event.event_type ?? "";
    const payload = event.payload ?? {};

    if (eventType === "snapshot") {
      const output = asString(payload.output);
      const status = asString(payload.status);
      if (typeof output === "string") setRunOutput(output);
      if (typeof status === "string") setRunStatus(status);
      return;
    }

    if (eventType === "task_queued") {
      setRunStatus("QUEUED");
      const queuePosition = asString(payload.queue_position) ?? "-";
      appendLog(`任务已入队，排队位置: ${queuePosition}`);
      return;
    }

    if (eventType === "task_running") {
      setRunStatus("RUNNING");
      appendLog("任务开始执行。");
      return;
    }

    if (eventType === "runtime_resolved") {
      const workflowId = asString(payload.workflow_id) ?? "-";
      const steps = Array.isArray(payload.steps) ? payload.steps : [];
      const nextPanels: StepPanel[] = [];
      steps.forEach((item, index) => {
        if (!item || typeof item !== "object") return;
        const step = item as Record<string, unknown>;
        nextPanels.push({
          stepId: asString(step.step_id) ?? `step-${index + 1}`,
          stepName: asString(step.step_name) ?? asString(step.step_id) ?? `步骤${index + 1}`,
          skillId: asString(step.skill_id) ?? "unknown-skill",
          stepIndex: index + 1,
          stepTotal: steps.length,
          status: "pending",
          output: "",
          outputChars: 0,
        });
      });
      setStepPanels(nextPanels);
      const summary = steps
        .map((item, index) => {
          if (!item || typeof item !== "object") return `${index + 1}.unknown`;
          const step = item as Record<string, unknown>;
          const stepId = asString(step.step_id) ?? "step";
          const skillId = asString(step.skill_id) ?? "skill";
          return `${index + 1}.${stepId}(${skillId})`;
        })
        .join(" -> ");
      appendLog(`运行时已解析: workflow=${workflowId} steps=${summary || "-"}`, "step");
      return;
    }

    if (eventType === "step_started") {
      const stepId = asString(payload.step_id) ?? `step-${Date.now()}`;
      const stepIndexRaw = asString(payload.step_index);
      const stepTotalRaw = asString(payload.step_total);
      const stepIndex = Number(stepIndexRaw ?? "0") || 0;
      const stepTotal = Number(stepTotalRaw ?? "0") || 0;
      const stepName = asString(payload.step_name) ?? asString(payload.step_id) ?? "unknown-step";
      const skillId = asString(payload.skill_id) ?? "unknown-skill";
      upsertStepPanel({
        stepId,
        stepName,
        skillId,
        stepIndex: stepIndex || stepPanels.length + 1,
        stepTotal: stepTotal || Math.max(stepPanels.length, 1),
        status: "running",
        output: "",
        outputChars: 0,
      });
      appendLog(`步骤开始 [${stepIndexRaw ?? "?"}/${stepTotalRaw ?? "?"}] ${stepName} (${skillId})`, "step");
      return;
    }

    if (eventType === "step_completed") {
      const stepId = asString(payload.step_id) ?? `step-${Date.now()}`;
      const stepIndexRaw = asString(payload.step_index);
      const stepTotalRaw = asString(payload.step_total);
      const stepIndex = Number(stepIndexRaw ?? "0") || 0;
      const stepTotal = Number(stepTotalRaw ?? "0") || 0;
      const stepName = asString(payload.step_name) ?? asString(payload.step_id) ?? "unknown-step";
      const outputChars = asString(payload.output_chars) ?? "0";
      const stepOutput = asString(payload.output) ?? asString(payload.output_preview) ?? "";
      const skillId = asString(payload.skill_id) ?? "unknown-skill";
      upsertStepPanel({
        stepId,
        stepName,
        skillId,
        stepIndex: stepIndex || stepPanels.length + 1,
        stepTotal: stepTotal || Math.max(stepPanels.length, 1),
        status: "completed",
        output: stepOutput,
        outputChars: Number(outputChars) || stepOutput.length,
      });
      appendLog(`步骤完成 [${stepIndexRaw ?? "?"}/${stepTotalRaw ?? "?"}] ${stepName} 输出字符=${outputChars}`, "step");
      return;
    }

    if (eventType === "token") {
      const chunk = asString(payload.chunk);
      if (typeof chunk === "string" && chunk.length > 0) {
        setRunOutput((prev) => prev + chunk);
      }
      return;
    }

    if (eventType === "task_succeeded") {
      setRunStatus("SUCCEEDED");
      setRunning(false);
      appendLog("任务执行成功。");
      return;
    }

    if (eventType === "task_failed") {
      setRunStatus("FAILED");
      setRunning(false);
      const error = asString(payload.error) ?? "未知错误";
      setRunError(error);
      appendLog(`任务执行失败: ${error}`, "error");
      return;
    }

    if (eventType === "task_canceled") {
      setRunStatus("CANCELED");
      setRunning(false);
      appendLog("任务已取消。", "error");
      return;
    }
  };

  const handleSseFrame = (frame: string) => {
    const trimmed = frame.trim();
    if (!trimmed || trimmed.startsWith(":")) return;

    const dataLines = frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());
    const rawPayload = (dataLines.length > 0 ? dataLines.join("\n") : trimmed).trim();
    if (!rawPayload) return;

    const envelope = parseEventEnvelope(rawPayload);
    if (!envelope) {
      appendLog(`未识别事件: ${rawPayload.slice(0, 140)}`, "error");
      return;
    }
    handleTaskEvent(envelope);
  };

  const streamTaskEvents = async (taskId: string) => {
    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const response = await fetch(`${API_BASE_URL}/v1/tasks/${taskId}/events`, {
        method: "GET",
        headers: { Accept: "text/event-stream" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`订阅事件失败: HTTP ${response.status}`);
      }
      if (!response.body) {
        throw new Error("事件流为空。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n").replace(/\r/g, "\n");

        let boundaryIndex = buffer.indexOf("\n\n");
        while (boundaryIndex !== -1) {
          const frame = buffer.slice(0, boundaryIndex);
          buffer = buffer.slice(boundaryIndex + 2);
          handleSseFrame(frame);
          boundaryIndex = buffer.indexOf("\n\n");
        }
      }

      buffer += decoder.decode().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      if (buffer.trim()) {
        handleSseFrame(buffer);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "事件流异常断开。";
      setRunError(message);
      setRunStatus("FAILED");
      appendLog(message, "error");
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
      }
      setRunning(false);
    }
  };

  const runStoryboardWorkflow = async () => {
    if (!selectedAgent || !selectedWorkflow) return;
    let prompt = scriptInput.trim();
    let inputPayload: Record<string, unknown> | undefined;

    if (isNovelToScriptAgent) {
      const content = novelContent.trim();
      const audience = novelAudience.trim();
      const episodesRaw = novelExpectedEpisodes.trim();
      if (!content) {
        setRunError("请输入小说内容。");
        return;
      }
      if (!audience) {
        setRunError("请输入小说受众。");
        return;
      }
      if (!episodesRaw) {
        setRunError("请输入期望集数。");
        return;
      }

      const episodes = Number(episodesRaw);
      if (!Number.isInteger(episodes) || episodes <= 0) {
        setRunError("期望集数必须是大于 0 的整数。");
        return;
      }

      prompt = content;
      inputPayload = {
        novel_content: content,
        target_audience: audience,
        expected_episode_count: episodes,
      };
    } else if (!prompt) {
      setRunError("请输入测试数据。");
      return;
    }

    clearRunPanel();
    setRunning(true);
    setRunStatus("CREATING");
    appendLog("正在创建任务...");

    const skillPromptOverrides = Object.fromEntries(
      selectedAgent.skills.map((skill) => [skill.id, skill.promptTemplate]),
    );

    try {
      const response = await fetch(`${API_BASE_URL}/v1/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: "fun-agent-admin",
          agent_id: selectedAgent.id,
          workflow_id: selectedWorkflow.id,
          skill_id: selectedSkill?.id,
          skill_prompt_override: selectedSkill?.promptTemplate,
          skill_prompt_overrides: skillPromptOverrides,
          input_payload: inputPayload,
          prompt,
          idempotency_key: `run-${selectedAgent.id}-${selectedWorkflow.id}-${Date.now()}`,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as TaskCreateResponse;
      if (!response.ok) {
        throw new Error(payload.detail ?? payload.error ?? `请求失败: ${response.status}`);
      }
      if (!payload.task_id) {
        throw new Error("任务创建成功，但未返回 task_id。");
      }

      setRunTaskId(payload.task_id);
      setRunStatus(payload.status ?? "QUEUED");
      appendLog(`任务已创建: ${payload.task_id}`);
      await streamTaskEvents(payload.task_id);
    } catch (error) {
      setRunning(false);
      setRunStatus("FAILED");
      const message = error instanceof Error ? error.message : "创建任务失败。";
      setRunError(message);
      appendLog(message, "error");
    }
  };

  if (!selectedAgent) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-8">
        <Card>
          <CardHeader>
            <CardTitle>未找到可用智能体</CardTitle>
            <CardDescription>请检查数据库配置，或确认 `config/agent-config.ts` 中存在本地回退配置。</CardDescription>
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
            <Badge className="bg-primary text-primary-foreground">Fun Agent 控制台</Badge>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">Fun Agent 1.0</h1>
            <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
              结构层: 智能体 - 工作流 - 技能。测试入口支持输入剧本并流式查看执行过程和结果。
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
            <CardDescription>选择智能体后可配置工作流和技能提示词。</CardDescription>
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
              <CardDescription>可配置工作流模型与技能提示词，不支持 agent 级 prompt 配置。</CardDescription>
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
                <Button type="button" onClick={saveToDatabase}>保存到数据库</Button>
                <Button type="button" variant="outline" onClick={resetSelectedAgent}>恢复到已保存版本</Button>
              </div>
              <p className="text-xs text-muted-foreground">{dirty ? "当前有未保存修改。" : "当前配置已落库。"}</p>
            </CardContent>
          </Card>

          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>工作流配置</CardTitle>
              <CardDescription>每个工作流仅绑定模型，技能在步骤中由运行时串行执行。</CardDescription>
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
                      <p className="mt-2 font-mono text-[11px] text-muted-foreground">模型={workflow.modelProfile}</p>
                    </button>
                  );
                })}
              </div>
              {selectedWorkflow ? (
                <div className="rounded-xl border border-border/70 bg-background/50 p-3 text-sm">
                  <p><span className="text-muted-foreground">工作流 ID: </span>{selectedWorkflow.id}</p>
                  <p><span className="text-muted-foreground">模型配置: </span><span className="font-mono">{selectedWorkflow.modelProfile}</span></p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>技能提示词</CardTitle>
              <CardDescription>支持可视化编辑技能提示词；运行任务时会按 skill_id 覆盖到对应步骤。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2">
                {selectedAgent.skills.map((skill) => {
                  const active = selectedSkill?.id === skill.id;
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => setSelectedSkillId(skill.id)}
                      className={[
                        "rounded-xl border p-3 text-left transition-colors",
                        active
                          ? "border-primary bg-primary/8 shadow-sm"
                          : "border-border/70 bg-background/45 hover:border-primary/50",
                      ].join(" ")}
                    >
                      <p className="text-sm font-semibold">{skill.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{skill.id}</p>
                    </button>
                  );
                })}
              </div>
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
                <p className="text-sm text-muted-foreground">请先选择一个技能。</p>
              )}
            </CardContent>
          </Card>

          <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
            <CardHeader>
              <CardTitle>{selectedAgent.name}测试入口</CardTitle>
              <CardDescription>
                {isNovelToScriptAgent
                  ? "输入小说内容、受众和期望集数，前端将以 JSON 传递给智能体。"
                  : "输入测试数据后启动智能体，流式查看步骤过程日志与输出结果。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isNovelToScriptAgent ? (
                <div className="space-y-3">
                  <Textarea
                    rows={8}
                    value={novelContent}
                    onChange={(event) => setNovelContent(event.target.value)}
                    placeholder="小说内容"
                  />
                  <Input
                    value={novelAudience}
                    onChange={(event) => setNovelAudience(event.target.value)}
                    placeholder="小说受众（例如：18-28 都市女性）"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={novelExpectedEpisodes}
                    onChange={(event) => setNovelExpectedEpisodes(event.target.value)}
                    placeholder="期望集数"
                  />
                </div>
              ) : (
                <Textarea
                  rows={10}
                  value={scriptInput}
                  onChange={(event) => setScriptInput(event.target.value)}
                  placeholder="请输入测试数据"
                />
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={runStoryboardWorkflow} disabled={running || !selectedWorkflow}>
                  {running ? "运行中..." : "运行智能体"}
                </Button>
                <Button type="button" variant="outline" onClick={cancelCurrentRun} disabled={!running}>
                  取消任务
                </Button>
                <Button type="button" variant="secondary" onClick={clearRunPanel}>
                  清空结果
                </Button>
                <Badge variant="outline">状态: {runStatus}</Badge>
                <Badge variant="outline">任务: {runTaskId ?? "-"}</Badge>
              </div>

              {runError ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {runError}
                </p>
              ) : null}

              <Separator />

              <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                <p className="mb-2 text-sm font-semibold">步骤分栏输出</p>
                {stepPanels.length === 0 ? (
                  <p className="text-xs text-muted-foreground">暂无步骤数据，开始运行后将按步骤展示输出。</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {stepPanels.map((step) => (
                      <div key={step.stepId} className="rounded-lg border border-border/70 bg-card/80 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            步骤 {step.stepIndex}/{step.stepTotal}: {step.stepName}
                          </p>
                          <Badge variant={step.status === "completed" ? "default" : "secondary"}>
                            {step.status === "completed" ? "已完成" : step.status === "running" ? "执行中" : "待执行"}
                          </Badge>
                        </div>
                        <p className="mb-2 font-mono text-[11px] text-muted-foreground">
                          skill={step.skillId} outputChars={step.outputChars}
                        </p>
                        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">
                          {step.output || "该步骤尚无输出。"}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                  <p className="mb-2 text-sm font-semibold">过程日志</p>
                  <div className="max-h-80 space-y-1 overflow-auto font-mono text-xs">
                    {runLogs.length === 0 ? (
                      <p className="text-muted-foreground">暂无日志，运行任务后这里会实时更新。</p>
                    ) : (
                      runLogs.map((log) => (
                        <p
                          key={log.id}
                          className={
                            log.level === "error"
                              ? "text-destructive"
                              : log.level === "step"
                                ? "text-primary"
                                : "text-foreground"
                          }
                        >
                          [{log.at}] {log.message}
                        </p>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                  <p className="mb-2 text-sm font-semibold">流式输出</p>
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">
                    {runOutput || "暂无输出，运行后将逐字符流式显示。"}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
