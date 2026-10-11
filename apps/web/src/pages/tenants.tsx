import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleOff,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "@/hooks/use-api";
import { useAgentPrefill } from "@/hooks/use-agent-prefill";
import { api } from "@/lib/api";
import { money, shortDate } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { ErrorState, LoadingState } from "@/components/data-state";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  contact_email: string;
  plan: string;
  status: string;
  seat_limit: number;
  user_count: number;
  monthly_volume: number;
  created_at: string;
};
type TenantUser = {
  id: string;
  name: string;
  email: string;
  role: "cfo" | "manager" | "customer";
  avatar: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
};
const blankTenant = {
  name: "",
  slug: "",
  contactEmail: "",
  plan: "Growth",
  seatLimit: 20,
  ownerName: "",
  ownerEmail: "",
  temporaryPassword: "Welcome123!",
};
const blankUser = {
  name: "",
  email: "",
  role: "manager" as const,
  temporaryPassword: "Welcome123!",
};

export function TenantsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tenants = useApi<Tenant[]>("/api/tenants");
  const search = searchParams.get("search") ?? "";
  const tenantStatus = searchParams.get("status") ?? "all";
  const plan = searchParams.get("plan") ?? "all";
  const sort = searchParams.get("sort") ?? "name_asc";
  const userSearch = searchParams.get("userSearch") ?? "";
  const userRole = searchParams.get("userRole") ?? "all";
  const userStatus = searchParams.get("userStatus") ?? "all";
  const [selected, setSelected] = useState("");
  const users = useApi<TenantUser[]>(
    `/api/tenants/${selected || "none"}/users`,
  );
  const provisioning = searchParams.get("panel") === "provision-tenant";
  const addingUser = searchParams.get("panel") === "add-user";
  const setPanel = (panel: "provision-tenant" | "add-user" | null) => {
    const next = new URLSearchParams(searchParams);
    if (panel) next.set("panel", panel);
    else next.delete("panel");
    setSearchParams(next, { replace: true });
  };
  const setFilter = (key: string, value: string, defaultValue = "all") => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const setProvisioning = (open: boolean | ((value: boolean) => boolean)) => {
    const value = typeof open === "function" ? open(provisioning) : open;
    setPanel(value ? "provision-tenant" : null);
  };
  const setAddingUser = (open: boolean | ((value: boolean) => boolean)) => {
    const value = typeof open === "function" ? open(addingUser) : open;
    setPanel(value ? "add-user" : null);
  };
  const [editingTenant, setEditingTenant] = useState(false);
  const [tenantForm, setTenantForm] = useAgentPrefill(
    "action.tenant.provision",
    blankTenant,
  );
  const [userForm, setUserForm] = useAgentPrefill<{
    name: string;
    email: string;
    role: "cfo" | "manager";
    temporaryPassword: string;
  }>("action.user.provision", blankUser);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const visibleTenants = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...(tenants.data ?? [])]
      .filter(
        (tenant) =>
          (tenantStatus === "all" || tenant.status === tenantStatus) &&
          (plan === "all" || tenant.plan === plan) &&
          `${tenant.name} ${tenant.slug} ${tenant.contact_email}`
            .toLowerCase()
            .includes(query),
      )
      .sort((a, b) => {
        if (sort === "volume_desc") return b.monthly_volume - a.monthly_volume;
        if (sort === "users_desc") return b.user_count - a.user_count;
        if (sort === "newest")
          return +new Date(b.created_at) - +new Date(a.created_at);
        return a.name.localeCompare(b.name);
      });
  }, [plan, search, sort, tenantStatus, tenants.data]);
  useEffect(() => {
    if (!visibleTenants.some((tenant) => tenant.id === selected))
      setSelected(visibleTenants[0]?.id ?? "");
  }, [selected, visibleTenants]);
  const current = tenants.data?.find((t) => t.id === selected);
  const visibleUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    return (users.data ?? []).filter(
      (user) =>
        (userRole === "all" || user.role === userRole) &&
        (userStatus === "all" || user.status === userStatus) &&
        `${user.name} ${user.email}`.toLowerCase().includes(query),
    );
  }, [userRole, userSearch, userStatus, users.data]);
  const metrics = useMemo(
    () => ({
      active: tenants.data?.filter((t) => t.status === "active").length ?? 0,
      seats: tenants.data?.reduce((n, t) => n + t.user_count, 0) ?? 0,
      volume: tenants.data?.reduce((n, t) => n + t.monthly_volume, 0) ?? 0,
    }),
    [tenants.data],
  );
  const createTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("tenant");
    setNotice("");
    try {
      await api.post("/api/tenants", undefined, tenantForm);
      setTenantForm(blankTenant);
      setProvisioning(false);
      setNotice("Tenant provisioned with an owner account.");
      await tenants.reload();
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Unable to provision tenant",
      );
    } finally {
      setBusy("");
    }
  };
  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setBusy("user");
    setNotice("");
    try {
      await api.post(`/api/tenants/${selected}/users`, undefined, userForm);
      setUserForm(blankUser);
      setAddingUser(false);
      setNotice("User provisioned successfully.");
      await Promise.all([users.reload(), tenants.reload()]);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Unable to add user");
    } finally {
      setBusy("");
    }
  };
  const updateTenant = async (field: "status" | "plan", value: string) => {
    if (!current) return;
    setBusy(`tenant-${field}`);
    try {
      await api.patch(`/api/tenants/${current.id}`, { [field]: value });
      setNotice(`${current.name} updated.`);
      await tenants.reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy("");
    }
  };
  const updateTenantProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!current) return;
    const form = new FormData(e.currentTarget);
    setBusy("tenant-profile");
    try {
      await api.patch(`/api/tenants/${current.id}`, {
        name: String(form.get("name")),
        contactEmail: String(form.get("contactEmail")),
        seatLimit: Number(form.get("seatLimit")),
        plan: String(form.get("plan")),
      });
      setEditingTenant(false);
      setNotice(`${current.name} profile updated.`);
      await tenants.reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy("");
    }
  };
  const archiveTenant = async () => {
    if (
      !current ||
      !confirm(`Archive ${current.name}? All active sessions will be revoked.`)
    )
      return;
    setBusy("tenant-archive");
    try {
      await api.delete(`/api/tenants/${current.id}`);
      setNotice(`${current.name} archived.`);
      await tenants.reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setBusy("");
    }
  };
  const toggleUser = async (user: TenantUser) => {
    setBusy(user.id);
    try {
      await api.patch(`/api/tenants/${selected}/users/${user.id}`, {
        status: user.status === "active" ? "disabled" : "active",
      });
      await users.reload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy("");
    }
  };
  if (tenants.loading) return <LoadingState />;
  if (tenants.error || !tenants.data)
    return <ErrorState message={tenants.error} retry={tenants.reload} />;
  return (
    <>
      <PageHeading
        eyebrow="Platform operations"
        title="Tenant management"
        detail="Provision workspaces, control access and manage every tenant from one governed console."
        action={
          <Button variant="brand" onClick={() => setProvisioning((v) => !v)}>
            <Plus size={15} />
            Provision tenant
          </Button>
        }
      />
      {notice && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-dark">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      )}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted">
            Active tenants
          </p>
          <p className="mt-2 text-2xl font-extrabold tabular">
            {metrics.active}
            <span className="ml-1 text-sm text-muted">
              / {tenants.data.length}
            </span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted">
            Provisioned users
          </p>
          <p className="mt-2 text-2xl font-extrabold tabular">
            {metrics.seats}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted">
            Platform volume
          </p>
          <p className="mt-2 text-2xl font-extrabold tabular">
            {money(metrics.volume, true)}
          </p>
        </Card>
      </div>
      {provisioning && (
        <Card className="mb-5 border-brand/25 bg-brand-soft/30 p-5">
          <div className="mb-5">
            <p className="font-bold">Provision a tenant</p>
            <p className="mt-1 text-xs text-muted">
              Creates an isolated workspace and its first CFO/Owner account.
            </p>
          </div>
          <form
            onSubmit={createTenant}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <Field label="Company name">
              <Input
                value={tenantForm.name}
                onChange={(e) =>
                  setTenantForm({
                    ...tenantForm,
                    name: e.target.value,
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)/g, ""),
                  })
                }
                required
              />
            </Field>
            <Field label="Workspace slug">
              <Input
                value={tenantForm.slug}
                onChange={(e) =>
                  setTenantForm({ ...tenantForm, slug: e.target.value })
                }
                required
              />
            </Field>
            <Field label="Billing contact">
              <Input
                type="email"
                value={tenantForm.contactEmail}
                onChange={(e) =>
                  setTenantForm({ ...tenantForm, contactEmail: e.target.value })
                }
                required
              />
            </Field>
            <Field label="Plan">
              <Select
                value={tenantForm.plan}
                onChange={(v) => setTenantForm({ ...tenantForm, plan: v })}
                options={["Starter", "Growth", "Scale"]}
              />
            </Field>
            <Field label="Seat limit">
              <Input
                type="number"
                min={1}
                value={tenantForm.seatLimit}
                onChange={(e) =>
                  setTenantForm({
                    ...tenantForm,
                    seatLimit: Number(e.target.value),
                  })
                }
                required
              />
            </Field>
            <Field label="Owner name">
              <Input
                value={tenantForm.ownerName}
                onChange={(e) =>
                  setTenantForm({ ...tenantForm, ownerName: e.target.value })
                }
                required
              />
            </Field>
            <Field label="Owner email">
              <Input
                type="email"
                value={tenantForm.ownerEmail}
                onChange={(e) =>
                  setTenantForm({ ...tenantForm, ownerEmail: e.target.value })
                }
                required
              />
            </Field>
            <Field label="Temporary password">
              <Input
                type="password"
                value={tenantForm.temporaryPassword}
                onChange={(e) =>
                  setTenantForm({
                    ...tenantForm,
                    temporaryPassword: e.target.value,
                  })
                }
                required
              />
            </Field>
            <div className="flex gap-2 md:col-span-2 xl:col-span-4">
              <Button type="submit" variant="brand" disabled={busy === "tenant"}>
                {busy === "tenant" ? "Provisioning…" : "Create workspace"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setProvisioning(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}
      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 xl:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-3 text-muted" size={16} />
            <Input
              className="pl-9"
              placeholder="Search workspaces…"
              value={search}
              onChange={(e) => setFilter("search", e.target.value, "")}
            />
          </div>
          <select
            value={tenantStatus}
            onChange={(e) => setFilter("status", e.target.value)}
            className="h-10 rounded-[10px] border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-brand"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={plan}
            onChange={(e) => setFilter("plan", e.target.value)}
            className="h-10 rounded-[10px] border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-brand"
          >
            <option value="all">All plans</option>
            <option value="Starter">Starter</option>
            <option value="Growth">Growth</option>
            <option value="Scale">Scale</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setFilter("sort", e.target.value, "name_asc")}
            className="h-10 rounded-[10px] border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-brand"
          >
            <option value="name_asc">Name A–Z</option>
            <option value="volume_desc">Highest volume</option>
            <option value="users_desc">Most users</option>
            <option value="newest">Newest first</option>
          </select>
        </div>
      </Card>
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="space-y-2">
          {!visibleTenants.length && (
            <Card>
              <Empty
                title="No matching tenants"
                detail="Try another search, status, or plan."
              />
            </Card>
          )}
          {visibleTenants.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelected(t.id);
                setAddingUser(false);
                setEditingTenant(false);
              }}
              className={`w-full rounded-[15px] border p-4 text-left transition ${selected === t.id ? "border-ink bg-ink text-white shadow-lift" : "border-line bg-white hover:border-ink/20"}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selected === t.id ? "bg-white/10" : "bg-ink text-white"}`}
                >
                  <Building2 size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <strong className="truncate text-sm">{t.name}</strong>
                    <Badge
                      tone={
                        t.status === "active"
                          ? "green"
                          : ["suspended", "archived"].includes(t.status)
                            ? "red"
                            : "amber"
                      }
                    >
                      {t.status}
                    </Badge>
                  </span>
                  <span
                    className={`mt-1 block text-[11px] ${selected === t.id ? "text-white/55" : "text-muted"}`}
                  >
                    {t.plan} · {t.user_count}/{t.seat_limit} users
                  </span>
                </span>
                <ChevronRight
                  size={16}
                  className={selected === t.id ? "text-white/50" : "text-muted"}
                />
              </div>
            </button>
          ))}
        </div>
        {current && (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold tracking-[-.03em]">
                    {current.name}
                  </h2>
                  <Badge
                    tone={
                      current.status === "active"
                        ? "green"
                        : ["suspended", "archived"].includes(current.status)
                          ? "red"
                          : "amber"
                    }
                  >
                    {current.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {current.slug} · Created {shortDate(current.created_at)} ·{" "}
                  {current.contact_email}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTenant((v) => !v)}
                >
                  <Pencil size={14} />
                  Edit
                </Button>
                {current.status !== "archived" && (
                  <Select
                    compact
                    value={current.plan}
                    onChange={(v) => void updateTenant("plan", v)}
                    options={["Starter", "Growth", "Scale"]}
                  />
                )}
                <Button
                  variant={
                    current.status === "suspended" ||
                    current.status === "archived"
                      ? "brand"
                      : "outline"
                  }
                  size="sm"
                  disabled={busy === "tenant-status"}
                  onClick={() =>
                    void updateTenant(
                      "status",
                      current.status === "active" ? "suspended" : "active",
                    )
                  }
                >
                  {current.status === "active" ? (
                    <>
                      <CircleOff size={14} />
                      Suspend
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      Reactivate
                    </>
                  )}
                </Button>
                {current.status !== "archived" && (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busy === "tenant-archive"}
                    onClick={() => void archiveTenant()}
                  >
                    <Archive size={14} />
                    Archive
                  </Button>
                )}
              </div>
            </div>
            {editingTenant && (
              <form
                onSubmit={updateTenantProfile}
                className="grid gap-3 border-b border-line bg-brand-soft/30 p-5 sm:grid-cols-2"
              >
                <Field label="Tenant name">
                  <Input name="name" defaultValue={current.name} required />
                </Field>
                <Field label="Billing contact">
                  <Input
                    name="contactEmail"
                    type="email"
                    defaultValue={current.contact_email}
                    required
                  />
                </Field>
                <Field label="Seat limit">
                  <Input
                    name="seatLimit"
                    type="number"
                    min={current.user_count || 1}
                    defaultValue={current.seat_limit}
                    required
                  />
                </Field>
                <Field label="Plan">
                  <select
                    name="plan"
                    defaultValue={current.plan}
                    className="h-10 w-full rounded-[10px] border border-line bg-white px-3 text-sm font-semibold"
                  >
                    <option>Starter</option>
                    <option>Growth</option>
                    <option>Scale</option>
                  </select>
                </Field>
                <div className="flex gap-2 sm:col-span-2">
                  <Button
                    type="submit"
                    variant="brand"
                    size="sm"
                    disabled={busy === "tenant-profile"}
                  >
                    {busy === "tenant-profile" ? "Saving…" : "Save tenant"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingTenant(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            <div className="grid gap-3 border-b border-line bg-canvas/50 p-5 sm:grid-cols-3">
              <MiniMetric
                label="Monthly volume"
                value={money(current.monthly_volume, true)}
              />
              <MiniMetric
                label="Seats used"
                value={`${current.user_count} / ${current.seat_limit}`}
              />
              <MiniMetric
                label="Data isolation"
                value="Enforced"
                icon={<ShieldCheck size={14} />}
              />
            </div>
            <div className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-bold">
                    <Users size={16} />
                    Workspace users
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Roles and login access for this tenant.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddingUser((v) => !v)}
                >
                  <UserPlus size={14} />
                  Add user
                </Button>
              </div>
              {addingUser && (
                <form
                  onSubmit={createUser}
                  className="mb-4 grid gap-3 rounded-xl border border-line bg-canvas p-4 md:grid-cols-2"
                >
                  <Field label="Full name">
                    <Input
                      value={userForm.name}
                      onChange={(e) =>
                        setUserForm({ ...userForm, name: e.target.value })
                      }
                      required
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      type="email"
                      value={userForm.email}
                      onChange={(e) =>
                        setUserForm({ ...userForm, email: e.target.value })
                      }
                      required
                    />
                  </Field>
                  <Field label="Role">
                    <Select
                      value={userForm.role}
                      onChange={(v) =>
                        setUserForm({
                          ...userForm,
                          role: v as typeof userForm.role,
                        })
                      }
                      options={["cfo", "manager"]}
                    />
                  </Field>
                  <Field label="Temporary password">
                    <Input
                      type="password"
                      value={userForm.temporaryPassword}
                      onChange={(e) =>
                        setUserForm({
                          ...userForm,
                          temporaryPassword: e.target.value,
                        })
                      }
                      required
                    />
                  </Field>
                  <div className="flex gap-2 md:col-span-2">
                    <Button
                      type="submit"
                      variant="brand"
                      size="sm"
                      disabled={busy === "user"}
                    >
                      {busy === "user" ? "Adding…" : "Add user"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAddingUser(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
              <div className="mb-4 flex flex-col gap-2 md:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="absolute left-3 top-2.5 text-muted"
                    size={15}
                  />
                  <Input
                    className="h-9 pl-9"
                    placeholder="Search users…"
                    value={userSearch}
                    onChange={(e) =>
                      setFilter("userSearch", e.target.value, "")
                    }
                  />
                </div>
                <select
                  value={userRole}
                  onChange={(e) => setFilter("userRole", e.target.value)}
                  className="h-9 rounded-[10px] border border-line bg-white px-3 text-xs font-semibold"
                >
                  <option value="all">All roles</option>
                  <option value="cfo">CFO</option>
                  <option value="manager">Manager</option>
                  <option value="customer">Customer</option>
                </select>
                <select
                  value={userStatus}
                  onChange={(e) => setFilter("userStatus", e.target.value)}
                  className="h-9 rounded-[10px] border border-line bg-white px-3 text-xs font-semibold"
                >
                  <option value="all">All access</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              {users.loading ? (
                <LoadingState />
              ) : users.error ? (
                <ErrorState message={users.error} retry={users.reload} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left">
                    <thead>
                      <tr className="border-b border-line text-[10px] font-bold uppercase tracking-[.12em] text-muted">
                        <th className="pb-2">User</th>
                        <th className="pb-2">Role</th>
                        <th className="pb-2">Last sign-in</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-right">Access</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleUsers.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-line/70 last:border-0"
                        >
                          <td className="py-3">
                            <div className="flex items-center gap-2.5">
                              <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-[10px] font-bold text-white">
                                {user.avatar}
                              </span>
                              <span>
                                <strong className="block text-xs">
                                  {user.name}
                                </strong>
                                <span className="text-[10px] text-muted">
                                  {user.email}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="py-3 text-xs font-semibold capitalize">
                            {user.role.replace("_", " ")}
                          </td>
                          <td className="py-3 text-xs text-muted">
                            {user.last_login_at
                              ? shortDate(user.last_login_at)
                              : "Never"}
                          </td>
                          <td className="py-3">
                            <Badge
                              tone={user.status === "active" ? "green" : "red"}
                            >
                              {user.status}
                            </Badge>
                          </td>
                          <td className="py-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy === user.id}
                              onClick={() => void toggleUser(user)}
                            >
                              {user.status === "active" ? "Disable" : "Enable"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </>
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
    <label className="block text-[11px] font-bold text-ink">
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
function Select({
  value,
  onChange,
  options,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  compact?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-[10px] border border-line bg-white font-semibold outline-none focus:border-brand ${compact ? "h-9 px-3 text-xs" : "h-10 w-full px-3 text-sm"}`}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option.replace("_", " ")}
        </option>
      ))}
    </select>
  );
}
function MiniMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-muted">
        {label}
      </p>
      <p className="mt-1.5 flex items-center gap-1.5 text-sm font-extrabold">
        {icon}
        {value}
      </p>
    </div>
  );
}
