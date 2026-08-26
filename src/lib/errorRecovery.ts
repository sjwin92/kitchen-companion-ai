export function isStaleDeploymentError(error: Error): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .* failed/i
    .test(error.message);
}
