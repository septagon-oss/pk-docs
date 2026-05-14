const BUNDLE_API_VERSION = "docs.platformkit.dev/v1alpha1";
const BUNDLE_KIND = "ModuleDocsBundle";

export function assertModuleBundle(bundle, source = "bundle") {
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    throw new Error(`${source}: expected an object`);
  }
  if (bundle.apiVersion !== BUNDLE_API_VERSION) {
    throw new Error(`${source}: apiVersion must be ${BUNDLE_API_VERSION}`);
  }
  if (bundle.kind !== BUNDLE_KIND) {
    throw new Error(`${source}: kind must be ${BUNDLE_KIND}`);
  }

  requireString(bundle, ["metadata", "name"], source);
  requireString(bundle, ["metadata", "generatedAt"], source);
  requireString(bundle, ["metadata", "generatedBy"], source);
  requireString(bundle, ["spec", "module", "id"], source);
  requireString(bundle, ["spec", "module", "title"], source);
  requireString(bundle, ["spec", "module", "modulePath"], source);
  requireString(bundle, ["spec", "narrative", "summary"], source);

  if (bundle.metadata.name !== bundle.spec.module.id) {
    throw new Error(
      `${source}: metadata.name (${bundle.metadata.name}) must match spec.module.id (${bundle.spec.module.id})`,
    );
  }

  return bundle;
}

export function compareBundlesByTitle(left, right) {
  const leftTitle = String(left?.spec?.module?.title ?? left?.spec?.module?.id ?? "");
  const rightTitle = String(right?.spec?.module?.title ?? right?.spec?.module?.id ?? "");
  return leftTitle.localeCompare(rightTitle);
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function countObjectKeys(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return 0;
  }
  return Object.keys(value).length;
}

function requireString(root, pathParts, source) {
  let current = root;
  for (const part of pathParts) {
    current = current?.[part];
  }
  if (typeof current !== "string" || current.trim() === "") {
    throw new Error(`${source}: ${pathParts.join(".")} must be a non-empty string`);
  }
}

export { BUNDLE_API_VERSION, BUNDLE_KIND };
