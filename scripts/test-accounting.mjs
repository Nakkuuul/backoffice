/**
 * Verify accounting masters + statements: create ledgers under seeded Tally
 * groups, then compute Balance Sheet and P&L. node scripts/test-accounting.mjs
 */
import assert from 'node:assert/strict';
import { pool } from '../src/db/pool.js';
import { findGroupByName } from '../src/modules/accounting-service/accounting.repository.js';
import { createLedger, listGroups } from '../src/modules/accounting-service/accounting.service.js';
import { balanceSheet, profitAndLoss } from '../src/modules/accounting-service/accounting.statements.js';

const ts = Date.now();
const mk = async (groupName, name, amount, type) => {
  const g = await findGroupByName(groupName);
  return createLedger({ name: `${name} ${ts}`, groupId: g.id, openingBalance: amount, openingBalanceType: type });
};

try {
  console.log('seeded groups:', (await listGroups()).length);

  // A small balanced set of opening balances.
  await mk('Cash-in-Hand', 'Cash', 120000, 'Dr'); // asset
  await mk('Capital Account', 'Owner Capital', 90000, 'Cr'); // liability
  await mk('Sales Accounts', 'Brokerage Income', 50000, 'Cr'); // income
  await mk('Indirect Expenses', 'Office Rent', 20000, 'Dr'); // expense

  const pl = await profitAndLoss();
  const bs = await balanceSheet();

  console.log('\nP&L  → income:', pl.income.total, 'expenses:', pl.expenses.total, 'netProfit:', pl.netProfit, `(${pl.result})`);
  console.log('BS   → assets:', bs.assets.total, 'liabilities(incl. P&L):', bs.liabilities.total, 'difference:', bs.difference);

  assert.equal(pl.income.total, 50000, 'income total');
  assert.equal(pl.expenses.total, 20000, 'expense total');
  assert.equal(pl.netProfit, 30000, 'net profit = income - expense');
  assert.equal(bs.assets.total, 120000, 'assets total');
  assert.equal(bs.liabilities.total, 120000, 'liabilities incl. net profit');
  assert.equal(bs.difference, 0, 'balance sheet balances');

  console.log('\n✅ ACCOUNTING MASTERS + STATEMENTS OK');
} catch (err) {
  console.error('\n❌', err.message);
  process.exitCode = 1;
} finally {
  await pool.query(`DELETE FROM acc_ledgers WHERE name LIKE $1`, [`%${ts}`]);
  await pool.end();
}
