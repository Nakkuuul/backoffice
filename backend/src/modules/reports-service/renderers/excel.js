import ExcelJS from 'exceljs';

/**
 * Render report data to a styled .xlsx workbook via exceljs.
 * @returns {Promise<Buffer>}
 */
export async function toExcel(data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Broker Backoffice';
  const ws = wb.addWorksheet((data.title || 'Report').slice(0, 31));

  const cols = data.columns || [];

  // Title + meta block above the table.
  ws.mergeCells(1, 1, 1, Math.max(cols.length, 1));
  ws.getCell('A1').value = data.title || '';
  ws.getCell('A1').font = { bold: true, size: 14 };

  let r = 3;
  for (const [k, v] of Object.entries(data.meta || {})) {
    ws.getCell(r, 1).value = k;
    ws.getCell(r, 1).font = { bold: true };
    ws.getCell(r, 2).value = v;
    r++;
  }
  r += 1;

  // Header row.
  const headerRow = ws.getRow(r);
  cols.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3D91' } };
    cell.alignment = { horizontal: c.align || 'left' };
  });
  headerRow.commit();

  // Data rows.
  (data.rows || []).forEach((row, idx) => {
    const xr = ws.getRow(r + 1 + idx);
    cols.forEach((c, i) => {
      const cell = xr.getCell(i + 1);
      cell.value = row[c.key];
      cell.alignment = { horizontal: c.align || 'left' };
      if (c.money) cell.numFmt = '#,##0.00';
    });
    xr.commit();
  });

  // Reasonable column widths.
  cols.forEach((c, i) => {
    ws.getColumn(i + 1).width = Math.max(12, String(c.header).length + 4);
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
