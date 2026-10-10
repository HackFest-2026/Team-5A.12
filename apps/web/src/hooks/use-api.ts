import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRole } from "@/context/role-context";

export function useApi<T>(path: string) {
  const { role } = useRole();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await api.get<T>(path, role)); }
    catch (e) { setError(e instanceof Error ? e.message : "Request failed"); }
    finally { setLoading(false); }
  }, [path, role]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, loading, reload: load };
}
