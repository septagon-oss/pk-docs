import path from "node:path";
import { fileURLToPath } from "node:url";

export function resolveWorkspaceRoot(metaUrl) {
  return path.resolve(path.dirname(fileURLToPath(metaUrl)), "..");
}

export function resolveSiblingRepo(workspaceRoot, repoName) {
  return path.resolve(workspaceRoot, "..", repoName);
}
