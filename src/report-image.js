const width = 960;
const margin = 48;
const rowHeight = 66;
const rowsPerImage = 36;

function paginate(charts) {
  const pages = [[]];
  let remaining = rowsPerImage;
  for (const chart of charts) {
    let index = 0;
    do {
      if (remaining < 2) {
        pages.push([]);
        remaining = rowsPerImage;
      }
      const rows = chart.rows.slice(index, index + remaining - 1);
      pages.at(-1).push({ title: chart.title, rows });
      remaining -= Math.max(rows.length, 1) + 1;
      index += rows.length;
    } while (index < chart.rows.length);
  }
  return pages;
}

function writeText(ctx, value, x, y, font, color, maxWidth) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y, maxWidth);
}

export function createReportImages(report) {
  const pages = paginate(report.charts);
  return pages.map((charts, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = 260 + charts.reduce((sum, chart) =>
      sum + 58 + Math.max(1, chart.rows.length) * rowHeight, 0);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('無法產生圖片。');

    const contentWidth = width - margin * 2;
    ctx.fillStyle = '#f3f6fa';
    ctx.fillRect(0, 0, width, canvas.height);
    ctx.fillStyle = '#eaf3f9';
    ctx.fillRect(0, 0, width, 210);

    writeText(ctx, `捷旭AI智慧助理 · ${report.roleLabel}`, margin, 46, '700 24px sans-serif', '#246694', contentWidth);
    writeText(ctx, report.heading, margin, 94, '700 36px sans-serif', '#163859', contentWidth);
    writeText(ctx, report.total, margin, 152, '700 46px sans-serif', '#163859', contentWidth);
    const info = [report.updated, report.pilot ? '試用範圍' : '', pages.length > 1 ? `第 ${index + 1}／${pages.length} 張` : ''];
    writeText(ctx, info.filter(Boolean).join('  ·  '), margin, 188, '20px sans-serif', '#495967', contentWidth);

    let y = 250;
    for (const chart of charts) {
      writeText(ctx, chart.title, margin, y, '700 29px sans-serif', '#163859', contentWidth);
      y += 56;
      if (!chart.rows.length) {
        writeText(ctx, '目前沒有可顯示的人員。', margin, y, '22px sans-serif', '#495967', contentWidth);
        y += rowHeight;
      }
      for (const row of chart.rows) {
        const label = [row.rank ? `${row.rank}. ${row.name}` : row.name, row.people].filter(Boolean).join('  ');
        writeText(ctx, label, margin, y, '24px sans-serif', '#163859', contentWidth - 235);
        ctx.textAlign = 'right';
        writeText(ctx, row.amountLabel, width - margin, y, '700 24px sans-serif', '#163859', 220);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#dce6ee';
        ctx.fillRect(margin, y + 12, contentWidth, 10);
        ctx.fillStyle = '#246694';
        ctx.fillRect(margin + contentWidth * row.offset / 100, y + 12, contentWidth * row.width / 100, 10);
        y += rowHeight;
      }
      y += 2;
    }
    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl.startsWith('data:image/png;base64,')) throw new Error('無法產生圖片。');
    return { dataUrl, filename: `捷旭跟刀業績-${report.month}${pages.length > 1 ? `-${index + 1}` : ''}.png` };
  });
}
