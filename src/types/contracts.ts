export type InstanceStatus = "CREATING" | "RUNNING" | "STOPPED" | "ERROR";
export type DesiredState = "RUNNING" | "STOPPED";
export type RuntimeType = "ZEROCLAW";
export type InstanceActionType = "START" | "STOP" | "RESTART" | "ROLLBACK";

export interface ClawInstance {
  id: string;
  name: string;
  hostId: string;
  image: string;
  runtime: RuntimeType;
  status: InstanceStatus;
  desiredState: DesiredState;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptedActionResponse {
  taskId: string;
  acceptedAt: string;
}

export interface ListResponse<T> {
  items: T[];
}

export interface ImagePreset {
  id: string;
  name: string;
  image: string;
  runtime: RuntimeType;
  description?: string;
  recommended: boolean;
}

export interface CreateInstanceRequest {
  name: string;
  hostId: string;
  image: string;
  desiredState: DesiredState;
}
