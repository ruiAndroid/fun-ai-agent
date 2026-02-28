import { AcceptedActionResponse, InstanceActionType, ListResponse, LobsterInstance } from "@/types/contracts";

const BASE_URL = process.env.NEXT_PUBLIC_CONTROL_API_BASE_URL ?? "http://localhost:8080";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status}: ${body || response.statusText}`);
  }
  return (await response.json()) as T;
}

export async function listInstances() {
  return requestJson<ListResponse<LobsterInstance>>("/v1/instances");
}

export async function submitInstanceAction(instanceId: string, action: InstanceActionType) {
  return requestJson<AcceptedActionResponse>(`/v1/instances/${instanceId}/actions`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}
