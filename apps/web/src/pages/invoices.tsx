import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BellRing,
  CreditCard,
  Download,
  FilePlus2,
  MessageCircleQuestion,
  Search,
  Trash2,
} from "lucide-react";
import { useRole } from "@/context/role-context";
import { useApi } from "@/hooks/use-api";
import { useAgentPrefill } from "@/hooks/use-agent-prefill";
import { api, type Role } from "@/lib/api";
import { money, shortDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Input, Select } from "@/components/ui/input";
import { ErrorState, LoadingState } from "@/components/data-state";
import { PageHeading } from "@/components/page-heading";
import { Modal } from "@/components/ui/modal";

type Invoice = {
  id: string;
  customer_id: string;
  number: string;
  amount: number;
  paid_amount: number;
  balance: number;
  status: string;
  issue_date: string;
  due_date: string;
  category: string;
  risk_score: number;
  reminder_count: number;
  last_reminded_at: string | null;
  company: string;
  customer_name: string;
};
type Customer = { id: string; company: string };
type Detail = Invoice & {
  customer_email: string;
  segment: string;
  payment_terms: number;
  credit_limit: number;
  health_score: number;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    reference: string;
    status: string;
    paid_at: string;
  }>;
  disputes: Array<{
    id: string;
    reason: string;
    detail: string;
    status: string;
    resolution_note: string | null;
    reviewed_by: string | null;
    created_at: string;
  }>;
};
const statusTone = (status: string) =>
  status === "paid"
    ? "green"
    : status === "overdue" || status === "disputed"
      ? "red"
      : status === "partially_paid"
        ? "amber"
        : "neutral";
const statuses = [
  "draft",
  "sent",
  "overdue",
  "partially_paid",
  "paid",
  "disputed",
];

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportInvoices(rows: Invoice[]) {
  const columns: Array<[string, (invoice: Invoice) => unknown]> = [
    ["Invoice", (invoice) => invoice.number],
    ["Customer", (invoice) => invoice.company],
    ["Contact", (invoice) => invoice.customer_name],
    ["Issue date", (invoice) => invoice.issue_date.slice(0, 10)],
    ["Due date", (invoice) => invoice.due_date.slice(0, 10)],
    ["Status", (invoice) => invoice.status],
    ["Category", (invoice) => invoice.category],
    ["Total (INR)", (invoice) => invoice.amount],
    ["Paid (INR)", (invoice) => invoice.paid_amount],
    ["Balance (INR)", (invoice) => invoice.balance],
    ["Risk score", (invoice) => invoice.risk_score],
  ];
  const csv = [
    columns.map(([label]) => csvCell(label)).join(","),
    ...rows.map((invoice) =>
      columns.map(([, read]) => csvCell(read(invoice))).join(","),
    ),
  ].join("\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cashpilot-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function InvoicesPage() {
  const { role } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const requestedStatus = searchParams.get("status") ?? "all";
  const status = statuses.includes(requestedStatus) ? requestedStatus : "all";
  const sort = searchParams.get("sort") ?? "due_asc";
  const creating = searchParams.get("modal") === "create-invoice";
  const selected = searchParams.get("invoice") ?? "";
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const setFilter = (key: "search" | "status" | "sort", value: string) => {
    const next = new URLSearchParams(searchParams);
    if (
      !value ||
      (key === "status" && value === "all") ||
      (key === "sort" && value === "due_asc")
    )
      next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const setCreateOpen = (open: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set("modal", "create-invoice");
    else next.delete("modal");
    setSearchParams(next, { replace: true });
  };
  const setSelected = (invoiceId: string) => {
    const next = new URLSearchParams(searchParams);
    if (invoiceId) next.set("invoice", invoiceId);
    else next.delete("invoice");
    setSearchParams(next, { replace: true });
  };
  const { data, error, loading, reload } = useApi<Invoice[]>("/api/invoices");
  const customerData = useApi<Customer[]>(
    role === "customer" ? "/api/invoices" : "/api/customers",
  );
  const filtered = useMemo(
    () =>
      [...(data ?? [])]
        .filter(
          (item) =>
            (status === "all" || item.status === status) &&
            `${item.number} ${item.company}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) => {
          if (sort === "due_desc")
            return +new Date(b.due_date) - +new Date(a.due_date);
          if (sort === "amount_desc") return b.amount - a.amount;
          if (sort === "balance_desc") return b.balance - a.balance;
          if (sort === "risk_desc") return b.risk_score - a.risk_score;
          return +new Date(a.due_date) - +new Date(b.due_date);
        }),
    [data, search, sort, status],
  );
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("cashpilot:agent-context", {
        detail: {
          path: `${window.location.pathname}${window.location.search}`,
          detail: `Invoices · ${status === "all" ? "all" : status.replace("_", " ")} · ${filtered.length} results`,
        },
      }),
    );
  }, [creating, filtered.length, search, selected, sort, status]);
  const remind = async (invoice: Invoice) => {
    setBusy(invoice.id);
    setNotice("");
    try {
      await api.post(`/api/invoices/${invoice.id}/remind`, role);
      setNotice(`Reminder sent for ${invoice.number}.`);
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy("");
    }
  };
  const askWhyOverdue = (invoice: Invoice) => {
    window.dispatchEvent(
      new CustomEvent("cashpilot:agent-prompt", {
        detail: {
          prompt: `Why is ${invoice.number} for ${invoice.company} overdue? Use its live invoice, payment, reminder, and dispute history.`,
        },
      }),
    );
  };
  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error} retry={reload} />;
  const canOperate = role === "cfo" || role === "manager";
  return (
    <>
      <PageHeading
        eyebrow="Receivables"
        title="Invoices"
        detail={
          role === "customer"
            ? "Review your billing history, balances and due dates."
            : "Issue, inspect and collect every receivable from one operational ledger."
        }
        action={
          role === "cfo" ? (
            <Button variant="brand" onClick={() => setCreateOpen(true)}>
              <FilePlus2 size={16} />
              New invoice
            </Button>
          ) : undefined
        }
      />
      {notice && (
        <div className="mb-4 rounded-xl border border-brand/15 bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark">
          {notice}
        </div>
      )}
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-3 text-muted" size={16} />
            <Input
              className="pl-9"
              placeholder="Search invoice or customer…"
              value={search}
              onChange={(e) => setFilter("search", e.target.value)}
            />
          </div>
          <Select
            value={status}
            onChange={(e) => setFilter("status", e.target.value)}
          >
            <option value="all">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value.replace("_", " ")}
              </option>
            ))}
          </Select>
          <Select
            value={sort}
            onChange={(e) => setFilter("sort", e.target.value)}
          >
            <option value="due_asc">Due date: earliest</option>
            <option value="due_desc">Due date: latest</option>
            <option value="amount_desc">Highest total</option>
            <option value="balance_desc">Highest balance</option>
            <option value="risk_desc">Highest risk</option>
          </Select>
          <Button
            variant="outline"
            disabled={!filtered.length}
            onClick={() => {
              exportInvoices(filtered);
              setNotice(
                `${filtered.length} invoice${filtered.length === 1 ? "" : "s"} exported.`,
              );
            }}
          >
            <Download size={15} />
            Export
          </Button>
        </div>
        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-canvas/70 text-[10px] uppercase tracking-[.12em] text-muted">
                <tr>
                  <th className="px-5 py-3">Invoice</th>
                  <th>Customer</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th>Risk</th>
                  <th className="pr-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((invoice) => (
                  <tr
                    key={invoice.id}
                    onClick={() => setSelected(invoice.id)}
                    className="cursor-pointer border-t border-line/80 transition-colors hover:bg-canvas/60"
                  >
                    <td className="px-5 py-4">
                      <p className="font-bold">{invoice.number}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {invoice.category}
                      </p>
                    </td>
                    <td>
                      <p className="font-semibold">{invoice.company}</p>
                      <p className="text-[11px] text-muted">
                        {invoice.customer_name}
                      </p>
                    </td>
                    <td className="tabular text-xs">
                      {shortDate(invoice.due_date)}
                    </td>
                    <td>
                      <Badge
                        tone={
                          statusTone(invoice.status) as
                            "green" | "red" | "amber" | "neutral"
                        }
                      >
                        {invoice.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="tabular font-semibold">
                      {money(invoice.amount)}
                    </td>
                    <td className="tabular font-bold">
                      {money(invoice.balance)}
                    </td>
                    <td>
                      <span
                        className={
                          invoice.risk_score > 75
                            ? "font-bold text-coral"
                            : invoice.risk_score > 45
                              ? "font-semibold text-amber"
                              : "text-muted"
                        }
                      >
                        {invoice.risk_score}
                      </span>
                    </td>
                    <td
                      className="pr-5 text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {canOperate &&
                      ["overdue", "partially_paid"].includes(invoice.status) ? (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => askWhyOverdue(invoice)}
                          >
                            <MessageCircleQuestion size={13} />
                            Why overdue?
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === invoice.id}
                            onClick={() => void remind(invoice)}
                          >
                            <BellRing size={13} />
                            {busy === invoice.id ? "Sending…" : "Remind"}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelected(invoice.id)}
                        >
                          View
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No matching invoices"
            detail="Try another search or status filter."
          />
        )}
      </Card>
      {creating && role === "cfo" && (
        <CreateInvoiceModal
          customers={customerData.data ?? []}
          role={role}
          close={() => setCreateOpen(false)}
          done={async () => {
            setCreateOpen(false);
            setNotice("Invoice created and recorded in audit history.");
            await reload();
          }}
        />
      )}
      {selected && (
        <InvoiceDetailModal
          id={selected}
          role={role}
          close={() => setSelected("")}
          changed={async (message) => {
            setNotice(message);
            await reload();
          }}
        />
      )}
    </>
  );
}

function InvoiceDetailModal({
  id,
  role,
  close,
  changed,
}: {
  id: string;
  role: Role;
  close: () => void;
  changed: (message: string) => Promise<void>;
}) {
  const { data, error, loading, reload } = useApi<Detail>(
    `/api/invoices/${id}`,
  );
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");
  if (loading)
    return (
      <Modal title="Invoice details" close={close}>
        <LoadingState />
      </Modal>
    );
  if (error || !data)
    return (
      <Modal title="Invoice details" close={close}>
        <ErrorState message={error} retry={reload} />
      </Modal>
    );
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setLocalError("");
    const form = new FormData(e.currentTarget);
    const body =
      role === "manager"
        ? { status: String(form.get("status")) }
        : {
            status: String(form.get("status")),
            amount: Number(form.get("amount")),
            dueDate: String(form.get("dueDate")),
            category: String(form.get("category")),
          };
    try {
      await api.patch(`/api/invoices/${id}`, body);
      await reload();
      await changed(`${data.number} updated successfully.`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    const linked = [
      data.payments.length
        ? `${data.payments.length} payment${data.payments.length === 1 ? "" : "s"}`
        : "",
      data.disputes.length
        ? `${data.disputes.length} dispute${data.disputes.length === 1 ? "" : "s"}`
        : "",
    ].filter(Boolean);
    const dependencyWarning = linked.length
      ? ` This also permanently deletes ${linked.join(" and ")}.`
      : "";
    if (
      !confirm(
        `Delete ${data.number}?${dependencyWarning} This cannot be undone.`,
      )
    )
      return;
    setSaving(true);
    try {
      await api.delete(`/api/invoices/${id}`);
      close();
      await changed(`${data.number} deleted.`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title={data.number}
      detail={`${data.company} · Issued ${shortDate(data.issue_date)}`}
      close={close}
      wide
    >
      <form onSubmit={save}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Invoice total" value={money(data.amount)} />
          <Metric label="Paid" value={money(data.paid_amount)} />
          <Metric label="Balance" value={money(data.balance)} emphasis />
        </div>
        <section className="mt-5 rounded-2xl border border-line p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">Customer</p>
              <p className="mt-1 text-sm text-muted">
                {data.customer_name} · {data.customer_email}
              </p>
            </div>
            <Badge
              tone={
                data.health_score > 80
                  ? "green"
                  : data.health_score > 60
                    ? "amber"
                    : "red"
              }
            >
              {data.health_score} health
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
            <span>
              <b className="block text-muted">Segment</b>
              {data.segment}
            </span>
            <span>
              <b className="block text-muted">Terms</b>Net {data.payment_terms}
            </span>
            <span>
              <b className="block text-muted">Credit limit</b>
              {money(data.credit_limit, true)}
            </span>
          </div>
        </section>
        {(role === "cfo" || role === "manager") && (
          <section className="mt-5">
            <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[.14em] text-muted">
              Invoice controls
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <Select
                  name="status"
                  defaultValue={data.status}
                  className="w-full"
                >
                  {statuses.map((value) => (
                    <option key={value} value={value}>
                      {value.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </Field>
              {role === "cfo" && (
                <>
                  <Field label="Amount">
                    <Input
                      name="amount"
                      type="number"
                      min={data.paid_amount || 1}
                      defaultValue={data.amount}
                    />
                  </Field>
                  <Field label="Due date">
                    <Input
                      name="dueDate"
                      type="date"
                      defaultValue={data.due_date.slice(0, 10)}
                    />
                  </Field>
                  <Field label="Category">
                    <Input name="category" defaultValue={data.category} />
                  </Field>
                </>
              )}
            </div>
          </section>
        )}
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard size={16} />
            <p className="text-sm font-bold">Payment history</p>
          </div>
          {data.payments.length ? (
            <div className="divide-y divide-line rounded-xl border border-line">
              {data.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">
                      {payment.method} · {payment.reference}
                    </p>
                    <p className="text-xs text-muted">
                      {shortDate(payment.paid_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular">{money(payment.amount)}</p>
                    <Badge tone="green">{payment.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-canvas p-4 text-sm text-muted">
              No payments recorded.
            </p>
          )}
        </section>
        {data.disputes.length > 0 && (
          <section className="mt-6">
            <p className="mb-3 text-sm font-bold">Dispute history</p>
            {data.disputes.map((dispute) => (
              <div
                key={dispute.id}
                className="rounded-xl border border-line p-3 text-sm"
              >
                <div className="flex justify-between">
                  <b>{dispute.reason}</b>
                  <Badge
                    tone={dispute.status === "resolved" ? "green" : "amber"}
                  >
                    {dispute.status.replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-1 text-muted">{dispute.detail}</p>
                {dispute.resolution_note && (
                  <p className="mt-2 rounded-lg bg-brand-soft p-2 text-brand-dark">
                    <b>Resolution:</b> {dispute.resolution_note}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}
        {localError && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-coral">
            {localError}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-between gap-2">
          {role === "cfo" ? (
            <Button
              type="button"
              variant="danger"
              disabled={saving}
              onClick={() => void remove()}
            >
              <Trash2 size={14} />
              Delete invoice
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {role === "customer" && data.status !== "paid" && (
              <Link to="/disputes" onClick={close}>
                <Button type="button" variant="outline">
                  Raise dispute
                </Button>
              </Link>
            )}
            <Button type="button" variant="ghost" onClick={close}>
              Close
            </Button>
            {(role === "cfo" || role === "manager") && (
              <Button type="submit" variant="brand" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}

function CreateInvoiceModal({
  customers,
  role,
  close,
  done,
}: {
  customers: Customer[];
  role: Role;
  close: () => void;
  done: () => Promise<void>;
}) {
  const [form, setForm] = useAgentPrefill("action.invoice.create", {
    customerId: customers[0]?.id ?? "",
    amount: "",
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    category: "Usage",
    status: "draft",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/api/invoices", role, {
        ...form,
        amount: Number(form.amount),
      });
      await done();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create invoice");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      title="Create invoice"
      detail="Draft now, send when ready."
      close={close}
    >
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Customer">
          <Select
            required
            className="w-full"
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value })}
          >
            {customers.map((c) => (
              <option value={c.id} key={c.id}>
                {c.company}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount">
            <Input
              required
              type="number"
              min="1"
              placeholder="₹ 0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <Field label="Due date">
            <Input
              required
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </Field>
          <Field label="Category">
            <Select
              className="w-full"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option>Usage</option>
              <option>Implementation</option>
              <option>Annual platform</option>
              <option>Consulting</option>
            </Select>
          </Field>
          <Field label="Initial state">
            <Select
              className="w-full"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="draft">Save as draft</option>
              <option value="sent">Issue immediately</option>
            </Select>
          </Field>
        </div>
        {error && <p className="text-sm font-semibold text-coral">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="brand" disabled={saving}>
            {saving ? "Creating…" : "Create invoice"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs font-bold text-muted">
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
function Metric({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-4 ${emphasis ? "bg-ink text-white" : "bg-canvas"}`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-wide ${emphasis ? "text-white/55" : "text-muted"}`}
      >
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold tabular">{value}</p>
    </div>
  );
}
