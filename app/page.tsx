"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { type AgentConfig, type AgentStatus } from "@/config/agent-config";

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

const DEFAULT_VARIANT_KEY = "__default__";
const VARIANT_KEY_PATTERN = /^[a-z0-9_]+$/;

type ModelsResponse = {
  data?: unknown;
  success?: boolean;
  detail?: string;
  error?: string;
};

type ModelOption = {
  id: string;
  ownedBy: string;
  endpointTypes: string[];
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

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/fun-agents/api").replace(/\/$/, "");

function deepCloneAgents(source: AgentConfig[]): AgentConfig[] {
  return source.map((agent) => ({
    ...agent,
    workflows: agent.workflows.map((workflow) => ({ ...workflow })),
    skills: agent.skills.map((skill) => ({ ...skill })),
  }));
}

function hasConfigDiff(current: AgentConfig[], baseline: AgentConfig[]): boolean {
  return JSON.stringify(current) !== JSON.stringify(baseline);
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
      .map<AgentConfig["skills"][number] | null>((skill) => {
        if (!skill || typeof skill !== "object") return null;
        const row = skill as Record<string, unknown>;
        const skillId = asString(row.id)?.trim();
        if (!skillId) return null;
        const promptVariantsRaw = row.promptVariants;
        const promptVariants: Record<string, string> = {};
        if (promptVariantsRaw && typeof promptVariantsRaw === "object") {
          Object.entries(promptVariantsRaw as Record<string, unknown>).forEach(([key, value]) => {
            const normalizedKey = key.trim();
            const normalizedPrompt = asString(value)?.trim() ?? "";
            if (!normalizedKey || !normalizedPrompt) return;
            promptVariants[normalizedKey] = normalizedPrompt;
          });
        }
        return {
          id: skillId,
          name: asString(row.name)?.trim() || skillId,
          promptTemplate: asString(row.promptTemplate)?.trim() || "",
          promptVariants,
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

function normalizeModelOptions(raw: unknown): ModelOption[] {
  if (!Array.isArray(raw)) return [];

  const options: ModelOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = asString(row.id)?.trim();
    if (!id) continue;
    const endpointTypes = Array.isArray(row.supported_endpoint_types)
      ? row.supported_endpoint_types
          .map((entry) => asString(entry)?.trim().toLowerCase() ?? "")
          .filter((entry) => Boolean(entry))
      : [];
    options.push({
      id,
      ownedBy: asString(row.owned_by)?.trim() || "",
      endpointTypes,
    });
  }

  options.sort((a, b) => a.id.localeCompare(b.id));
  return options;
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
  const baselineAgentsRef = useRef<AgentConfig[]>([]);

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");
  const [selectedVariantKey, setSelectedVariantKey] = useState<string>(DEFAULT_VARIANT_KEY);
  const [newVariantKey, setNewVariantKey] = useState("");
  const [customVariantKeysByAgent, setCustomVariantKeysByAgent] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savedSkillToken, setSavedSkillToken] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);

  const [scriptInput, setScriptInput] = useState("");
  const [novelContent, setNovelContent] = useState("");
  const [novelType, setNovelType] = useState("one_line_script");
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

    const loadAgentConfigs = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/v1/config/agents`, { method: "GET" });
        const payload = (await response.json().catch(() => ({}))) as ConfigAgentsResponse;
        if (!response.ok) {
          throw new Error(payload.detail ?? payload.error ?? `读取配置失败: ${response.status}`);
        }

        const resolved = normalizeAgentConfigs(payload.agents);
        if (cancelled) return;

        baselineAgentsRef.current = deepCloneAgents(resolved);
        setAgents(resolved);
        setSelectedAgentId((prev) => (resolved.find((agent) => agent.id === prev) ? prev : (resolved[0]?.id ?? "")));
        setBanner(resolved.length === 0 ? "数据库暂无智能体配置。" : null);
      } catch {
        if (cancelled) return;
        baselineAgentsRef.current = [];
        setAgents([]);
        setSelectedAgentId("");
        setBanner("读取数据库配置失败。");
      } finally {
        if (!cancelled) {
          setLoadingAgents(false);
        }
      }
    };

    void loadAgentConfigs();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      setLoadingModels(true);
      setModelLoadError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/v1/models`, { method: "GET" });
        const payload = (await response.json().catch(() => ({}))) as ModelsResponse;
        if (!response.ok) {
          throw new Error(payload.detail ?? payload.error ?? `读取模型列表失败: ${response.status}`);
        }
        if (payload.success === false) {
          throw new Error(payload.detail ?? payload.error ?? "模型网关返回 success=false");
        }
        const options = normalizeModelOptions(payload.data);
        if (cancelled) return;
        setModelOptions(options);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "读取模型列表失败。";
        setModelOptions([]);
        setModelLoadError(message);
      } finally {
        if (!cancelled) {
          setLoadingModels(false);
        }
      }
    };

    void loadModels();
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

  useEffect(() => {
    setSavedSkillToken(null);
  }, [selectedAgentId]);

  useEffect(() => {
    setSelectedVariantKey(DEFAULT_VARIANT_KEY);
    setNewVariantKey("");
  }, [selectedAgentId, selectedSkillId]);

  const selectedWorkflow = useMemo(() => {
    if (!selectedAgent) return null;
    return selectedAgent.workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null;
  }, [selectedAgent, selectedWorkflowId]);

  const selectedSkill = useMemo(() => {
    if (!selectedAgent) return null;
    return selectedAgent.skills.find((skill) => skill.id === selectedSkillId) ?? null;
  }, [selectedAgent, selectedSkillId]);

  const availableVariantKeys = useMemo(() => {
    if (!selectedAgent) return [DEFAULT_VARIANT_KEY];
    const keys = new Set<string>();
    keys.add(DEFAULT_VARIANT_KEY);
    selectedAgent.skills.forEach((skill) => {
      Object.keys(skill.promptVariants ?? {}).forEach((key) => {
        if (key) keys.add(key);
      });
    });
    (customVariantKeysByAgent[selectedAgent.id] ?? []).forEach((key) => {
      if (key) keys.add(key);
    });
    return Array.from(keys);
  }, [selectedAgent, customVariantKeysByAgent]);

  useEffect(() => {
    if (!availableVariantKeys.includes(selectedVariantKey)) {
      setSelectedVariantKey(DEFAULT_VARIANT_KEY);
    }
  }, [availableVariantKeys, selectedVariantKey]);

  const activeSkillPrompt = useMemo(() => {
    if (!selectedSkill) return "";
    if (selectedVariantKey === DEFAULT_VARIANT_KEY) {
      return selectedSkill.promptTemplate;
    }
    return selectedSkill.promptVariants?.[selectedVariantKey] ?? "";
  }, [selectedSkill, selectedVariantKey]);

  const selectedSkillDirty = useMemo(() => {
    if (!selectedAgent || !selectedSkill) return false;
    const baselineAgent = baselineAgentsRef.current.find((agent) => agent.id === selectedAgent.id);
    const baselineSkill = baselineAgent?.skills.find((skill) => skill.id === selectedSkill.id);
    if (!baselineSkill) return true;
    if (selectedVariantKey === DEFAULT_VARIANT_KEY) {
      return baselineSkill.promptTemplate !== selectedSkill.promptTemplate;
    }
    const currentPrompt = selectedSkill.promptVariants?.[selectedVariantKey] ?? "";
    const baselinePrompt = baselineSkill.promptVariants?.[selectedVariantKey] ?? "";
    return baselinePrompt !== currentPrompt;
  }, [selectedAgent, selectedSkill, selectedVariantKey]);

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

  const updateSkillPrompt = (skillId: string, promptTemplate: string, variantKey: string = DEFAULT_VARIANT_KEY) => {
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === selectedAgentId
          ? {
              ...agent,
              skills: agent.skills.map((skill) =>
                skill.id === skillId
                  ? variantKey === DEFAULT_VARIANT_KEY
                    ? { ...skill, promptTemplate }
                    : {
                        ...skill,
                        promptVariants: {
                          ...(skill.promptVariants ?? {}),
                          [variantKey]: promptTemplate,
                        },
                      }
                  : skill,
              ),
            }
          : agent,
      ),
    );
    if (skillId === selectedSkillId) {
      setSavedSkillToken(null);
    }
    setDirty(true);
  };

  const updateWorkflowModelProfile = (workflowId: string, modelProfile: string) => {
    const normalized = modelProfile.trim();
    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === selectedAgentId
          ? {
              ...agent,
              workflows: agent.workflows.map((workflow) =>
                workflow.id === workflowId ? { ...workflow, modelProfile: normalized } : workflow,
              ),
            }
          : agent,
      ),
    );
    setDirty(true);
  };

  const persistConfigs = async (
    successMessage: string,
    onSuccess?: (persistedAgents: AgentConfig[]) => void,
  ) => {
    if (savingConfig) return;
    setSavingConfig(true);
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
      setDirty(false);
      onSuccess?.(finalAgents);
      setBanner(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存数据库配置失败。";
      setBanner(message);
    } finally {
      setSavingConfig(false);
    }
  };

  const saveToDatabase = async () => {
    await persistConfigs("已保存配置到数据库。");
  };

  const saveCurrentSkill = async () => {
    if (!selectedAgent || !selectedSkill || savingConfig) return;
    setSavingConfig(true);
    try {
      const isDefaultVariant = selectedVariantKey === DEFAULT_VARIANT_KEY;
      const activePrompt = isDefaultVariant
        ? selectedSkill.promptTemplate
        : (selectedSkill.promptVariants?.[selectedVariantKey] ?? "");
      const endpoint = isDefaultVariant
        ? `${API_BASE_URL}/v1/config/agents/${encodeURIComponent(selectedAgent.id)}/skills/${encodeURIComponent(selectedSkill.id)}`
        : `${API_BASE_URL}/v1/config/agents/${encodeURIComponent(selectedAgent.id)}/skills/${encodeURIComponent(selectedSkill.id)}/variants/${encodeURIComponent(selectedVariantKey)}`;
      const body = isDefaultVariant
        ? {
            name: selectedSkill.name,
            promptTemplate: selectedSkill.promptTemplate,
          }
        : {
            promptTemplate: activePrompt,
          };
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        const message =
          asString(payload.detail) ?? asString(payload.error) ?? `保存 Skill 失败: ${response.status}`;
        throw new Error(message);
      }

      const nextBaseline = deepCloneAgents(
        baselineAgentsRef.current.map((agent) =>
          agent.id === selectedAgent.id
            ? {
                ...agent,
                skills: agent.skills.map((skill) =>
                  skill.id === selectedSkill.id
                    ? {
                        ...skill,
                        name: selectedSkill.name,
                        promptTemplate: isDefaultVariant
                          ? selectedSkill.promptTemplate
                          : skill.promptTemplate,
                        promptVariants: isDefaultVariant
                          ? (skill.promptVariants ?? {})
                          : {
                              ...(skill.promptVariants ?? {}),
                              [selectedVariantKey]: activePrompt,
                            },
                      }
                    : skill,
                ),
              }
            : agent,
        ),
      );
      baselineAgentsRef.current = nextBaseline;
      setSavedSkillToken(`${selectedSkill.id}:${selectedVariantKey}`);
      setDirty(hasConfigDiff(agents, nextBaseline));
      setBanner(
        isDefaultVariant
          ? `已保存 Skill「${selectedSkill.name}」默认提示词到数据库。`
          : `已保存 Skill「${selectedSkill.name}」在 variant「${selectedVariantKey}」下的提示词。`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存 Skill 到数据库失败。";
      setBanner(message);
    } finally {
      setSavingConfig(false);
    }
  };

  const addVariantKey = () => {
    if (!selectedAgent) return;
    const key = newVariantKey.trim();
    if (!key) {
      setBanner("variant_key 不能为空。");
      return;
    }
    if (!VARIANT_KEY_PATTERN.test(key)) {
      setBanner("variant_key 仅支持小写字母、数字和下划线。");
      return;
    }
    if (availableVariantKeys.includes(key)) {
      setSelectedVariantKey(key);
      setBanner(`variant_key「${key}」已存在。`);
      return;
    }
    setCustomVariantKeysByAgent((prev) => {
      const existing = prev[selectedAgent.id] ?? [];
      return {
        ...prev,
        [selectedAgent.id]: [...existing, key],
      };
    });
    setSelectedVariantKey(key);
    setNewVariantKey("");
    setBanner(`已新增 variant_key「${key}」。请为当前 Skill 输入提示词并保存。`);
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
    setSavedSkillToken(null);
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
    let runtimeVariantKey = "";

    if (isNovelToScriptAgent) {
      const content = novelContent.trim();
      const type = novelType.trim();
      const audience = novelAudience.trim();
      const episodesRaw = novelExpectedEpisodes.trim();
      if (!content) {
        setRunError("请输入小说内容。");
        return;
      }
      if (!type) {
        setRunError("请输入小说类型。");
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
      runtimeVariantKey = type;
      inputPayload = {
        novel_content: content,
        novel_type: type,
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
      selectedAgent.skills.map((skill) => {
        const variantPrompt =
          runtimeVariantKey && skill.promptVariants?.[runtimeVariantKey]
            ? skill.promptVariants[runtimeVariantKey]
            : skill.promptTemplate;
        return [skill.id, variantPrompt];
      }),
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
            <CardTitle>{loadingAgents ? "正在加载智能体配置" : "未找到可用智能体"}</CardTitle>
            <CardDescription>
              {loadingAgents ? "正在从数据库读取配置，请稍候。" : "请检查数据库中的智能体配置是否已写入。"}
            </CardDescription>
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
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">模型 ID（modelProfile）</p>
                    <Input
                      list="gateway-model-options"
                      value={selectedWorkflow.modelProfile}
                      onChange={(event) => updateWorkflowModelProfile(selectedWorkflow.id, event.target.value)}
                      placeholder={loadingModels ? "模型列表加载中..." : "输入或选择模型 ID"}
                    />
                    <datalist id="gateway-model-options">
                      {modelOptions.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.ownedBy ? `${model.id} (${model.ownedBy})` : model.id}
                        </option>
                      ))}
                    </datalist>
                    <p className="text-xs text-muted-foreground">
                      {modelLoadError
                        ? `模型列表加载失败: ${modelLoadError}`
                        : `已加载 ${modelOptions.length} 个网关模型，可手动输入自定义 model id。`}
                    </p>
                  </div>
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
                  <div className="mb-3 space-y-2 rounded-md border border-border/70 bg-card/50 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {availableVariantKeys.map((variantKey) => (
                        <Button
                          key={variantKey}
                          type="button"
                          size="sm"
                          variant={selectedVariantKey === variantKey ? "default" : "outline"}
                          onClick={() => setSelectedVariantKey(variantKey)}
                        >
                          {variantKey === DEFAULT_VARIANT_KEY ? "default" : variantKey}
                        </Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={newVariantKey}
                        onChange={(event) => setNewVariantKey(event.target.value)}
                        placeholder="新增 variant_key（如 one_line_script）"
                      />
                      <Button type="button" variant="outline" onClick={addVariantKey}>
                        新增 variant_key
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    rows={4}
                    value={activeSkillPrompt}
                    onChange={(event) =>
                      updateSkillPrompt(selectedSkill.id, event.target.value, selectedVariantKey)
                    }
                    placeholder={
                      selectedVariantKey === DEFAULT_VARIANT_KEY
                        ? "请输入默认技能提示词模板"
                        : `请输入 variant「${selectedVariantKey}」下的技能提示词模板`
                    }
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={saveCurrentSkill}
                      disabled={savingConfig || !selectedSkillDirty}
                    >
                      {savingConfig
                        ? "保存中..."
                        : savedSkillToken === `${selectedSkill.id}:${selectedVariantKey}`
                          ? "已保存"
                          : "保存当前 Skill"}
                    </Button>
                    {selectedSkillDirty ? (
                      <span className="text-xs text-muted-foreground">
                        当前 Skill 在 {selectedVariantKey === DEFAULT_VARIANT_KEY ? "default" : selectedVariantKey} 下有未保存修改。
                      </span>
                    ) : null}
                  </div>
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
                  ? "输入小说内容、类型、受众和期望集数，前端将以 JSON 传递给智能体。"
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
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">小说类型</label>
                    <select
                      value={novelType}
                      onChange={(event) => setNovelType(event.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="one_line_script">一句话剧本</option>
                      <option value="novel_to_script">小说改剧本</option>
                    </select>
                  </div>
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
