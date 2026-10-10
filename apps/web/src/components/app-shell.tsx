import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Activity, BadgeIndianRupee, Bell, Bot, Building2, ChevronDown, CircleDollarSign,
  FileCheck2, FileText, LayoutDashboard, LogOut, Menu, ReceiptText, ShieldCheck, Users, WalletCards, X,
} from "lucide-react";
import { useRole } from "@/context/role-context";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import type { Role } from "@/lib/api";
import { cn, relativeDate } from "@/lib/utils";
import { Button } from "./ui/button";

const nav = [
  { to:"/", label:"Overview", icon:LayoutDashboard, roles:["cfo","manager","customer","platform_admin"] },
  { to:"/cashflow", label:"Cash flow", icon:Activity, roles:["cfo","manager"] },
  { to:"/invoices", label:"Invoices", icon:FileText, roles:["cfo","manager","customer"] },
  { to:"/payments", label:"Payments", icon:WalletCards, roles:["cfo","manager","customer"] },
  { to:"/customers", label:"Customers", icon:Users, roles:["cfo","manager"] },
  { to:"/disputes", label:"Disputes", icon:ReceiptText, roles:["cfo","manager","customer"] },
  { to:"/approvals", label:"Approvals", icon:FileCheck2, roles:["cfo","manager"] },
  { to:"/audit", label:"Audit log", icon:ShieldCheck, roles:["cfo","manager","platform_admin"] },
  { to:"/tenants", label:"Tenants", icon:Building2, roles:["platform_admin"] },
] satisfies Array<{to:string;label:string;icon:typeof Activity;roles:Role[]}>;

type Notification={id:string;type:string;title:string;detail:string;route:string;read_at:string|null;created_at:string};

export function AppShell({ children }: { children: ReactNode }) {
  const { role, user, logout, person } = useRole();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  const location = useLocation();
  const navigate=useNavigate();
  const notifications=useApi<Notification[]>("/api/notifications");
  const unread=notifications.data?.filter(item=>!item.read_at).length??0;
  const openNotification=async(item:Notification)=>{if(!item.read_at)await api.post(`/api/notifications/${item.id}/read`);setNotificationsOpen(false);await notifications.reload();navigate(item.route)};
  const readAll=async()=>{await api.post("/api/notifications/read-all");await notifications.reload()};
  const current = nav.find((item) => item.to === location.pathname)?.label ?? "Workspace";
  const items = nav.filter((item) => item.roles.includes(role));

  const Sidebar = () => <aside className="flex h-full w-[252px] shrink-0 flex-col overflow-y-auto border-r border-line bg-[#fafbf7] px-3 py-4">
    <div className="flex h-12 items-center gap-3 px-2">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white"><BadgeIndianRupee size={20} strokeWidth={2.2} /></div>
      <div><div className="text-[17px] font-extrabold tracking-[-.04em]">CashPilot</div><div className="text-[10px] font-bold uppercase tracking-[.14em] text-muted">Finance operations</div></div>
    </div>
    <div className="mt-7 px-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-muted/70">Workspace</div>
    <nav className="mt-2 space-y-1">
      {items.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={({isActive}) => cn(
        "flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-semibold transition-colors",
        isActive ? "bg-ink text-white shadow-sm" : "text-muted hover:bg-ink/5 hover:text-ink") }>
        <Icon size={17} strokeWidth={2} /><span>{label}</span>{label === "Approvals" && <span className="ml-auto rounded-full bg-amber-soft px-1.5 py-0.5 text-[10px] text-amber">3</span>}
      </NavLink>)}
    </nav>
    <div className="mt-auto rounded-[14px] border border-brand/15 bg-brand-soft/70 p-3">
      <div className="flex items-center gap-2 text-xs font-bold text-brand-dark"><Bot size={15} /> Agent-ready</div>
      <p className="mt-1.5 text-[11px] leading-4 text-brand-dark/70">Context catalog and typed actions are connected.</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full w-[78%] rounded-full bg-brand" /></div>
    </div>
  </aside>;

  return <div className="flex min-h-screen bg-canvas text-ink">
    <div className="hidden md:sticky md:top-0 md:block md:h-screen"><Sidebar /></div>
    {mobileOpen && <div className="fixed inset-0 z-50 flex md:hidden"><button aria-label="Close menu" className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} /><div className="relative"><Sidebar /></div><Button variant="outline" size="icon" className="relative ml-2 mt-3" onClick={() => setMobileOpen(false)}><X size={18}/></Button></div>}
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-line bg-canvas/90 px-4 backdrop-blur-xl md:px-7">
        <Button aria-label="Open menu" variant="ghost" size="icon" className="mr-2 md:hidden" onClick={() => setMobileOpen(true)}><Menu size={19}/></Button>
        <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted">{user?.tenantName ?? "CashPilot Platform"}</p><p className="text-sm font-semibold">{current}</p></div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative"><Button variant="ghost" size="icon" aria-label="Notifications" className="relative" onClick={()=>{setNotificationsOpen(v=>!v);setRoleOpen(false)}}><Bell size={18}/>{unread>0&&<span className="absolute right-1.5 top-1 min-w-4 rounded-full bg-coral px-1 text-[9px] font-bold leading-4 text-white ring-2 ring-canvas">{unread}</span>}</Button>
            {notificationsOpen&&<div className="absolute right-0 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[16px] border border-line bg-white shadow-lift"><div className="flex items-center justify-between border-b border-line p-4"><div><p className="text-sm font-bold">Notifications</p><p className="mt-0.5 text-[10px] text-muted">{unread?`${unread} unread update${unread>1?"s":""}`:"You’re all caught up"}</p></div>{unread>0&&<button className="text-xs font-bold text-brand-dark" onClick={()=>void readAll()}>Mark all read</button>}</div><div className="max-h-[420px] overflow-y-auto">{notifications.loading?<p className="p-5 text-sm text-muted">Loading updates…</p>:notifications.data?.length?notifications.data.map(item=><button key={item.id} onClick={()=>void openNotification(item)} className={cn("flex w-full gap-3 border-b border-line/70 p-4 text-left last:border-0 hover:bg-canvas",!item.read_at&&"bg-brand-soft/30")}><span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full",item.read_at?"bg-line":"bg-brand")}/><span><span className="block text-sm font-bold">{item.title}</span><span className="mt-1 block text-xs leading-5 text-muted">{item.detail}</span><span className="mt-2 block text-[10px] font-semibold text-muted/70">{relativeDate(item.created_at)}</span></span></button>):<p className="p-6 text-center text-sm text-muted">No notifications yet.</p>}</div></div>}
          </div>
          <div className="relative">
            <button className="flex items-center gap-2 rounded-xl border border-line bg-white py-1.5 pl-1.5 pr-2 text-left shadow-sm" onClick={() => setRoleOpen((v) => !v)}>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-[11px] font-bold text-white">{person.avatar}</span>
              <span className="hidden sm:block"><span className="block text-xs font-bold">{person.name}</span><span className="block text-[10px] text-muted">{person.title}</span></span>
              <ChevronDown size={14} className="text-muted" />
            </button>
            {roleOpen && <div className="absolute right-0 mt-2 w-56 rounded-[14px] border border-line bg-white p-1.5 shadow-lift">
              <div className="border-b border-line px-2 py-2.5"><p className="truncate text-xs font-bold">{user?.email}</p><p className="mt-0.5 text-[10px] text-muted">Authenticated session</p></div>
              <button onClick={() => void logout()} className="mt-1 flex w-full items-center gap-2 rounded-[9px] px-3 py-2 text-left text-sm font-semibold text-coral hover:bg-red-50"><LogOut size={15}/>Sign out</button>
            </div>}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] p-4 pb-24 md:p-7 md:pb-24"><div key={`${role}-${location.pathname}`} className="page-enter">{children}</div></main>
    </div>
    <button className="fixed bottom-5 right-5 z-20 flex h-12 items-center gap-2 rounded-full bg-brand px-4 text-sm font-bold text-white shadow-lift transition-transform hover:-translate-y-0.5" title="Agent arrives in phase two">
      <CircleDollarSign size={19} /> <span className="hidden sm:inline">Ask CashPilot</span>
    </button>
  </div>;
}
