import test from "node:test";
import assert from "node:assert/strict";

import { assertModuleBundle, BUNDLE_API_VERSION, BUNDLE_KIND } from "../src/index.mjs";

test("assertModuleBundle accepts a valid bundle", () => {
  const bundle = {
    apiVersion: BUNDLE_API_VERSION,
    kind: BUNDLE_KIND,
    metadata: {
      name: "translation_management",
      generatedAt: "2026-03-22T00:00:00Z",
      generatedBy: "test",
    },
    spec: {
      module: {
        id: "translation_management",
        title: "Translation Management",
        modulePath: "translation_management/module.go",
      },
      narrative: {
        summary: "Centralized translations.",
      },
    },
  };

  assert.equal(assertModuleBundle(bundle), bundle);
});

test("assertModuleBundle rejects mismatched module ids", () => {
  const bundle = {
    apiVersion: BUNDLE_API_VERSION,
    kind: BUNDLE_KIND,
    metadata: {
      name: "auth_management",
      generatedAt: "2026-03-22T00:00:00Z",
      generatedBy: "test",
    },
    spec: {
      module: {
        id: "translation_management",
        title: "Translation Management",
        modulePath: "translation_management/module.go",
      },
      narrative: {
        summary: "Centralized translations.",
      },
    },
  };

  assert.throws(() => assertModuleBundle(bundle), /must match spec\.module\.id/);
});
