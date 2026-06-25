/**
 * Render report data to CSV (RFC 4180 quoting). Uses the definition's columns
 * for headers/order.
 */
function cell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** @returns {Buffer} */
export function toCsv(data) {
  const cols = data.columns || [];
  const lines = [cols.map((c) => cell(c.header)).join(',')];
  for (const row of data.rows || []) {
    lines.push(cols.map((c) => cell(row[c.key])).join(','));
  }
  // BOM so Excel opens UTF-8 correctly.
  return Buffer.from('﻿' + lines.join('\r\n'), 'utf8');
}
