const { PDFDocument, StandardFonts } = require('pdf-lib');
const { pathToFileURL } = require('url');

async function test() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 400]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('John Doe Resume\nSoftware Engineer with 5 years experience in React and Node.js.', { x: 50, y: 350, size: 14, font });
  const pdfBytes = await pdfDoc.save();

  const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
  
  // Format workerSrc as valid file:// URL
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/build/pdf.worker.mjs')).href;

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  console.log('Pages count:', pdf.numPages);
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += `Page ${i}:\n${pageText}\n\n`;
  }
  
  console.log('--- EXTRACTED TEXT SUCCESS ---');
  console.log(fullText.trim());
}

test().catch(err => console.error('Error:', err));
