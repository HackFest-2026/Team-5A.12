export type Role = "cfo" | "manager" | "customer" | "platform_admin";
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: Role;
  tenantId: string | null;
  tenantName: string | null;
  customerId: string | null;
};

export type AgentRunRequest = {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  context: {
    pageId: string | null;
    route: string;
    search: string;
    locale: string;
    timezone: string;
    uiStateVersion: number;
  };
};

export type AgentRunResponse = {
  id: string;
  status: "completed" | "awaiting_confirmation";
  mode: "deterministic_navigation" | "local_tools" | "openrouter_tools";
  answer: string;
  uiCommand: null | {
    type: "navigate";
    pageId: string;
    route: string;
    uiStateVersion: number;
    form?: {
      actionId: string;
      fields: Record<string, string | number>;
      missingFields: string[];
    };
  };
  pendingAction: AgentPendingAction | null;
  evidence: AgentEvidence[];
  trace: AgentTraceStep[];
  metrics: { durationMs: number; tokens: number };
};

export type AgentEvidence = {
  sourceType: string;
  sourceId: string;
  field: string;
  value: unknown;
  route: string;
  observedAt: string;
};

export type AgentTraceStep = {
  step: string;
  tool?: string;
  outcome: string;
  durationMs?: number;
  evidenceCount?: number;
  usage?: unknown;
};

export type AgentPendingAction = {
  id: string;
  actionType: string;
  summary: string;
  payload: Record<string, unknown>;
  expiresAt: string;
};

export type AgentSignal = {
  id: string;
  severity: "high" | "medium";
  title: string;
  detail: string;
  route: string;
  prompt: string;
};

export type AgentActionResult = {
  actionId: string;
  status: "completed" | "rejected" | "undone";
  answer: string;
  result?: unknown;
  undoUntil?: string | null;
};

export type AgentProgressEvent = {
  type: "run_started" | "progress";
  runId?: string;
  node?: string;
  detail?: string;
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (
    response.status === 401 &&
    path !== "/api/auth/me" &&
    path !== "/api/auth/login"
  )
    window.dispatchEvent(new Event("cashpilot:unauthorized"));
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body;
}

async function streamAgentRun(
  body: AgentRunRequest,
  onProgress?: (event: AgentProgressEvent) => void,
) {
  const response = await fetch(`${API_URL}/api/agent/runs`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) {
    const failure = await response.json().catch(() => ({}));
    throw new Error(failure.error ?? "Agent stream failed");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AgentRunResponse | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const dataLine = frame
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      const event = JSON.parse(dataLine.slice(6));
      if (event.type === "result") result = event.data;
      else if (event.type === "error")
        throw new Error(event.error ?? "Agent stream failed");
      else onProgress?.(event as AgentProgressEvent);
    }
    if (done) break;
  }
  if (!result) throw new Error("Agent stream ended without a result.");
  return result;
}

export const api = {
  get: <T>(path: string, _role?: Role) => request<T>(path),
  post: <T>(path: string, _role?: Role, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  login: (email: string, password: string) =>
    request<SessionUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<SessionUser>("/api/auth/me"),
  logout: () =>
    request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  streamAgentRun,
};
