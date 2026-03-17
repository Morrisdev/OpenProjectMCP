// Initial seed data — populated by running the rebuild_cache tool after setup.
// Add your own users here, or leave empty and run rebuild_cache.
export const CACHED_USERS: Array<{
  id: number;
  login: string;
  name: string;
  email: string;
  status: string;
}> = [];
