import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type Role, type SessionUser } from "@/lib/api";

const roleTitles: Record<Role, string> = { cfo:"CFO / Owner", manager:"Finance Manager", customer:"Customer", platform_admin:"Platform Admin" };
type RoleContextValue = {
  role: Role; user: SessionUser | null; person: { name: string; title: string; avatar: string };
  loading: boolean; login: (email:string,password:string)=>Promise<void>; logout: ()=>Promise<void>;
};
const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
    const unauthorized = () => setUser(null);
    window.addEventListener("cashpilot:unauthorized", unauthorized);
    return () => window.removeEventListener("cashpilot:unauthorized", unauthorized);
  }, []);
  const value = useMemo<RoleContextValue>(() => {
    const role = user?.role ?? "cfo";
    return {
      role, user, loading,
      person: { name:user?.name ?? "", title:roleTitles[role], avatar:user?.avatar ?? "" },
      login: async (email,password) => { const session = await api.login(email,password); setUser(session); },
      logout: async () => { try { await api.logout(); } finally { setUser(null); } },
    };
  }, [user,loading]);
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const value = useContext(RoleContext);
  if (!value) throw new Error("useRole must be used within RoleProvider");
  return value;
}
