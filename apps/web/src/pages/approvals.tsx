import { useMemo, useState } from "react";
import { Check, Clock3, Search, ShieldAlert, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useRole } from "@/context/role-context";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { money, relativeDate } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { ErrorState, LoadingState } from "@/components/data-state";
import { Empty } from "@/components/ui/empty";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

type Approval = {
  id: string;
  title: string;
  description: string;
  action_type: string;
  amount: number | null;
  risk: string;
  status: string;
  requested_by: string;
  created_at: string;
  decided_by: string | null;
};

export function ApprovalsPage() {
  const { role } = useRole();
  const { data, error, loading, reload } = useApi<Approval[]>("/api/approvals");
  const [searchParams, setSearchParams] = useSearchParams();
  const [busy, setBusy] = useState("");
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "all";
  const risk = searchParams.get("risk") ?? "all";
  const sort = searchParams.get("sort") ?? "newest";
  const setFilter = (key: string, value: string, defaultValue = "all") => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...(data ?? [])]
      .filter(
        (approval) =>
          (status === "all" || approval.status === status) &&
          (risk === "all" || approval.risk === risk) &&
          `${approval.title} ${approval.description} ${approval.requested_by} ${approval.action_type}`
            .toLowerCase()
            .includes(query),
      )
      .sort((a, b) => {
        if (sort === "oldest")
          return +new Date(a.created_at) - +new Date(b.created_at);
        if (sort === "amount_desc") return (b.amount ?? 0) - (a.amount ?? 0);
        if (sort === "risk_desc")
          return Number(b.risk === "high") - Number(a.risk === "high");
        return +new Date(b.created_at) - +new Date(a.created_at);
      });
  }, [data, risk, search, sort, status]);
  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusy(id);
    try {
      await api.post(`/api/approvals/${id}/decision`, role, { decision });
      await reload();
    } finally {
      setBusy("");
    }
  };
  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error} retry={reload} />;
  return (
    <>
      <PageHeading
        eyebrow="Controlled actions"
        title="Approval queue"
        detail="High-impact financial decisions remain human-controlled, explainable and auditable."
      />
      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-3 text-muted" size={16} />
            <Input
              className="pl-9"
              placeholder="Search approvals…"
              value={search}
              onChange={(event) => setFilter("search", event.target.value, "")}
            />
          </div>
          <Select
            value={status}
            onChange={(event) => setFilter("status", event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
          <Select
            value={risk}
            onChange={(event) => setFilter("risk", event.target.value)}
          >
            <option value="all">All risk levels</option>
            <option value="high">High risk</option>
            <option value="medium">Medium risk</option>
          </Select>
          <Select
            value={sort}
            onChange={(event) =>
              setFilter("sort", event.target.value, "newest")
            }
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount_desc">Highest exposure</option>
            <option value="risk_desc">Highest risk</option>
          </Select>
        </div>
      </Card>
      {visible.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((approval) => (
            <Card
              key={approval.id}
              className={approval.status === "pending" ? "" : "opacity-70"}
            >
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-soft text-amber">
                    <ShieldAlert size={18} />
                  </div>
                  <div className="flex gap-2">
                    <Badge tone={approval.risk === "high" ? "red" : "amber"}>
                      {approval.risk} risk
                    </Badge>
                    <Badge
                      tone={
                        approval.status === "approved"
                          ? "green"
                          : approval.status === "rejected"
                            ? "red"
                            : "neutral"
                      }
                    >
                      {approval.status}
                    </Badge>
                  </div>
                </div>
                <h2 className="mt-4 font-bold">{approval.title}</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">
                  {approval.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-y border-line py-3 text-xs">
                  <span>
                    <span className="text-muted">Requested by</span>{" "}
                    <strong>{approval.requested_by}</strong>
                  </span>
                  {approval.amount ? (
                    <span>
                      <span className="text-muted">Exposure</span>{" "}
                      <strong className="tabular">
                        {money(approval.amount)}
                      </strong>
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 text-muted">
                    <Clock3 size={12} />
                    {relativeDate(approval.created_at)}
                  </span>
                </div>
                {approval.status === "pending" &&
                  (role === "cfo" ? (
                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === approval.id}
                        onClick={() => void decide(approval.id, "rejected")}
                      >
                        <X size={14} />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="brand"
                        disabled={busy === approval.id}
                        onClick={() => void decide(approval.id, "approved")}
                      >
                        <Check size={14} />
                        {busy === approval.id ? "Saving…" : "Approve"}
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-4 text-right text-xs font-semibold text-muted">
                      Awaiting CFO approval
                    </p>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Empty
          title="No matching approvals"
          detail="Try another search, status, or risk filter."
        />
      )}
    </>
  );
}
