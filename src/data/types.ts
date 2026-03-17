// Initial seed data — populated by running the rebuild_cache tool after setup.
// Add your own work package types here, or leave empty and run rebuild_cache.
export const CACHED_TYPES: Array<{
  id: number;
  name: string;
  isDefault: boolean;
  isMilestone: boolean;
}> = [];
