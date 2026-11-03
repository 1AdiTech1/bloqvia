import assert from "node:assert/strict";
import { test } from "node:test";
import { receiptFailure } from "../src/outcome.js";

const ok = { outcome: { executor_id: "learner-x.bloqvia.testnet", status: { SuccessValue: "" } } };
const panic = {
  outcome: {
    executor_id: "core.bloqvia.testnet",
    status: {
      Failure: {
        ActionError: { index: 0, kind: { FunctionCallError: { ExecutionError: "Smart contract panicked: Wrong answer" } } },
      },
    },
  },
};

test("all receipts succeeded -> null", () => {
  assert.equal(receiptFailure({ receipts_outcome: [ok, ok] }), null);
  assert.equal(receiptFailure({}), null);
});

test("a contract panic in a later receipt is reported without the panic prefix", () => {
  assert.deepEqual(receiptFailure({ receipts_outcome: [ok, panic, ok] }), {
    executor: "core.bloqvia.testnet",
    message: "Wrong answer",
  });
});

test("an unknown failure shape still yields a message", () => {
  const weird = { outcome: { executor_id: "core.bloqvia.testnet", status: { Failure: { Something: { new: true } } } } };
  const f = receiptFailure({ receipts_outcome: [weird] });
  assert.ok(f && f.message.startsWith("Transaction failed:"));
});
