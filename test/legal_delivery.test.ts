import assert from "node:assert/strict";
import test from "node:test";
import { createMatterImageVariants, planLegalDelivery } from "../src/legal_delivery.js";

test("a deadline inside three days is queued for follow-up with all legal image variants", async () => {
  const plan = planLegalDelivery("2026-09-15", new Date("2026-09-13T12:00:00Z"));
  const calls: string[] = [];
  const images = await createMatterImageVariants("https://files.example/evidence.jpg", async (_image, aspect) => {
    calls.push(aspect);
    return `cropped:${aspect}`;
  });

  assert.equal(plan.followUp, "due_soon");
  assert.deepEqual(calls, ["4:3", "16:9", "3:4"]);
  assert.deepEqual(images.map((item) => item.label), [
    "case_card",
    "timeline",
    "document_preview"
  ]);
});
