import {
  AcceptedActionResponse,
  ClawInstance,
  CreateInstanceRequest,
  ImagePreset,
  InstanceActionType,
  ListResponse,
} from "@/types/contracts";
import { appConfig } from "@/config/app-config";

const BASE_URL = appConfig.controlApiBaseUrl;

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
  return requestJson<ListResponse<ClawInstance>>("/v1/instances");
}

export async function listImages() {
  return requestJson<ListResponse<ImagePreset>>("/v1/images");
}

export async function createInstance(request: CreateInstanceRequest) {
  return requestJson<ClawInstance>("/v1/instances", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function submitInstanceAction(instanceId: string, action: InstanceActionType) {
  return requestJson<AcceptedActionResponse>(`/v1/instances/${instanceId}/actions`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}
