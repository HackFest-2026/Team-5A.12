import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  CornerDownLeft,
  Database,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  api,
  type AgentActionResult,
  type AgentEvidence,
  type AgentPendingAction,
  type AgentRunRequest,
  type AgentRunResponse,
  type AgentSignal,
  type AgentTraceStep,
} from "@/lib/api";
import {
  agentPrefillEvent,
  agentPrefillStorageKey,
} from "@/hooks/use-agent-prefill";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "./ui/sidebar";

const pageIds: Record<string, string> = {
  "/": "page.overview",
  "/cashflow": "page.cashflow",
  "/invoices": "page.invoices",
  "/payments": "page.payments",
  "/customers": "page.customers",
  "/disputes": "page.disputes",
  "/approvals": "page.approvals",
  "/audit": "page.audit",
  "/tenants": "page.tenants",
};

const pageLabels: Record<string, string> = {
  "/": "Overview",
  "/cashflow": "Cash flow",
  "/invoices": "Invoices",
  "/payments": "Payments",
  "/customers": "Customers",
  "/disputes": "Disputes",
  "/approvals": "Approvals",
  "/audit": "Audit",
  "/tenants": "Tenants",
};

type Message = {
  id: string;
  author: "user" | "agent";
  text: string;
  evidence?: AgentEvidence[];
  trace?: AgentTraceStep[];
  metrics?: AgentRunResponse["metrics"];
  mode?: AgentRunResponse["mode"];
};

type ContextDetail = { path: string; detail: string };
type UndoState = { actionId: string; summary: string; until: string };
type DynamicField = {
  key: string;
  label: string;
  promptKey?: string;
  type?: "text" | "number" | "email" | "date" | "textarea" | "select";
  options?: string[];
};
type DynamicFormConfig = {
  label: string;
  required: DynamicField[];
  defaults: Record<string, string | number>;
};
type DynamicForm = {
  actionId: string;
  values: Record<string, string | number>;
  missing: DynamicField[];
};

const dynamicForms: Record<string, DynamicFormConfig> = {
  "action.invoice.create": {
    label: "Create invoice",
    required: [
      { key: "customerId", label: "Customer", promptKey: "customer" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "dueDate", label: "Due date", type: "date" },
    ],
    defaults: { category: "Usage", status: "draft" },
  },
  "action.invoice.create_with_customer": {
    label: "Create customer and invoice",
    required: [
      { key: "company", label: "Company name" },
      { key: "name", label: "Contact name" },
      { key: "email", label: "Contact email", type: "email" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "dueDate", label: "Due date", type: "date" },
    ],
    defaults: {
      segment: "Growth",
      healthScore: 75,
      creditLimit: 1000000,
      paymentTerms: 30,
      category: "Usage",
      status: "draft",
    },
  },
  "action.payment.record": {
    label: "Record payment",
    required: [
      { key: "invoiceId", label: "Invoice number", promptKey: "invoice" },
      { key: "amount", label: "Amount", type: "number" },
      {
        key: "method",
        label: "Payment method",
        type: "select",
        options: ["Bank transfer", "UPI", "Card"],
      },
      { key: "reference", label: "Reference number" },
    ],
    defaults: {},
  },
  "action.customer.create": {
    label: "Add customer",
    required: [
      { key: "name", label: "Contact name" },
      { key: "company", label: "Company name" },
      { key: "email", label: "Email", type: "email" },
    ],
    defaults: {
      segment: "Growth",
      healthScore: 75,
      creditLimit: 1000000,
      paymentTerms: 30,
    },
  },
  "action.dispute.open": {
    label: "Open dispute",
    required: [
      { key: "invoiceId", label: "Invoice number", promptKey: "invoice" },
      {
        key: "reason",
        label: "Reason",
        type: "select",
        options: ["Billing mismatch", "Scope mismatch", "Duplicate charge"],
      },
      { key: "detail", label: "What happened?", type: "textarea" },
    ],
    defaults: {},
  },
};

function createDynamicForm(
  actionId: string,
  fields: Record<string, string | number>,
  current?: DynamicForm | null,
) {
  const config = dynamicForms[actionId];
  if (!config) return null;
  const values = {
    ...config.defaults,
    ...(current?.actionId === actionId ? current.values : {}),
    ...fields,
  };
  const missing = config.required.filter((field) => {
    const value = values[field.key];
    return value === undefined || value === null || String(value).trim() === "";
  });
  return { actionId, values, missing } satisfies DynamicForm;
}
const suggestions = [
  "Why is our cash gap so large?",
  "Rank our collection risks",
  "Record a payment",
];

function cleanAnswer(answer: string) {
  return answer
    .replace(/\$\s*([\d,]+(?:\.\d+)?)/g, (_match, raw: string) => {
      const amount = Number(raw.replaceAll(",", ""));
      return Number.isFinite(amount)
        ? `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
        : `₹${raw}`;
    })
    .replace(/\bUSD\b/gi, "INR")
    .replace(/\b(?:US\s+)?dollars?\b/gi, "rupees")
    .replace(/\s*\[[a-z_]+:[^\]]+\]/gi, "")
    .replace(/\*\*/g, "")
    .replace(/^\s*\*\s+/gm, "• ")
    .trim();
}

function displayValue(value: unknown) {
  if (typeof value === "number")
    return value >= 1000
      ? `₹${value.toLocaleString("en-IN")}`
      : value.toLocaleString("en-IN");
  if (typeof value === "string") return value.replaceAll("_", " ");
  return JSON.stringify(value);
}

function displayFieldName(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/Id$/, "")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function displayPayloadValue(key: string, value: unknown) {
  if (typeof value === "number" && ["amount", "creditLimit"].includes(key))
    return `₹${value.toLocaleString("en-IN")}`;
  return String(value);
}

export function AgentPanel() {
  const { isMobile, open, setOpen, openMobile, setOpenMobile } = useSidebar();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [progressLabel, setProgressLabel] = useState("Checking live records…");
  const [uiStateVersion, setUiStateVersion] = useState(1);
  const [pendingAction, setPendingAction] = useState<AgentPendingAction | null>(
    null,
  );
  const [signals, setSignals] = useState<AgentSignal[]>([]);
  const [contextDetail, setContextDetail] = useState<ContextDetail | null>(
    null,
  );
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [undoSeconds, setUndoSeconds] = useState(0);
  const [dynamicForm, setDynamicForm] = useState<DynamicForm | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      author: "agent",
      text: "I can investigate live finance data, explain the evidence, open product workflows, and prepare safe actions for confirmation.",
    },
  ]);
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const contextLabel = useMemo(() => {
    if (contextDetail?.path === `${location.pathname}${location.search}`)
      return contextDetail.detail;
    const params = new URLSearchParams(location.search);
    const state =
      params.get("status") ?? params.get("search") ?? params.get("period");
    return [
      pageLabels[location.pathname] ?? "Workspace",
      state?.replaceAll("_", " "),
    ]
      .filter(Boolean)
      .join(" · ");
  }, [contextDetail, location.pathname, location.search]);

  useEffect(() => {
    api
      .get<AgentSignal[]>("/api/agent/signals")
      .then(setSignals)
      .catch(() => setSignals([]));
  }, []);

  useEffect(() => {
    if (!undo) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(undo.until).getTime() - Date.now()) / 1000),
      );
      setUndoSeconds(remaining);
      if (!remaining) setUndo(null);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [undo]);

  useEffect(() => {
    const updateContext = (event: Event) =>
      setContextDetail((event as CustomEvent<ContextDetail>).detail);
    const preparePrompt = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt: string }>).detail;
      if (isMobile) setOpenMobile(true);
      else setOpen(true);
      setInput(detail.prompt);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    };
    window.addEventListener("cashpilot:agent-context", updateContext);
    window.addEventListener("cashpilot:agent-prompt", preparePrompt);
    return () => {
      window.removeEventListener("cashpilot:agent-context", updateContext);
      window.removeEventListener("cashpilot:agent-prompt", preparePrompt);
    };
  }, [isMobile, setOpen, setOpenMobile]);

  const show = () => {
    if (isMobile) setOpenMobile(true);
    else setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

  const hide = () => {
    if (isMobile) setOpenMobile(false);
    else setOpen(false);
  };

  const sidebarVisible = isMobile ? openMobile : open;

  const send = async (rawMessage: string, displayMessage?: string) => {
    const message = rawMessage.trim();
    if (!message || busy) return;
    const history = messages
      .filter((item) => item.id !== "welcome")
      .slice(-6)
      .map((item) => ({
        role:
          item.author === "agent" ? ("assistant" as const) : ("user" as const),
        content: item.text,
      }));
    setInput("");
    setMessages((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        author: "user",
        text: displayMessage ?? message,
      },
    ]);
    setBusy(true);
    setProgressLabel("Starting agent workflow…");
    try {
      const payload: AgentRunRequest = {
        message,
        history,
        context: {
          pageId: pageIds[location.pathname] ?? null,
          route: location.pathname,
          search: location.search,
          locale: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          uiStateVersion,
        },
      };
      const result = await api.streamAgentRun(
        payload,
        (event) => event.detail && setProgressLabel(event.detail),
      );
      setMessages((items) => [
        ...items,
        {
          id: result.id,
          author: "agent",
          text: cleanAnswer(result.answer),
          evidence: result.evidence,
          trace: result.trace,
          metrics: result.metrics,
          mode: result.mode,
        },
      ]);
      setPendingAction(result.pendingAction);
      if (result.pendingAction) setDynamicForm(null);
      if (result.uiCommand) {
        setUiStateVersion(result.uiCommand.uiStateVersion);
        if (result.uiCommand.form) {
          const form = result.uiCommand.form;
          const nextDynamic = createDynamicForm(
            form.actionId,
            form.fields,
            dynamicForm,
          );
          if (nextDynamic?.missing.length) {
            setDynamicForm(nextDynamic);
            navigate(result.uiCommand.route.split("?")[0]);
          } else {
            navigate(result.uiCommand.route);
            sessionStorage.setItem(
              agentPrefillStorageKey,
              JSON.stringify(form),
            );
            window.setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent(agentPrefillEvent, { detail: form }),
              );
            }, 50);
          }
        } else {
          navigate(result.uiCommand.route);
        }
      }
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          author: "agent",
          text:
            error instanceof Error ? error.message : "The agent run failed.",
        },
      ]);
    } finally {
      setBusy(false);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const decide = async (decision: "confirm" | "reject") => {
    if (!pendingAction || busy) return;
    setBusy(true);
    try {
      const result = await api.post<AgentActionResult>(
        `/api/agent/actions/${pendingAction.id}/${decision}`,
      );
      setMessages((items) => [
        ...items,
        { id: crypto.randomUUID(), author: "agent", text: result.answer },
      ]);
      if (decision === "confirm" && result.undoUntil) {
        setUndo({
          actionId: result.actionId,
          summary: pendingAction.summary,
          until: result.undoUntil,
        });
      }
      setPendingAction(null);
      if (decision === "confirm")
        window.dispatchEvent(new Event("cashpilot:data-changed"));
      api
        .get<AgentSignal[]>("/api/agent/signals")
        .then(setSignals)
        .catch(() => undefined);
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          author: "agent",
          text: error instanceof Error ? error.message : "The action failed.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const undoAction = async () => {
    if (!undo || busy) return;
    setBusy(true);
    try {
      const result = await api.post<AgentActionResult>(
        `/api/agent/actions/${undo.actionId}/undo`,
      );
      setMessages((items) => [
        ...items,
        { id: crypto.randomUUID(), author: "agent", text: result.answer },
      ]);
      setUndo(null);
      window.dispatchEvent(new Event("cashpilot:data-changed"));
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          author: "agent",
          text: error instanceof Error ? error.message : "Undo failed.",
        },
      ]);
      setUndo(null);
    } finally {
      setBusy(false);
    }
  };

  const submitDynamicForm = (event: React.FormEvent) => {
    event.preventDefault();
    if (!dynamicForm || busy) return;
    const config = dynamicForms[dynamicForm.actionId];
    const details = Object.entries(dynamicForm.values)
      .filter(([, value]) => String(value).trim() !== "")
      .map(([key, value]) => {
        const field = config.required.find((item) => item.key === key);
        return `${field?.promptKey ?? key}: ${value}`;
      })
      .join(", ");
    const visibleDetails = dynamicForm.missing
      .map(
        (field) =>
          `${field.label}: ${String(dynamicForm.values[field.key] ?? "")}`,
      )
      .join(" · ");
    void send(
      `Continue ${config.label.toLowerCase()} with ${details}.`,
      visibleDetails,
    );
  };

  return (
    <>
      <Sidebar
        side="right"
        variant="floating"
        collapsible="offcanvas"
        aria-label="CashPilot agent"
        className="z-40 md:[--sidebar-width:390px] min-[1800px]:[--sidebar-width:420px]"
      >
        <SidebarHeader className="border-b border-line bg-white px-4 py-3.5 text-ink">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand-dark">
              <Sparkles size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">CashPilot agent</p>
              <p className="text-[10px] text-muted">
                Live tools · confirmed writes
              </p>
            </div>
            <Button
              aria-label="Close agent"
              variant="ghost"
              size="icon"
              onClick={hide}
            >
              <X size={18} />
            </Button>
          </div>
          <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-[10px] font-semibold text-muted">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate">{contextLabel}</span>
          </div>
        </SidebarHeader>
        <SidebarContent className="scrollbar-none min-h-64 flex-1 space-y-3 overscroll-contain overflow-y-auto bg-[#fbfaf6] p-4">
          {messages.length === 1 &&
            signals.map((signal) => (
              <button
                key={signal.id}
                onClick={() => void send(signal.prompt)}
                className={`w-full rounded-2xl border p-3 text-left ${signal.severity === "high" ? "border-coral/20 bg-coral-soft/60" : "border-amber/20 bg-amber-soft/60"}`}
              >
                <span className="flex items-center gap-2 text-xs font-bold">
                  <Sparkles size={13} />
                  {signal.title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  {signal.detail}
                </span>
                <span className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-brand-dark">
                  Investigate with live data
                </span>
              </button>
            ))}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.author === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] ${message.author === "user" ? "" : "w-full"}`}
              >
                <div
                  className={`whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm leading-5 ${message.author === "user" ? "ml-auto w-fit rounded-br-sm bg-ink text-white" : "rounded-bl-sm border border-line bg-white text-ink"}`}
                >
                  {message.text}
                </div>
                {message.evidence && message.evidence.length > 0 && (
                  <div className="mt-2 grid gap-1.5">
                    {message.evidence.slice(0, 4).map((item, index) => (
                      <button
                        key={`${item.sourceType}-${item.sourceId}-${item.field}-${index}`}
                        onClick={() => navigate(item.route)}
                        className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-left hover:border-brand/30"
                      >
                        <Database size={13} className="shrink-0 text-brand" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-muted">
                            {item.sourceType} · {item.sourceId}
                          </span>
                          <span className="block truncate text-xs font-semibold">
                            {item.field.replaceAll("_", " ")}:{" "}
                            {displayValue(item.value)}
                          </span>
                        </span>
                        <ExternalLink size={12} className="text-muted" />
                      </button>
                    ))}
                  </div>
                )}
                {message.trace && message.trace.length > 0 && (
                  <details className="mt-2 rounded-xl border border-line bg-white text-xs">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-bold text-muted">
                      <ChevronDown size={13} />
                      Execution trace
                      <span className="ml-auto font-mono text-[10px] font-normal">
                        {message.metrics?.durationMs ?? 0}ms ·{" "}
                        {message.metrics?.tokens ?? 0} tokens
                      </span>
                    </summary>
                    <div className="space-y-1 border-t border-line px-3 py-2">
                      {message.trace.map((step, index) => (
                        <div
                          key={`${step.step}-${index}`}
                          className="flex items-center justify-between gap-2"
                        >
                          <span>
                            <b>{step.tool ?? step.step}</b> ·{" "}
                            {step.outcome.replaceAll("_", " ")}
                          </span>
                          <span className="font-mono text-[10px] text-muted">
                            {step.durationMs === undefined
                              ? ""
                              : `${step.durationMs}ms`}
                          </span>
                        </div>
                      ))}
                      <p className="pt-1 text-[10px] text-muted">
                        Mode: {message.mode?.replaceAll("_", " ")}
                      </p>
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-line bg-white px-3.5 py-2.5 text-xs text-muted">
                <LoaderCircle className="animate-spin" size={14} />
                {progressLabel}
              </div>
            </div>
          )}
          {pendingAction && (
            <div className="rounded-2xl border border-amber/25 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-amber">
                <ShieldCheck size={15} />
                Confirmation required
              </div>
              <p className="mt-2 text-sm font-bold">{pendingAction.summary}</p>
              <dl className="mt-2 grid gap-1 rounded-xl bg-canvas p-2.5 text-[11px]">
                {Object.entries(pendingAction.payload).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt className="text-muted">{displayFieldName(key)}</dt>
                    <dd className="max-w-[65%] truncate font-semibold">
                      {displayPayloadValue(key, value)}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void decide("reject")}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="brand"
                  disabled={busy}
                  onClick={() => void decide("confirm")}
                >
                  <Check size={14} />
                  Confirm
                </Button>
              </div>
            </div>
          )}
          {dynamicForm && dynamicForm.missing.length > 0 && (
            <form
              onSubmit={submitDynamicForm}
              className="rounded-2xl border border-brand/20 bg-white p-3 shadow-sm"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-brand-dark">
                <Sparkles size={14} />
                Complete only the missing details
              </div>
              <p className="mt-1 text-[11px] leading-4 text-muted">
                {`I kept everything you already provided for ${dynamicForms[
                  dynamicForm.actionId
                ].label.toLowerCase()}.`}
              </p>
              <div className="mt-3 grid gap-2.5">
                {dynamicForm.missing.map((field) => (
                  <label key={field.key} className="grid gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                      {field.label}
                    </span>
                    {field.type === "select" ? (
                      <Select
                        className="w-full"
                        required
                        value={String(dynamicForm.values[field.key] ?? "")}
                        onChange={(event) =>
                          setDynamicForm((current) =>
                            current
                              ? {
                                  ...current,
                                  values: {
                                    ...current.values,
                                    [field.key]: event.target.value,
                                  },
                                }
                              : current,
                          )
                        }
                      >
                        <option value="">
                          Choose {field.label.toLowerCase()}
                        </option>
                        {field.options?.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </Select>
                    ) : field.type === "textarea" ? (
                      <textarea
                        required
                        rows={3}
                        value={String(dynamicForm.values[field.key] ?? "")}
                        onChange={(event) =>
                          setDynamicForm((current) =>
                            current
                              ? {
                                  ...current,
                                  values: {
                                    ...current.values,
                                    [field.key]: event.target.value,
                                  },
                                }
                              : current,
                          )
                        }
                        className="rounded-xl border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                      />
                    ) : (
                      <Input
                        required
                        type={field.type ?? "text"}
                        min={field.type === "number" ? 1 : undefined}
                        value={String(dynamicForm.values[field.key] ?? "")}
                        onChange={(event) =>
                          setDynamicForm((current) =>
                            current
                              ? {
                                  ...current,
                                  values: {
                                    ...current.values,
                                    [field.key]: event.target.value,
                                  },
                                }
                              : current,
                          )
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setDynamicForm(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" variant="brand" disabled={busy}>
                  Continue
                </Button>
              </div>
            </form>
          )}
          {undo && (
            <div className="flex items-center gap-3 rounded-2xl bg-ink px-3.5 py-3 text-white shadow-sm">
              <ShieldCheck size={15} className="text-emerald-300" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold">
                  Action completed safely
                </p>
                <p className="truncate text-[10px] text-white/55">
                  {undo.summary}
                </p>
              </div>
              <button
                onClick={() => void undoAction()}
                disabled={busy}
                className="shrink-0 text-xs font-extrabold text-emerald-300"
              >
                Undo · {undoSeconds}s
              </button>
            </div>
          )}
        </SidebarContent>
        <SidebarFooter className="gap-0 border-t border-line bg-white p-0">
          {messages.length === 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pt-3">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => void send(suggestion)}
                  className="shrink-0 rounded-full border border-line bg-canvas px-3 py-1.5 text-[11px] font-semibold text-muted hover:border-brand/30 hover:text-brand-dark"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex gap-2 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={busy || Boolean(pendingAction)}
              maxLength={500}
              placeholder={
                pendingAction
                  ? "Confirm or reject the proposed action"
                  : "Ask, investigate, or take action…"
              }
              className="ui-control min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3.5 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
            />
            <Button
              type="submit"
              aria-label="Send request"
              variant="brand"
              size="icon"
              disabled={busy || !input.trim()}
            >
              <CornerDownLeft size={17} />
            </Button>
          </form>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      {!sidebarVisible && (
        <button
          onClick={show}
          className="ui-button ui-button-brand fixed bottom-5 right-5 z-20 flex h-12 items-center gap-2 rounded-full bg-brand px-4 text-sm font-bold text-white shadow-lift 2xl:hidden"
        >
          <Bot size={19} />
          <span className="hidden sm:inline">Ask CashPilot</span>
          {signals.length > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-white px-1.5 text-[10px] font-extrabold leading-5 text-brand-dark">
              {signals.length}
            </span>
          )}
        </button>
      )}
    </>
  );
}
