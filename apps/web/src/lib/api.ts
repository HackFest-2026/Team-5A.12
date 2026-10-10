export type Role = "cfo" | "manager" | "customer" | "platform_admin";
export type SessionUser = {
  id: string; name: string; email: string; avatar: string; role: Role;
  tenantId: string | null; tenantName: string | null; customerId: string | null;
};

export type AgentRunRequest = {
  message: string;
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
  status: "completed";
  mode: "deterministic_navigation";
  answer: string;
  uiCommand: null | { type: "navigate"; pageId: string; route: string; uiStateVersion: number };
  trace: Array<{ step: string; outcome: string; actorRole?: Role }>;
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== "/api/auth/me" && path !== "/api/auth/login") window.dispatchEvent(new Event("cashpilot:unauthorized"));
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body;
}

export const api = {
  get: <T>(path: string, _role?: Role) => request<T>(path),
  post: <T>(path: string, _role?: Role, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  login: (email: string, password: string) => request<SessionUser>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<SessionUser>("/api/auth/me"),
  logout: () => request<{ok: boolean}>("/api/auth/logout", { method: "POST" }),
};
