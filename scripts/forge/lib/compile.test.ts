import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocateRunId,
  buildRunId,
  joinNegative,
  joinPositive,
} from "./compile.ts";

describe("joinPositive", () => {
  it("joins base → variant → lexicon with blank lines", () => {
    const out = joinPositive("BASE", "VARIANT", ["LEX1", "LEX2"]);
    assert.equal(out, "BASE\n\nVARIANT\n\nLEX1\n\nLEX2\n");
  });

  it("drops empty blocks but keeps order", () => {
    const out = joinPositive("BASE", "", ["", "LEX"]);
    assert.equal(out, "BASE\n\nLEX\n");
  });

  it("trims each block", () => {
    const out = joinPositive("  BASE  ", "  VAR  ", ["  L  "]);
    assert.equal(out, "BASE\n\nVAR\n\nL\n");
  });
});

describe("joinNegative", () => {
  it("dedups case-insensitively and keeps first spelling", () => {
    const out = joinNegative("text, Watermark, blurry", "watermark, TEXT, extra limbs");
    assert.equal(out, "text, Watermark, blurry, extra limbs\n");
  });

  it("normalizes newlines to commas", () => {
    const out = joinNegative("a,\nb", "c");
    assert.equal(out, "a, b, c\n");
  });

  it("handles empty sides", () => {
    assert.equal(joinNegative("", "only"), "only\n");
    assert.equal(joinNegative("only", ""), "only\n");
    assert.equal(joinNegative("", ""), "\n");
  });
});

describe("buildRunId", () => {
  it("builds compile standalone id", () => {
    assert.equal(
      buildRunId("20260709", "three-view", "v2", true),
      "20260709_three-view_v2_compile",
    );
  });

  it("builds image-run id without _compile", () => {
    assert.equal(
      buildRunId("20260709", "standing", "v1", false),
      "20260709_standing_v1",
    );
  });
});

describe("allocateRunId", () => {
  it("returns base when free", async () => {
    const exists = async () => false;
    const r = await allocateRunId("any", "20260709_standing_v1_compile", exists, "/tmp/out");
    assert.equal(r.runId, "20260709_standing_v1_compile");
    assert.equal(r.runDir, "/tmp/out/20260709_standing_v1_compile");
  });

  it("allocates _r2 when base taken", async () => {
    const taken = new Set(["/tmp/out/20260709_standing_v1_compile"]);
    const exists = async (dir: string) => taken.has(dir);
    const r = await allocateRunId("any", "20260709_standing_v1_compile", exists, "/tmp/out");
    assert.equal(r.runId, "20260709_standing_v1_compile_r2");
  });

  it("allocates next free revision", async () => {
    const taken = new Set([
      "/tmp/out/run",
      "/tmp/out/run_r2",
      "/tmp/out/run_r3",
    ]);
    const exists = async (dir: string) => taken.has(dir);
    const r = await allocateRunId("any", "run", exists, "/tmp/out");
    assert.equal(r.runId, "run_r4");
  });
});
