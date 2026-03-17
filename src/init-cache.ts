#!/usr/bin/env node
// Postbuild script — creates cache.json from seed data if it doesn't already exist.
import { initCache } from "./db.js";

const dbPath = initCache();
console.log(`Cache ready: ${dbPath}`);
