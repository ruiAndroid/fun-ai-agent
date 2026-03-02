"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

type TaskStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";

type TaskView = {
  task_id: string;
  tenant_id: string;
  agent_id: string;
  status: TaskStatus;
  output: string;
  error?: string | null;
  queue_position?: number | null;
  created_at: string;
  updated_at: string;
};

type PlaneEvent = {
  event_type: string;
  payload: Record<string, unknown>;
  timestamp?: string;
};

type LogItem = {
  id: string;
  type: string;
  message: string;
  at: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
const TERMINAL_STATUS: TaskStatus[] = ["SUCCEEDED", "FAILED", "CANCELED"];

function asTaskView(payload: Record<string, unknown>): TaskView | null {
  if (
    typeof payload.task_id !== "string" ||
    typeof payload.tenant_id !== "string" ||
    typeof payload.agent_id !== "string" ||
    typeof payload.status !== "string"
  ) {
    return null;
  }
  return payload as unknown as TaskView;
}

function badgeStyle(status: TaskStatus | undefined): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "outline";
  if (status === "SUCCEEDED") return "default";
  if (status === "FAILED") return "destructive";
  if (status === "RUNNING") return "secondary";
  return "outline";
}

export default function Home() {
  const [tenantId, setTenantId] = useState("tenant-demo");
  const [agentId, setAgentId] = useState("agent-writer");
  const [prompt, setPrompt] = useState("请总结用户请求并输出结构化结果。");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [currentTask, setCurrentTask] = useState<TaskView | null>(null);
  const [output, setOutput] = useState("");
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const status = currentTask?.status;
  const isTerminal = useMemo(() => (status ? TERMINAL_STATUS.includes(status) : false), [status]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const pushLog = (type: string, message: string) => {
    setLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        type,
        message,
        at: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 39),
    ]);
  };

  const closeStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStreamActive(false);
  };

  const openStream = (taskId: string) => {
    closeStream();
    const eventSource = new EventSource(`${API_BASE_URL}/api/v1/tasks/${taskId}/events`);
    eventSourceRef.current = eventSource;
    setStreamActive(true);
    pushLog("stream", "SSE stream connected");

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as PlaneEvent;
        const payload = parsed.payload ?? {};
        if (parsed.event_type === "token" && typeof payload.chunk === "string") {
          setOutput((prev) => prev + payload.chunk);
        }

        const taskView = asTaskView(payload);
        if (taskView) {
          setCurrentTask(taskView);
          if (typeof taskView.output === "string") {
            setOutput(taskView.output);
          }
          if (TERMINAL_STATUS.includes(taskView.status)) {
            pushLog("task", `Task ${taskView.status}`);
            closeStream();
          }
        }
        pushLog(parsed.event_type, JSON.stringify(payload));
      } catch {
        pushLog("raw", event.data);
      }
    };

    eventSource.onerror = () => {
      setErrorMessage("SSE 连接中断，请检查 API 与 plane 服务状态。");
      pushLog("error", "SSE stream disconnected");
      closeStream();
    };
  };

  const createTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    setLogs([]);
    setOutput("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          agentId,
          prompt,
          idempotencyKey: idempotencyKey.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as TaskView | { detail?: string };
      if (!response.ok) {
        throw new Error((payload as { detail?: string }).detail ?? "create task failed");
      }

      const task = payload as TaskView;
      setCurrentTask(task);
      setOutput(task.output ?? "");
      pushLog("task", `Task created: ${task.task_id}`);
      openStream(task.task_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "request failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelTask = async () => {
    if (!currentTask) return;
    setErrorMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/tasks/${currentTask.task_id}/cancel`, {
        method: "POST",
      });
      const payload = (await response.json()) as TaskView | { detail?: string };
      if (!response.ok) {
        throw new Error((payload as { detail?: string }).detail ?? "cancel failed");
      }
      setCurrentTask(payload as TaskView);
      pushLog("task", "Cancel requested");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "cancel failed");
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
      <section className="panel-enter mb-6 rounded-3xl border border-border/70 bg-card/80 p-6 shadow-lg backdrop-blur md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="status-dot h-2.5 w-2.5 rounded-full bg-primary" />
              <Badge className="bg-primary text-primary-foreground">Agent Runtime Console</Badge>
            </div>
            <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              fun-ai-agent 平台并发运行面控制台
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
              通过 API 网关提交任务到智能体运行面，实时观察排队、执行、输出流和终态。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs md:text-sm">
            <Badge variant="outline">API: {API_BASE_URL}</Badge>
            <Badge variant="outline">SSE: {streamActive ? "CONNECTED" : "IDLE"}</Badge>
            <Badge variant={badgeStyle(status)}>STATUS: {status ?? "NONE"}</Badge>
            <Badge variant="outline">TASK: {currentTask?.task_id ?? "-"}</Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
          <CardHeader>
            <CardTitle>提交任务</CardTitle>
            <CardDescription>输入租户、智能体和 Prompt。后端会执行并发控制和排队。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={createTask}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="tenant-demo" />
                <Input value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="agent-writer" />
              </div>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                placeholder="输入这次智能体任务的描述"
              />
              <Input
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                placeholder="idempotency key (optional)"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "提交中..." : "创建并运行任务"}
                </Button>
                <Button type="button" variant="secondary" onClick={cancelTask} disabled={!currentTask || isTerminal}>
                  取消当前任务
                </Button>
                <Button type="button" variant="outline" onClick={() => setLogs([])}>
                  清空日志
                </Button>
              </div>
              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            </form>
          </CardContent>
        </Card>

        <Card className="panel-enter border-border/80 bg-card/85 backdrop-blur">
          <CardHeader>
            <CardTitle>任务状态</CardTitle>
            <CardDescription>实时输出和状态快照。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-xl border border-border/70 bg-background/60 p-3 font-mono text-xs">
              <p>task_id: {currentTask?.task_id ?? "-"}</p>
              <p>tenant_id: {currentTask?.tenant_id ?? "-"}</p>
              <p>agent_id: {currentTask?.agent_id ?? "-"}</p>
              <p>queue_position: {currentTask?.queue_position ?? "-"}</p>
              <p>status: {currentTask?.status ?? "-"}</p>
            </div>
            <Separator />
            <div className="rounded-xl border border-border/70 bg-background/70 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-mono text-muted-foreground">实时输出</p>
                <Badge variant="outline">{output.length} chars</Badge>
              </div>
              <pre className="h-52 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
                {output || "等待输出..."}
              </pre>
            </div>
            {currentTask?.error ? (
              <p className="rounded-lg bg-destructive/10 p-2 text-xs text-destructive">{currentTask.error}</p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="panel-enter mt-5">
        <Card className="border-border/80 bg-card/85 backdrop-blur">
          <CardHeader>
            <CardTitle>事件流日志</CardTitle>
            <CardDescription>来自 /api/v1/tasks/&lt;task_id&gt;/events 的 SSE 数据。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 overflow-auto rounded-xl border border-border/70 bg-background/60 p-3">
              {logs.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground">暂无事件</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="rounded-lg border border-border/60 bg-card/70 p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-mono text-[11px] uppercase tracking-wide text-primary">{log.type}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{log.at}</span>
                      </div>
                      <p className="font-mono text-xs leading-relaxed text-foreground/90">{log.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
