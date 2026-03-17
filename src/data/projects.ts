// Initial seed data — populated by running the rebuild_cache tool after setup.
// Add your own projects here, or leave empty and run rebuild_cache.
export const CACHED_PROJECTS: Array<{
  id: number;
  identifier: string;
  name: string;
  active: boolean;
  parent: string | null;
}> = [];
