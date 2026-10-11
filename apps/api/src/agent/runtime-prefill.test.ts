import assert from "node:assert/strict";
import test from "node:test";
import { prefillFields } from "./runtime.js";

test("reuses a missing customer label for company and contact name", () => {
  const result = prefillFields(
    "action.invoice.create_with_customer",
    {
      company: "Sum",
      amount: 25000,
      dueDate: "2026-11-10",
    },
    "cfo",
  );

  assert.equal(result.fields.company, "Sum");
  assert.equal(result.fields.name, "Sum");
  assert.deepEqual(result.missingFields, ["email"]);
});

test("uses a supplied contact label as the missing company name", () => {
  const result = prefillFields(
    "action.invoice.create_with_customer",
    { name: "Sum" },
    "cfo",
  );

  assert.equal(result.fields.company, "Sum");
  assert.equal(result.fields.name, "Sum");
  assert.deepEqual(result.missingFields, ["email", "amount", "dueDate"]);
});
