#!/usr/bin/env node
/**
 * Presentation helper for the Taskfile — keeps all terminal styling in one
 * place and works identically on every OS (plain Node, no shell builtins).
 *
 *   node scripts/ui.mjs banner
 *   node scripts/ui.mjs section "Title" "Subtitle"
 *   node scripts/ui.mjs info|ok|warn|err "message"
 *   node scripts/ui.mjs summary "Headline"
 *   node scripts/ui.mjs urls
 */
const C = {
  cyan: '\x1b[1;36m',
  green: '\x1b[1;32m',
  yellow: '\x1b[1;33m',
  red: '\x1b[1;31m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};
const RULE = '─'.repeat(60);
const w = (s) => process.stdout.write(s);

const URLS = [
  ['group', 'Application'],
  ['Backend API', 'http://localhost:3000/api/v1', ''],
  ['Health check', 'http://localhost:3000/api/v1/health/ready', ''],
  ['Frontend UI', 'http://localhost:3001', ''],
  ['group', 'Infrastructure (Docker)'],
  ['PostgreSQL', 'localhost:5432', 'db=backoffice  user=backoffice'],
  ['MinIO (storage)', 'http://localhost:9000', 'S3-compatible API'],
  ['MinIO console', 'http://localhost:9001', 'backoffice / backoffice_secret'],
  ['Haraka MTA', 'localhost:2525', 'app → MTA (submission)'],
  ['', 'localhost:25', 'inbound MX (bounces/replies)'],
];

function urls() {
  for (const row of URLS) {
    if (row[0] === 'group') {
      w(`\n  ${C.bold}${row[1]}${C.reset}\n`);
      continue;
    }
    const [label, url, note] = row;
    w(`    ${label.padEnd(16)} ${C.cyan}${url.padEnd(24)}${C.reset} ${C.dim}${note}${C.reset}\n`);
  }
  w('\n');
}

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case 'banner':
    w(`\n  ${C.cyan}${C.bold}SAPPHIRE BROKING · BACKOFFICE${C.reset}\n`);
    w(`  ${C.dim}on-prem monorepo — infra · backend · frontend${C.reset}\n`);
    break;
  case 'section':
    w(`\n${C.cyan}${RULE}${C.reset}\n`);
    w(`${C.cyan}${C.bold} ▸ ${args[0] || ''}${C.reset}  ${C.dim}${args[1] || ''}${C.reset}\n`);
    w(`${C.cyan}${RULE}${C.reset}\n`);
    break;
  case 'info':
    w(`${C.dim}  • ${args.join(' ')}${C.reset}\n`);
    break;
  case 'ok':
    w(`${C.green}  ✔${C.reset} ${args.join(' ')}\n`);
    break;
  case 'warn':
    w(`${C.yellow}  !${C.reset} ${args.join(' ')}\n`);
    break;
  case 'err':
    w(`${C.red}  ✗${C.reset} ${args.join(' ')}\n`);
    break;
  case 'summary':
    w(`\n${C.green}  ✔ ${args.join(' ')}${C.reset}\n`);
    urls();
    break;
  case 'urls':
    urls();
    break;
  default:
    w(`ui.mjs: unknown command "${cmd}"\n`);
    process.exit(1);
}
