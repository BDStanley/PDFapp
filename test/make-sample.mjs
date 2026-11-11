import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import fs from 'fs';
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const lorem = 'The quick brown fox jumps over the lazy dog. Research methods matter for every empirical paper. ';
for (let n = 1; n <= 6; n++) {
  const land = n === 4;
  const page = doc.addPage(land ? [842, 595] : [595, 842]);
  const { width, height } = page.getSize();
  page.drawText(`Chapter ${n}`, { x: 60, y: height - 80, size: 26, font: bold, color: rgb(0.6, 0.1, 0.1) });
  let y = height - 120;
  for (let l = 0; l < 30 && y > 60; l++) {
    const t = (l % 7 === 3 ? 'Important finding about elasticity. ' : '') + lorem.slice(0, 70 + (l % 3) * 5);
    page.drawText(t, { x: 60, y, size: 12, font });
    y -= 20;
  }
  page.drawText(`Page ${n}`, { x: width / 2 - 20, y: 30, size: 10, font });
  if (n === 5) page.setRotation(degrees(90));
}
fs.writeFileSync(process.argv[2], await doc.save());
