import * as repo from './accounting.repository.js';
import { NATURE } from './accounting.constants.js';

/**
 * Financial statements for the broker's books.
 *
 * Today balances come from ledger OPENING balances (no vouchers exist yet).
 * The math is written around a single `ledgerBalance()` so that, once
 * transactions are added, closing balance = opening + Σ(postings) drops in with
 * no change to the statement structure.
 *
 * Sign convention: a ledger's "natural" balance is positive when on its
 * expected side — Dr for assets/expenses, Cr for liabilities/income.
 */

/** Signed natural balance for a ledger given its nature. */
function naturalBalance(row) {
  const amt = Number(row.opening_balance) || 0;
  const dr = row.opening_balance_type === 'Dr' ? amt : -amt;
  // Assets & expenses are debit-natured; liabilities & income credit-natured.
  if (row.nature === NATURE.ASSET || row.nature === NATURE.EXPENSE) return dr;
  return -dr; // credit-natured
}

/** Build a map id→group and a resolver for a ledger's primary (top) group. */
async function primaryGroupResolver() {
  const groups = await repo.listGroups();
  const byId = new Map(groups.map((g) => [g.id, g]));
  return (groupId) => {
    let g = byId.get(groupId);
    while (g && g.parent_id) g = byId.get(g.parent_id);
    return g ? g.name : 'Ungrouped';
  };
}

/** Group rows by their primary group, summing balances and listing ledgers. */
function rollUp(rows, primaryOf) {
  const groups = new Map();
  let total = 0;
  for (const r of rows) {
    const amount = naturalBalance(r);
    total += amount;
    const key = primaryOf(r.group_id);
    if (!groups.has(key)) groups.set(key, { group: key, amount: 0, ledgers: [] });
    const g = groups.get(key);
    g.amount = round(g.amount + amount);
    g.ledgers.push({ name: r.name, amount: round(amount) });
  }
  return { groups: [...groups.values()], total: round(total) };
}

const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Profit & Loss: income vs expense ledgers. Net profit = income − expense.
 */
export async function profitAndLoss() {
  const rows = await repo.ledgerBalances();
  const primaryOf = await primaryGroupResolver();

  const income = rollUp(rows.filter((r) => r.nature === NATURE.INCOME), primaryOf);
  const expenses = rollUp(rows.filter((r) => r.nature === NATURE.EXPENSE), primaryOf);
  const netProfit = round(income.total - expenses.total);

  return {
    asOf: new Date().toISOString().slice(0, 10),
    basis: 'opening-balances', // becomes 'transactional' once vouchers exist
    income,
    expenses,
    netProfit,
    result: netProfit >= 0 ? 'profit' : 'loss',
  };
}

/**
 * Balance Sheet: assets vs liabilities. Current-period net profit is carried to
 * the liabilities side (under capital), mirroring Tally.
 */
export async function balanceSheet() {
  const rows = await repo.ledgerBalances();
  const primaryOf = await primaryGroupResolver();

  const assets = rollUp(rows.filter((r) => r.nature === NATURE.ASSET), primaryOf);
  const liabilities = rollUp(rows.filter((r) => r.nature === NATURE.LIABILITY), primaryOf);

  // Net profit from P&L flows into capital on the liabilities side.
  const income = rows.filter((r) => r.nature === NATURE.INCOME).reduce((s, r) => s + naturalBalance(r), 0);
  const expense = rows.filter((r) => r.nature === NATURE.EXPENSE).reduce((s, r) => s + naturalBalance(r), 0);
  const netProfit = round(income - expense);

  const liabilitiesTotal = round(liabilities.total + netProfit);
  return {
    asOf: new Date().toISOString().slice(0, 10),
    basis: 'opening-balances',
    liabilities: {
      ...liabilities,
      profitAndLoss: netProfit, // current-period result carried to capital
      total: liabilitiesTotal,
    },
    assets,
    // Should be ~0 when the books are balanced; surfaced for transparency.
    difference: round(assets.total - liabilitiesTotal),
  };
}
