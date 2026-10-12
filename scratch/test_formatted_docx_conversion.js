const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
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

async function createSamplePdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Standard letter size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Title
  page.drawText('RESUME - ALEX JOHNSON', { x: 50, y: 740, size: 22, font: fontBold, color: rgb(0.1, 0.1, 0.3) });
  page.drawText('Senior Systems Architect & Lead Engineer', { x: 50, y: 715, size: 14, font: fontOblique, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('Email: alex.johnson@example.com | Phone: (555) 019-2834 | New York, NY', { x: 50, y: 695, size: 10, font });

  // Section 1
  page.drawText('WORK EXPERIENCE', { x: 50, y: 660, size: 14, font: fontBold, color: rgb(0.1, 0.3, 0.6) });
  page.drawText('Lead Architect - Tech Solutions Inc.', { x: 50, y: 638, size: 12, font: fontBold });
  page.drawText('Jan 2022 - Present | Designed and deployed scalable microservices processing 50M+ requests daily.', { x: 65, y: 622, size: 10, font });
  page.drawText('• Reduced system latency by 35% using distributed caching with Redis.', { x: 65, y: 606, size: 10, font });
  page.drawText('• Managed a high-performing engineering team of 12 full-stack developers.', { x: 65, y: 590, size: 10, font });

  // Section 2
  page.drawText('EDUCATION', { x: 50, y: 550, size: 14, font: fontBold, color: rgb(0.1, 0.3, 0.6) });
  page.drawText('B.S. in Computer Science - Columbia University (2014 - 2018)', { x: 50, y: 530, size: 11, font });

  return await pdfDoc.save();
}

async function convertPdfBufferToFormattedDocx(pdfBuffer) {
  const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
  const { pathToFileURL } = require('url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/build/pdf.worker.mjs')).href;

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;

  let bodyParagraphsXml = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const { width: pageWidth, height: pageHeight } = viewport;
    const textContent = await page.getTextContent();

    const items = textContent.items.map((item) => {
      const tx = item.transform;
      const x = tx[4];
      const y = tx[5];
      const topY = pageHeight - y;
      const fontSize = Math.round(Math.hypot(tx[0], tx[1]) || item.height || 12);
      const isBold = (item.fontName || "").toLowerCase().includes("bold") || (fontSize >= 14 && /^[A-Z0-9\s:-]{3,}$/.test(item.str));
      const isItalic = (item.fontName || "").toLowerCase().includes("italic") || (item.fontName || "").toLowerCase().includes("oblique");

      return {
        str: item.str,
        x,
        y,
        topY,
        width: item.width || (item.str.length * fontSize * 0.5),
        height: item.height || fontSize,
        fontSize,
        isBold,
        isItalic
      };
    });

    // Group items into visual lines
    items.sort((a, b) => a.topY - b.topY || a.x - b.x);

    let lines = [];
    items.forEach((item) => {
      if (!item.str.trim()) return;

      let currentLine = lines.find((l) => Math.abs(l.topY - item.topY) <= Math.max(l.fontSize, item.fontSize) * 0.45);
      if (!currentLine) {
        currentLine = {
          topY: item.topY,
          fontSize: item.fontSize,
          items: []
        };
        lines.push(currentLine);
      }
      currentLine.items.push(item);
    });

    lines.sort((a, b) => a.topY - b.topY);

    let prevTopY = 0;

    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);

      const lineMinX = line.items[0].x;
      const lineMaxX = line.items[line.items.length - 1].x + line.items[line.items.length - 1].width;
      const lineWidth = lineMaxX - lineMinX;

      // Alignment check
      let alignment = "left";
      if (Math.abs((lineMinX + lineMaxX) / 2 - pageWidth / 2) < 40 && lineWidth < pageWidth * 0.7) {
        alignment = "center";
      } else if (pageWidth - lineMaxX < 72 && lineMinX > pageWidth * 0.4) {
        alignment = "right";
      }

      // Indentation (in twips, 1 pt = 20 twips)
      let indentXml = "";
      if (alignment === "left" && lineMinX > 60) {
        const indentTwips = Math.round((lineMinX - 50) * 20);
        if (indentTwips > 100) {
          indentXml = `<w:ind w:left="${indentTwips}"/>`;
        }
      }

      // Spacing check
      let spacingBefore = 80;
      if (prevTopY > 0) {
        const vGap = line.topY - prevTopY;
        if (vGap > line.fontSize * 1.5) {
          spacingBefore = Math.min(Math.round((vGap - line.fontSize) * 15), 360);
        }
      }
      prevTopY = line.topY;

      // Detect Heading Level or Title
      let styleXml = "";
      const maxFontSizeInLine = Math.max(...line.items.map((it) => it.fontSize));
      const fullLineText = line.items.map((it) => it.str).join(" ").trim();

      if (maxFontSizeInLine >= 20) {
        styleXml = `<w:pStyle w:val="Title"/>`;
      } else if (maxFontSizeInLine >= 16) {
        styleXml = `<w:pStyle w:val="Heading1"/>`;
      } else if (maxFontSizeInLine >= 13) {
        styleXml = `<w:pStyle w:val="Heading2"/>`;
      } else if (/^[A-Z0-9\s:-]{4,}$/.test(fullLineText) && fullLineText.length < 50) {
        styleXml = `<w:pStyle w:val="Heading3"/>`;
      }

      // Build runs XML with formatting
      let runsXml = "";
      line.items.forEach((item, idx) => {
        const spacePrefix = (idx > 0 && item.x - (line.items[idx - 1].x + line.items[idx - 1].width) > item.fontSize * 0.15) ? " " : "";

        let rPr = "";
        if (item.isBold) rPr += `<w:b/>`;
        if (item.isItalic) rPr += `<w:i/>`;
        if (item.fontSize) {
          const szHalfPts = item.fontSize * 2;
          rPr += `<w:sz w:val="${szHalfPts}"/><w:szCs w:val="${szHalfPts}"/>`;
        }

        const runPropsXml = rPr ? `<w:rPr>${rPr}</w:rPr>` : "";
        runsXml += `<w:r>${runPropsXml}<w:t xml:space="preserve">${escapeXml(spacePrefix + item.str)}</w:t></w:r>`;
      });

      const pPrXml = `<w:pPr>${styleXml}<w:jc w:val="${alignment}"/>${indentXml}<w:spacing w:before="${spacingBefore}" w:after="80"/></w:pPr>`;
      bodyParagraphsXml.push(`<w:p>${pPrXml}${runsXml}</w:p>`);
    }

    // Add page break if not last page
    if (i < pdf.numPages) {
      bodyParagraphsXml.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
    }
  }

  // Construct full Word JSZip package
  const zip = new JSZip();

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:color w:val="1E293B"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="44"/>
      <w:szCs w:val="44"/>
      <w:color w:val="0F172A"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="36"/>
      <w:szCs w:val="36"/>
      <w:color w:val="0F172A"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="28"/>
      <w:szCs w:val="28"/>
      <w:color w:val="1E293B"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="24"/>
      <w:szCs w:val="24"/>
      <w:color w:val="334155"/>
    </w:rPr>
  </w:style>
</w:styles>`);

  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyParagraphsXml.join("\n    ")}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:bottom="1440" w:left="1440" w:right="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`);

  return await zip.generateAsync({ type: "nodebuffer" });
}

async function run() {
  const pdfBytes = await createSamplePdf();
  const docxBuffer = await convertPdfBufferToFormattedDocx(pdfBytes);
  const outPath = path.join(__dirname, 'test_formatted_resume.docx');
  fs.writeFileSync(outPath, docxBuffer);
  console.log('✓ Successfully generated formatted DOCX at:', outPath, 'Size:', docxBuffer.length, 'bytes');
}

run().catch(console.error);
