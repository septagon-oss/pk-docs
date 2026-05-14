import { countObjectKeys } from "../../contracts/src/index.mjs";

export function getModuleAPISnapshot(bundle) {
  const api = bundle.spec.api;
  const document = api?.document && typeof api.document === "object" ? api.document : null;
  const operations = Array.isArray(api?.operations) ? api.operations.map(normalizeOperation) : [];

  return {
    present: Boolean(api),
    title: api?.title ?? null,
    version: api?.version ?? null,
    description: api?.description ?? null,
    sourcePath: api?.sourcePath ?? null,
    schemaCount: countObjectKeys(document?.components?.schemas),
    operationCount: operations.length,
    document,
    operations,
  };
}

export function groupOperationsByFeature({ operations, features }) {
  const featuresById = new Map(features.map((feature) => [feature.id, feature]));
  return features.map((feature) => ({
    featureId: feature.id,
    featureName: feature.name,
    operations: operations.filter((operation) => operation.featureIds.includes(feature.id)),
  })).filter((group) => featuresById.has(group.featureId));
}

function normalizeOperation(operation) {
  return {
    operationId: operation.operationId ?? "",
    method: operation.method ?? "GET",
    path: operation.path ?? "/",
    summary: operation.summary ?? operation.description ?? "",
    description: operation.description ?? "",
    tags: Array.isArray(operation.tags) ? operation.tags : [],
    featureIds: Array.isArray(operation.featureIds) ? operation.featureIds : [],
    public: Boolean(operation.public),
    deprecated: Boolean(operation.deprecated),
    contractDeclared: Boolean(operation.contractDeclared),
  };
}
