import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BRAND_NAME, PACKAGE_NAME, STUDIO_NAME } from "./brand.ts";

describe("Shitate branding", () => {
  it("uses Shitate for the product and shitate for machine identifiers", () => {
    assert.equal(BRAND_NAME, "Shitate");
    assert.equal(PACKAGE_NAME, "shitate");
    assert.equal(STUDIO_NAME, "Shitate Studio");
  });
});
