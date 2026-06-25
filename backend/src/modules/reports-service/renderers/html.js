import { config } from '../../../config/index.js';

const esc = (s = '') =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const money = (n) =>
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Render report data into a clean, print-ready HTML document. A report
 * definition can supply its own `renderHtml(data)` for a bespoke layout; this
 * generic table layout is the default and handles most tabular reports.
 */
export function renderReportHtml(def, data) {
  if (typeof def.renderHtml === 'function') return def.renderHtml(data);

  const brand = esc(config.email.fromName || 'Broker Backoffice');
  const metaRows = Object.entries(data.meta || {})
    .map(([k, v]) => `<tr><td class="mk">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join('');

  const head = (data.columns || [])
    .map((c) => `<th style="text-align:${c.align || 'left'}">${esc(c.header)}</th>`)
    .join('');

  const body = (data.rows || [])
    .map(
      (row) =>
        `<tr>${(data.columns || [])
          .map((c) => {
            const v = row[c.key];
            const val = c.money ? money(v) : esc(v ?? '');
            return `<td style="text-align:${c.align || 'left'}">${val}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { font-family: Arial, Helvetica, sans-serif; }
    body { margin: 28px; color: #1a1a1a; font-size: 12px; }
    .hdr { display:flex; justify-content:space-between; align-items:flex-start;
           border-bottom:2px solid #0b3d91; padding-bottom:10px; margin-bottom:14px; }
    .brand { font-size:18px; font-weight:bold; color:#0b3d91; }
    h1 { font-size:15px; margin:0 0 4px; }
    .meta { margin:10px 0 16px; border-collapse:collapse; }
    .meta td { padding:2px 10px 2px 0; }
    .meta .mk { color:#555; }
    table.data { width:100%; border-collapse:collapse; }
    table.data th { background:#0b3d91; color:#fff; padding:6px 8px; font-size:11px; }
    table.data td { padding:5px 8px; border-bottom:1px solid #e5e7eb; }
    table.data tr:nth-child(even) td { background:#f7f9fc; }
    .foot { margin-top:18px; font-size:10px; color:#888; text-align:center; }
  </style></head><body>
    <div class="hdr">
      <div><div class="brand">${brand}</div><h1>${esc(data.title || def.title)}</h1></div>
      <div style="font-size:10px;color:#666">Generated: ${esc(data.generatedAt || '')}</div>
    </div>
    <table class="meta">${metaRows}</table>
    <table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    <div class="foot">This is a system-generated report from ${brand}.</div>
  </body></html>`;
}
