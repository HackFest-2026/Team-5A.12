import { useState } from "react";
import { ArrowRight, BadgeIndianRupee, Check, LockKeyhole, Sparkles } from "lucide-react";
import { useRole } from "@/context/role-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const accounts = [
  { role:"CFO / Owner", name:"Maya Iyer", email:"maya@northstarlabs.in", initials:"MI" },
  { role:"Finance Manager", name:"Dev Malhotra", email:"dev@northstarlabs.in", initials:"DM" },
  { role:"Customer", name:"Riya Mehta", email:"riya@acmeretail.in", initials:"RM" },
  { role:"Platform Admin", name:"Anika Bose", email:"anika@cashpilot.app", initials:"AB" },
];

export function LoginPage(){
  const { login } = useRole();
  const [email,setEmail] = useState(accounts[0].email);
  const [password,setPassword] = useState("demo1234");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError("");try{await login(email,password)}catch(err){setError(err instanceof Error?err.message:"Unable to sign in") }finally{setBusy(false)}};
  return <main className="min-h-screen bg-[#f4f5ef] p-3 sm:p-6">
    <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-[1280px] overflow-hidden rounded-[28px] border border-line bg-white shadow-lift sm:min-h-[calc(100vh-3rem)] lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
        <div className="absolute -bottom-28 left-12 h-80 w-80 rounded-full bg-amber/10 blur-3xl" />
        <div className="relative flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand"><BadgeIndianRupee size={22}/></span><div><p className="text-lg font-extrabold tracking-[-.04em]">CashPilot</p><p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/50">Finance operations</p></div></div>
        <div className="relative my-auto max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-brand-soft"><Sparkles size={14}/>Context-aware finance workspace</div>
          <h1 className="text-5xl font-extrabold leading-[1.06] tracking-[-.055em]">Every financial decision, in one controlled workspace.</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/60">Cash visibility, collections, approvals and tenant governance—secured by role and backed by a complete audit trail.</p>
          <div className="mt-10 grid grid-cols-2 gap-3">{["Tenant isolation","Role-based access","Audited actions","Agent-ready APIs"].map(item=><div key={item} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] p-3 text-sm font-semibold text-white/80"><span className="grid h-5 w-5 place-items-center rounded-full bg-brand/20 text-brand-soft"><Check size={12}/></span>{item}</div>)}</div>
        </div>
        <p className="relative text-xs text-white/35">Secure demo environment · Synthetic financial data</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-md">
          <div className="mb-9 flex items-center gap-3 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white"><BadgeIndianRupee size={21}/></span><span className="text-lg font-extrabold tracking-[-.04em]">CashPilot</span></div>
          <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-brand">Welcome back</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-[-.045em]">Sign in to your workspace</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Use one of the demo personas below or enter your credentials.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block text-xs font-bold text-ink">Work email<Input className="mt-2" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
            <label className="block text-xs font-bold text-ink">Password<div className="relative mt-2"><LockKeyhole size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"/><Input className="pl-9" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></div></label>
            {error&&<div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">{error}</div>}
            <Button className="h-11 w-full" variant="brand" disabled={busy}>{busy?"Signing in…":<>Sign in <ArrowRight size={16}/></>}</Button>
          </form>
          <div className="my-7 flex items-center gap-3"><span className="h-px flex-1 bg-line"/><span className="text-[10px] font-bold uppercase tracking-[.15em] text-muted">Demo personas</span><span className="h-px flex-1 bg-line"/></div>
          <div className="grid gap-2 sm:grid-cols-2">{accounts.map(account=><button key={account.email} onClick={()=>{setEmail(account.email);setPassword("demo1234");setError("")}} className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${email===account.email?"border-brand bg-brand-soft":"border-line hover:border-ink/20 hover:bg-canvas"}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink text-[10px] font-bold text-white">{account.initials}</span><span className="min-w-0"><span className="block truncate text-xs font-bold">{account.name}</span><span className="block truncate text-[10px] text-muted">{account.role}</span></span></button>)}</div>
          <p className="mt-5 text-center text-[11px] text-muted">All demo accounts use password <strong className="text-ink">demo1234</strong></p>
        </div>
      </section>
    </div>
  </main>
}
