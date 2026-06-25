#!/usr/bin/env node
/**
 * Ensure backend/.env exists (copy from the template on first run). Used by
 * `task bootstrap`. Cross-platform (no shell `cp`).
 */
import { existsSync, copyFileSync } from 'node:fs';

const G = '\x1b[1;32m';
const Y = '\x1b[1;33m';
const R = '\x1b[0m';

const example = 'backend/.env.example';
const env = 'backend/.env';

if (existsSync(env)) {
  console.log(`${G}  ✔${R} backend/.env present`);
} else {
  copyFileSync(example, env);
  console.log(`${G}  ✔${R} created backend/.env from template ${Y}(review secrets before production)${R}`);
}
