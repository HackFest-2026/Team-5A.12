import { useState } from "react";
import {
  ArrowRight,
  BadgeIndianRupee,
  Check,
  FileText,
  LockKeyhole,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useRole } from "@/context/role-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const accounts = [
  { role: "CFO / Owner", name: "Maya Iyer", email: "maya@northstarlabs.in" },
  { role: "Finance Manager", name: "Dev Malhotra", email: "dev@northstarlabs.in" },
  { role: "Customer", name: "Riya Mehta", email: "riya@acmeretail.in" },
  { role: "Platform Admin", name: "Anika Bose", email: "anika@cashpilot.app" },
];

const principles = [
  "See the live cash position",
  "Act with a complete audit trail",
  "Keep every role in one workspace",
];

export function LoginPage() {
  const { login } = useRole();
  const [email, setEmail] = useState(accounts[0].email);
  const [password, setPassword] = useState("demo1234");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-canvas text-ink">
      <header className="mx-auto flex h-20 max-w-[1240px] items-center border-b border-line px-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
            <BadgeIndianRupee size={18} strokeWidth={2} />
          </span>
          <span className="font-display text-xl tracking-[-.035em]">CashPilot</span>
        </div>
        <p className="ml-auto hidden text-xs font-semibold text-muted sm:block">
          Finance operations, thoughtfully organized.
        </p>
      </header>

      <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1.15fr)_420px] lg:gap-20 lg:py-20">
        <section className="flex flex-col justify-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-brand">
            Built for finance teams
          </p>
          <h1 className="mt-5 max-w-[680px] font-display text-[48px] leading-[.98] tracking-[-.05em] sm:text-[64px] lg:text-[76px]">
            Every rupee,
            <br />
            finally in view.
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            Follow cash, collect receivables, and approve the next move from one
            calm, controlled workspace.
          </p>

          <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
            {principles.map((principle) => (
              <div key={principle} className="flex items-start gap-2 border-t border-line pt-3 text-xs font-semibold leading-5">
                <Check className="mt-0.5 shrink-0 text-brand" size={14} />
                {principle}
              </div>
            ))}
          </div>

          <div className="relative mt-14 hidden h-[230px] max-w-2xl overflow-hidden border border-line bg-[#eef2ff] sm:block">
            <div className="absolute inset-x-0 top-0 flex items-center justify-between border-b border-[#ccd7fb] px-5 py-3 text-[10px] font-bold uppercase tracking-[.14em] text-brand-dark">
              <span>Northstar cash position</span>
              <span>Live ledger</span>
            </div>
            <svg viewBox="0 0 700 175" className="absolute inset-x-0 bottom-0 h-[175px] w-full" aria-hidden="true">
              <path d="M0 139 C75 134 93 105 153 111 C222 118 243 78 310 85 C387 94 403 52 476 59 C541 65 578 24 700 16 L700 175 L0 175Z" fill="#dbe4ff" />
              <path d="M0 139 C75 134 93 105 153 111 C222 118 243 78 310 85 C387 94 403 52 476 59 C541 65 578 24 700 16" fill="none" stroke="#4263c7" strokeWidth="3" />
            </svg>
            <div className="absolute bottom-5 left-5 flex gap-2">
              {[TrendingUp, FileText, ShieldCheck].map((Icon, index) => (
                <span key={index} className="grid h-9 w-9 place-items-center border border-[#c7d2f5] bg-white text-brand">
                  <Icon size={16} />
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="self-center border-t-2 border-ink bg-white/70 px-0 py-7 sm:px-8">
          <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-brand">Workspace access</p>
          <h2 className="mt-3 font-display text-4xl leading-none tracking-[-.04em]">Welcome back.</h2>
          <p className="mt-3 text-sm leading-6 text-muted">Sign in or choose a demo role to explore the workspace.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block text-xs font-bold text-ink">
              Work email
              <Input className="mt-2" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="block text-xs font-bold text-ink">
              Password
              <div className="relative mt-2">
                <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <Input className="pl-9" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
            </label>
            {error && <div className="border-l-2 border-coral bg-coral-soft px-3 py-2.5 text-sm font-semibold text-red-700">{error}</div>}
            <Button type="submit" className="h-11 w-full" variant="default" disabled={busy}>
              {busy ? "Signing in…" : <>Enter workspace <ArrowRight size={16} /></>}
            </Button>
          </form>

          <div className="my-7 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[10px] font-bold uppercase tracking-[.15em] text-muted">Demo roles</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line">
            {accounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => { setEmail(account.email); setPassword("demo1234"); setError(""); }}
                className={`ui-button p-3 text-left ${email === account.email ? "bg-brand-soft text-brand-dark" : "bg-white text-ink"}`}
              >
                <span className="block text-xs font-bold">{account.name}</span>
                <span className="mt-1 block text-[10px] text-muted">{account.role}</span>
              </button>
            ))}
          </div>
          <p className="mt-5 text-center text-[11px] text-muted">Demo password: <strong className="text-ink">demo1234</strong></p>
        </section>
      </div>
    </main>
  );
}
