import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export type ReportTable = {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  summaryLines?: string[];
};

@Injectable()
export class ReportExportService {
  toCsv(table: ReportTable): Buffer {
    const escape = (value: string | number | null | undefined) => {
      const text = value === undefined || value === null ? '' : String(value);
      if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
      return text;
    };
    const lines = [
      table.headers.map(escape).join(','),
      ...table.rows.map((row) => row.map(escape).join(',')),
    ];
    if (table.summaryLines?.length) {
      lines.push('');
      for (const line of table.summaryLines) lines.push(escape(line));
    }
    return Buffer.from(`\uFEFF${lines.join('\r\n')}`, 'utf8');
  }

  async toPdf(table: ReportTable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        info: {
          Title: table.title,
          Author: 'Efnan Business PLC',
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc
        .fillColor('#6F4E37')
        .fontSize(16)
        .text('Efnan Business PLC', { continued: false });
      doc
        .fillColor('#2F1B10')
        .fontSize(13)
        .text(table.title, { continued: false });
      if (table.subtitle) {
        doc.fillColor('#746355').fontSize(9).text(table.subtitle);
      }
      doc
        .fillColor('#746355')
        .fontSize(8)
        .text(`Generated ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`);
      doc.moveDown(0.8);

      if (table.summaryLines?.length) {
        doc.fillColor('#2F1B10').fontSize(9);
        for (const line of table.summaryLines) {
          doc.text(line);
        }
        doc.moveDown(0.6);
      }

      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const colCount = Math.max(table.headers.length, 1);
      const colWidth = usableWidth / colCount;
      const startX = doc.page.margins.left;

      const drawRow = (
        cells: (string | number | null | undefined)[],
        opts: { header?: boolean; y: number },
      ) => {
        let x = startX;
        const fontSize = opts.header ? 8 : 7;
        doc.fontSize(fontSize).fillColor(opts.header ? '#6F4E37' : '#2F1B10');
        if (opts.header) doc.font('Helvetica-Bold');
        else doc.font('Helvetica');
        let maxH = 14;
        for (let i = 0; i < colCount; i++) {
          const text = cells[i] === undefined || cells[i] === null ? '' : String(cells[i]);
          const h = doc.heightOfString(text, { width: colWidth - 4 });
          maxH = Math.max(maxH, h + 4);
        }
        if (opts.y + maxH > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          opts.y = doc.page.margins.top;
        }
        x = startX;
        for (let i = 0; i < colCount; i++) {
          const text = cells[i] === undefined || cells[i] === null ? '' : String(cells[i]);
          doc.text(text, x + 2, opts.y, {
            width: colWidth - 4,
            height: maxH,
            ellipsis: true,
          });
          x += colWidth;
        }
        return opts.y + maxH + 2;
      };

      let y = doc.y;
      y = drawRow(table.headers, { header: true, y });
      doc
        .moveTo(startX, y - 1)
        .lineTo(startX + usableWidth, y - 1)
        .strokeColor('#E0D3C2')
        .stroke();

      for (const row of table.rows) {
        y = drawRow(row, { y });
      }

      doc.end();
    });
  }

  filename(reportId: string, ext: 'csv' | 'pdf', from?: string, to?: string) {
    const range =
      from || to ? `-${from || 'start'}-${to || 'end'}` : '';
    return `efnan-${reportId}${range}.${ext}`;
  }
}
