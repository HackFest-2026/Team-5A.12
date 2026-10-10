import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarRange, CircleAlert, TrendingUp } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "@/hooks/use-api";
import { money, shortDate } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { ErrorState, LoadingState, Stat } from "@/components/data-state";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

type Data = {
  months: Array<{
    month_start: string;
    inflow: number;
    outflow: number;
    forecast: number;
  }>;
  aging: {
    current: number;
    days_1_30: number;
    days_31_60: number;
    days_60_plus: number;
  };
  projectedGap: number;
  gapDate: string;
  gapBasis: string;
};

const periods = {
  "1m": { label: "Last month", count: 1 },
  "3m": { label: "Last 3 months", count: 3 },
  "6m": { label: "Last 6 months", count: 6 },
} as const;

type Period = keyof typeof periods;

export function CashflowPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPeriod = searchParams.get("period");
  const period: Period =
    requestedPeriod && requestedPeriod in periods
      ? (requestedPeriod as Period)
      : "6m";
  const { data, error, loading, reload } = useApi<Data>("/api/cashflow");

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error} retry={reload} />;

  const visibleMonths = data.months.slice(-periods[period].count);
  const latest = visibleMonths.at(-1);
  const overdueReceivables =
    data.aging.days_1_30 + data.aging.days_31_60 + data.aging.days_60_plus;
  const potentialCoverage =
    data.projectedGap > 0
      ? Math.min(
          100,
          Math.round((overdueReceivables / data.projectedGap) * 100),
        )
      : 100;
  const aging = [
    { name: "Current", value: data.aging.current, color: "#176b50" },
    { name: "1–30 days", value: data.aging.days_1_30, color: "#bf7a17" },
    { name: "31–60 days", value: data.aging.days_31_60, color: "#d86d45" },
    { name: "60+ days", value: data.aging.days_60_plus, color: "#c95045" },
  ];

  const changePeriod = (nextPeriod: Period) => {
    const next = new URLSearchParams(searchParams);
    next.set("period", nextPeriod);
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <PageHeading
        eyebrow="Liquidity"
        title="Cash-flow intelligence"
        detail="Actual movement, receivables aging and short-term liquidity pressure."
        action={
          <label className="relative inline-flex items-center">
            <CalendarRange
              size={16}
              className="pointer-events-none absolute left-3.5 z-10"
            />
            <Select
              aria-label="Cash flow period"
              className="h-11 min-w-44 cursor-pointer pl-10 pr-8 font-bold"
              value={period}
              onChange={(event) => changePeriod(event.target.value as Period)}
            >
              {Object.entries(periods).map(([value, option]) => (
                <option key={value} value={value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Latest inflow"
          value={money(latest?.inflow ?? 0, true)}
          note="Recorded collections"
          icon={<TrendingUp size={17} />}
        />
        <Stat
          label="Latest outflow"
          value={money(latest?.outflow ?? 0, true)}
          note="Operating cash movement"
        />
        <Stat
          label="Projected gap"
          value={money(data.projectedGap, true)}
          note={`Expected by ${shortDate(data.gapDate)}`}
          icon={<CircleAlert size={17} className="text-coral" />}
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">Actual vs forecast</h2>
              <p className="mt-1 text-xs text-muted">
                {periods[period].label} · monthly cash movement in INR
              </p>
            </div>
            <Badge tone="amber">14-day risk window</Badge>
          </CardHeader>
          <CardContent className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={visibleMonths}
                margin={{ top: 20, right: 4, left: -10, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#e8ebe5" />
                <XAxis
                  dataKey="month_start"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-IN", {
                      month: "short",
                    })
                  }
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#6d756f" }}
                />
                <YAxis
                  tickFormatter={(value) => `${value / 100000}L`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#6d756f" }}
                />
                <Tooltip
                  formatter={(value) => money(Number(value), true)}
                  labelFormatter={(value) => shortDate(String(value))}
                />
                <Bar
                  dataKey="inflow"
                  fill="#176b50"
                  radius={[5, 5, 0, 0]}
                  barSize={24}
                />
                <Bar
                  dataKey="outflow"
                  fill="#dfe3dc"
                  radius={[5, 5, 0, 0]}
                  barSize={24}
                />
                <Line
                  dataKey="forecast"
                  stroke="#bf7a17"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#bf7a17" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <h2 className="font-bold">Receivables aging</h2>
              <p className="mt-1 text-xs text-muted">
                Outstanding balance by age
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={aging}
                    innerRadius={60}
                    outerRadius={88}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {aging.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => money(Number(value), true)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {aging.map((item) => (
                <div
                  className="flex items-center justify-between text-sm"
                  key={item.name}
                >
                  <span className="flex items-center gap-2 text-muted">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: item.color }}
                    />
                    {item.name}
                  </span>
                  <strong className="tabular">{money(item.value, true)}</strong>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-5 border-amber/20 bg-amber-soft/50">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-amber shadow-sm">
            <CircleAlert size={20} />
          </div>
          <div className="flex-1">
            <p className="font-bold">
              Current forecast indicates {money(data.projectedGap, true)} of
              liquidity pressure
            </p>
            <p className="mt-1 text-sm text-muted">
              Overdue receivables total {money(overdueReceivables, true)} and
              could cover up to {potentialCoverage}% of the measured pressure.
              Values are derived from the live ledger.
            </p>
          </div>
          <Link to="/invoices?status=overdue">
            <Button variant="default">Review contributors</Button>
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
