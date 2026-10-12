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

async function createSajunExactPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Title & Subtitle
  page.drawText('Sajun Palraj', { x: 50, y: 740, size: 24, font: fontBold });
  page.drawText('MERN Full-Stack Developer', { x: 200, y: 740, size: 16, font, color: rgb(0.15, 0.4, 0.9) });

  // Contacts
  page.drawText('sajunpalraj2004@gmail.com', { x: 50, y: 712, size: 9.5, font });
  page.drawText('+91 8608225321', { x: 200, y: 712, size: 9.5, font });
  page.drawText('Nagercoil, Kanyakumari, Tamil Nadu, India', { x: 300, y: 712, size: 9.5, font });
  page.drawText('Sajun Palraj', { x: 50, y: 694, size: 9.5, font });
  page.drawText('SajunPalraj', { x: 140, y: 694, size: 9.5, font });

  // PROFESSIONAL SUMMARY
  page.drawText('PROFESSIONAL SUMMARY', { x: 50, y: 660, size: 12, font: fontBold });
  page.drawText('MERN Stack Developer with a Computer Science Engineering background and hands-on experience building', { x: 50, y: 640, size: 9.5, font });
  page.drawText('responsive web applications using MongoDB, Express.js, React.js, Node.js, Next.js, JavaScript, and SQL.', { x: 50, y: 626, size: 9.5, font });

  // TECHNICAL SKILLS
  page.drawText('TECHNICAL SKILLS', { x: 50, y: 590, size: 12, font: fontBold });
  page.drawText('(Frontend: React.js, Next.js, HTML5, CSS3, Tailwind CSS, MUI | Backend: Node.js, Express.js, REST APIs, CRUD |', { x: 50, y: 570, size: 9.5, font });
  page.drawText('Languages: JavaScript (ES6+), SQL, Python | Database: MongoDB, MySQL | Development Tools: Git, GitHub,', { x: 50, y: 556, size: 9.5, font });

  // WORK EXPERIENCES
  page.drawText('WORK EXPERIENCES', { x: 50, y: 520, size: 12, font: fontBold });
  page.drawText('Shiro Software Solutions', { x: 50, y: 500, size: 10.5, font: fontBold });
  page.drawText('2024 | Nagercoil', { x: 450, y: 500, size: 10, font });
  page.drawText('Web Development Intern', { x: 50, y: 486, size: 9.5, font: fontOblique });
  page.drawText('• Developed web applications using HTML, CSS, JavaScript, React.js, Node.js, and SQL.', { x: 50, y: 468, size: 9.5, font });

  // EDUCATIONS
  page.drawText('EDUCATIONS', { x: 50, y: 430, size: 12, font: fontBold });
  page.drawText('Bachelor of Engineering', { x: 50, y: 410, size: 10.5, font: fontBold });
  page.drawText('2022 – 2026 | Nagercoil, Kanyakumari', { x: 380, y: 410, size: 10, font });

  return await pdfDoc.save();
}

async function convertPdfToILovePdfFidelityDocx(pdfBuffer) {
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

      const scaleY = Math.abs(tx[3] || 0);
      const scaleX = Math.abs(tx[0] || 0);
      const hypotScale = Math.hypot(tx[0] || 0, tx[1] || 0);

      let fontSize = 10.5;
      if (hypotScale >= 6 && hypotScale <= 120) fontSize = hypotScale;
      else if (scaleY >= 6 && scaleY <= 120) fontSize = scaleY;
      else if (scaleX >= 6 && scaleX <= 120) fontSize = scaleX;
      else if (item.height && item.height >= 6 && item.height <= 120) fontSize = item.height;
      else fontSize = 10.5;

      fontSize = Math.round(fontSize * 10) / 10;
      if (fontSize < 7) fontSize = 10.5;
      if (fontSize > 72) fontSize = 72;

      const fontName = (item.fontName || "").toLowerCase();
      const isBold = fontName.includes("bold") || fontName.includes("700") || fontName.includes("800") || (fontSize >= 12 && /^[A-Z0-9\s:-]{3,}$/.test(item.str));
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

    // Deduplicate overlapping duplicate items
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

    // Process lines & check for Right-aligned date/location tabs!
    physicalLines.forEach(line => {
      line.items.sort((a, b) => a.x - b.x);

      // Check if line has a left group (x < 250) and right group (x > 350)
      const leftItems = line.items.filter(it => it.x < 300);
      const rightItems = line.items.filter(it => it.x >= 350);

      if (leftItems.length > 0 && rightItems.length > 0) {
        line.hasTab = true;
        line.leftText = leftItems.map(it => it.str).join(" ").trim();
        line.rightText = rightItems.map(it => it.str).join(" ").trim();
        line.leftFont = leftItems[0];
        line.rightFont = rightItems[0];
      } else {
        line.hasTab = false;
        const stitchedRuns = [];
        line.items.forEach((item) => {
          if (stitchedRuns.length === 0) {
            stitchedRuns.push({ ...item });
            return;
          }

          const lastRun = stitchedRuns[stitchedRuns.length - 1];
          const lastStr = lastRun.str;
          const currStr = item.str;

          const lastEndsWithSpace = /\s$/.test(lastStr);
          const currStartsWithSpace = /^\s/.test(currStr);
          const currStartsWithPunct = /^[,.:;!?\)\]\/\-]/.test(currStr.trim());

          let needSpace = false;
          if (!lastEndsWithSpace && !currStartsWithSpace && !currStartsWithPunct) {
            needSpace = true;
          }

          if (lastRun.isBold === item.isBold && lastRun.isItalic === item.isItalic && Math.abs(lastRun.fontSize - item.fontSize) < 1.5) {
            lastRun.str = lastRun.str + (needSpace ? " " : "") + currStr.trim();
            lastRun.width = (item.x + item.width) - lastRun.x;
          } else {
            if (needSpace && !currStartsWithSpace) {
              item.str = " " + item.str;
            }
            stitchedRuns.push({ ...item });
          }
        });

        line.runs = stitchedRuns;
      }
    });

    let prevLineTopY = 0;

    for (let idx = 0; idx < physicalLines.length; idx++) {
      const line = physicalLines[idx];

      if (line.hasTab) {
        // Render 2-column Tab Line: Left title + Right date/location right-aligned
        const szHalfPtsLeft = Math.round(line.leftFont.fontSize * 2);
        const szHalfPtsRight = Math.round(line.rightFont.fontSize * 2);

        let leftPr = line.leftFont.isBold ? `<w:b/>` : "";
        if (line.leftFont.isItalic) leftPr += `<w:i/>`;
        let rightPr = line.rightFont.isBold ? `<w:b/>` : "";
        if (line.rightFont.isItalic) rightPr += `<w:i/>`;

        const pPrXml = `<w:pPr><w:tabs><w:tab w:val="right" w:pos="9360"/></w:tabs><w:spacing w:before="160" w:after="80" w:line="276" w:lineRule="auto"/></w:pPr>`;
        const runsXml = `<w:r><w:rPr>${leftPr}<w:sz w:val="${szHalfPtsLeft}"/><w:szCs w:val="${szHalfPtsLeft}"/></w:rPr><w:t xml:space="preserve">${escapeXml(line.leftText)}</w:t></w:r><w:r><w:tab/></w:r><w:r><w:rPr>${rightPr}<w:sz w:val="${szHalfPtsRight}"/><w:szCs w:val="${szHalfPtsRight}"/></w:rPr><w:t xml:space="preserve">${escapeXml(line.rightText)}</w:t></w:r>`;

        bodyParagraphsXml.push(`<w:p>${pPrXml}${runsXml}</w:p>`);
        prevLineTopY = line.topY;
        continue;
      }

      const fullLineText = line.runs.map(r => r.str).join("").trim();
      if (!fullLineText) continue;

      const isSectionHeader = /^(PROFESSIONAL SUMMARY|TECHNICAL SKILLS|WORK EXPERIENCES|EDUCATIONS|PROJECTS|CERTIFICATIONS)$/i.test(fullLineText);
      const isBullet = /^(\*|-|•|\d+[\.\)])\s+/.test(fullLineText);

      let spacingBefore = 100;
      if (prevLineTopY > 0) {
        const vGap = line.topY - prevLineTopY;
        if (vGap > line.fontSize * 1.5) {
          spacingBefore = Math.min(Math.round((vGap - line.fontSize) * 16), 360);
        }
      }
      prevLineTopY = line.topY;

      let styleXml = "";
      let borderXml = "";
      let keepNextXml = "";

      if (isSectionHeader) {
        styleXml = `<w:pStyle w:val="Heading2"/>`;
        keepNextXml = `<w:keepNext/>`;
        borderXml = `<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="4" w:color="2563EB"/></w:pBdr>`;
      } else if (line.fontSize >= 20) {
        styleXml = `<w:pStyle w:val="Title"/>`;
        keepNextXml = `<w:keepNext/>`;
      } else if (line.fontSize >= 14) {
        styleXml = `<w:pStyle w:val="Heading1"/>`;
        keepNextXml = `<w:keepNext/>`;
      }

      let indentXml = "";
      if (isBullet) {
        indentXml = `<w:ind w:left="540" w:hanging="280"/>`;
      }

      let runsXml = "";
      line.runs.forEach((run, rIdx) => {
        let rPr = "";
        if (run.isBold) rPr += `<w:b/>`;
        if (run.isItalic) rPr += `<w:i/>`;

        // Check if run is the subtitle "MERN Full-Stack Developer" -> apply Royal Blue #2563EB
        if (run.str.includes("MERN Full-Stack Developer")) {
          rPr += `<w:color w:val="2563EB"/>`;
        }

        if (run.fontSize) {
          const szHalfPts = Math.round(run.fontSize * 2);
          rPr += `<w:sz w:val="${szHalfPts}"/><w:szCs w:val="${szHalfPts}"/>`;
        }

        const runPropsXml = rPr ? `<w:rPr>${rPr}</w:rPr>` : "";
        runsXml += `<w:r>${runPropsXml}<w:t xml:space="preserve">${escapeXml(run.str)}</w:t></w:r>`;
      });

      // STRICT SCHEMA ORDER: pStyle -> keepNext -> pBdr -> spacing -> ind
      const pPrXml = `<w:pPr>${styleXml}${keepNextXml}${borderXml}<w:spacing w:before="${spacingBefore}" w:after="100" w:line="276" w:lineRule="auto"/>${indentXml}</w:pPr>`;
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
      <w:sz w:val="24"/>
      <w:szCs w:val="24"/>
      <w:color w:val="0F172A"/>
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
  const pdfBytes = await createSajunExactPdf();
  const docxBuffer = await convertPdfToILovePdfFidelityDocx(pdfBytes);
  const outPath = path.join(__dirname, 'test_sajun_ilovepdf_clone.docx');
  fs.writeFileSync(outPath, docxBuffer);
  console.log('✓ Successfully generated iLovePDF Exact Clone DOCX at:', outPath, 'Size:', docxBuffer.length, 'bytes');
}

run().catch(console.error);
