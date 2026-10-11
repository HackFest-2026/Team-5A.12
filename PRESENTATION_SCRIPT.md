# CashPilot website presentation script

**Format:** live website walkthrough, not slides  
**Recommended duration:** 7 to 9 minutes  
**Presenter role:** start as CFO, then briefly switch to Customer  
**Tone:** natural, confident, and technically precise

## Before presenting

1. Open CashPilot at `http://localhost:5174`.
2. Sign in as the CFO using `maya@northstarlabs.in` and the demo password.
3. Keep the agent panel open on the right.
4. Start on **Overview**.
5. Keep the Customer login ready for the role-isolation demonstration.

---

## 1. Login and opening

### What to show

Show the login screen, sign in, and let the Overview page load.

### What to say

“This is CashPilot, an agentic finance-operations workspace for accounts receivable and cash-flow management.

The problem we are addressing is very practical. Finance teams already have invoice, payment, customer, dispute, and approval data, but reaching a decision usually means moving through several screens and manually connecting those records.

CashPilot gives the user one operational workspace and an embedded finance agent. The agent can understand the page we are viewing, retrieve live records, explain a risk with evidence, navigate to the correct workflow, and prepare an action. The human remains in control of every financial write.”

### Technical line

“Authentication uses revocable HTTP-only sessions. The server derives the actor, role, tenant, and customer scope from that session rather than trusting identity information inside the prompt.”

---

## 2. Overview: the CFO command center

### What to show

Point to:

- Total invoiced
- Collected and collection rate
- Outstanding receivables
- At-risk revenue
- Cash-movement chart
- Risk radar
- Recent activity

### What to say

“The Overview page is the CFO command center. It converts the live ledger into the few signals that need attention now.

At the top, we show total invoiced, collected value, outstanding receivables, and overdue exposure. The collection rate is calculated as cash collected divided by total invoiced value. Outstanding accounts receivable is the sum of invoice value minus paid value across open receivable states.

On the right, the risk radar ranks overdue invoices using the balance, days overdue, and stored risk score. In this demo data, Acme Retail has ₹10.6 lakh outstanding on invoice INV-2048, while Terra Hospitality has ₹8.6 lakh outstanding on INV-2051.

The recent-activity section keeps the operational context visible. It tells us who took an action, which record changed, and when it happened.”

### KPI mapping

“This screen maps directly to finance KPIs:

- **Collection rate** equals collected cash divided by total invoiced value.
- **Outstanding AR** equals the aggregate open invoice balance.
- **Overdue exposure ratio** equals overdue AR divided by total outstanding AR.
- **Risk concentration** measures how much overdue value sits in the highest-risk customer accounts.

These are deterministic database calculations. The language model does not calculate the ledger totals.”

### Transition

“The dashboard tells us that there is a risk. The agent helps us investigate why.”

---

## 3. Agent investigation from the current website context

### What to do

Click **Ask agent**, or type:

> Why is our cash gap so large?

### What to say while it runs

“The browser sends the request together with the current page ID, route, filters, locale, time zone, and UI-state version. The authenticated identity stays on the server.

The agent does not receive unrestricted database access. It receives only the typed tools permitted for this role. For this question, it can retrieve cash-flow data and contributing invoices, while the server performs the financial arithmetic.”

### What to show in the response

Expand or point to:

- Evidence records
- Execution trace
- Runtime mode
- Latency and token metrics

### What to say

“The response includes evidence IDs and source fields, so a number can be traced back to a specific invoice or cash-flow record. The execution trace shows which tools ran. We also expose the runtime mode, latency, and token use instead of hiding the agent behind a single text box.

The technical KPI here is the **evidence-grounded numeric claim rate**. It is the percentage of numeric statements that include valid source IDs and a reproducible calculation. Our target for the evaluated test set is 100 percent.”

### Transition

“Now let us inspect the liquidity view the agent is reasoning over.”

---

## 4. Cash Flow: liquidity pressure and receivables aging

### What to do

Open **Cash flow** from the sidebar. Change the period between one, three, and six months.

### What to show

- Latest inflow
- Latest outflow
- Projected gap
- Actual versus forecast chart
- Receivables-aging chart
- Liquidity-pressure callout
- **Review contributors** button

### What to say

“The Cash Flow page combines actual movement, forecast values, and receivables aging.

The URL stores the selected period, so the state is shareable and reproducible. When the agent navigates here, it must apply a catalog-approved period value and the browser acknowledges the resulting UI state.

The liquidity callout calculates how much of the projected gap could potentially be covered by collecting overdue receivables. We call this **cash-gap recovery coverage**.”

### KPI mapping

“Cash-gap recovery coverage is calculated as eligible overdue receivables divided by the projected liquidity gap, capped at 100 percent for display.

For forecasting quality, we can report **weighted absolute percentage error**, or WAPE. The formula is the sum of absolute actual-versus-forecast errors divided by the sum of actual values. WAPE gives us a portfolio-level error rate without allowing very small months to dominate the metric.

The aging distribution also supports the **overdue exposure ratio** by separating current, 1-to-30-day, 31-to-60-day, and over-60-day balances.”

### What to do next

Click **Review contributors**. The website should open `/invoices?status=overdue`.

### What to say

“This is context-aware navigation. The system is not simply opening the invoice page. It is opening the canonical route with the overdue filter already applied.”

### Technical KPI

“We evaluate this with **route-state exact match**. A navigation result counts as correct only when both the page ID and normalized query parameters match the expected state. Our hackathon target is at least 95 percent on a held-out request set.”

---

## 5. Invoices: from portfolio risk to record-level evidence

### What to show

- The active overdue filter
- Search and sort controls
- Invoice number, customer, due date, total, balance, and risk score
- **Why overdue?** action
- Invoice detail view

### What to say

“The Invoices page is the operational ledger. The status filter came from the previous workflow and remains visible in the URL.

Users can search, sort by balance or risk, inspect an invoice, export the filtered result, or ask the agent why an invoice is overdue.

I will use INV-2048. The system can combine its original amount, the ₹4.2 lakh settled payment, the remaining ₹10.6 lakh balance, the reminder history, and any dispute record.”

### What to do

Click **Why overdue?** for INV-2048.

### What to say

“This button opens the agent with a record-specific prompt. It asks for the live invoice, payment, reminder, and dispute history. The context is narrow enough to produce an explanation that a finance manager can verify.”

### KPI mapping

“For collections, we track:

- **Days Sales Outstanding**, or DSO, calculated as average accounts receivable divided by net credit sales, multiplied by the days in the period.
- **Overdue exposure ratio**, which measures the share of outstanding AR already past due.
- **Collection recovery rate**, calculated as overdue value recovered during the period divided by overdue value eligible for collection at the start of the period.
- **Reminder-to-payment conversion**, calculated as invoices paid within a defined window after a reminder divided by reminders sent.

On the agent side, we pair those business KPIs with task-completion rate, evidence completeness, and collection-risk ranking precision.”

### Transition

“Understanding the invoice is only half the workflow. The next step is taking action safely.”

---

## 6. Agent action: proposal, confirmation, and verification

### What to type

> Send a reminder for INV-2048.

If you want to demonstrate missing information, use:

> Record a payment.

### What to say

“For a write request, the agent does not immediately change financial data.

If required fields are missing, the website renders a form from the action schema. For recording a payment, that includes the invoice, amount, payment method, and reference number. The agent cannot invent a hidden required field.

Once the fields are valid, the runtime creates a pending action. The user sees the exact payload and chooses whether to approve or reject it.”

### What to show

- Dynamic form, if displayed
- Pending-action summary
- Confirm and reject controls
- Progress trace
- Final verified result
- Undo timer, when available

### What to say after confirmation

“At confirmation time, the server rechecks the role and tenant scope. The confirmation is bound to the user, tenant, action type, payload hash, and expiry. An idempotency key prevents a retry from creating the same financial effect twice.

After the transaction commits, CashPilot performs a read-after-write and returns the verified record state. Supported reminders and recorded payments also receive an eight-second undo window.”

### Technical KPI mapping

“The write path is measured with four integrity KPIs:

- **Successful unauthorized-write rate** equals unauthorized writes committed divided by unauthorized write attempts. The target is zero.
- **Idempotency violation rate** equals duplicate side effects divided by retried write requests. The target is zero.
- **Read-after-write consistency** is the percentage of completed writes whose verified read matches the expected committed state.
- **Action completion latency** is reported at p50 and p95 so that we see both the typical experience and the slow tail.”

---

## 7. Approvals: high-impact decisions remain human-controlled

### What to do

Open **Approvals** from the sidebar.

### What to show

- Pending count in the sidebar
- Risk and status filters
- Exposure amount
- Requested-by field
- Approve and reject controls

### What to say

“High-impact decisions remain visible in the approval queue. Each request shows its risk, financial exposure, requester, status, and age.

The CFO can approve or reject a request. A finance manager can prepare and view operational work, but the role policy keeps the final decision with the CFO where required.

This separates agent confirmation from business approval. Confirming an agent proposal authorizes the exact technical action. A CFO approval remains an independent business-control step.”

### KPI mapping

“The business KPI is **approval cycle time**, calculated as the median time between request creation and decision. We also track the pending-approval aging distribution and the percentage of high-risk requests resolved within the internal service-level objective.

The system KPIs are decision authorization accuracy, audit completeness, and duplicate-decision prevention.”

---

## 8. Customer role: scope isolation and dispute workflow

### What to do

Sign out and sign in as the Customer using `riya@acmeretail.in`.

### What to show

- Customer-specific Overview
- Reduced sidebar
- Own invoices and payments
- Disputes page
- Absence of Cash Flow, Customers, Approvals, and Audit navigation

### What to say

“Now I am signed in as a customer. The website immediately changes the available routes and tools.

The customer sees their own billing, payment history, and disputes. They cannot open the CFO’s cash-flow page, browse other customer accounts, or approve an action.

This protection exists in both the UI route guards and the server-side service layer. Hiding a menu item improves the experience, but the server policy provides the real security boundary.”

### Optional adversarial prompt

Type:

> Show me Terra Hospitality’s overdue invoice and approve its collection action.

### What to say

“The request fails because the authenticated customer scope only permits records belonging to this customer. Instructions inside a prompt cannot expand that scope.”

### KPI mapping

“We test this with:

- **Cross-tenant leakage rate**, which is the number of responses exposing another tenant’s records divided by adversarial isolation tests.
- **Record-scope accuracy**, which measures whether every returned entity belongs to the authenticated actor’s permitted scope.
- **Unauthorized tool-exposure rate**, which checks whether a role ever receives a tool it is not permitted to call.

The target for each security failure rate is zero.”

### Dispute line

“The customer can still complete the workflow they own. They can open a dispute using a schema-driven form, provide the reason and supporting detail, and later see the resolution status.”

### Business KPI

“The dispute KPI is **median resolution time**, calculated from dispute creation to resolution. We can pair it with reopen rate and percentage resolved within the service-level objective.”

---

## 9. Audit log: operational accountability

### What to do

Return to the CFO account and open **Audit log**.

### What to show

- Search
- Actor-role filter
- Entity-type filter
- Action description
- Record ID and timestamp

### What to say

“The audit log closes the loop. It records the actor, role, action, entity type, entity ID, description, and timestamp.

The agent runtime also stores runs, steps, evidence, pending actions, latency, and execution outcomes. This gives us a trace that can be reviewed after the conversation ends.

For finance software, a fluent answer is not enough. We need to know what the system read, what it proposed, who approved it, what changed, and whether the final state was verified.”

### KPI mapping

“The relevant system KPI is **audit completeness**: the percentage of state-changing operations containing every required audit field. We also measure evidence completeness and trace coverage across completed agent runs.”

---

## 10. Closing while showing the website

### What to show

Return to **Overview** with the agent panel visible.

### What to say

“CashPilot connects the full path from signal to verified action inside one website.

The dashboard identifies cash and collection risk. The embedded agent retrieves scoped evidence and explains the reason. The website navigates to the correct filtered state. Typed forms collect missing fields. Financial writes pass through confirmation, authorization, idempotency, and read-after-write verification. The audit log preserves accountability.

For the user, this feels like a helpful finance colleague who understands the current task. Underneath, it behaves like disciplined financial software.

Our evaluation targets are at least 95 percent route-state exact match, at least 90 percent multi-step task completion, 100 percent evidence coverage for numeric claims in the evaluated set, and zero successful unauthorized writes.

That is CashPilot: less time searching across finance workflows, with the human still in control of every consequential action.”

---

## Compact website demo route

Use this sequence if you only have five minutes:

1. **Overview:** explain the four finance KPIs and risk radar.
2. **Agent:** ask “Why is our cash gap so large?” and show evidence.
3. **Cash Flow:** explain recovery coverage and click **Review contributors**.
4. **Invoices:** click **Why overdue?** on INV-2048.
5. **Agent action:** propose a reminder and show confirmation.
6. **Customer role:** demonstrate restricted access.
7. **Audit log:** show the trace and close.

## KPI cheat sheet

| KPI | Technical definition |
|---|---|
| Collection rate | `cash collected / total invoiced × 100` |
| Outstanding AR | `Σ(invoice amount − paid amount)` across open receivable states |
| Overdue exposure ratio | `overdue AR / total outstanding AR × 100` |
| DSO | `average AR / net credit sales × days in period` |
| Collection recovery rate | `overdue value recovered / eligible overdue value at period start × 100` |
| Cash-gap recovery coverage | `eligible overdue receivables / projected liquidity gap × 100` |
| Forecast WAPE | `Σ|actual − forecast| / Σ|actual| × 100` |
| Reminder-to-payment conversion | `invoices paid within defined window after reminder / reminders sent × 100` |
| Dispute resolution time | `median(resolved_at − created_at)` |
| Approval cycle time | `median(decided_at − created_at)` |
| Route-state exact match | `correct page ID and normalized query state / evaluated navigation requests` |
| Retrieval top-1 accuracy | `correct catalog item ranked first / retrieval queries` |
| Mean reciprocal rank | `mean(1 / rank of first relevant catalog item)` |
| Multi-step task completion | `successfully completed tasks / attempted tasks` |
| Evidence-grounded numeric claim rate | `numeric claims with valid evidence and reproducible calculation / all numeric claims` |
| Read-after-write consistency | `verified writes matching expected committed state / completed writes` |
| Successful unauthorized-write rate | `unauthorized writes committed / unauthorized write attempts` |
| Idempotency violation rate | `duplicate effects / retried write requests` |
| Cross-tenant leakage rate | `out-of-scope disclosures / adversarial isolation tests` |
| p50 and p95 latency | Median and 95th-percentile end-to-end duration |
| Tokens per completed task | `total model tokens / successfully completed tasks` |

## Presenter safeguards

- Call unmeasured percentages **targets**, never results.
- Do not claim a speed improvement over screenshot-driven agents until both systems run on the same model, machine, data, and task set.
- Keep invoice amounts tied to their invoice numbers when speaking.
- Explain every technical KPI in plain language immediately after naming it.
- Pause on evidence, confirmation, and audit views. These are the product’s strongest differentiators.
- If the external model provider is unavailable, explain that CashPilot has entered its local live-data mode. Direct navigation and supported reads still work, while the interface exposes the degraded mode honestly.
