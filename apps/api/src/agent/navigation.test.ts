import assert from "node:assert/strict";
import test from "node:test";
import { isDirectAgentUiIntent, resolveNavigation } from "./navigation.js";

const context = {
  pageId: "page.overview",
  route: "/",
  search: "",
  uiStateVersion: 1,
};

test("routes to invoices with URL-backed status", () => {
  const result = resolveNavigation("Show overdue invoices", "cfo", context);
  assert.equal(result.kind, "navigate");
  assert.equal(result.command?.route, "/invoices?status=overdue");
});

test("denies pages outside the actor role", () => {
  const result = resolveNavigation("Open cash flow", "customer", context);
  assert.equal(result.kind, "denied");
  assert.equal(result.command, null);
});

test("reports when the requested state is already active", () => {
  const result = resolveNavigation("Open paid invoices", "manager", {
    pageId: "page.invoices",
    route: "/invoices",
    search: "?status=paid",
    uiStateVersion: 2,
  });
  assert.equal(result.kind, "answer");
  assert.equal(result.command, null);
});

test("opens the create-invoice form for a CFO", () => {
  const result = resolveNavigation("Create an invoice", "cfo", context);
  assert.equal(result.kind, "navigate");
  assert.equal(result.command?.route, "/invoices?modal=create-invoice");
});

test("opens other registered product forms without feature-specific routing code", () => {
  assert.equal(
    resolveNavigation("Record a payment", "cfo", context).command?.route,
    "/payments?modal=record-payment",
  );
  assert.equal(
    resolveNavigation("Add a customer", "cfo", context).command?.route,
    "/customers?modal=add-customer",
  );
});

test("sends every write workflow request to the language model", () => {
  assert.equal(isDirectAgentUiIntent("Record a payment"), false);
  assert.equal(isDirectAgentUiIntent("Create an invoice"), false);
  assert.equal(
    isDirectAgentUiIntent(
      "Record payment amount 400 against INV-2048 via UPI, reference PAY-400",
    ),
    false,
  );
  assert.equal(
    isDirectAgentUiIntent("Create customer Acme with email arun@acme.test"),
    false,
  );
  assert.equal(
    isDirectAgentUiIntent(
      "Send a payment reminder for invoice INV-2048 - takes action on behalf of us and to show how undo option works",
    ),
    false,
  );
  assert.equal(
    isDirectAgentUiIntent("Show invoice INV-2048 and remind the customer"),
    false,
  );
});

test("keeps read-only page requests on the deterministic navigation path", () => {
  assert.equal(isDirectAgentUiIntent("Show overdue invoices"), true);
  assert.equal(isDirectAgentUiIntent("List payments"), true);
});

test("does not expose invoice creation to a manager", () => {
  const result = resolveNavigation("Create an invoice", "manager", context);
  assert.equal(result.kind, "denied");
  assert.equal(result.command, null);
});
