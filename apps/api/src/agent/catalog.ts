export type AgentRole = "cfo" | "manager" | "customer" | "platform_admin";

export type AgentFilter = {
  id: string;
  key: string;
  type: "text" | "enum" | "date";
  values?: string[];
};

export type AgentPage = {
  id: string;
  label: string;
  description: string;
  aliases: string[];
  route: string;
  roles: AgentRole[];
  filters: AgentFilter[];
  actions: string[];
};

export const agentCatalog = {
  version: "1.1.0",
  pages: [
    {
      id: "page.overview",
      label: "Overview",
      description: "Workspace KPIs, cash trend, risk signals, and recent activity.",
      aliases: ["overview", "dashboard", "home", "summary", "kpis"],
      route: "/",
      roles: ["cfo", "manager", "customer", "platform_admin"],
      filters: [],
      actions: ["action.page.open"],
    },
    {
      id: "page.cashflow",
      label: "Cash flow",
      description: "Cash movement, forecasts, liquidity gaps, and receivables aging.",
      aliases: ["cash flow", "cashflow", "liquidity", "forecast", "cash gap", "aging"],
      route: "/cashflow",
      roles: ["cfo", "manager"],
      filters: [{ id: "filter.cashflow.period", key: "period", type: "enum", values: ["3m", "6m", "12m"] }],
      actions: ["action.page.open", "action.cashflow.explain_gap"],
    },
    {
      id: "page.invoices",
      label: "Invoices",
      description: "Receivables, invoice status, balances, due dates, and collection actions.",
      aliases: ["invoices", "invoice", "receivables", "bills", "billing", "overdue"],
      route: "/invoices",
      roles: ["cfo", "manager", "customer"],
      filters: [
        { id: "filter.invoices.status", key: "status", type: "enum", values: ["all", "draft", "sent", "overdue", "partially_paid", "paid", "disputed"] },
        { id: "filter.invoices.search", key: "search", type: "text" },
      ],
      actions: ["action.page.open", "action.invoice.open", "action.invoice.create", "action.invoice.update", "action.invoice.remind"],
    },
    {
      id: "page.payments",
      label: "Payments",
      description: "Settled receipts, payment references, methods, and linked invoices.",
      aliases: ["payments", "payment", "receipts", "transactions", "money received"],
      route: "/payments",
      roles: ["cfo", "manager", "customer"],
      filters: [{ id: "filter.payments.search", key: "search", type: "text" }],
      actions: ["action.page.open", "action.payment.record", "action.payment.update"],
    },
    {
      id: "page.customers",
      label: "Customers",
      description: "Customer portfolio, credit limits, account health, and outstanding balances.",
      aliases: ["customers", "customer", "clients", "accounts", "portfolio"],
      route: "/customers",
      roles: ["cfo", "manager"],
      filters: [],
      actions: ["action.page.open", "action.customer.open", "action.customer.create", "action.customer.update"],
    },
    {
      id: "page.disputes",
      label: "Disputes",
      description: "Billing disputes, review status, evidence, and resolution decisions.",
      aliases: ["disputes", "dispute", "cases", "resolution", "billing issue"],
      route: "/disputes",
      roles: ["cfo", "manager", "customer"],
      filters: [],
      actions: ["action.page.open", "action.dispute.open", "action.dispute.review"],
    },
    {
      id: "page.approvals",
      label: "Approvals",
      description: "Pending financial actions that require CFO review.",
      aliases: ["approvals", "approval", "requests", "pending decisions"],
      route: "/approvals",
      roles: ["cfo", "manager"],
      filters: [],
      actions: ["action.page.open", "action.approval.decide"],
    },
    {
      id: "page.audit",
      label: "Audit log",
      description: "Trace of actor, action, entity, and outcome across the workspace.",
      aliases: ["audit", "audit log", "history", "activity log", "trace"],
      route: "/audit",
      roles: ["cfo", "manager", "platform_admin"],
      filters: [],
      actions: ["action.page.open"],
    },
    {
      id: "page.tenants",
      label: "Tenants",
      description: "Platform workspaces, plans, status, users, and access controls.",
      aliases: ["tenants", "tenant", "workspaces", "organizations", "platform accounts"],
      route: "/tenants",
      roles: ["platform_admin"],
      filters: [],
      actions: ["action.page.open", "action.tenant.provision", "action.tenant.update", "action.user.provision"],
    },
  ] as AgentPage[],
  entities: ["tenant", "user", "session", "customer", "invoice", "payment", "dispute", "approval", "notification", "audit_log"],
  policy: {
    authentication: "http_only_session",
    tenantIsolation: "server_enforced",
    customerScope: "own_records_only",
    confirmationRequired: ["action.invoice.remind", "action.payment.record", "action.dispute.open", "action.approval.decide", "action.tenant.update"],
  },
};

export function catalogForRole(role: AgentRole) {
  return agentCatalog.pages.filter((page) => page.roles.includes(role));
}
