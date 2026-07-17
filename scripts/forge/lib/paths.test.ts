import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRepoRoot } from "./paths.ts";

describe("resolveRepoRoot", () => {
  it("prefers SHITATE_ROOT", () => {
    assert.equal(
      resolveRepoRoot(
        {
          SHITATE_ROOT: "/tmp/shitate",
          CHARACTER_FORGE_ROOT: "/tmp/legacy",
        },
        "/tmp/default",
      ),
      "/tmp/shitate",
    );
  });

  it("keeps CHARACTER_FORGE_ROOT as a compatibility fallback", () => {
    assert.equal(
      resolveRepoRoot({ CHARACTER_FORGE_ROOT: "/tmp/legacy" }, "/tmp/default"),
      "/tmp/legacy",
    );
  });
});
