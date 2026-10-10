import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CircleAlert,
  Clock3,
  IndianRupee,
  Radar,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useRole } from "@/context/role-context";
import { useApi } from "@/hooks/use-api";
import { money, relativeDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ErrorState, LoadingState, Stat } from "@/components/data-state";
import { PageHeading } from "@/components/page-heading";
import type { AgentSignal } from "@/lib/api";

type BusinessDashboard = {
  mode: "business";
  metrics: {
    total_invoiced: number;
    collected: number;
    outstanding: number;
    overdue: number;
    overdue_count: number;
    avg_risk: number;
  };
  cashflow: Array<{
    label: string;
    inflow: number;
    outflow: number;
    forecast: number;
  }>;
  risks: Array<{
    id: string;
    number: string;
    amount: number;
    paid_amount: number;
    risk_score: number;
    company: string;
    days_overdue: number;
  }>;
  activity: Array<{
    id: number;
    actor_name: string;
    action: string;
    detail: string;
    created_at: string;
  }>;
};
type PlatformDashboard = {
  mode: "platform";
  metrics: { tenants: number; monthly_volume: number; active_tenants: number };
  tenants: Array<{
    id: string;
    name: string;
    plan: string;
    status: string;
    monthly_volume: number;
  }>;
};

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const started = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - started) / 550);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{display}</>;
}

function PlatformOverview({ data }: { data: PlatformDashboard }) {
  return (
    <>
      <PageHeading
        eyebrow="Platform command"
        title="Tenant operations"
        detail="Health, usage and governance across every CashPilot workspace."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Total tenants"
          value={data.metrics.tenants}
          note="Across all plans"
          icon={<Building2 size={17} />}
        />
        <Stat
          label="Active tenants"
          value={data.metrics.active_tenants}
          note="1 workspace needs review"
          icon={<ShieldCheck size={17} />}
        />
        <Stat
          label="Monthly volume"
          value={money(data.metrics.monthly_volume, true)}
          note="Processed across platform"
          icon={<IndianRupee size={17} />}
        />
      </div>
      <Card className="mt-5 overflow-hidden">
        <CardHeader>
          <div>
            <h2 className="font-bold">Tenant pulse</h2>
            <p className="mt-1 text-xs text-muted">
              Workspace activity and plan distribution
            </p>
          </div>
        </CardHeader>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-y border-line bg-canvas/70 text-[10px] uppercase tracking-[.12em] text-muted">
              <tr>
                <th className="px-5 py-3">Workspace</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Monthly volume</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.tenants.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-line/80 last:border-0"
                >
                  <td className="px-5 py-4 font-semibold">{t.name}</td>
                  <td>{t.plan}</td>
                  <td>
                    <Badge tone={t.status === "active" ? "green" : "amber"}>
                      {t.status}
                    </Badge>
                  </td>
                  <td className="tabular font-semibold">
                    {money(Number(t.monthly_volume), true)}
                  </td>
                  <td>
                    <Button variant="ghost" size="sm">
                      Inspect <ArrowRight size={13} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export function DashboardPage() {
  const { role, person } = useRole();
  const { data, error, loading, reload } = useApi<
    BusinessDashboard | PlatformDashboard
  >("/api/dashboard");
  const agentSignals = useApi<AgentSignal[]>("/api/agent/signals");
  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error} retry={reload} />;
  if (data.mode === "platform") return <PlatformOverview data={data} />;
  const collectionRate = data.metrics.total_invoiced
    ? Math.round((data.metrics.collected / data.metrics.total_invoiced) * 100)
    : 0;
  const customer = role === "customer";
  const latestCash = data.cashflow.at(-1)?.inflow ?? 0;
  const priorCash = data.cashflow.at(-2)?.inflow ?? 0;
  const inflowDelta = priorCash
    ? Math.round(((latestCash - priorCash) / priorCash) * 100)
    : 0;
  const priority = agentSignals.data?.[0];
  const askAgent = (prompt: string) =>
    window.dispatchEvent(
      new CustomEvent("cashpilot:agent-prompt", { detail: { prompt } }),
    );
  return (
    <>
      <PageHeading
        eyebrow={customer ? "Customer account" : "CFO command center"}
        title={
          customer
            ? `Good morning, ${person.name.split(" ")[0]}`
            : "Today’s critical finance actions"
        }
        detail={
          customer
            ? "Your invoices, payment history and open account actions in one place."
            : `${data.metrics.overdue_count} overdue receivables require attention; every recommendation below is based on the live ledger.`
        }
        action={
          !customer && (
            <Button
              variant="brand"
              onClick={() =>
                askAgent(
                  "Analyze today's critical finance risks and recommend the safest next action",
                )
              }
            >
              <Sparkles size={16} />
              Ask agent
            </Button>
          )
        }
      />
      {!customer && priority && (
        <Card className="mb-5 border-coral/20 bg-gradient-to-r from-coral-soft/70 to-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-coral shadow-sm">
              <Sparkles size={18} />
            </span>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-[.12em] text-coral">
                Agent priority
              </p>
              <p className="mt-1 font-bold">{priority.title}</p>
              <p className="mt-1 text-sm text-muted">{priority.detail}</p>
            </div>
            <Button variant="outline" onClick={() => askAgent(priority.prompt)}>
              Investigate
            </Button>
          </div>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label={customer ? "Total billed" : "Total invoiced"}
          value={money(data.metrics.total_invoiced, true)}
          note={
            <span
              className={`inline-flex items-center ${inflowDelta >= 0 ? "text-brand" : "text-coral"}`}
            >
              <ArrowUpRight size={13} /> {Math.abs(inflowDelta)}% latest inflow
              change
            </span>
          }
          icon={<IndianRupee size={17} />}
        />
        <Stat
          label={customer ? "Paid" : "Collected"}
          value={money(data.metrics.collected, true)}
          note={`${collectionRate}% collection rate`}
          icon={<ShieldCheck size={17} />}
        />
        <Stat
          label="Outstanding"
          value={money(data.metrics.outstanding, true)}
          note={`${data.metrics.overdue_count} overdue invoice${data.metrics.overdue_count === 1 ? "" : "s"}`}
          icon={<Clock3 size={17} />}
        />
        <Stat
          label={customer ? "Overdue" : "At-risk revenue"}
          value={money(data.metrics.overdue, true)}
          note={
            <span className="inline-flex items-center text-coral">
              <ArrowDownRight size={13} /> Action recommended
            </span>
          }
          icon={<CircleAlert size={17} />}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.85fr)]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">
                {customer ? "Account balance" : "Cash movement"}
              </h2>
              <p className="mt-1 text-xs text-muted">
                Six-month inflow, outflow and projected position
              </p>
            </div>
            <Badge tone="green">Live ledger</Badge>
          </CardHeader>
          <CardContent className="h-[310px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.cashflow}
                margin={{ top: 10, right: 6, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="inflow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#176b50" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#176b50" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e8ebe5" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#6d756f" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#6d756f" }}
                  tickFormatter={(v) => `${v / 100000}L`}
                />
                <Tooltip
                  formatter={(value) => money(Number(value), true)}
                  contentStyle={{
                    border: "1px solid #dfe3dc",
                    borderRadius: 12,
                    boxShadow: "0 12px 32px rgba(24,32,28,.08)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="inflow"
                  stroke="#176b50"
                  strokeWidth={2.5}
                  fill="url(#inflow)"
                />
                <Area
                  type="monotone"
                  dataKey="outflow"
                  stroke="#bf7a17"
                  strokeWidth={2}
                  fill="transparent"
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <div className="flex items-center gap-2">
                <Radar size={17} className="text-coral" />
                <h2 className="font-bold">Risk radar</h2>
              </div>
              <p className="mt-1 text-xs text-muted">
                Prioritized from live receivables
              </p>
            </div>
            <Link to="/invoices" className="text-xs font-bold text-brand">
              View all
            </Link>
          </CardHeader>
          <div className="mt-3 divide-y divide-line">
            {data.risks.length ? (
              data.risks.map((risk) => (
                <div
                  key={risk.id}
                  className="px-5 py-4 transition-colors hover:bg-canvas/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">{risk.company}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {risk.number} · {risk.days_overdue} days overdue
                      </p>
                    </div>
                    <Badge tone={risk.risk_score > 84 ? "red" : "amber"}>
                      <AnimatedNumber value={risk.risk_score} /> risk
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <span className="tabular text-sm font-bold">
                        {money(risk.amount - risk.paid_amount, true)}
                      </span>
                      <span className="ml-1 text-[11px] text-muted">
                        outstanding
                      </span>
                    </div>
                    <ArrowRight size={15} className="text-muted" />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-sm text-muted">
                No overdue exposure.
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-5 overflow-hidden">
        <CardHeader>
          <div>
            <h2 className="font-bold">Recent activity</h2>
            <p className="mt-1 text-xs text-muted">
              Important changes across your workspace
            </p>
          </div>
          <Link to="/audit" className="text-xs font-bold text-brand">
            Full audit trail
          </Link>
        </CardHeader>
        <div className="mt-3 grid divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {data.activity.slice(0, 4).map((item) => (
            <div key={item.id} className="flex gap-3 px-5 py-4">
              <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-canvas text-muted">
                <Users size={14} />
              </div>
              <div>
                <p className="text-sm">
                  <strong>{item.actor_name}</strong> {item.action}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-muted">
                  {item.detail}
                </p>
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted/70">
                  {relativeDate(item.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
