import * as service from './accounting.service.js';
import * as statements from './accounting.statements.js';

/* ── Group Master ─────────────────────────────────────────────────────────── */
export async function createGroup(req, res) {
  res.status(201).json(await service.createGroup(req.body));
}
export async function listGroups(_req, res) {
  res.json({ groups: await service.listGroups() });
}
export async function getGroup(req, res) {
  res.json(await service.getGroup(req.params.id));
}
export async function updateGroup(req, res) {
  res.json(await service.updateGroup(req.params.id, req.body));
}
export async function deleteGroup(req, res) {
  await service.deleteGroup(req.params.id);
  res.status(204).end();
}

/* ── Ledger Master ────────────────────────────────────────────────────────── */
export async function createLedger(req, res) {
  res.status(201).json(await service.createLedger(req.body));
}
export async function listLedgers(req, res) {
  const items = await service.listLedgers(req.query);
  res.json({ items, count: items.length });
}
export async function getLedger(req, res) {
  res.json(await service.getLedger(req.params.id));
}
export async function updateLedger(req, res) {
  res.json(await service.updateLedger(req.params.id, req.body));
}
export async function deleteLedger(req, res) {
  await service.deleteLedger(req.params.id);
  res.status(204).end();
}

/* ── Financial statements ─────────────────────────────────────────────────── */
export async function balanceSheet(_req, res) {
  res.json(await statements.balanceSheet());
}
export async function profitAndLoss(_req, res) {
  res.json(await statements.profitAndLoss());
}
