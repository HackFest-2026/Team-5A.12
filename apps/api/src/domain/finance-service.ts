import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, query } from "../db.js";
import { audit } from "./audit.js";
import type { Actor } from "./types.js";

export const createInvoiceInput = z.object({
  customerId: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.string().date(),
  category: z.string().min(2),
  status: z.enum(["draft", "sent"]).default("draft"),
});

export const createCustomerInput = z.object({
  name: z.string().min(2),
  company: z.string().min(2),
  email: z.string().email(),
  segment: z.enum(["Enterprise", "Growth", "SMB"]),
  healthScore: z.number().int().min(0).max(100),
  creditLimit: z.number().positive(),
  paymentTerms: z.number().int().min(1).max(180),
});

export const updateInvoiceInput = z
  .object({
    invoiceId: z.string().min(1),
    status: z
      .enum(["draft", "sent", "overdue", "partially_paid", "paid", "disputed"])
      .optional(),
    amount: z.number().positive().optional(),
    dueDate: z.string().date().optional(),
    category: z.string().min(2).optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== "invoiceId"),
    "At least one update field is required",
  );

export const recordPaymentInput = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(["Bank transfer", "UPI", "Card"]),
  reference: z.string().min(3),
  paidAt: z.string().datetime().optional(),
});

export const openDisputeInput = z.object({
  invoiceId: z.string().min(1),
  reason: z.string().min(3),
  detail: z.string().min(10),
});
export const reviewDisputeInput = z.object({
  disputeId: z.string().min(1),
  status: z.enum(["under_review", "resolved", "rejected"]),
  resolutionNote: z.string().min(5),
});
export const decideApprovalInput = z.object({
  approvalId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
});

export async function createCustomer(actor: Actor, rawInput: unknown) {
  const input = createCustomerInput.parse(rawInput);
  const id = `c-${randomUUID()}`;
  const [created] = await query<any>(
    `INSERT INTO customers (id,tenant_id,name,company,email,segment,health_score,credit_limit,payment_terms)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *,credit_limit::float`,
    [
      id,
      actor.tenantId,
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
    actor,
    "created customer",
    "customer",
    id,
    `${input.company} added to the customer portfolio.`,
  );
  return created;
}

export async function createInvoice(actor: Actor, rawInput: unknown) {
  const input = createInvoiceInput.parse(rawInput);
  const [customer] = await query<any>(
    "SELECT id,company FROM customers WHERE id=$1 AND tenant_id=$2",
    [input.customerId, actor.tenantId],
  );
  if (!customer) throw new Error("Customer not found in this workspace.");
  const id = `i-${randomUUID()}`;
  const [count] = await query<any>(
    "SELECT count(*)::int n FROM invoices WHERE tenant_id=$1",
    [actor.tenantId],
  );
  const number = `INV-${2090 + count.n}`;
  const [created] = await query<any>(
    `INSERT INTO invoices
    (id,tenant_id,customer_id,number,amount,status,issue_date,due_date,category,risk_score)
    VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE,$7,$8,10)
    RETURNING id,number,customer_id,amount::float,status,due_date,category`,
    [
      id,
      actor.tenantId,
      input.customerId,
      number,
      input.amount,
      input.status,
      input.dueDate,
      input.category,
    ],
  );
  await audit(
    actor,
    "created invoice",
    "invoice",
    number,
    `${number} created for ₹${input.amount.toLocaleString("en-IN")}.`,
  );
  return { ...created, company: customer.company };
}

export async function updateInvoice(actor: Actor, rawInput: unknown) {
  const input = updateInvoiceInput.parse(rawInput);
  if (
    actor.role === "manager" &&
    Object.keys(input).some((key) => !["invoiceId", "status"].includes(key))
  )
    throw new Error("Finance Managers can update invoice status only.");
  const [current] = await query<any>(
    `SELECT *,(amount-paid_amount)::float balance FROM invoices WHERE id=$1 AND tenant_id=$2`,
    [input.invoiceId, actor.tenantId],
  );
  if (!current) throw new Error("Invoice not found in this workspace.");
  if (input.amount !== undefined && input.amount < Number(current.paid_amount))
    throw new Error(
      "Invoice total cannot be lower than payments already recorded.",
    );
  if (input.status === "paid" && Number(current.balance) > 0)
    throw new Error(
      "Record the remaining payment before marking this invoice paid.",
    );
  const [updated] = await query<any>(
    `UPDATE invoices SET status=COALESCE($1,status),amount=COALESCE($2,amount),
    due_date=COALESCE($3,due_date),category=COALESCE($4,category),updated_at=now()
    WHERE id=$5 AND tenant_id=$6 RETURNING id,number,status,amount::float,paid_amount::float,(amount-paid_amount)::float balance,due_date,category`,
    [
      input.status,
      input.amount,
      input.dueDate,
      input.category,
      input.invoiceId,
      actor.tenantId,
    ],
  );
  await audit(
    actor,
    "updated invoice",
    "invoice",
    updated.number,
    `${updated.number}: ${Object.entries(input)
      .filter(([key]) => key !== "invoiceId")
      .map(([key, value]) => `${key}=${value}`)
      .join(", ")}.`,
  );
  return updated;
}

export async function sendInvoiceReminder(actor: Actor, invoiceId: string) {
  const [invoice] = await query<any>(
    `UPDATE invoices SET reminder_count=reminder_count+1,last_reminded_at=now()
    WHERE id=$1 AND tenant_id=$2 AND status IN ('overdue','partially_paid','sent')
    RETURNING id,number,reminder_count,status`,
    [invoiceId, actor.tenantId],
  );
  if (!invoice)
    throw new Error("Eligible invoice not found in this workspace.");
  await audit(
    actor,
    "sent reminder",
    "invoice",
    invoice.number,
    `Collection reminder ${invoice.reminder_count} queued and delivered.`,
  );
  const recipients = await query<any>(
    `SELECT u.id FROM users u JOIN invoices i ON i.customer_id=u.customer_id WHERE i.id=$1 AND u.status='active'`,
    [invoiceId],
  );
  await Promise.all(
    recipients.map((recipient) =>
      query(
        `INSERT INTO notifications (id,tenant_id,user_id,type,title,detail,route) VALUES ($1,$2,$3,'invoice','Payment reminder received',$4,'/invoices')`,
        [
          `n-${randomUUID()}`,
          actor.tenantId,
          recipient.id,
          `${invoice.number} has an updated payment reminder.`,
        ],
      ),
    ),
  );
  return {
    id: invoice.id,
    number: invoice.number,
    reminderCount: invoice.reminder_count,
    status: invoice.status,
  };
}

export async function recordPayment(actor: Actor, rawInput: unknown) {
  const input = recordPaymentInput.parse(rawInput);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT *,(amount-paid_amount)::float balance FROM invoices WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
      [input.invoiceId, actor.tenantId],
    );
    const invoice = result.rows[0];
    if (!invoice) throw new Error("Invoice not found in this workspace.");
    if (input.amount > Number(invoice.balance))
      throw new Error("Payment exceeds the invoice balance.");
    const id = `p-${randomUUID()}`;
    const created = await client.query(
      `INSERT INTO payments (id,tenant_id,invoice_id,customer_id,amount,method,reference,status,paid_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'settled',COALESCE($8::timestamptz,now()))
      RETURNING id,invoice_id,amount::float,method,reference,status,paid_at`,
      [
        id,
        actor.tenantId,
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
    const invoiceReadback = await client.query(
      `SELECT id,number,status,amount::float,paid_amount::float,(amount-paid_amount)::float balance FROM invoices WHERE id=$1`,
      [invoice.id],
    );
    await client.query("COMMIT");
    await audit(
      actor,
      "recorded payment",
      "payment",
      id,
      `${input.reference}: ₹${input.amount.toLocaleString("en-IN")} recorded against ${invoice.number}.`,
    );
    return { payment: created.rows[0], invoice: invoiceReadback.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function openDispute(actor: Actor, rawInput: unknown) {
  const input = openDisputeInput.parse(rawInput);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const invoiceResult = await client.query(
      `SELECT * FROM invoices WHERE id=$1 AND tenant_id=$2 AND customer_id=$3 FOR UPDATE`,
      [input.invoiceId, actor.tenantId, actor.customerId],
    );
    const invoice = invoiceResult.rows[0];
    if (!invoice) throw new Error("Invoice not found in your account.");
    const id = `d-${randomUUID()}`;
    await client.query(
      `INSERT INTO disputes (id,tenant_id,invoice_id,customer_id,reason,detail) VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        id,
        actor.tenantId,
        input.invoiceId,
        actor.customerId,
        input.reason,
        input.detail,
      ],
    );
    await client.query(
      `UPDATE invoices SET status='disputed',updated_at=now() WHERE id=$1`,
      [input.invoiceId],
    );
    await client.query("COMMIT");
    await audit(
      actor,
      "opened dispute",
      "invoice",
      invoice.number,
      `${input.reason}: ${input.detail}`,
    );
    return {
      id,
      invoiceId: input.invoiceId,
      invoiceNumber: invoice.number,
      status: "open",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function reviewDispute(actor: Actor, rawInput: unknown) {
  const input = reviewDisputeInput.parse(rawInput);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE disputes SET status=$1,resolution_note=$2,reviewed_by=$3,reviewed_at=now()
      WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [
        input.status,
        input.resolutionNote,
        actor.name,
        input.disputeId,
        actor.tenantId,
      ],
    );
    const dispute = result.rows[0];
    if (!dispute) throw new Error("Dispute not found in this workspace.");
    if (["resolved", "rejected"].includes(input.status))
      await client.query(
        `UPDATE invoices SET status=CASE WHEN paid_amount>=amount THEN 'paid'::invoice_status ELSE 'sent'::invoice_status END,updated_at=now() WHERE id=$1 AND status='disputed'`,
        [dispute.invoice_id],
      );
    await client.query("COMMIT");
    await audit(
      actor,
      "reviewed dispute",
      "dispute",
      dispute.id,
      `Case set to ${input.status}: ${input.resolutionNote}`,
    );
    return {
      id: dispute.id,
      invoiceId: dispute.invoice_id,
      status: dispute.status,
      resolutionNote: dispute.resolution_note,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function decideApproval(actor: Actor, rawInput: unknown) {
  const input = decideApprovalInput.parse(rawInput);
  const [approval] = await query<any>(
    `UPDATE approvals SET status=$1,decided_by=$2,decided_at=now()
    WHERE id=$3 AND tenant_id=$4 AND status='pending'
    RETURNING id,title,description,action_type,amount::float,risk,status,decided_by,decided_at`,
    [input.decision, actor.name, input.approvalId, actor.tenantId],
  );
  if (!approval)
    throw new Error("Pending approval not found in this workspace.");
  await audit(
    actor,
    `${input.decision} action`,
    "approval",
    approval.id,
    `${approval.title} was ${input.decision}.`,
  );
  return approval;
}
