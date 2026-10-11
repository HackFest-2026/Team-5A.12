import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, query } from "../db.js";
import { audit } from "./audit.js";
import type { Actor } from "./types.js";

export class FinanceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "FinanceError";
    this.status = status;
  }
}

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

export const updateCustomerInput = createCustomerInput
  .partial()
  .extend({ customerId: z.string().min(1) })
  .refine(
    (value) => Object.keys(value).some((key) => key !== "customerId"),
    "At least one update field is required",
  );

export const deleteCustomerInput = z.object({
  customerId: z.string().min(1),
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

export const deleteInvoiceInput = z.object({
  invoiceId: z.string().min(1),
});

export const recordPaymentInput = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(["Bank transfer", "UPI", "Card"]),
  reference: z.string().min(3),
  paidAt: z.string().datetime().optional(),
});

export const updatePaymentInput = z
  .object({
    paymentId: z.string().min(1),
    method: z.enum(["Bank transfer", "UPI", "Card"]).optional(),
    reference: z.string().min(3).optional(),
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== "paymentId"),
    "At least one update field is required",
  );

export const deletePaymentInput = z.object({
  paymentId: z.string().min(1),
});

export const deletePaymentsInput = z.object({
  paymentIds: z.array(z.string().min(1)).min(1).max(30),
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

const approvalFieldsInput = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(2000),
  actionType: z.string().trim().min(2).max(80),
  amount: z.number().nonnegative().nullable(),
  risk: z.enum(["low", "medium", "high"]),
});

export const createApprovalInput = approvalFieldsInput;

export const updateApprovalInput = approvalFieldsInput
  .partial()
  .extend({ approvalId: z.string().min(1) })
  .refine(
    (value) => Object.keys(value).some((key) => key !== "approvalId"),
    "At least one update field is required",
  );

export const deleteApprovalInput = z.object({
  approvalId: z.string().min(1),
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

export async function updateCustomer(actor: Actor, rawInput: unknown) {
  const input = updateCustomerInput.parse(rawInput);
  const [updated] = await query<any>(
    `UPDATE customers SET name=COALESCE($1,name),company=COALESCE($2,company),
    email=COALESCE($3,email),segment=COALESCE($4,segment),
    health_score=COALESCE($5,health_score),credit_limit=COALESCE($6,credit_limit),
    payment_terms=COALESCE($7,payment_terms),updated_at=now()
    WHERE id=$8 AND tenant_id=$9 RETURNING *,credit_limit::float`,
    [
      input.name,
      input.company,
      input.email?.toLowerCase(),
      input.segment,
      input.healthScore,
      input.creditLimit,
      input.paymentTerms,
      input.customerId,
      actor.tenantId,
    ],
  );
  if (!updated)
    throw new FinanceError("Customer not found in this workspace.", 404);
  await audit(
    actor,
    "updated customer",
    "customer",
    updated.id,
    `${updated.company} profile updated.`,
  );
  return updated;
}

export async function deleteCustomer(actor: Actor, rawInput: unknown) {
  const input = deleteCustomerInput.parse(rawInput);
  const [customer] = await query<any>(
    `SELECT c.*,
    EXISTS(SELECT 1 FROM invoices i WHERE i.customer_id=c.id) has_invoices,
    EXISTS(SELECT 1 FROM users u WHERE u.customer_id=c.id) has_users
    FROM customers c WHERE c.id=$1 AND c.tenant_id=$2`,
    [input.customerId, actor.tenantId],
  );
  if (!customer)
    throw new FinanceError("Customer not found in this workspace.", 404);
  if (customer.has_invoices || customer.has_users)
    throw new FinanceError(
      "Customers with invoices or portal users cannot be deleted.",
      409,
    );
  await query(`DELETE FROM customers WHERE id=$1 AND tenant_id=$2`, [
    customer.id,
    actor.tenantId,
  ]);
  await audit(
    actor,
    "deleted customer",
    "customer",
    customer.id,
    `${customer.company} was deleted.`,
  );
  return { id: customer.id, company: customer.company };
}

export async function createInvoice(actor: Actor, rawInput: unknown) {
  const input = createInvoiceInput.parse(rawInput);
  const [customer] = await query<any>(
    "SELECT id,company FROM customers WHERE id=$1 AND tenant_id=$2",
    [input.customerId, actor.tenantId],
  );
  if (!customer)
    throw new FinanceError("Customer not found in this workspace.", 404);
  const id = `i-${randomUUID()}`;
  const [next] = await query<any>(
    `SELECT GREATEST(2090,COALESCE(max(substring(number from '[0-9]+')::int),2089)+1)::int n
     FROM invoices`,
  );
  const number = `INV-${next.n}`;
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
    throw new FinanceError(
      "Finance Managers can update invoice status only.",
      403,
    );
  const [current] = await query<any>(
    `SELECT *,(amount-paid_amount)::float balance FROM invoices WHERE id=$1 AND tenant_id=$2`,
    [input.invoiceId, actor.tenantId],
  );
  if (!current)
    throw new FinanceError("Invoice not found in this workspace.", 404);
  if (input.amount !== undefined && input.amount < Number(current.paid_amount))
    throw new FinanceError(
      "Invoice total cannot be lower than payments already recorded.",
    );
  if (input.status === "paid" && Number(current.balance) > 0)
    throw new FinanceError(
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

export async function deleteInvoice(actor: Actor, rawInput: unknown) {
  const input = deleteInvoiceInput.parse(rawInput);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const invoiceResult = await client.query<any>(
      `SELECT id,number FROM invoices WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
      [input.invoiceId, actor.tenantId],
    );
    const invoice = invoiceResult.rows[0];
    if (!invoice)
      throw new FinanceError("Invoice not found in this workspace.", 404);
    const payments = await client.query(
      `DELETE FROM payments WHERE invoice_id=$1 AND tenant_id=$2`,
      [invoice.id, actor.tenantId],
    );
    const disputes = await client.query(
      `DELETE FROM disputes WHERE invoice_id=$1 AND tenant_id=$2`,
      [invoice.id, actor.tenantId],
    );
    await client.query(`DELETE FROM invoices WHERE id=$1 AND tenant_id=$2`, [
      invoice.id,
      actor.tenantId,
    ]);
    await client.query("COMMIT");
    await audit(
      actor,
      "deleted invoice",
      "invoice",
      invoice.number,
      `${invoice.number} was permanently deleted with ${payments.rowCount ?? 0} linked payment(s) and ${disputes.rowCount ?? 0} linked dispute(s).`,
    );
    return {
      id: invoice.id,
      number: invoice.number,
      deletedPayments: payments.rowCount ?? 0,
      deletedDisputes: disputes.rowCount ?? 0,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Transaction may already be committed or rolled back.
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function sendInvoiceReminder(actor: Actor, invoiceId: string) {
  const [invoice] = await query<any>(
    `UPDATE invoices SET reminder_count=reminder_count+1,last_reminded_at=now()
    WHERE id=$1 AND tenant_id=$2 AND status IN ('overdue','partially_paid','sent')
    RETURNING id,number,reminder_count,status`,
    [invoiceId, actor.tenantId],
  );
  if (!invoice)
    throw new FinanceError(
      "Eligible invoice not found in this workspace.",
      404,
    );
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
    if (!invoice)
      throw new FinanceError("Invoice not found in this workspace.", 404);
    if (input.amount > Number(invoice.balance))
      throw new FinanceError("Payment exceeds the invoice balance.");
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

export async function updatePayment(actor: Actor, rawInput: unknown) {
  const input = updatePaymentInput.parse(rawInput);
  const [updated] = await query<any>(
    `UPDATE payments SET method=COALESCE($1,method),reference=COALESCE($2,reference),updated_at=now()
    WHERE id=$3 AND tenant_id=$4
    RETURNING id,invoice_id,amount::float,method,reference,status,paid_at`,
    [input.method, input.reference, input.paymentId, actor.tenantId],
  );
  if (!updated)
    throw new FinanceError("Payment not found in this workspace.", 404);
  await audit(
    actor,
    "updated payment",
    "payment",
    updated.id,
    `${updated.reference} payment details updated.`,
  );
  return updated;
}

export async function deletePayment(actor: Actor, rawInput: unknown) {
  const input = deletePaymentInput.parse(rawInput);
  const result = await deletePayments(actor, { paymentIds: [input.paymentId] });
  return {
    paymentId: result.deletedPayments[0]?.id,
    invoice: result.invoices[0],
  };
}

export async function deletePayments(actor: Actor, rawInput: unknown) {
  const input = deletePaymentsInput.parse(rawInput);
  const paymentIds = [...new Set(input.paymentIds)];
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<any>(
      `SELECT * FROM payments WHERE id=ANY($1::text[]) AND tenant_id=$2 FOR UPDATE`,
      [paymentIds, actor.tenantId],
    );
    if (result.rows.length !== paymentIds.length) {
      const found = new Set(result.rows.map((payment) => payment.id));
      const missing = paymentIds.filter((id) => !found.has(id));
      throw new FinanceError(
        `Payment${missing.length === 1 ? "" : "s"} not found in this workspace: ${missing.join(", ")}.`,
        404,
      );
    }
    const invoiceIds = [
      ...new Set(result.rows.map((payment) => String(payment.invoice_id))),
    ];
    await client.query(
      `DELETE FROM payments WHERE id=ANY($1::text[]) AND tenant_id=$2`,
      [paymentIds, actor.tenantId],
    );
    const invoiceResult = await client.query<any>(
      `UPDATE invoices i SET
        paid_amount=COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.invoice_id=i.id),0),
        status=CASE
          WHEN COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.invoice_id=i.id),0)>=i.amount THEN 'paid'::invoice_status
          WHEN COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.invoice_id=i.id),0)>0 THEN 'partially_paid'::invoice_status
          ELSE 'sent'::invoice_status
        END,
        updated_at=now()
      WHERE i.id=ANY($1::text[]) AND i.tenant_id=$2
      RETURNING id,number,status,amount::float,paid_amount::float,(amount-paid_amount)::float balance`,
      [invoiceIds, actor.tenantId],
    );
    await client.query("COMMIT");
    await Promise.all(
      result.rows.map((payment) =>
        audit(
          actor,
          "deleted payment",
          "payment",
          payment.id,
          `${payment.reference} was removed and the invoice balance restored.`,
        ),
      ),
    );
    return {
      deletedPayments: result.rows.map((payment) => ({
        id: payment.id,
        reference: payment.reference,
        amount: Number(payment.amount),
      })),
      invoices: invoiceResult.rows,
    };
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
    if (!invoice)
      throw new FinanceError("Invoice not found in your account.", 404);
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
    if (!dispute)
      throw new FinanceError("Dispute not found in this workspace.", 404);
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

export async function createApproval(actor: Actor, rawInput: unknown) {
  const input = createApprovalInput.parse(rawInput);
  const id = `a-${randomUUID()}`;
  const [approval] = await query<any>(
    `INSERT INTO approvals
      (id,tenant_id,title,description,action_type,amount,risk,status,requested_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)
     RETURNING id,title,description,action_type,amount::float,risk,status,requested_by,created_at`,
    [
      id,
      actor.tenantId,
      input.title,
      input.description,
      input.actionType,
      input.amount,
      input.risk,
      actor.name,
    ],
  );
  await audit(
    actor,
    "created approval request",
    "approval",
    id,
    `${input.title} was added to the approval queue.`,
  );
  return approval;
}

export async function updateApproval(actor: Actor, rawInput: unknown) {
  const input = updateApprovalInput.parse(rawInput);
  const [approval] = await query<any>(
    `UPDATE approvals SET title=COALESCE($1,title),description=COALESCE($2,description),
    action_type=COALESCE($3,action_type),amount=CASE WHEN $4::boolean THEN $5 ELSE amount END,
    risk=COALESCE($6,risk)
    WHERE id=$7 AND tenant_id=$8
    RETURNING id,title,description,action_type,amount::float,risk,status,requested_by,created_at`,
    [
      input.title,
      input.description,
      input.actionType,
      Object.prototype.hasOwnProperty.call(input, "amount"),
      input.amount,
      input.risk,
      input.approvalId,
      actor.tenantId,
    ],
  );
  if (!approval)
    throw new FinanceError("Approval not found in this workspace.", 404);
  await audit(
    actor,
    "updated approval request",
    "approval",
    approval.id,
    `${approval.title} details were updated.`,
  );
  return approval;
}

export async function deleteApproval(actor: Actor, rawInput: unknown) {
  const input = deleteApprovalInput.parse(rawInput);
  const [approval] = await query<any>(
    `DELETE FROM approvals WHERE id=$1 AND tenant_id=$2
     RETURNING id,title,status`,
    [input.approvalId, actor.tenantId],
  );
  if (!approval)
    throw new FinanceError("Approval not found in this workspace.", 404);
  await audit(
    actor,
    "deleted approval request",
    "approval",
    approval.id,
    `${approval.title} (${approval.status}) was deleted.`,
  );
  return approval;
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
    throw new FinanceError(
      "Pending approval not found in this workspace.",
      404,
    );
  await audit(
    actor,
    `${input.decision} action`,
    "approval",
    approval.id,
    `${approval.title} was ${input.decision}.`,
  );
  return approval;
}
