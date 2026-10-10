import { useEffect, useState } from "react";

export const agentPrefillEvent = "cashpilot:agent-prefill";
export const agentPrefillStorageKey = "cashpilot:agent-prefill-pending";

export type AgentPrefill = {
  actionId: string;
  fields: Record<string, string | number>;
};

export function useAgentPrefill<T extends Record<string, unknown>>(
  actionId: string,
  initial: T,
  enabled = true,
) {
  const [form, setForm] = useState<T>(initial);

  useEffect(() => {
    if (!enabled) return;

    const apply = (detail?: AgentPrefill | null) => {
      if (!detail || detail.actionId !== actionId) return;
      setForm((current) => ({ ...current, ...detail.fields }) as T);
      sessionStorage.removeItem(agentPrefillStorageKey);
    };
    const receive = (event: Event) => {
      apply((event as CustomEvent<AgentPrefill>).detail);
    };

    try {
      const pending = sessionStorage.getItem(agentPrefillStorageKey);
      if (pending) apply(JSON.parse(pending) as AgentPrefill);
    } catch {
      sessionStorage.removeItem(agentPrefillStorageKey);
    }

    window.addEventListener(agentPrefillEvent, receive);
    return () => window.removeEventListener(agentPrefillEvent, receive);
  }, [actionId, enabled]);

  return [form, setForm] as const;
}
