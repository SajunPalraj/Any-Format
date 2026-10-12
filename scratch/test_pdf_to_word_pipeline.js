const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const JSZip = require('jszip');

function escapeXml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function testPdfToWordPipeline() {
  // 1. Create sample resume PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawText('SAJUN KUMAR', { x: 50, y: 750, size: 20, font: fontBold });
  page.drawText('Senior Full Stack Software Engineer', { x: 50, y: 725, size: 14, font });
  page.drawText('Email: sajun@example.com | Phone: +1 555-0199', { x: 50, y: 705, size: 10, font });
  
  page.drawText('EXPERIENCE', { x: 50, y: 670, size: 14, font: fontBold });
  page.drawText('- Lead Developer at TechCorp (2021 - Present)', { x: 50, y: 650, size: 11, font });
  page.drawText('- Software Engineer at WebSystems (2018 - 2021)', { x: 50, y: 630, size: 11, font });

  page.drawText('SKILLS', { x: 50, y: 590, size: 14, font: fontBold });
  page.drawText('JavaScript, React, Node.js, Python, PDF Processing, Next.js', { x: 50, y: 570, size: 11, font });

  const pdfBytes = await pdfDoc.save();

  // 2. Extract text using pdfjs-dist
  const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
  const { pathToFileURL } = require('url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/build/pdf.worker.mjs')).href;

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  let pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    const tc = await p.getTextContent();
    const txt = tc.items.map(item => item.str).join(' ');
    pageTexts.push(txt);
  }
  const fullText = pageTexts.join('\n\n');

  console.log('--- EXTRACTED RESUME TEXT ---');
  console.log(fullText);

  // 3. Generate DOCX zip package
  const zip = new JSZip();

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  const paragraphsXml = fullText
    .split("\n")
    .map((line) => line.trim() ? `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>` : `<w:p/>`)
    .join("");

  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphsXml}</w:body>
</w:document>`);

  const docxBuffer = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(path.join(__dirname, "test_resume_output.docx"), docxBuffer);

  console.log('\n✓ Generated test_resume_output.docx successfully! Size:', docxBuffer.length, 'bytes.');
}

testPdfToWordPipeline().catch(err => console.error('Error:', err));
