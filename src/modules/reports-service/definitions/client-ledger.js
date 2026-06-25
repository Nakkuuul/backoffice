import { query } from '../../../db/pool.js';

/**
 * SAMPLE report definition — Client Ledger Statement.
 *
 * Demonstrates the full pattern (Postgres data → columns/rows → all formats).
 * Replace/extend with the broker's real reports once formats are provided; the
 * service machinery around it stays the same.
 *
 * params: { clientRef, from?, to? }
 */
export default {
  key: 'client-ledger',
  title: 'Client Ledger Statement',
  formats: ['pdf', 'csv', 'xlsx', 'html'],

  async resolveData(params = {}) {
    const clientRef = params.clientRef || 'CL0001';
    const from = params.from || '1900-01-01';
    const to = params.to || '2999-12-31';

    const { rows } = await query(
      `SELECT entry_date, description, debit, credit, balance
         FROM ledger_entries
        WHERE client_ref = $1 AND entry_date BETWEEN $2 AND $3
        ORDER BY entry_date, id`,
      [clientRef, from, to],
    );

    const totalDebit = rows.reduce((s, r) => s + Number(r.debit), 0);
    const totalCredit = rows.reduce((s, r) => s + Number(r.credit), 0);
    const closing = rows.length ? Number(rows[rows.length - 1].balance) : 0;

    return {
      title: `Client Ledger Statement — ${clientRef}`,
      meta: {
        Client: clientRef,
        Period: `${params.from || 'start'} to ${params.to || 'date'}`,
        'Total Debit': totalDebit.toFixed(2),
        'Total Credit': totalCredit.toFixed(2),
        'Closing Balance': closing.toFixed(2),
      },
      columns: [
        { key: 'entry_date', header: 'Date' },
        { key: 'description', header: 'Description' },
        { key: 'debit', header: 'Debit', align: 'right', money: true },
        { key: 'credit', header: 'Credit', align: 'right', money: true },
        { key: 'balance', header: 'Balance', align: 'right', money: true },
      ],
      rows: rows.map((r) => ({
        entry_date: new Date(r.entry_date).toISOString().slice(0, 10),
        description: r.description,
        debit: Number(r.debit),
        credit: Number(r.credit),
        balance: Number(r.balance),
      })),
    };
  },
};
