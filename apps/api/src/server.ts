import "./config.js";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { agentCatalog, catalogForRole } from "./agent/catalog.js";
import {
  confirmAction,
  materializeProactiveNotifications,
  proactiveSignals,
  rejectAction,
  runAgent,
  undoAction,
} from "./agent/runtime.js";
import { db, query } from "./db.js";
import { audit } from "./domain/audit.js";
import { deleteInvoice, FinanceError } from "./domain/finance-service.js";
import type { Actor, Role } from "./domain/types.js";

const app = express();
const port = Number(process.env.PORT ?? 4001);
const configuredWebOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      const isLocalDevelopment =
        process.env.NODE_ENV !== "production" &&
        Boolean(origin?.match(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/));
      if (
        !origin ||
        configuredWebOrigins.includes(origin) ||
        isLocalDevelopment
      )
        return callback(null, true);
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
  }),
);
app.use(express.json());

type AuthenticatedRequest = Request & {
  auth?: Actor;
  sessionTokenHash?: string;
};

const SESSION_COOKIE = "cashpilot_session";
const SESSION_DAYS = 7;
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

function readCookie(req: Request, name: string) {
  const match = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function publicActor(row: any): Actor {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar,
    role: row.role,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name ?? null,
    customerId: row.customer_id,
  };
}

async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const rawToken = readCookie(req, SESSION_COOKIE);
  if (!rawToken)
    return res.status(401).json({ error: "Please sign in to continue." });
  const hash = tokenHash(rawToken);
  const [row] = await query<any>(
    `SELECT u.*, t.name tenant_name, t.status tenant_status
    FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN tenants t ON t.id=u.tenant_id
    WHERE s.token_hash=$1 AND s.expires_at>now()`,
    [hash],
  );
  if (
    !row ||
    row.status !== "active" ||
    (row.tenant_id && row.tenant_status !== "active")
  ) {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    return res.status(401).json({
      error:
        row?.tenant_status === "suspended"
          ? "This workspace is suspended."
          : "Your session has expired.",
    });
  }
  req.auth = publicActor(row);
  req.sessionTokenHash = hash;
  next();
}

function actor(req: Request): Actor {
  const current = (req as AuthenticatedRequest).auth;
  if (!current) throw new Error("Authenticated actor missing");
  return current;
}

function allow(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(actor(req).role)) {
      return res
        .status(403)
        .json({ error: "This action is outside your role and data scope." });
    }
    next();
  };
}

const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(handler(req, res)).catch(next);

app.get(
  "/health",
  asyncRoute(async (_req, res) => {
    await query("SELECT 1");
    res.json({
      ok: true,
      service: "cashpilot-api",
      agent: {
        provider: process.env.OPENROUTER_API_KEY ? "openrouter" : "local_tools",
        configured: Boolean(process.env.OPENROUTER_API_KEY),
        model: process.env.OPENROUTER_MODEL ?? "google/gemini-3-flash-preview",
      },
    });
  }),
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});
app.post(
  "/api/auth/login",
  asyncRoute(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const [row] = await query<any>(
      `SELECT u.*, t.name tenant_name, t.status tenant_status
    FROM users u LEFT JOIN tenants t ON t.id=u.tenant_id
    WHERE lower(u.email)=lower($1) AND u.password_hash=crypt($2,u.password_hash)`,
      [input.email.trim(), input.password],
    );
    if (!row)
      return res.status(401).json({ error: "Email or password is incorrect." });
    if (row.status !== "active")
      return res.status(403).json({ error: "This user account is disabled." });
    if (row.tenant_id && row.tenant_status !== "active")
      return res.status(403).json({
        error: "This workspace is not active. Contact CashPilot support.",
      });
    const rawToken = randomBytes(32).toString("base64url");
    await query(
      `INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,now()+($3 || ' days')::interval)`,
      [tokenHash(rawToken), row.id, SESSION_DAYS],
    );
    await query(`UPDATE users SET last_login_at=now() WHERE id=$1`, [row.id]);
    res.cookie(SESSION_COOKIE, rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_DAYS * 86400000,
      path: "/",
    });
    res.json(publicActor(row));
  }),
);

app.use("/api", (req, res, next) => {
  void Promise.resolve(
    requireAuth(req as AuthenticatedRequest, res, next),
  ).catch(next);
});

app.get("/api/auth/me", (req, res) => res.json(actor(req)));
app.get("/api/session", (req, res) => res.json(actor(req)));
app.post(
  "/api/auth/logout",
  asyncRoute(async (req: AuthenticatedRequest, res) => {
    if (req.sessionTokenHash)
      await query(`DELETE FROM sessions WHERE token_hash=$1`, [
        req.sessionTokenHash,
      ]);
    res.clearCookie(SESSION_COOKIE, { path: "/", sameSite: "lax" });
    res.json({ ok: true });
  }),
);

app.get(
  "/api/dashboard",
  asyncRoute(async (req, res) => {
    const a = actor(req);
    if (a.role === "platform_admin") {
      const [metrics] =
        await query<any>(`SELECT count(*)::int tenants, sum(monthly_volume)::float monthly_volume,
      count(*) FILTER (WHERE status='active')::int active_tenants FROM tenants`);
      const tenants = await query(
        `SELECT * FROM tenants ORDER BY monthly_volume DESC`,
      );
      return res.json({ mode: "platform", metrics, tenants });
    }

    const customerClause =
      a.role === "customer" ? "AND i.customer_id = $2" : "";
    const params =
      a.role === "customer" ? [a.tenantId, a.customerId] : [a.tenantId];
    const [metrics] = await query<any>(
      `SELECT
      COALESCE(sum(i.amount),0)::float total_invoiced,
      COALESCE(sum(i.paid_amount),0)::float collected,
      COALESCE(sum(i.amount-i.paid_amount) FILTER (WHERE i.status IN ('overdue','partially_paid','sent','disputed')),0)::float outstanding,
      COALESCE(sum(i.amount-i.paid_amount) FILTER (WHERE i.status='overdue'),0)::float overdue,
      count(*) FILTER (WHERE i.status='overdue')::int overdue_count,
      round(COALESCE(avg(i.risk_score),0))::int avg_risk
     FROM invoices i WHERE i.tenant_id=$1 ${customerClause}`,
      params,
    );
    const cashflow =
      a.role === "customer"
        ? await query(
            `WITH months AS (
              SELECT generate_series(
                date_trunc('month', CURRENT_DATE) - interval '5 months',
                date_trunc('month', CURRENT_DATE),
                interval '1 month'
              )::date AS month_start
            ), invoice_months AS (
              SELECT date_trunc('month', issue_date)::date AS month_start,
                sum(amount)::float AS billed
              FROM invoices
              WHERE tenant_id=$1 AND customer_id=$2
                AND issue_date >= date_trunc('month', CURRENT_DATE) - interval '5 months'
              GROUP BY 1
            ), payment_months AS (
              SELECT date_trunc('month', paid_at)::date AS month_start,
                sum(amount)::float AS paid
              FROM payments
              WHERE tenant_id=$1 AND customer_id=$2 AND status='settled'
                AND paid_at >= date_trunc('month', CURRENT_DATE) - interval '5 months'
              GROUP BY 1
            )
            SELECT to_char(m.month_start,'Mon') AS label,
              COALESCE(i.billed,0)::float AS inflow,
              COALESCE(p.paid,0)::float AS outflow,
              sum(COALESCE(i.billed,0)-COALESCE(p.paid,0))
                OVER (ORDER BY m.month_start)::float AS forecast
            FROM months m
            LEFT JOIN invoice_months i USING (month_start)
            LEFT JOIN payment_months p USING (month_start)
            ORDER BY m.month_start`,
            [a.tenantId, a.customerId],
          )
        : await query(
            `SELECT to_char(month_start,'Mon') AS label, inflow::float, outflow::float, forecast::float
    FROM cashflow_months WHERE tenant_id=$1 ORDER BY month_start`,
            [a.tenantId],
          );
    const risks = await query(
      `SELECT i.id, i.number, i.amount::float, i.paid_amount::float, i.due_date,
      i.risk_score, c.company, (CURRENT_DATE-i.due_date)::int days_overdue
    FROM invoices i JOIN customers c ON c.id=i.customer_id
    WHERE i.tenant_id=$1 AND i.status='overdue' ${a.role === "customer" ? "AND i.customer_id=$2" : ""}
    ORDER BY i.risk_score DESC LIMIT 4`,
      params,
    );
    const activity = await query(
      `SELECT * FROM audit_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 5`,
      [a.tenantId],
    );
    res.json({ mode: "business", metrics, cashflow, risks, activity });
  }),
);

app.get(
  "/api/invoices",
  asyncRoute(async (req, res) => {
    const a = actor(req);
    if (a.role === "platform_admin")
      return res
        .status(403)
        .json({ error: "Select a tenant workspace first." });
    const params: unknown[] = [a.tenantId];
    let where = "i.tenant_id=$1";
    if (a.role === "customer") {
      params.push(a.customerId);
      where += ` AND i.customer_id=$${params.length}`;
    }
    if (req.query.status && req.query.status !== "all") {
      params.push(req.query.status);
      where += ` AND i.status=$${params.length}`;
    }
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      where += ` AND (i.number ILIKE $${params.length} OR c.company ILIKE $${params.length})`;
    }
    const rows = await query(
      `SELECT i.*, i.amount::float amount, i.paid_amount::float paid_amount,
    (i.amount-i.paid_amount)::float balance, c.company, c.name customer_name
    FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE ${where}
    ORDER BY CASE WHEN i.status='overdue' THEN 0 ELSE 1 END, i.due_date ASC`,
      params,
    );
    res.json(rows);
  }),
);

app.get(
  "/api/invoices/:id",
  asyncRoute(async (req, res) => {
    const a = actor(req);
    if (a.role === "platform_admin")
      return res
        .status(403)
        .json({ error: "Select a tenant workspace first." });
    const params =
      a.role === "customer"
        ? [req.params.id, a.tenantId, a.customerId]
        : [req.params.id, a.tenantId];
    const [invoice] = await query<any>(
      `SELECT i.*,i.amount::float amount,i.paid_amount::float paid_amount,
    (i.amount-i.paid_amount)::float balance,c.company,c.name customer_name,c.email customer_email,
    c.segment,c.payment_terms,c.credit_limit::float credit_limit,c.health_score
    FROM invoices i JOIN customers c ON c.id=i.customer_id
    WHERE i.id=$1 AND i.tenant_id=$2 ${a.role === "customer" ? "AND i.customer_id=$3" : ""}`,
      params,
    );
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    const payments = await query(
      `SELECT id,amount::float,method,reference,status,paid_at FROM payments WHERE invoice_id=$1 ORDER BY paid_at DESC`,
      [invoice.id],
    );
    const disputes = await query(
      `SELECT id,reason,detail,status,resolution_note,reviewed_by,reviewed_at,created_at FROM disputes WHERE invoice_id=$1 ORDER BY created_at DESC`,
      [invoice.id],
    );
    res.json({ ...invoice, payments, disputes });
  }),
);

const invoiceSchema = z.object({
  customerId: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.string().date(),
  category: z.string().min(2),
  status: z.enum(["draft", "sent"]).default("draft"),
});

app.post(
  "/api/invoices",
  allow("cfo"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const input = invoiceSchema.parse(req.body);
    const id = `i-${crypto.randomUUID()}`;
    const [next] = await query<any>(
      `SELECT GREATEST(2090,COALESCE(max(substring(number from '[0-9]+')::int),2089)+1)::int n
       FROM invoices`,
    );
    const number = `INV-${next.n}`;
    const [created] = await query(
      `INSERT INTO invoices
    (id,tenant_id,customer_id,number,amount,status,issue_date,due_date,category,risk_score)
    VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,$8,10) RETURNING *`,
      [
        id,
        a.tenantId,
        input.customerId,
        number,
        input.amount,
        input.status,
        input.dueDate,
        input.category,
      ],
    );
    await audit(
      a,
      "created invoice",
      "invoice",
      number,
      `${number} created for ₹${input.amount.toLocaleString("en-IN")}.`,
    );
    res.status(201).json(created);
  }),
);

const invoiceUpdateSchema = z
  .object({
    status: z
      .enum(["draft", "sent", "overdue", "partially_paid", "paid", "disputed"])
      .optional(),
    amount: z.number().positive().optional(),
    dueDate: z.string().date().optional(),
    category: z.string().min(2).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

app.patch(
  "/api/invoices/:id",
  allow("cfo", "manager"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const input = invoiceUpdateSchema.parse(req.body);
    if (
      a.role === "manager" &&
      Object.keys(input).some((key) => key !== "status")
    )
      return res
        .status(403)
        .json({ error: "Finance Managers can update invoice status only." });
    const [current] = await query<any>(
      `SELECT *,(amount-paid_amount)::float balance FROM invoices WHERE id=$1 AND tenant_id=$2`,
      [req.params.id, a.tenantId],
    );
    if (!current) return res.status(404).json({ error: "Invoice not found." });
    if (
      input.amount !== undefined &&
      input.amount < Number(current.paid_amount)
    )
      return res.status(400).json({
        error: "Invoice total cannot be lower than payments already recorded.",
      });
    if (input.status === "paid" && Number(current.balance) > 0)
      return res.status(400).json({
        error: "Record the remaining payment before marking this invoice paid.",
      });
    const [updated] = await query<any>(
      `UPDATE invoices SET status=COALESCE($1,status),amount=COALESCE($2,amount),
    due_date=COALESCE($3,due_date),category=COALESCE($4,category),updated_at=now()
    WHERE id=$5 AND tenant_id=$6 RETURNING *,amount::float,paid_amount::float,(amount-paid_amount)::float balance`,
      [
        input.status,
        input.amount,
        input.dueDate,
        input.category,
        req.params.id,
        a.tenantId,
      ],
    );
    await audit(
      a,
      "updated invoice",
      "invoice",
      updated.number,
      `${updated.number}: ${Object.entries(input)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ")}.`,
    );
    res.json(updated);
  }),
);

app.delete(
  "/api/invoices/:id",
  allow("cfo"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    res.json(await deleteInvoice(a, { invoiceId: req.params.id }));
  }),
);

app.post(
  "/api/invoices/:id/remind",
  allow("cfo", "manager"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const [invoice] = await query<any>(
      `UPDATE invoices SET reminder_count=reminder_count+1,last_reminded_at=now()
    WHERE id=$1 AND tenant_id=$2 RETURNING number, reminder_count`,
      [req.params.id, a.tenantId],
    );
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    await audit(
      a,
      "sent reminder",
      "invoice",
      invoice.number,
      `Collection reminder ${invoice.reminder_count} queued and delivered.`,
    );
    const recipients = await query<any>(
      `SELECT u.id FROM users u JOIN invoices i ON i.customer_id=u.customer_id WHERE i.id=$1 AND u.status='active'`,
      [req.params.id],
    );
    await Promise.all(
      recipients.map((recipient) =>
        query(
          `INSERT INTO notifications (id,tenant_id,user_id,type,title,detail,route) VALUES ($1,$2,$3,'invoice','Payment reminder received',$4,'/invoices')`,
          [
            `n-${randomUUID()}`,
            a.tenantId,
            recipient.id,
            `${invoice.number} has an updated payment reminder.`,
          ],
        ),
      ),
    );
    res.json({ ok: true, reminderCount: invoice.reminder_count });
  }),
);

app.get(
  "/api/customers",
  allow("cfo", "manager"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const rows = await query(
      `SELECT c.*, c.credit_limit::float,
      COALESCE(sum(i.amount-i.paid_amount),0)::float outstanding,
      count(i.id) FILTER (WHERE i.status='overdue')::int overdue_invoices
    FROM customers c LEFT JOIN invoices i ON i.customer_id=c.id
    WHERE c.tenant_id=$1 GROUP BY c.id ORDER BY outstanding DESC`,
      [a.tenantId],
    );
    res.json(rows);
  }),
);

app.get(
  "/api/customers/:id",
  allow("cfo", "manager"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const [customer] = await query<any>(
      `SELECT c.*,c.credit_limit::float,
    COALESCE(sum(i.amount-i.paid_amount),0)::float outstanding,
    count(i.id) FILTER (WHERE i.status='overdue')::int overdue_invoices
    FROM customers c LEFT JOIN invoices i ON i.customer_id=c.id
    WHERE c.id=$1 AND c.tenant_id=$2 GROUP BY c.id`,
      [req.params.id, a.tenantId],
    );
    if (!customer)
      return res.status(404).json({ error: "Customer not found." });
    const invoices = await query(
      `SELECT id,number,amount::float,paid_amount::float,(amount-paid_amount)::float balance,status,due_date FROM invoices WHERE customer_id=$1 ORDER BY due_date DESC`,
      [customer.id],
    );
    const payments = await query(
      `SELECT p.id,p.amount::float,p.method,p.reference,p.status,p.paid_at,i.number FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE p.customer_id=$1 ORDER BY p.paid_at DESC`,
      [customer.id],
    );
    res.json({ ...customer, invoices, payments });
  }),
);

const customerSchema = z.object({
  name: z.string().min(2),
  company: z.string().min(2),
  email: z.string().email(),
  segment: z.enum(["Enterprise", "Growth", "SMB"]),
  healthScore: z.number().int().min(0).max(100),
  creditLimit: z.number().positive(),
  paymentTerms: z.number().int().min(1).max(180),
});

app.post(
  "/api/customers",
  allow("cfo"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const input = customerSchema.parse(req.body);
    const id = `c-${randomUUID()}`;
    const [created] = await query<any>(
      `INSERT INTO customers (id,tenant_id,name,company,email,segment,health_score,credit_limit,payment_terms)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *,credit_limit::float`,
      [
        id,
        a.tenantId,
        input.name,
        input.company,
        input.email.toLowerCase(),
        input.segment,
        input.healthScore,
        input.creditLimit,
        input.paymentTerms,
      ],
    );
    await audit(
      a,
      "created customer",
      "customer",
      id,
      `${input.company} added to the customer portfolio.`,
    );
    res.status(201).json(created);
  }),
);

const customerUpdateSchema = customerSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );
app.patch(
  "/api/customers/:id",
  allow("cfo"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const input = customerUpdateSchema.parse(req.body);
    const [updated] = await query<any>(
      `UPDATE customers SET name=COALESCE($1,name),company=COALESCE($2,company),email=COALESCE($3,email),
    segment=COALESCE($4,segment),health_score=COALESCE($5,health_score),credit_limit=COALESCE($6,credit_limit),
    payment_terms=COALESCE($7,payment_terms),updated_at=now() WHERE id=$8 AND tenant_id=$9 RETURNING *,credit_limit::float`,
      [
        input.name,
        input.company,
        input.email?.toLowerCase(),
        input.segment,
        input.healthScore,
        input.creditLimit,
        input.paymentTerms,
        req.params.id,
        a.tenantId,
      ],
    );
    if (!updated) return res.status(404).json({ error: "Customer not found." });
    await audit(
      a,
      "updated customer",
      "customer",
      updated.id,
      `${updated.company} profile updated.`,
    );
    res.json(updated);
  }),
);

app.delete(
  "/api/customers/:id",
  allow("cfo"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const [customer] = await query<any>(
      `SELECT c.*,EXISTS(SELECT 1 FROM invoices i WHERE i.customer_id=c.id) has_invoices,
    EXISTS(SELECT 1 FROM users u WHERE u.customer_id=c.id) has_users FROM customers c WHERE c.id=$1 AND c.tenant_id=$2`,
      [req.params.id, a.tenantId],
    );
    if (!customer)
      return res.status(404).json({ error: "Customer not found." });
    if (customer.has_invoices || customer.has_users)
      return res.status(409).json({
        error: "Customers with invoices or portal users cannot be deleted.",
      });
    await query(`DELETE FROM customers WHERE id=$1`, [customer.id]);
    await audit(
      a,
      "deleted customer",
      "customer",
      customer.id,
      `${customer.company} was deleted.`,
    );
    res.json({ ok: true });
  }),
);

app.get(
  "/api/payments",
  asyncRoute(async (req, res) => {
    const a = actor(req);
    if (a.role === "platform_admin")
      return res
        .status(403)
        .json({ error: "Select a tenant workspace first." });
    const rows = await query(
      `SELECT p.*, p.amount::float, i.number, c.company
    FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN customers c ON c.id=p.customer_id
    WHERE p.tenant_id=$1 ${a.role === "customer" ? "AND p.customer_id=$2" : ""}
    ORDER BY p.paid_at DESC`,
      a.role === "customer" ? [a.tenantId, a.customerId] : [a.tenantId],
    );
    res.json(rows);
  }),
);

const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(["Bank transfer", "UPI", "Card"]),
  reference: z.string().min(3),
  paidAt: z.string().datetime().optional(),
});
app.post(
  "/api/payments",
  allow("cfo"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const input = paymentSchema.parse(req.body);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `SELECT *,(amount-paid_amount)::float balance FROM invoices WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
        [input.invoiceId, a.tenantId],
      );
      const invoice = result.rows[0];
      if (!invoice) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Invoice not found." });
      }
      if (input.amount > Number(invoice.balance)) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ error: "Payment exceeds the invoice balance." });
      }
      const id = `p-${randomUUID()}`;
      const created = await client.query(
        `INSERT INTO payments (id,tenant_id,invoice_id,customer_id,amount,method,reference,status,paid_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'settled',COALESCE($8::timestamptz,now())) RETURNING *,amount::float`,
        [
          id,
          a.tenantId,
          invoice.id,
          invoice.customer_id,
          input.amount,
          input.method,
          input.reference,
          input.paidAt,
        ],
      );
      await client.query(
        `UPDATE invoices SET paid_amount=paid_amount+$1,status=CASE WHEN paid_amount+$1>=amount THEN 'paid'::invoice_status ELSE 'partially_paid'::invoice_status END,updated_at=now() WHERE id=$2`,
        [input.amount, invoice.id],
      );
      await client.query("COMMIT");
      await audit(
        a,
        "recorded payment",
        "payment",
        id,
        `${input.reference}: ₹${input.amount.toLocaleString("en-IN")} recorded against ${invoice.number}.`,
      );
      const recipients = await query<any>(
        `SELECT id FROM users WHERE customer_id=$1 AND status='active'`,
        [invoice.customer_id],
      );
      await Promise.all(
        recipients.map((recipient) =>
          query(
            `INSERT INTO notifications (id,tenant_id,user_id,type,title,detail,route) VALUES ($1,$2,$3,'payment','Payment recorded',$4,'/payments')`,
            [
              `n-${randomUUID()}`,
              a.tenantId,
              recipient.id,
              `₹${input.amount.toLocaleString("en-IN")} was recorded against ${invoice.number}.`,
            ],
          ),
        ),
      );
      res.status(201).json(created.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

const paymentUpdateSchema = z
  .object({
    method: z.enum(["Bank transfer", "UPI", "Card"]).optional(),
    reference: z.string().min(3).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field is required");
app.patch(
  "/api/payments/:id",
  allow("cfo"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const input = paymentUpdateSchema.parse(req.body);
    const [updated] = await query<any>(
      `UPDATE payments SET method=COALESCE($1,method),reference=COALESCE($2,reference),updated_at=now() WHERE id=$3 AND tenant_id=$4 RETURNING *,amount::float`,
      [input.method, input.reference, req.params.id, a.tenantId],
    );
    if (!updated) return res.status(404).json({ error: "Payment not found." });
    await audit(
      a,
      "updated payment",
      "payment",
      updated.id,
      `${updated.reference} payment details updated.`,
    );
    res.json(updated);
  }),
);

app.delete(
  "/api/payments/:id",
  allow("cfo"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `DELETE FROM payments WHERE id=$1 AND tenant_id=$2 RETURNING *`,
        [req.params.id, a.tenantId],
      );
      const payment = result.rows[0];
      if (!payment) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Payment not found." });
      }
      await client.query(
        `UPDATE invoices SET paid_amount=GREATEST(0,paid_amount-$1),status=CASE WHEN paid_amount-$1<=0 THEN 'sent'::invoice_status ELSE 'partially_paid'::invoice_status END,updated_at=now() WHERE id=$2`,
        [payment.amount, payment.invoice_id],
      );
      await client.query("COMMIT");
      await audit(
        a,
        "deleted payment",
        "payment",
        payment.id,
        `${payment.reference} was removed and the invoice balance restored.`,
      );
      res.json({ ok: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.get(
  "/api/cashflow",
  allow("cfo", "manager"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const months = await query(
      `SELECT month_start, inflow::float, outflow::float, forecast::float
    FROM cashflow_months WHERE tenant_id=$1 ORDER BY month_start`,
      [a.tenantId],
    );
    const aging = await query(
      `SELECT
      COALESCE(sum(amount-paid_amount) FILTER (WHERE due_date>=CURRENT_DATE),0)::float current,
      COALESCE(sum(amount-paid_amount) FILTER (WHERE due_date<CURRENT_DATE AND due_date>=CURRENT_DATE-30),0)::float days_1_30,
      COALESCE(sum(amount-paid_amount) FILTER (WHERE due_date<CURRENT_DATE-30 AND due_date>=CURRENT_DATE-60),0)::float days_31_60,
      COALESCE(sum(amount-paid_amount) FILTER (WHERE due_date<CURRENT_DATE-60),0)::float days_60_plus
    FROM invoices WHERE tenant_id=$1 AND status <> 'paid'`,
      [a.tenantId],
    );
    const latest = months.at(-1) as
      { outflow?: number; forecast?: number } | undefined;
    const projectedGap = Math.max(
      0,
      Number(latest?.outflow ?? 0) - Number(latest?.forecast ?? 0),
    );
    res.json({
      months,
      aging: aging[0],
      projectedGap,
      gapDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      gapBasis: "latest_outflow_minus_forecast",
    });
  }),
);

app.get(
  "/api/approvals",
  allow("cfo", "manager"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    res.json(
      await query(
        `SELECT *, amount::float FROM approvals WHERE tenant_id=$1 ORDER BY
    CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC`,
        [a.tenantId],
      ),
    );
  }),
);

const approvalFieldsSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(2000),
  actionType: z.string().trim().min(2).max(80),
  amount: z.number().nonnegative().nullable(),
  risk: z.enum(["low", "medium", "high"]),
});

app.post(
  "/api/approvals",
  allow("cfo"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const input = approvalFieldsSchema.parse(req.body);
    const id = `a-${randomUUID()}`;
    const [approval] = await query<any>(
      `INSERT INTO approvals
        (id,tenant_id,title,description,action_type,amount,risk,status,requested_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)
       RETURNING *,amount::float`,
      [
        id,
        a.tenantId,
        input.title,
        input.description,
        input.actionType,
        input.amount,
        input.risk,
        a.name,
      ],
    );
    await audit(
      a,
      "created approval request",
      "approval",
      id,
      `${input.title} was added to the approval queue.`,
    );
    res.status(201).json(approval);
  }),
);

app.patch(
  "/api/approvals/:id",
  allow("cfo"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const input = approvalFieldsSchema.parse(req.body);
    const [approval] = await query<any>(
      `UPDATE approvals SET title=$1,description=$2,action_type=$3,amount=$4,risk=$5
       WHERE id=$6 AND tenant_id=$7 RETURNING *,amount::float`,
      [
        input.title,
        input.description,
        input.actionType,
        input.amount,
        input.risk,
        req.params.id,
        a.tenantId,
      ],
    );
    if (!approval)
      return res.status(404).json({ error: "Approval not found." });
    await audit(
      a,
      "updated approval request",
      "approval",
      approval.id,
      `${approval.title} details were updated.`,
    );
    res.json(approval);
  }),
);

app.delete(
  "/api/approvals/:id",
  allow("cfo"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const [approval] = await query<any>(
      `DELETE FROM approvals WHERE id=$1 AND tenant_id=$2
       RETURNING id,title,status`,
      [req.params.id, a.tenantId],
    );
    if (!approval)
      return res.status(404).json({ error: "Approval not found." });
    await audit(
      a,
      "deleted approval request",
      "approval",
      approval.id,
      `${approval.title} (${approval.status}) was deleted.`,
    );
    res.status(204).end();
  }),
);

const decisionSchema = z.object({ decision: z.enum(["approved", "rejected"]) });
app.post(
  "/api/approvals/:id/decision",
  allow("cfo"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const { decision } = decisionSchema.parse(req.body);
    const [approval] = await query<any>(
      `UPDATE approvals SET status=$1,decided_by=$2,decided_at=now()
    WHERE id=$3 AND tenant_id=$4 AND status='pending' RETURNING *`,
      [decision, a.name, req.params.id, a.tenantId],
    );
    if (!approval)
      return res.status(404).json({ error: "Pending approval not found." });
    await audit(
      a,
      `${decision} action`,
      "approval",
      approval.id,
      `${approval.title} was ${decision}.`,
    );
    res.json(approval);
  }),
);

app.get(
  "/api/disputes",
  asyncRoute(async (req, res) => {
    const a = actor(req);
    if (a.role === "platform_admin")
      return res
        .status(403)
        .json({ error: "Select a tenant workspace first." });
    res.json(
      await query(
        `SELECT d.*, i.number, i.amount::float, c.company FROM disputes d
    JOIN invoices i ON i.id=d.invoice_id JOIN customers c ON c.id=d.customer_id
    WHERE d.tenant_id=$1 ${a.role === "customer" ? "AND d.customer_id=$2" : ""} ORDER BY d.created_at DESC`,
        a.role === "customer" ? [a.tenantId, a.customerId] : [a.tenantId],
      ),
    );
  }),
);

const disputeSchema = z.object({
  invoiceId: z.string(),
  reason: z.string().min(3),
  detail: z.string().min(10),
});
app.post(
  "/api/disputes",
  allow("customer"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const input = disputeSchema.parse(req.body);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const invoiceResult = await client.query(
        `SELECT * FROM invoices WHERE id=$1 AND customer_id=$2 FOR UPDATE`,
        [input.invoiceId, a.customerId],
      );
      const invoice = invoiceResult.rows[0];
      if (!invoice) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Invoice not found." });
      }
      const id = `d-${crypto.randomUUID()}`;
      await client.query(
        `INSERT INTO disputes (id,tenant_id,invoice_id,customer_id,reason,detail) VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          id,
          a.tenantId,
          input.invoiceId,
          a.customerId,
          input.reason,
          input.detail,
        ],
      );
      await client.query(`UPDATE invoices SET status='disputed' WHERE id=$1`, [
        input.invoiceId,
      ]);
      await client.query("COMMIT");
      await audit(
        a,
        "opened dispute",
        "invoice",
        invoice.number,
        `${input.reason}: ${input.detail}`,
      );
      const reviewers = await query<any>(
        `SELECT id FROM users WHERE tenant_id=$1 AND role IN ('cfo','manager') AND status='active'`,
        [a.tenantId],
      );
      await Promise.all(
        reviewers.map((reviewer) =>
          query(
            `INSERT INTO notifications (id,tenant_id,user_id,type,title,detail,route) VALUES ($1,$2,$3,'case','New dispute requires review',$4,'/disputes')`,
            [
              `n-${randomUUID()}`,
              a.tenantId,
              reviewer.id,
              `${invoice.number}: ${input.reason}`,
            ],
          ),
        ),
      );
      res.status(201).json({ id, status: "open" });
    } finally {
      client.release();
    }
  }),
);

const disputeReviewSchema = z.object({
  status: z.enum(["under_review", "resolved", "rejected"]),
  resolutionNote: z.string().min(5),
});
app.patch(
  "/api/disputes/:id",
  allow("cfo", "manager"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const input = disputeReviewSchema.parse(req.body);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE disputes SET status=$1,resolution_note=$2,reviewed_by=$3,reviewed_at=now()
    WHERE id=$4 AND tenant_id=$5 RETURNING *`,
        [input.status, input.resolutionNote, a.name, req.params.id, a.tenantId],
      );
      const dispute = result.rows[0];
      if (!dispute) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Dispute not found." });
      }
      if (["resolved", "rejected"].includes(input.status))
        await client.query(
          `UPDATE invoices SET status=CASE WHEN paid_amount>=amount THEN 'paid'::invoice_status ELSE 'sent'::invoice_status END,updated_at=now() WHERE id=$1 AND status='disputed'`,
          [dispute.invoice_id],
        );
      const users = await client.query(
        `SELECT id FROM users WHERE customer_id=$1 AND status='active'`,
        [dispute.customer_id],
      );
      for (const user of users.rows)
        await client.query(
          `INSERT INTO notifications (id,tenant_id,user_id,type,title,detail,route) VALUES ($1,$2,$3,'case','Dispute status updated',$4,'/disputes')`,
          [
            `n-${randomUUID()}`,
            a.tenantId,
            user.id,
            `Your dispute is now ${input.status.replace("_", " ")}.`,
          ],
        );
      await client.query("COMMIT");
      await audit(
        a,
        "reviewed dispute",
        "dispute",
        dispute.id,
        `Case set to ${input.status}: ${input.resolutionNote}`,
      );
      res.json(dispute);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.get(
  "/api/notifications",
  asyncRoute(async (req, res) => {
    const a = actor(req);
    res.json(
      await query(
        `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`,
        [a.id],
      ),
    );
  }),
);
app.post(
  "/api/notifications/read-all",
  asyncRoute(async (req, res) => {
    const a = actor(req);
    await query(
      `UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1`,
      [a.id],
    );
    res.json({ ok: true });
  }),
);
app.post(
  "/api/notifications/:id/read",
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const [notification] = await query<any>(
      `UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING *`,
      [req.params.id, a.id],
    );
    if (!notification)
      return res.status(404).json({ error: "Notification not found." });
    res.json(notification);
  }),
);

app.get(
  "/api/audit",
  allow("cfo", "manager", "platform_admin"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const rows =
      a.role === "platform_admin"
        ? await query(
            `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`,
          )
        : await query(
            `SELECT * FROM audit_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 100`,
            [a.tenantId],
          );
    res.json(rows);
  }),
);

app.get(
  "/api/tenants",
  allow("platform_admin"),
  asyncRoute(async (_req, res) => {
    res.json(
      await query(`SELECT t.id,t.name,t.slug,t.contact_email,t.plan,t.status,t.seat_limit,
    t.monthly_volume::float AS monthly_volume,t.created_at,t.updated_at,count(u.id)::int user_count
    FROM tenants t LEFT JOIN users u ON u.tenant_id=t.id GROUP BY t.id ORDER BY t.monthly_volume DESC`),
    );
  }),
);

const tenantSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  contactEmail: z.string().email(),
  plan: z.enum(["Starter", "Growth", "Scale"]),
  seatLimit: z.number().int().min(1).max(1000),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  temporaryPassword: z.string().min(8).max(100),
});

app.post(
  "/api/tenants",
  allow("platform_admin"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const input = tenantSchema.parse(req.body);
    const client = await db.connect();
    const tenantId = `t-${randomUUID()}`;
    const ownerId = `u-${randomUUID()}`;
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO tenants (id,name,slug,contact_email,plan,status,seat_limit)
      VALUES ($1,$2,$3,$4,$5,'active',$6)`,
        [
          tenantId,
          input.name,
          input.slug,
          input.contactEmail,
          input.plan,
          input.seatLimit,
        ],
      );
      const avatar = input.ownerName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
      await client.query(
        `INSERT INTO users (id,tenant_id,name,email,role,avatar,password_hash)
      VALUES ($1,$2,$3,$4,'cfo',$5,crypt($6,gen_salt('bf')))`,
        [
          ownerId,
          tenantId,
          input.ownerName,
          input.ownerEmail.toLowerCase(),
          avatar,
          input.temporaryPassword,
        ],
      );
      await client.query("COMMIT");
      await audit(
        a,
        "provisioned tenant",
        "tenant",
        tenantId,
        `${input.name} provisioned on the ${input.plan} plan with ${input.seatLimit} seats.`,
        tenantId,
      );
      res
        .status(201)
        .json({ id: tenantId, name: input.name, status: "active" });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }),
);

const tenantUpdateSchema = z
  .object({
    name: z.string().min(2).max(80).optional(),
    contactEmail: z.string().email().optional(),
    plan: z.enum(["Starter", "Growth", "Scale"]).optional(),
    status: z.enum(["active", "review", "suspended", "archived"]).optional(),
    seatLimit: z.number().int().min(1).max(1000).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

app.patch(
  "/api/tenants/:id",
  allow("platform_admin"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const input = tenantUpdateSchema.parse(req.body);
    const [updated] = await query<any>(
      `UPDATE tenants SET
    name=COALESCE($1,name),contact_email=COALESCE($2,contact_email),plan=COALESCE($3,plan),
    status=COALESCE($4,status),seat_limit=COALESCE($5,seat_limit),updated_at=now()
    WHERE id=$6 RETURNING *`,
      [
        input.name,
        input.contactEmail,
        input.plan,
        input.status,
        input.seatLimit,
        req.params.id,
      ],
    );
    if (!updated) return res.status(404).json({ error: "Tenant not found." });
    if (input.status === "suspended")
      await query(
        `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id=$1)`,
        [updated.id],
      );
    await audit(
      a,
      "updated tenant",
      "tenant",
      updated.id,
      `${updated.name}: ${Object.entries(input)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ")}.`,
      updated.id,
    );
    res.json(updated);
  }),
);

app.delete(
  "/api/tenants/:id",
  allow("platform_admin"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const [tenant] = await query<any>(
      `UPDATE tenants SET status='archived',updated_at=now() WHERE id=$1 AND status<>'archived' RETURNING *`,
      [req.params.id],
    );
    if (!tenant)
      return res.status(404).json({ error: "Active tenant not found." });
    await query(
      `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id=$1)`,
      [tenant.id],
    );
    await audit(
      a,
      "archived tenant",
      "tenant",
      tenant.id,
      `${tenant.name} was archived and all sessions revoked.`,
      tenant.id,
    );
    res.json({ ok: true });
  }),
);

app.get(
  "/api/tenants/:id/users",
  allow("platform_admin"),
  asyncRoute(async (req, res) => {
    res.json(
      await query(
        `SELECT id,name,email,role,avatar,status,last_login_at,created_at,customer_id
    FROM users WHERE tenant_id=$1 ORDER BY CASE role WHEN 'cfo' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,name`,
        [req.params.id],
      ),
    );
  }),
);

const tenantUserSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  role: z.enum(["cfo", "manager", "customer"]),
  temporaryPassword: z.string().min(8).max(100),
  customerId: z.string().nullable().optional(),
});

app.post(
  "/api/tenants/:id/users",
  allow("platform_admin"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const input = tenantUserSchema.parse(req.body);
    const [tenant] = await query<any>(
      `SELECT id,name,seat_limit FROM tenants WHERE id=$1`,
      [req.params.id],
    );
    if (!tenant) return res.status(404).json({ error: "Tenant not found." });
    const [{ count }] = await query<any>(
      `SELECT count(*)::int count FROM users WHERE tenant_id=$1 AND status='active'`,
      [tenant.id],
    );
    if (count >= tenant.seat_limit)
      return res
        .status(409)
        .json({ error: "This tenant has reached its seat limit." });
    if (input.role === "customer" && !input.customerId)
      return res
        .status(400)
        .json({ error: "Customer users must be linked to a customer record." });
    const id = `u-${randomUUID()}`;
    const avatar = input.name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
    const [created] = await query<any>(
      `INSERT INTO users (id,tenant_id,customer_id,name,email,role,avatar,password_hash)
    VALUES ($1,$2,$3,$4,$5,$6,$7,crypt($8,gen_salt('bf')))
    RETURNING id,name,email,role,avatar,status,created_at`,
      [
        id,
        tenant.id,
        input.customerId ?? null,
        input.name,
        input.email.toLowerCase(),
        input.role,
        avatar,
        input.temporaryPassword,
      ],
    );
    await audit(
      a,
      "provisioned user",
      "user",
      id,
      `${input.name} added as ${input.role}.`,
      tenant.id,
    );
    res.status(201).json(created);
  }),
);

const userUpdateSchema = z
  .object({
    role: z.enum(["cfo", "manager", "customer"]).optional(),
    status: z.enum(["active", "disabled"]).optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

app.patch(
  "/api/tenants/:tenantId/users/:userId",
  allow("platform_admin"),
  asyncRoute(async (req, res) => {
    const a = actor(req);
    const input = userUpdateSchema.parse(req.body);
    const [updated] = await query<any>(
      `UPDATE users SET role=COALESCE($1,role),status=COALESCE($2,status)
    WHERE id=$3 AND tenant_id=$4 RETURNING id,name,email,role,avatar,status,last_login_at,created_at`,
      [input.role, input.status, req.params.userId, req.params.tenantId],
    );
    if (!updated) return res.status(404).json({ error: "User not found." });
    if (input.status === "disabled")
      await query(`DELETE FROM sessions WHERE user_id=$1`, [updated.id]);
    await audit(
      a,
      "updated user",
      "user",
      updated.id,
      `${updated.name}: ${Object.entries(input)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ")}.`,
      String(req.params.tenantId),
    );
    res.json(updated);
  }),
);

const agentRunSchema = z.object({
  message: z.string().trim().min(1).max(500),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(1000),
      }),
    )
    .max(6)
    .optional()
    .default([]),
  context: z.object({
    pageId: z.string().max(80).nullable().optional(),
    route: z.string().startsWith("/").max(200),
    search: z.string().max(500).optional().default(""),
    locale: z.string().max(40).optional(),
    timezone: z.string().max(80).optional(),
    uiStateVersion: z.number().int().nonnegative(),
  }),
});

app.post("/api/agent/runs", async (req, res, next) => {
  const wantsStream = req.headers.accept?.includes("text/event-stream");
  try {
    const a = actor(req);
    const input = agentRunSchema.parse(req.body);
    if (!wantsStream) {
      return res
        .status(201)
        .json(await runAgent(a, input.message, input.context, input.history));
    }
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const send = (event: { type: string; [key: string]: unknown }) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    await runAgent(a, input.message, input.context, input.history, send);
    res.end();
  } catch (error) {
    if (!wantsStream || !res.headersSent) return next(error);
    const detail = error instanceof Error ? error.message : "Agent run failed.";
    res.write("event: error\n");
    res.write(`data: ${JSON.stringify({ type: "error", error: detail })}\n\n`);
    res.end();
  }
});

app.get(
  "/api/agent/signals",
  asyncRoute(async (req, res) => {
    res.json(await proactiveSignals(actor(req)));
  }),
);

app.post(
  "/api/agent/actions/:id/confirm",
  asyncRoute(async (req, res) => {
    res.json(await confirmAction(actor(req), String(req.params.id)));
  }),
);

app.post(
  "/api/agent/actions/:id/reject",
  asyncRoute(async (req, res) => {
    res.json(await rejectAction(actor(req), String(req.params.id)));
  }),
);

app.post(
  "/api/agent/actions/:id/undo",
  asyncRoute(async (req, res) => {
    res.json(await undoAction(actor(req), String(req.params.id)));
  }),
);

app.get("/api/agent/catalog", (req, res) => {
  const a = actor(req);
  res.json({
    version: agentCatalog.version,
    currentRole: a.role,
    tenantId: a.tenantId,
    pages: catalogForRole(a.role),
    entities: agentCatalog.entities,
    policy: agentCatalog.policy,
  });
});

app.get("/api/context/catalog", (req, res) => {
  const a = actor(req);
  res.json({
    version: agentCatalog.version,
    currentRole: a.role,
    tenantId: a.tenantId,
    pages: catalogForRole(a.role),
    entities: agentCatalog.entities,
    policy: agentCatalog.policy,
  });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  if (error instanceof FinanceError)
    return res.status(error.status).json({ error: error.message });
  if (error instanceof z.ZodError)
    return res
      .status(400)
      .json({ error: "Invalid request", issues: error.issues });
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  )
    return res
      .status(409)
      .json({ error: "That email or workspace slug is already in use." });
  res
    .status(500)
    .json({ error: "Something went wrong while processing the request." });
});

app.listen(port, () => {
  console.log(`CashPilot API running on http://localhost:${port}`);
  void materializeProactiveNotifications().catch((error) =>
    console.error("Proactive detector failed", error),
  );
  const proactiveTimer = setInterval(
    () =>
      void materializeProactiveNotifications().catch((error) =>
        console.error("Proactive detector failed", error),
      ),
    5 * 60_000,
  );
  proactiveTimer.unref();
});
