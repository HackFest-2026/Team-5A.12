import assert from "node:assert/strict";
import test from "node:test";
import { resolveNavigation } from "./navigation.js";

const context = { pageId: "page.overview", route: "/", search: "", uiStateVersion: 1 };

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
    pageId: "page.invoices", route: "/invoices", search: "?status=paid", uiStateVersion: 2,
  });
  assert.equal(result.kind, "answer");
  assert.equal(result.command, null);
});
