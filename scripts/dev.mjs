#!/usr/bin/env node
/**
 * Dev runner for `task up` — starts the backend and frontend together, with:
 *   • each server's output line-prefixed + colored so you always know the source
 *   • a single clear "what's up where" panel printed once BOTH report ready
 *   • Ctrl-C that tears down both process trees (cross-platform)
 *
 * Run from the repo root (the Taskfile invokes it there).
 */
import { spawn } from 'node:child_process';
import { printUrls } from './ui.mjs';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

const SERVICES = [
  { name: 'backend', color: '\x1b[36m', cwd: 'backend', cmd: 'npm run dev', ready: /listening on http/i },
  { name: 'frontend', color: '\x1b[35m', cwd: 'frontend', cmd: 'npm run dev', ready: /(Ready in|Local:\s*http)/i },
];

const LABEL_W = 8;
const tag = (s) => `${s.color}${s.name.padEnd(LABEL_W)}${C.reset}${C.dim}│${C.reset} `;
const w = (str) => process.stdout.write(str);

const children = [];
const ready = Object.create(null);
let panelShown = false;
let shuttingDown = false;

function showPanel() {
  if (panelShown || !SERVICES.every((s) => ready[s.name])) return;
  panelShown = true;
  // Present the whole stack service-by-service (infra + app), not just
  // frontend/backend — reuses the canonical list in ui.mjs.
  w(`\n${C.green}${C.bold}  ✔ All services are up${C.reset}\n`);
  printUrls();
  w(`  ${C.dim}prefixed logs stream below — Ctrl-C to stop both${C.reset}\n\n`);
}

for (const s of SERVICES) {
  w(`${tag(s)}${C.dim}starting (${s.cmd})…${C.reset}\n`);
  const child = spawn(s.cmd, { cwd: s.cwd, shell: true, env: process.env });
  children.push(child);

  let buf = '';
  const onData = (chunk) => {
    buf += chunk.toString();
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const raw of lines) {
      const line = raw.replace(/\r$/, '');
      w(tag(s) + line + '\n');
      if (!ready[s.name] && s.ready.test(line)) {
        ready[s.name] = true;
        showPanel();
      }
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('exit', (code) => {
    if (buf) w(tag(s) + buf + '\n');
    if (!shuttingDown) {
      w(`${tag(s)}${C.yellow}process exited (code ${code}) — stopping the rest${C.reset}\n`);
      shutdown();
    }
  });
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  w(`\n${C.yellow}  ⏻ shutting down…${C.reset}\n`);
  for (const c of children) {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(c.pid), '/t', '/f'], { stdio: 'ignore' });
      } else {
        c.kill('SIGTERM');
      }
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => process.exit(0), 800);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
