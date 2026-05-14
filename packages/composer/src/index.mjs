import { compareBundlesByTitle } from "../../contracts/src/index.mjs";
import { getModuleAPISnapshot, groupOperationsByFeature } from "../../openapi-source/src/index.mjs";
import { loadModuleShowcases } from "../../showcase-source/src/index.mjs";

export async function composeSiteModel({ bundles, generatedRoot }) {
  const sortedBundles = [...bundles].sort(compareBundlesByTitle);
  const modules = [];

  for (const bundle of sortedBundles) {
    modules.push(await composeModulePageModel({ bundle, generatedRoot }));
  }

  return {
    generatedAt: new Date().toISOString(),
    featuredModuleId: modules.find((module) => module.id === "translation_management")?.id ?? modules[0]?.id ?? null,
    stats: {
      moduleCount: modules.length,
      apiModuleCount: modules.filter((module) => module.api.present).length,
      showcaseCount: modules.reduce((count, module) => count + module.showcases.length, 0),
    },
    modules,
  };
}

export async function composeModulePageModel({ bundle, generatedRoot }) {
  const api = getModuleAPISnapshot(bundle);
  const showcases = await loadModuleShowcases({ bundle, generatedRoot });
  const features = composeFeatures(bundle, api.operations);
  const operationsByFeature = groupOperationsByFeature({
    operations: api.operations,
    features: bundle.spec.features ?? [],
  });

  return {
    id: bundle.spec.module.id,
    title: bundle.spec.module.title,
    summary: bundle.spec.narrative.summary,
    narrativeBody: bundle.spec.narrative.body ?? "",
    module: bundle.spec.module,
    dependencies: bundle.spec.dependencies ?? [],
    events: bundle.spec.events ?? [],
    showcases,
    features,
    api: {
      ...api,
      operationsByFeature: operationsByFeature.map((group) => ({
        ...group,
        operationCount: group.operations.length,
      })),
      operations: api.operations.map((operation) => ({
        ...operation,
        featureNames: operation.featureIds
          .map((featureId) => features.find((feature) => feature.id === featureId)?.name ?? featureId)
          .filter(Boolean),
      })),
    },
    stats: {
      featureCount: features.length,
      dependencyCount: (bundle.spec.dependencies ?? []).length,
      operationCount: api.operationCount,
      showcaseCount: showcases.length,
      eventCount: (bundle.spec.events ?? []).length,
    },
  };
}

function composeFeatures(bundle, operations) {
  return (bundle.spec.features ?? []).map((feature) => {
    const featureOperations = operations.filter((operation) => operation.featureIds.includes(feature.id));
    return {
      ...feature,
      tags: feature.tags ?? [],
      permissions: feature.permissions ?? [],
      endpoints: feature.endpoints ?? [],
      operationCount: featureOperations.length,
      operationIds: featureOperations.map((operation) => operation.operationId).filter(Boolean),
    };
  });
}
