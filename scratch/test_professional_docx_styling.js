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

async function createExecutiveSamplePdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Document Title
  page.drawText('EXECUTIVE SUMMARY & PROPOSAL', { x: 54, y: 738, size: 22, font: fontBold, color: rgb(0.06, 0.15, 0.35) });
  page.drawText('Enterprise Cloud Modernization & Architecture Transformation', { x: 54, y: 714, size: 12, font: fontOblique, color: rgb(0.35, 0.4, 0.5) });

  // Paragraph 1
  page.drawText('This proposal outlines the strategy for migrating monolithic infrastructure to a high-availability', { x: 54, y: 680, size: 10.5, font });
  page.drawText('cloud-native serverless microservices framework. Our architecture guarantees 99.99% uptime,', { x: 54, y: 664, size: 10.5, font });
  page.drawText('automated multi-region failover, and sub-100ms API response latency globally.', { x: 54, y: 648, size: 10.5, font });

  // Major Section 1
  page.drawText('1. ARCHITECTURE PRINCIPLES', { x: 54, y: 614, size: 14, font: fontBold, color: rgb(0.1, 0.25, 0.55) });

  page.drawText('• Decoupled Services: Independent deployment cycles and containerized microservices.', { x: 72, y: 590, size: 10, font });
  page.drawText('• Zero Trust Security: End-to-end encryption with granular OAuth2 and IAM policies.', { x: 72, y: 574, size: 10, font });
  page.drawText('• Automated CI/CD: Instant zero-downtime canary deployments via GitHub Actions.', { x: 72, y: 558, size: 10, font });

  // Major Section 2
  page.drawText('2. COST ESTIMATION & TIMELINE', { x: 54, y: 524, size: 14, font: fontBold, color: rgb(0.1, 0.25, 0.55) });
  page.drawText('Phase 1: Discovery & Audit (Weeks 1-3) - Complete workload classification.', { x: 54, y: 500, size: 10, font });
  page.drawText('Phase 2: Core Migration (Weeks 4-10) - Cloud database & backend migration.', { x: 54, y: 484, size: 10, font });
  page.drawText('Phase 3: Optimization & Go-Live (Weeks 11-12) - Traffic cutover and monitoring.', { x: 54, y: 468, size: 10, font });

  return await pdfDoc.save();
}

async function convertPdfToExecutiveDocx(pdfBuffer) {
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

    const midPageX = pageWidth / 2;
    const itemsLeft = rawItems.filter(it => it.x + it.width < midPageX - 20);
    const itemsRight = rawItems.filter(it => it.x > midPageX - 20);
    const hasTwoColumns = (itemsLeft.length > 3 && itemsRight.length > 3 && 
      !rawItems.some(it => it.x < midPageX - 20 && (it.x + it.width) > midPageX + 20 && it.fontSize < 16));

    let itemClusters = [];
    if (hasTwoColumns) {
      const topItems = rawItems.filter(it => (it.x < midPageX - 20 && (it.x + it.width) > midPageX - 20) || it.topY < 150);
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
            lastRun.str += item.str;
            lastRun.width = (item.x + item.width) - lastRun.x;
          } else if (gap >= item.fontSize * 0.25 && gap < item.fontSize * 1.8 && lastRun.isBold === item.isBold && lastRun.isItalic === item.isItalic && Math.abs(lastRun.fontSize - item.fontSize) < 1) {
            lastRun.str += " " + item.str;
            lastRun.width = (item.x + item.width) - lastRun.x;
          } else {
            stitchedRuns.push({ ...item });
          }
        });

        line.runs = stitchedRuns;
      });

      let logicalParagraphs = [];
      let currentPara = null;

      for (let idx = 0; idx < physicalLines.length; idx++) {
        const line = physicalLines[idx];
        const lineText = line.runs.map(r => r.str).join(" ").trim();
        if (!lineText) continue;

        const lineMinX = line.runs[0].x;
        const lineMaxX = line.runs[line.runs.length - 1].x + line.runs[line.runs.length - 1].width;
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

      let prevParaTopY = 0;

      for (const para of logicalParagraphs) {
        const fullParaText = para.lines.map(l => l.runs.map(r => r.str).join(" ")).join(" ");

        let alignment = "left";
        if (Math.abs((para.minX + para.maxX) / 2 - pageWidth / 2) < 45 && (para.maxX - para.minX) < pageWidth * 0.75) {
          alignment = "center";
        } else if (pageWidth - para.maxX < 72 && para.minX > pageWidth * 0.4) {
          alignment = "right";
        }

        let indentXml = "";
        if (para.isBullet) {
          indentXml = `<w:ind w:left="540" w:hanging="280"/>`;
        } else if (alignment === "left" && para.minX > 60) {
          const indentTwips = Math.round((para.minX - 54) * 20);
          if (indentTwips > 100) {
            indentXml = `<w:ind w:left="${indentTwips}"/>`;
          }
        }

        let spacingBefore = 80;
        if (prevParaTopY > 0) {
          const vGap = para.topY - prevParaTopY;
          if (vGap > para.fontSize * 1.5) {
            spacingBefore = Math.min(Math.round((vGap - para.fontSize) * 16), 360);
          }
        }
        prevParaTopY = para.lines[para.lines.length - 1].topY;

        let styleXml = "";
        let borderXml = "";
        let keepNextXml = "";

        if (para.fontSize >= 20) {
          styleXml = `<w:pStyle w:val="Title"/>`;
          keepNextXml = `<w:keepNext/>`;
        } else if (para.fontSize >= 15) {
          styleXml = `<w:pStyle w:val="Heading1"/>`;
          borderXml = `<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="CBD5E1"/></w:pBdr>`;
          keepNextXml = `<w:keepNext/>`;
        } else if (para.fontSize >= 13) {
          styleXml = `<w:pStyle w:val="Heading2"/>`;
          keepNextXml = `<w:keepNext/>`;
        } else if (/^[A-Z0-9\s:-]{4,}$/.test(fullParaText.trim()) && fullParaText.length < 60) {
          styleXml = `<w:pStyle w:val="Heading3"/>`;
          keepNextXml = `<w:keepNext/>`;
        }

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

        const pPrXml = `<w:pPr>${styleXml}${keepNextXml}<w:jc w:val="${alignment}"/>${indentXml}${borderXml}<w:spacing w:before="${spacingBefore}" w:after="120" w:line="276" w:lineRule="auto"/></w:pPr>`;
        bodyParagraphsXml.push(`<w:p>${pPrXml}${runsXml}</w:p>`);
      }
    }

    if (pageNum < pdf.numPages) {
      bodyParagraphsXml.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
    }
  }

  const zip = new JSZip();

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`);

  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`);

  zip.file("word/settings.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/>
  <w:defaultTabStop w:val="720"/>
  <w:characterSpacingControl w:val="doNotCompress"/>
</w:settings>`);

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
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
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
      <w:sz w:val="32"/>
      <w:szCs w:val="32"/>
      <w:color w:val="0F172A"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="26"/>
      <w:szCs w:val="26"/>
      <w:color w:val="1E293B"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="22"/>
      <w:szCs w:val="22"/>
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
      <w:pgMar w:top="1440" w:bottom="1440" w:left="1440" w:right="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`);

  return await zip.generateAsync({ type: "nodebuffer" });
}

async function run() {
  const pdfBytes = await createExecutiveSamplePdf();
  const docxBuffer = await convertPdfToExecutiveDocx(pdfBytes);
  const outPath = path.join(__dirname, 'test_professional_executive_result.docx');
  fs.writeFileSync(outPath, docxBuffer);
  console.log('✓ Successfully generated Professional Executive DOCX at:', outPath, 'Size:', docxBuffer.length, 'bytes');
}

run().catch(console.error);
