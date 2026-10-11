import { useMemo } from "react";
import { Activity, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "@/hooks/use-api";
import { shortDate } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { ErrorState, LoadingState } from "@/components/data-state";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Item = {
  id: number;
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  detail: string;
  created_at: string;
};

export function AuditPage() {
  const { data, error, loading, reload } = useApi<Item[]>("/api/audit");
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const role = searchParams.get("role") ?? "all";
  const entity = searchParams.get("entity") ?? "all";
  const sort = searchParams.get("sort") ?? "newest";
  const setFilter = (key: string, value: string, defaultValue = "all") => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const roles = useMemo(
    () => [...new Set((data ?? []).map((item) => item.actor_role))].sort(),
    [data],
  );
  const entities = useMemo(
    () => [...new Set((data ?? []).map((item) => item.entity_type))].sort(),
    [data],
  );
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...(data ?? [])]
      .filter(
        (item) =>
          (role === "all" || item.actor_role === role) &&
          (entity === "all" || item.entity_type === entity) &&
          `${item.actor_name} ${item.action} ${item.detail} ${item.entity_id}`
            .toLowerCase()
            .includes(query),
      )
      .sort((a, b) =>
        sort === "oldest"
          ? +new Date(a.created_at) - +new Date(b.created_at)
          : +new Date(b.created_at) - +new Date(a.created_at),
      );
  }, [data, entity, role, search, sort]);
  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error} retry={reload} />;
  return (
    <>
      <PageHeading
        eyebrow="Governance"
        title="Audit log"
        detail="Immutable operational history for human and future agent actions."
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-3 text-muted" size={16} />
            <Input
              className="pl-9"
              placeholder="Search actor, action, or record…"
              value={search}
              onChange={(event) => setFilter("search", event.target.value, "")}
            />
          </div>
          <Select
            value={role}
            onChange={(event) => setFilter("role", event.target.value)}
          >
            <option value="all">All roles</option>
            {roles.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
          <Select
            value={entity}
            onChange={(event) => setFilter("entity", event.target.value)}
          >
            <option value="all">All record types</option>
            {entities.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
          <Select
            value={sort}
            onChange={(event) =>
              setFilter("sort", event.target.value, "newest")
            }
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Select>
        </div>
        {visible.length ? (
          <div className="divide-y divide-line">
            {visible.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 px-5 py-4 md:grid-cols-[40px_1fr_150px_150px] md:items-center"
              >
                <div className="grid h-9 w-9 place-items-center rounded-full bg-canvas text-muted">
                  <Activity size={15} />
                </div>
                <div>
                  <p className="text-sm">
                    <strong>{item.actor_name}</strong>{" "}
                    <span className="text-muted">{item.action}</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">{item.detail}</p>
                </div>
                <div>
                  <Badge>{item.actor_role}</Badge>
                  <p className="mt-1 text-[10px] text-muted">
                    {item.entity_type} · {item.entity_id}
                  </p>
                </div>
                <time className="tabular text-xs text-muted md:text-right">
                  {shortDate(item.created_at)}
                  <span className="block">
                    {new Date(item.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </time>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="No matching audit events"
            detail="Try another search, role, or record type."
          />
        )}
      </Card>
    </>
  );
}
