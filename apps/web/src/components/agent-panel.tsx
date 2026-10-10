import { useMemo, useRef, useState } from "react";
import { Bot, CornerDownLeft, LoaderCircle, Sparkles, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, type AgentRunRequest, type AgentRunResponse } from "@/lib/api";
import { Button } from "./ui/button";

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

type Message = { id: string; author: "user" | "agent"; text: string };

const suggestions = ["Show overdue invoices", "Open cash flow", "Go to approvals"];

export function AgentPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [uiStateVersion, setUiStateVersion] = useState(1);
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", author: "agent", text: "I can navigate CashPilot and apply invoice filters. Finance answers and actions are coming next." },
  ]);
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const contextLabel = useMemo(() => pageIds[location.pathname]?.replace("page.", "") ?? "workspace", [location.pathname]);

  const show = () => {
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

  const send = async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || busy) return;
    setInput("");
    setMessages((items) => [...items, { id: crypto.randomUUID(), author: "user", text: message }]);
    setBusy(true);
    try {
      const payload: AgentRunRequest = {
        message,
        context: {
          pageId: pageIds[location.pathname] ?? null,
          route: location.pathname,
          search: location.search,
          locale: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          uiStateVersion,
        },
      };
      const result = await api.post<AgentRunResponse>("/api/agent/runs", undefined, payload);
      setMessages((items) => [...items, { id: result.id, author: "agent", text: result.answer }]);
      if (result.uiCommand) {
        setUiStateVersion(result.uiCommand.uiStateVersion);
        navigate(result.uiCommand.route);
      }
    } catch (error) {
      setMessages((items) => [...items, {
        id: crypto.randomUUID(), author: "agent", text: error instanceof Error ? error.message : "The agent run failed.",
      }]);
    } finally {
      setBusy(false);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return <>
    {open && <section aria-label="CashPilot agent" className="fixed inset-x-3 bottom-3 z-50 flex max-h-[min(680px,calc(100vh-1.5rem))] flex-col overflow-hidden rounded-[22px] border border-line bg-white shadow-lift sm:left-auto sm:right-5 sm:w-[400px]">
      <header className="flex items-center gap-3 border-b border-line bg-ink px-4 py-3.5 text-white">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand"><Sparkles size={17}/></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-bold">CashPilot agent</p><p className="truncate text-[10px] text-white/55">Current context: {contextLabel}</p></div>
        <Button aria-label="Close agent" variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setOpen(false)}><X size={18}/></Button>
      </header>
      <div className="scrollbar-none min-h-64 flex-1 space-y-3 overflow-y-auto bg-canvas/60 p-4">
        {messages.map((message) => <div key={message.id} className={`flex ${message.author === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${message.author === "user" ? "rounded-br-md bg-ink text-white" : "rounded-bl-md border border-line bg-white text-ink"}`}>{message.text}</div>
        </div>)}
        {busy && <div className="flex justify-start"><div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-line bg-white px-3.5 py-2.5 text-xs text-muted"><LoaderCircle className="animate-spin" size={14}/>Resolving request…</div></div>}
      </div>
      {messages.length === 1 && <div className="flex gap-2 overflow-x-auto border-t border-line bg-white px-4 pt-3">
        {suggestions.map((suggestion) => <button key={suggestion} onClick={() => void send(suggestion)} className="shrink-0 rounded-full border border-line bg-canvas px-3 py-1.5 text-[11px] font-semibold text-muted hover:border-brand/30 hover:text-brand-dark">{suggestion}</button>)}
      </div>}
      <form className="flex gap-2 bg-white p-4" onSubmit={(event) => { event.preventDefault(); void send(input); }}>
        <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} disabled={busy} maxLength={500} placeholder="Ask me to navigate…" className="min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3.5 text-sm outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"/>
        <Button aria-label="Send request" variant="brand" size="icon" disabled={busy || !input.trim()}><CornerDownLeft size={17}/></Button>
      </form>
    </section>}
    {!open && <button onClick={show} className="fixed bottom-5 right-5 z-20 flex h-12 items-center gap-2 rounded-full bg-brand px-4 text-sm font-bold text-white shadow-lift transition-transform hover:-translate-y-0.5">
      <Bot size={19}/><span className="hidden sm:inline">Ask CashPilot</span>
    </button>}
  </>;
}
