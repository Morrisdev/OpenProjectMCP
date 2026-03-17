// Initial seed data — populated by running the rebuild_cache tool after setup.
// Add your own statuses here, or leave empty and run rebuild_cache.
export const CACHED_STATUSES: Array<{
  id: number;
  name: string;
  isClosed: boolean;
  isDefault: boolean;
}> = [];
