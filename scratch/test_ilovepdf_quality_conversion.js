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

// Create a multi-column, multi-paragraph realistic test PDF document
async function createComplexPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Header Title
  page.drawText('ADVANCED SYSTEM ARCHITECTURE REPORT', { x: 50, y: 740, size: 20, font: fontBold, color: rgb(0.05, 0.15, 0.4) });
  page.drawText('Prepared by Global Engineering Team | September 2026', { x: 50, y: 720, size: 11, font: fontOblique, color: rgb(0.4, 0.4, 0.4) });

  // Paragraph that spans 3 lines (should reflow into ONE Word paragraph!)
  page.drawText('This document provides a comprehensive overview of modern microservice conversion pipelines.', { x: 50, y: 690, size: 10, font });
  page.drawText('Our mission is to achieve 100% fidelity when converting documents between PDF, Word, and Excel', { x: 50, y: 676, size: 10, font });
  page.drawText('formats without sacrificing visual structure, alignment, or text readability.', { x: 50, y: 662, size: 10, font });

  // Section Heading
  page.drawText('KEY OBJECTIVES', { x: 50, y: 630, size: 13, font: fontBold, color: rgb(0.1, 0.25, 0.5) });

  // Bullet items
  page.drawText('• High precision layout reconstruction with automatic column detection.', { x: 65, y: 608, size: 10, font });
  page.drawText('• Natural paragraph reflow eliminating artificial hard line breaks.', { x: 65, y: 592, size: 10, font });
  page.drawText('• Full support for bold, italic, font scaling, and custom margins.', { x: 65, y: 576, size: 10, font });

  // 2-Column Section Layout
  // Column 1 (Left Sidebar: x=50 to x=220)
  page.drawText('SIDEBAR INFO', { x: 50, y: 530, size: 12, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Status: Production Ready', { x: 50, y: 512, size: 9, font });
  page.drawText('Version: v4.2.0', { x: 50, y: 498, size: 9, font });
  page.drawText('License: Enterprise', { x: 50, y: 484, size: 9, font });

  // Column 2 (Main Content: x=240 to x=550)
  page.drawText('DETAILED SPECIFICATIONS', { x: 240, y: 530, size: 12, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('The layout reconstruction engine continuously analyzes bounding coordinates', { x: 240, y: 512, size: 9.5, font });
  page.drawText('to ensure that sidebars and main content areas remain cleanly separated.', { x: 240, y: 498, size: 9.5, font });

  return await pdfDoc.save();
}

async function convertPdfToILovePdfQualityDocx(pdfBuffer) {
  const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
  const { pathToFileURL } = require('url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/build/pdf.worker.mjs')).href;

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  let bodyParagraphsXml = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const { width: pageWidth, height: pageHeight } = viewport;
    const textContent = await page.getTextContent();

    // 1. Raw item extraction and normalization
    const rawItems = textContent.items.map((item) => {
      const tx = item.transform || [1, 0, 0, 1, 0, 0];
      const x = tx[4] || 0;
      const y = tx[5] || 0;
      const topY = pageHeight - y;
      const fontSize = Math.round((Math.hypot(tx[0], tx[1]) || item.height || 10) * 10) / 10;
      const fontName = (item.fontName || "").toLowerCase();
      const isBold = fontName.includes("bold") || fontName.includes("700") || fontName.includes("800") || (fontSize >= 13 && /^[A-Z0-9\s:-]{3,}$/.test(item.str));
      const isItalic = fontName.includes("italic") || fontName.includes("oblique");

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
    }).filter(it => it.str && it.str.trim() !== "");

    if (rawItems.length === 0) continue;

    // 2. Multi-column detection
    // Divide page into vertical regions if a distinct gap/gutter exists across items
    const xIntervals = [];
    rawItems.forEach(it => {
      xIntervals.push({ start: it.x, end: it.x + it.width });
    });

    // Determine if there are distinct columns (e.g. left column x < 220, right column x > 230)
    const midPageX = pageWidth / 2;
    const itemsLeft = rawItems.filter(it => it.x + it.width < midPageX - 20);
    const itemsRight = rawItems.filter(it => it.x > midPageX - 20);
    const hasTwoColumns = (itemsLeft.length > 3 && itemsRight.length > 3 && 
      !rawItems.some(it => it.x < midPageX - 20 && (it.x + it.width) > midPageX + 20 && it.fontSize < 16));

    let itemClusters = [];
    if (hasTwoColumns) {
      // Process Full-width Top Header Items, Left Column, Right Column, Full-width Footer
      const topItems = rawItems.filter(it => it.x < midPageX - 20 && (it.x + it.width) > midPageX - 20 || it.topY < 150);
      const col1Items = rawItems.filter(it => !topItems.includes(it) && it.x < midPageX);
      const col2Items = rawItems.filter(it => !topItems.includes(it) && it.x >= midPageX);

      itemClusters = [
        { type: "full", items: topItems },
        { type: "col1", items: col1Items },
        { type: "col2", items: col2Items }
      ];
    } else {
      itemClusters = [{ type: "full", items: rawItems }];
    }

    for (const cluster of itemClusters) {
      if (cluster.items.length === 0) continue;

      // Group items into physical visual lines
      const sortedClusterItems = [...cluster.items].sort((a, b) => a.topY - b.topY || a.x - b.x);
      let physicalLines = [];

      sortedClusterItems.forEach((item) => {
        let line = physicalLines.find((l) => Math.abs(l.topY - item.topY) <= Math.max(l.fontSize, item.fontSize) * 0.4);
        if (!line) {
          line = {
            topY: item.topY,
            fontSize: item.fontSize,
            items: []
          };
          physicalLines.push(line);
        }
        line.items.push(item);
      });

      physicalLines.sort((a, b) => a.topY - b.topY);

      // Stitch adjacent text runs within each line (fixing broken words)
      physicalLines.forEach(line => {
        line.items.sort((a, b) => a.x - b.x);
        const stitchedRuns = [];

        line.items.forEach((item) => {
          if (stitchedRuns.length === 0) {
            stitchedRuns.push({ ...item });
            return;
          }

          const lastRun = stitchedRuns[stitchedRuns.length - 1];
          const gap = item.x - (lastRun.x + lastRun.width);

          if (gap < item.fontSize * 0.25 && lastRun.isBold === item.isBold && lastRun.isItalic === item.isItalic && Math.abs(lastRun.fontSize - item.fontSize) < 1) {
            // Join string directly without space
            lastRun.str += item.str;
            lastRun.width = (item.x + item.width) - lastRun.x;
          } else if (gap >= item.fontSize * 0.25 && gap < item.fontSize * 1.8 && lastRun.isBold === item.isBold && lastRun.isItalic === item.isItalic && Math.abs(lastRun.fontSize - item.fontSize) < 1) {
            // Join string with single space
            lastRun.str += " " + item.str;
            lastRun.width = (item.x + item.width) - lastRun.x;
          } else {
            stitchedRuns.push({ ...item });
          }
        });

        line.runs = stitchedRuns;
      });

      // 3. Paragraph Reconstruction & Reflow Engine
      // Combine consecutive lines into a single flowing paragraph if they belong to the same block
      let logicalParagraphs = [];
      let currentPara = null;

      for (let idx = 0; idx < physicalLines.length; idx++) {
        const line = physicalLines[idx];
        const lineText = line.runs.map(r => r.str).join(" ").trim();
        if (!lineText) continue;

        const lineMinX = line.runs[0].x;
        const lineMaxX = line.runs[line.runs.length - 1].x + line.runs[line.runs.length - 1].width;
        const lineWidth = lineMaxX - lineMinX;

        const isBullet = /^(\*|-|•|\d+[\.\)])\s+/.test(lineText);
        const isHeader = line.fontSize >= 13 || line.runs.some(r => r.isBold && r.fontSize >= 11);

        let shouldStartNewPara = false;

        if (!currentPara) {
          shouldStartNewPara = true;
        } else {
          const prevLine = currentPara.lines[currentPara.lines.length - 1];
          const vGap = line.topY - prevLine.topY;
          const sameXIndent = Math.abs(lineMinX - currentPara.minX) < 15;

          if (isBullet || isHeader || currentPara.isBullet || currentPara.isHeader) {
            shouldStartNewPara = true;
          } else if (vGap > line.fontSize * 1.6) {
            shouldStartNewPara = true;
          } else if (!sameXIndent) {
            shouldStartNewPara = true;
          }
        }

        if (shouldStartNewPara) {
          currentPara = {
            minX: lineMinX,
            maxX: lineMaxX,
            topY: line.topY,
            fontSize: line.fontSize,
            isBullet,
            isHeader,
            lines: [line]
          };
          logicalParagraphs.push(currentPara);
        } else {
          currentPara.lines.push(line);
          currentPara.maxX = Math.max(currentPara.maxX, lineMaxX);
        }
      }

      // 4. Generate OpenXML for Logical Paragraphs
      let prevParaTopY = 0;

      for (const para of logicalParagraphs) {
        const firstLine = para.lines[0];
        const fullParaText = para.lines.map(l => l.runs.map(r => r.str).join(" ")).join(" ");

        // Determine Alignment
        let alignment = "left";
        if (Math.abs((para.minX + para.maxX) / 2 - pageWidth / 2) < 45 && (para.maxX - para.minX) < pageWidth * 0.75) {
          alignment = "center";
        } else if (pageWidth - para.maxX < 72 && para.minX > pageWidth * 0.4) {
          alignment = "right";
        }

        // Indentation
        let indentXml = "";
        if (para.isBullet) {
          indentXml = `<w:ind w:left="720" w:hanging="360"/>`;
        } else if (alignment === "left" && para.minX > 60) {
          const indentTwips = Math.round((para.minX - 50) * 20);
          if (indentTwips > 100) {
            indentXml = `<w:ind w:left="${indentTwips}"/>`;
          }
        }

        // Spacing Before
        let spacingBefore = 80;
        if (prevParaTopY > 0) {
          const vGap = para.topY - prevParaTopY;
          if (vGap > para.fontSize * 1.5) {
            spacingBefore = Math.min(Math.round((vGap - para.fontSize) * 15), 360);
          }
        }
        prevParaTopY = para.lines[para.lines.length - 1].topY;

        // Heading style
        let styleXml = "";
        if (para.fontSize >= 20) {
          styleXml = `<w:pStyle w:val="Title"/>`;
        } else if (para.fontSize >= 16) {
          styleXml = `<w:pStyle w:val="Heading1"/>`;
        } else if (para.fontSize >= 13) {
          styleXml = `<w:pStyle w:val="Heading2"/>`;
        } else if (/^[A-Z0-9\s:-]{4,}$/.test(fullParaText.trim()) && fullParaText.length < 60) {
          styleXml = `<w:pStyle w:val="Heading3"/>`;
        }

        // Build Runs
        let runsXml = "";
        para.lines.forEach((line, lineIdx) => {
          line.runs.forEach((run, runIdx) => {
            const prefixSpace = (lineIdx > 0 && runIdx === 0) ? " " : "";

            let rPr = "";
            if (run.isBold) rPr += `<w:b/>`;
            if (run.isItalic) rPr += `<w:i/>`;
            if (run.fontSize) {
              const szHalfPts = Math.round(run.fontSize * 2);
              rPr += `<w:sz w:val="${szHalfPts}"/><w:szCs w:val="${szHalfPts}"/>`;
            }

            const runPropsXml = rPr ? `<w:rPr>${rPr}</w:rPr>` : "";
            runsXml += `<w:r>${runPropsXml}<w:t xml:space="preserve">${escapeXml(prefixSpace + run.str)}</w:t></w:r>`;
          });
        });

        const pPrXml = `<w:pPr>${styleXml}<w:jc w:val="${alignment}"/>${indentXml}<w:spacing w:before="${spacingBefore}" w:after="100" w:line="276" w:lineRule="auto"/></w:pPr>`;
        bodyParagraphsXml.push(`<w:p>${pPrXml}${runsXml}</w:p>`);
      }
    }

    if (pageNum < pdf.numPages) {
      bodyParagraphsXml.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
    }
  }

  // Build ZIP Package
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
        <w:lang w:val="en-US"/>
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
  const pdfBytes = await createComplexPdf();
  const docxBuffer = await convertPdfToILovePdfQualityDocx(pdfBytes);
  const outPath = path.join(__dirname, 'test_ilovepdf_quality_result.docx');
  fs.writeFileSync(outPath, docxBuffer);
  console.log('✓ Successfully generated iLovePDF-quality DOCX at:', outPath, 'Size:', docxBuffer.length, 'bytes');
}

run().catch(console.error);
