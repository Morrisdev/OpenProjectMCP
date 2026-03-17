// Open (non-closed) Feature work packages used as parent suggestions when creating work packages.
// When a feature is chosen as parent, set customField1 (Module) to the feature's module value.
// Populated by running the rebuild_cache tool after setup.
export const CACHED_FEATURES: Array<{
  id: number;
  subject: string;
  projectId: number;
  project: string;
  module: string;
  status: string;
}> = [];
