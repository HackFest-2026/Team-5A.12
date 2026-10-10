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

export type AgentUiAction = {
  id: string;
  label: string;
  description: string;
  aliases: string[];
  route: string;
  roles: AgentRole[];
  formFields: string[];
};

export const agentCatalog = {
  version: "1.3.0",
  pages: [
    {
      id: "page.overview",
      label: "Overview",
      description:
        "Workspace KPIs, cash trend, risk signals, and recent activity.",
      aliases: ["overview", "dashboard", "home", "summary", "kpis"],
      route: "/",
      roles: ["cfo", "manager", "customer", "platform_admin"],
      filters: [],
      actions: ["action.page.open"],
    },
    {
      id: "page.cashflow",
      label: "Cash flow",
      description:
        "Cash movement, forecasts, liquidity gaps, and receivables aging.",
      aliases: [
        "cash flow",
        "cashflow",
        "liquidity",
        "forecast",
        "cash gap",
        "aging",
        "monthly revenue",
        "revenue",
        "inflow",
        "outflow",
      ],
      route: "/cashflow",
      roles: ["cfo", "manager"],
      filters: [
        {
          id: "filter.cashflow.period",
          key: "period",
          type: "enum",
          values: ["1m", "3m", "6m"],
        },
      ],
      actions: ["action.page.open", "action.cashflow.explain_gap"],
    },
    {
      id: "page.invoices",
      label: "Invoices",
      description:
        "Receivables, invoice status, balances, due dates, and collection actions.",
      aliases: [
        "invoices",
        "invoice",
        "receivables",
        "bills",
        "billing",
        "overdue",
      ],
      route: "/invoices",
      roles: ["cfo", "manager", "customer"],
      filters: [
        {
          id: "filter.invoices.status",
          key: "status",
          type: "enum",
          values: [
            "all",
            "draft",
            "sent",
            "overdue",
            "partially_paid",
            "paid",
            "disputed",
          ],
        },
        { id: "filter.invoices.search", key: "search", type: "text" },
      ],
      actions: [
        "action.page.open",
        "action.invoice.open",
        "action.invoice.create",
        "action.invoice.update",
        "action.invoice.remind",
      ],
    },
    {
      id: "page.payments",
      label: "Payments",
      description:
        "Settled receipts, payment references, methods, and linked invoices.",
      aliases: [
        "payments",
        "payment",
        "receipts",
        "transactions",
        "money received",
      ],
      route: "/payments",
      roles: ["cfo", "manager", "customer"],
      filters: [{ id: "filter.payments.search", key: "search", type: "text" }],
      actions: [
        "action.page.open",
        "action.payment.record",
        "action.payment.update",
      ],
    },
    {
      id: "page.customers",
      label: "Customers",
      description:
        "Customer portfolio, credit limits, account health, and outstanding balances.",
      aliases: ["customers", "customer", "clients", "accounts", "portfolio"],
      route: "/customers",
      roles: ["cfo", "manager"],
      filters: [],
      actions: [
        "action.page.open",
        "action.customer.open",
        "action.customer.create",
        "action.customer.update",
      ],
    },
    {
      id: "page.disputes",
      label: "Disputes",
      description:
        "Billing disputes, review status, evidence, and resolution decisions.",
      aliases: ["disputes", "dispute", "cases", "resolution", "billing issue"],
      route: "/disputes",
      roles: ["cfo", "manager", "customer"],
      filters: [],
      actions: [
        "action.page.open",
        "action.dispute.open",
        "action.dispute.review",
      ],
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
      description:
        "Trace of actor, action, entity, and outcome across the workspace.",
      aliases: ["audit", "audit log", "history", "activity log", "trace"],
      route: "/audit",
      roles: ["cfo", "manager", "platform_admin"],
      filters: [],
      actions: ["action.page.open"],
    },
    {
      id: "page.tenants",
      label: "Tenants",
      description:
        "Platform workspaces, plans, status, users, and access controls.",
      aliases: [
        "tenants",
        "tenant",
        "workspaces",
        "organizations",
        "platform accounts",
      ],
      route: "/tenants",
      roles: ["platform_admin"],
      filters: [],
      actions: [
        "action.page.open",
        "action.tenant.provision",
        "action.tenant.update",
        "action.user.provision",
      ],
    },
  ] as AgentPage[],
  uiActions: [
    {
      id: "action.invoice.create",
      label: "Create invoice",
      description: "Open the invoice creation form.",
      aliases: [
        "create invoice",
        "new invoice",
        "raise invoice",
        "issue invoice",
      ],
      route: "/invoices?modal=create-invoice",
      roles: ["cfo"],
      formFields: ["customerId", "amount", "dueDate", "category", "status"],
    },
    {
      id: "action.invoice.create_with_customer",
      label: "Create customer and invoice",
      description:
        "Create a missing customer and preserve the invoice draft in one guided workflow.",
      aliases: [
        "create invoice with new customer",
        "create customer and invoice",
      ],
      route: "/invoices",
      roles: ["cfo"],
      formFields: [
        "name",
        "company",
        "email",
        "segment",
        "healthScore",
        "creditLimit",
        "paymentTerms",
        "amount",
        "dueDate",
        "category",
        "status",
      ],
    },
    {
      id: "action.payment.record",
      label: "Record payment",
      description: "Open the payment recording form.",
      aliases: ["record payment", "add payment", "new payment", "log payment"],
      route: "/payments?modal=record-payment",
      roles: ["cfo"],
      formFields: ["invoiceId", "amount", "method", "reference", "paidAt"],
    },
    {
      id: "action.customer.create",
      label: "Add customer",
      description: "Open the customer creation form.",
      aliases: [
        "add customer",
        "create customer",
        "new customer",
        "add client",
      ],
      route: "/customers?modal=add-customer",
      roles: ["cfo"],
      formFields: [
        "name",
        "company",
        "email",
        "segment",
        "healthScore",
        "creditLimit",
        "paymentTerms",
      ],
    },
    {
      id: "action.dispute.open",
      label: "Open dispute",
      description: "Open the customer dispute form.",
      aliases: [
        "open dispute",
        "raise dispute",
        "create dispute",
        "report billing issue",
      ],
      route: "/disputes?modal=open-dispute",
      roles: ["customer"],
      formFields: ["invoiceId", "reason", "detail"],
    },
    {
      id: "action.tenant.provision",
      label: "Provision tenant",
      description: "Open the workspace provisioning form.",
      aliases: [
        "provision tenant",
        "create tenant",
        "add workspace",
        "new workspace",
      ],
      route: "/tenants?panel=provision-tenant",
      roles: ["platform_admin"],
      formFields: [
        "name",
        "slug",
        "contactEmail",
        "plan",
        "seatLimit",
        "ownerName",
        "ownerEmail",
      ],
    },
    {
      id: "action.user.provision",
      label: "Add workspace user",
      description: "Open tenant management for user provisioning.",
      aliases: ["add user", "create user", "invite user"],
      route: "/tenants?panel=add-user",
      roles: ["platform_admin"],
      formFields: ["name", "email", "role"],
    },
  ] as AgentUiAction[],
  entities: [
    "tenant",
    "user",
    "session",
    "customer",
    "invoice",
    "payment",
    "dispute",
    "approval",
    "notification",
    "audit_log",
  ],
  policy: {
    authentication: "http_only_session",
    tenantIsolation: "server_enforced",
    customerScope: "own_records_only",
    confirmationRequired: [
      "action.invoice.remind",
      "action.payment.record",
      "action.dispute.open",
      "action.approval.decide",
      "action.tenant.update",
    ],
  },
};

export function catalogForRole(role: AgentRole) {
  return agentCatalog.pages.filter((page) => page.roles.includes(role));
}

export function uiActionsForRole(role: AgentRole) {
  return agentCatalog.uiActions.filter((action) => action.roles.includes(role));
}

export function findUiTarget(target: string, role: AgentRole) {
  return (
    uiActionsForRole(role).find((action) => action.id === target) ??
    catalogForRole(role).find((page) => page.id === target)
  );
}
