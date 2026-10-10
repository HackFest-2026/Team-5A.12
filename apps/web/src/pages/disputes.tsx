import { useState } from "react";
import { CheckCircle2, Clock3, MessageSquareWarning, Plus } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useRole } from "@/context/role-context";
import { useApi } from "@/hooks/use-api";
import { useAgentPrefill } from "@/hooks/use-agent-prefill";
import { api } from "@/lib/api";
import { money, relativeDate } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { ErrorState, LoadingState } from "@/components/data-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

type Dispute = {
  id: string;
  invoice_id: string;
  reason: string;
  detail: string;
  status: string;
  resolution_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  number: string;
  amount: number;
  company: string;
};
type Invoice = { id: string; number: string; balance: number; status: string };
const tone = (status: string) =>
  status === "resolved" ? "green" : status === "rejected" ? "red" : "amber";

export function DisputesPage() {
  const { role } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, error, loading, reload } = useApi<Dispute[]>("/api/disputes");
  const invoices = useApi<Invoice[]>(
    role === "customer" ? "/api/invoices" : "/api/disputes",
  );
  const open = searchParams.get("modal") === "open-dispute";
  const setOpen = (value: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("modal", "open-dispute");
    else next.delete("modal");
    setSearchParams(next, { replace: true });
  };
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [form, setForm] = useAgentPrefill("action.dispute.open", {
    invoiceId: "",
    reason: "Billing mismatch",
    detail: "",
  });
  const [notice, setNotice] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/disputes", role, form);
      setOpen(false);
      setNotice("Dispute opened. Finance team has been notified.");
      await reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to open dispute");
    }
  };
  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error} retry={reload} />;
  return (
    <>
      <PageHeading
        eyebrow="Resolution center"
        title="Disputes"
        detail={
          role === "customer"
            ? "Track every case from submission through final resolution."
            : "Review evidence, document decisions and resolve customer cases."
        }
        action={
          role === "customer" ? (
            <Button variant="brand" onClick={() => setOpen(!open)}>
              <Plus size={15} />
              Open dispute
            </Button>
          ) : undefined
        }
      />
      {notice && (
        <div className="mb-4 rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark">
          {notice}
        </div>
      )}
      {open && (
        <Card className="mb-5 border-brand/20">
          <CardContent>
            <form onSubmit={submit}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Invoice">
                  <Select
                    required
                    className="w-full"
                    value={form.invoiceId}
                    onChange={(e) =>
                      setForm({ ...form, invoiceId: e.target.value })
                    }
                  >
                    <option value="">Choose invoice</option>
                    {invoices.data
                      ?.filter((i) => i.status !== "paid")
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.number} · {money(i.balance)}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Field label="Reason">
                  <Select
                    className="w-full"
                    value={form.reason}
                    onChange={(e) =>
                      setForm({ ...form, reason: e.target.value })
                    }
                  >
                    <option>Billing mismatch</option>
                    <option>Scope mismatch</option>
                    <option>Duplicate charge</option>
                    <option>Service quality</option>
                  </Select>
                </Field>
              </div>
              <Field label="Details">
                <textarea
                  required
                  minLength={10}
                  className="min-h-24 w-full rounded-[10px] border border-line p-3 text-sm outline-none focus:border-brand/50"
                  placeholder="Explain what needs review…"
                  value={form.detail}
                  onChange={(e) => setForm({ ...form, detail: e.target.value })}
                />
              </Field>
              <div className="mt-4 flex justify-end">
                <Button variant="brand">Submit dispute</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <div className="space-y-4">
        {data.map((dispute) => (
          <Card key={dispute.id}>
            <CardContent className="flex flex-col gap-4 sm:flex-row">
              <div
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${dispute.status === "resolved" ? "bg-brand-soft text-brand-dark" : "bg-coral-soft text-coral"}`}
              >
                {dispute.status === "resolved" ? (
                  <CheckCircle2 size={19} />
                ) : (
                  <MessageSquareWarning size={19} />
                )}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold">
                    {dispute.number} · {dispute.company}
                  </h2>
                  <Badge
                    tone={tone(dispute.status) as "green" | "red" | "amber"}
                  >
                    {dispute.status.replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-1 text-sm font-semibold">{dispute.reason}</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {dispute.detail}
                </p>
                {dispute.resolution_note && (
                  <div className="mt-3 rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">
                    <b>Resolution update:</b> {dispute.resolution_note}
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-60">
                      Reviewed by {dispute.reviewed_by}
                    </p>
                  </div>
                )}
                <p className="mt-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted/70">
                  <Clock3 size={11} />
                  Opened {relativeDate(dispute.created_at)} ·{" "}
                  {money(dispute.amount)}
                </p>
              </div>
              {role !== "customer" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(dispute)}
                >
                  Review case
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {selected && (
        <ReviewModal
          dispute={selected}
          close={() => setSelected(null)}
          done={async () => {
            setSelected(null);
            setNotice("Case decision saved and the customer was notified.");
            await reload();
          }}
        />
      )}
    </>
  );
}

function ReviewModal({
  dispute,
  close,
  done,
}: {
  dispute: Dispute;
  close: () => void;
  done: () => Promise<void>;
}) {
  const [status, setStatus] = useState(
    dispute.status === "open" ? "under_review" : dispute.status,
  );
  const [note, setNote] = useState(dispute.resolution_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.patch(`/api/disputes/${dispute.id}`, {
        status,
        resolutionNote: note,
      });
      await done();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save review");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Review ${dispute.number}`}
      detail={`${dispute.company} · ${dispute.reason}`}
      close={close}
    >
      <div className="rounded-xl bg-canvas p-4 text-sm leading-6 text-muted">
        {dispute.detail}
      </div>
      <form onSubmit={submit} className="mt-5 grid gap-4">
        <Field label="Decision status">
          <Select
            className="w-full"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="under_review">Under review</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </Select>
        </Field>
        <Field label="Review note">
          <textarea
            required
            minLength={5}
            className="min-h-28 w-full rounded-[10px] border border-line p-3 text-sm outline-none focus:border-brand/50"
            placeholder="Explain the decision and next step…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        {error && <p className="text-sm font-semibold text-coral">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="brand" disabled={busy}>
            {busy ? "Saving…" : "Save decision"}
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
    <label className="mt-4 block text-xs font-bold text-muted">
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
