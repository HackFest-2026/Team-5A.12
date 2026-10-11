import assert from "node:assert/strict";
import test from "node:test";
import {
  actionSummary,
  missingWriteToolDefinitions,
  paymentSearchTerms,
  writeToolNamesForRole,
} from "./runtime.js";

test("builds only the requested action summary", () => {
  assert.equal(
    actionSummary("send_reminder", { invoiceId: "i1" }),
    "Send a collection reminder",
  );
  assert.equal(
    actionSummary("delete_payments", { paymentIds: ["p1", "p2"] }),
    "Delete 2 selected payments and restore their invoice balances",
  );
});

test("normalizes exact INR payment amount searches", () => {
  assert.deepEqual(paymentSearchTerms("1120000"), {
    text: "1120000",
    amount: 1120000,
  });
  assert.deepEqual(paymentSearchTerms("₹11,20,000"), {
    text: "₹11,20,000",
    amount: 1120000,
  });
  assert.deepEqual(paymentSearchTerms("INV-2031"), {
    text: "INV-2031",
    amount: null,
  });
});

test("defines every permissioned write tool", () => {
  assert.deepEqual(missingWriteToolDefinitions(), []);
});

test("gives CFO complete finance mutation coverage", () => {
  assert.deepEqual(writeToolNamesForRole("cfo"), [
    "create_approval",
    "create_customer",
    "create_customer_and_invoice",
    "create_invoice",
    "decide_approval",
    "delete_approval",
    "delete_customer",
    "delete_invoice",
    "delete_payment",
    "delete_payments",
    "record_payment",
    "review_dispute",
    "send_reminder",
    "update_approval",
    "update_customer",
    "update_invoice",
    "update_payment",
  ]);
});

test("keeps non-CFO mutation tools role-scoped", () => {
  assert.deepEqual(writeToolNamesForRole("manager"), [
    "review_dispute",
    "send_reminder",
    "update_invoice",
  ]);
  assert.deepEqual(writeToolNamesForRole("customer"), ["open_dispute"]);
  assert.deepEqual(writeToolNamesForRole("platform_admin"), []);
});
