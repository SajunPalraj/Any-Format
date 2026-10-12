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

async function createSajunResumePdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Recreate the exact PDF structure from user screenshot: separate text items on same Y
  // Header: Name and Title as separate text runs on same line
  page.drawText('Sajun Palraj', { x: 50, y: 730, size: 20, font: fontBold });
  page.drawText('MERN Full-Stack Developer', { x: 170, y: 730, size: 16, font: fontBold });

  // Contact line
  page.drawText('sajunpalraj2004@gmail.com', { x: 50, y: 700, size: 9.5, font });
  page.drawText('+91 8608225321', { x: 190, y: 700, size: 9.5, font });
  page.drawText('Nagercoil, Kanyakumari, Tamil Nadu, India', { x: 280, y: 700, size: 9.5, font });

  // Summary
  page.drawText('PROFESSIONAL SUMMARY', { x: 50, y: 660, size: 12, font: fontBold });
  page.drawText('MERN Stack Developer with a Computer Science Engineering background and hands-on experience building', { x: 50, y: 640, size: 9.5, font });
  page.drawText('responsive web applications using MongoDB, Express.js, React.js, Node.js, Next.js, JavaScript, and SQL.', { x: 50, y: 626, size: 9.5, font });

  // Skills
  page.drawText('TECHNICAL SKILLS', { x: 50, y: 590, size: 12, font: fontBold });
  page.drawText('Frontend:', { x: 50, y: 570, size: 9.5, font: fontBold });
  page.drawText('React.js, Next.js, HTML5, CSS3, Tailwind CSS, MUI |', { x: 100, y: 570, size: 9.5, font });
  page.drawText('Backend:', { x: 330, y: 570, size: 9.5, font: fontBold });
  page.drawText('Node.js, Express.js, REST APIs, CRUD', { x: 380, y: 570, size: 9.5, font });

  // Experience
  page.drawText('WORK EXPERIENCES', { x: 50, y: 530, size: 12, font: fontBold });
  page.drawText('ShiroSoftwareSolutions', { x: 50, y: 510, size: 9.5, font: fontBold });
  page.drawText('2024 | Nagercoil', { x: 165, y: 510, size: 9.5, font });
  page.drawText('WebDevelopmentIntern', { x: 250, y: 510, size: 9.5, font });

  return await pdfDoc.save();
}

async function convertPdfToPerfectDocx(pdfBuffer) {
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

    let rawItems = textContent.items.map((item) => {
      const tx = item.transform || [1, 0, 0, 1, 0, 0];
      const x = Math.round(tx[4] || 0);
      const y = Math.round(tx[5] || 0);
      const topY = Math.round(pageHeight - y);
      const fontSize = Math.round((Math.hypot(tx[0], tx[1]) || item.height || 10) * 10) / 10;
      const fontName = (item.fontName || "").toLowerCase();
      const isBold = fontName.includes("bold") || fontName.includes("700") || fontName.includes("800") || (fontSize >= 13 && /^[A-Z0-9\s:-]{3,}$/.test(item.str));
      const isItalic = fontName.includes("italic") || fontName.includes("oblique");

      return {
        str: item.str,
        x,
        y,
        topY,
        width: Math.round(item.width || (item.str.length * fontSize * 0.5)),
        height: Math.round(item.height || fontSize),
        fontSize,
        isBold,
        isItalic
      };
    }).filter(it => it.str && it.str.trim() !== "");

    // Deduplicate overlapping duplicate items (e.g. shadow text)
    const uniqueItems = [];
    rawItems.forEach(item => {
      const isDup = uniqueItems.some(u => 
        Math.abs(u.x - item.x) < 2 && 
        Math.abs(u.topY - item.topY) < 2 && 
        u.str.trim() === item.str.trim()
      );
      if (!isDup) {
        uniqueItems.push(item);
      }
    });
    rawItems = uniqueItems;

    if (rawItems.length === 0) continue;

    const sortedItems = [...rawItems].sort((a, b) => a.topY - b.topY || a.x - b.x);
    let physicalLines = [];

    sortedItems.forEach((item) => {
      let line = physicalLines.find((l) => Math.abs(l.topY - item.topY) <= Math.max(l.fontSize, item.fontSize) * 0.45);
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

    // PERFECT RUN STITCHING: Guarantee clean space separation between adjacent items!
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
        const lastStr = lastRun.str;
        const currStr = item.str;

        // Determine if space is needed between lastRun and item
        const lastEndsWithSpace = /\s$/.test(lastStr);
        const currStartsWithSpace = /^\s/.test(currStr);
        const currStartsWithPunct = /^[,.:;!?\)\]\/\-]/.test(currStr.trim());

        let needSpace = false;
        if (!lastEndsWithSpace && !currStartsWithSpace && !currStartsWithPunct) {
          needSpace = true;
        }

        if (lastRun.isBold === item.isBold && lastRun.isItalic === item.isItalic && Math.abs(lastRun.fontSize - item.fontSize) < 1.5) {
          // Same styling -> merge into single run!
          lastRun.str = lastRun.str + (needSpace ? " " : "") + currStr.trim();
          lastRun.width = (item.x + item.width) - lastRun.x;
        } else {
          // Different styling -> separate run, ensure leading space if needed
          if (needSpace && !currStartsWithSpace) {
            item.str = " " + item.str;
          }
          stitchedRuns.push({ ...item });
        }
      });

      line.runs = stitchedRuns;
    });

    // Paragraph Building
    let logicalParagraphs = [];
    let currentPara = null;

    for (let idx = 0; idx < physicalLines.length; idx++) {
      const line = physicalLines[idx];
      const lineText = line.runs.map(r => r.str).join("").trim();
      if (!lineText) continue;

      const lineMinX = line.runs[0].x;
      const lineMaxX = line.runs[line.runs.length - 1].x + line.runs[line.runs.length - 1].width;
      const isBullet = /^(\*|-|•|\d+[\.\)])\s+/.test(lineText);
      const isHeader = line.fontSize >= 12 || line.runs.some(r => r.isBold && r.fontSize >= 11);

      let shouldStartNewPara = false;

      if (!currentPara) {
        shouldStartNewPara = true;
      } else {
        const prevLine = currentPara.lines[currentPara.lines.length - 1];
        const vGap = line.topY - prevLine.topY;
        const sameXIndent = Math.abs(lineMinX - currentPara.minX) < 20;

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
      const fullParaText = para.lines.map(l => l.runs.map(r => r.str).join("")).join(" ");

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
        const indentTwips = Math.round((para.minX - 50) * 20);
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
      let keepNextXml = "";

      if (para.fontSize >= 20) {
        styleXml = `<w:pStyle w:val="Title"/>`;
        keepNextXml = `<w:keepNext/>`;
      } else if (para.fontSize >= 15) {
        styleXml = `<w:pStyle w:val="Heading1"/>`;
        keepNextXml = `<w:keepNext/>`;
      } else if (para.fontSize >= 12) {
        styleXml = `<w:pStyle w:val="Heading2"/>`;
        keepNextXml = `<w:keepNext/>`;
      } else if (/^[A-Z0-9\s:-]{4,}$/.test(fullParaText.trim()) && fullParaText.length < 60) {
        styleXml = `<w:pStyle w:val="Heading3"/>`;
        keepNextXml = `<w:keepNext/>`;
      }

      let runsXml = "";
      para.lines.forEach((line, lineIdx) => {
        line.runs.forEach((run, runIdx) => {
          const prefixSpace = (lineIdx > 0 && runIdx === 0 && !/^\s/.test(run.str)) ? " " : "";

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

      // STRICT OPENXML SCHEMA ELEMENT ORDER INSIDE <w:pPr>:
      // 1. pStyle -> 2. keepNext -> 3. spacing -> 4. ind -> 5. jc
      const jcXml = alignment !== "left" ? `<w:jc w:val="${alignment}"/>` : "";
      const pPrXml = `<w:pPr>${styleXml}${keepNextXml}<w:spacing w:before="${spacingBefore}" w:after="120" w:line="276" w:lineRule="auto"/>${indentXml}${jcXml}</w:pPr>`;
      bodyParagraphsXml.push(`<w:p>${pPrXml}${runsXml}</w:p>`);
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
      <w:pgMar w:top="1440" w:bottom="1440" w:left="1440" w:right="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`);

  return await zip.generateAsync({ type: "nodebuffer" });
}

async function run() {
  const pdfBytes = await createSajunResumePdf();
  const docxBuffer = await convertPdfToPerfectDocx(pdfBytes);
  const outPath = path.join(__dirname, 'test_sajun_resume_perfect.docx');
  fs.writeFileSync(outPath, docxBuffer);
  console.log('✓ Successfully generated Sajun Resume Perfect DOCX at:', outPath, 'Size:', docxBuffer.length, 'bytes');
}

run().catch(console.error);
