const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const JSZip = require('jszip');

function safeFontSize(tx, itemHeight) {
  const scaleY = Math.abs(tx[3] || 0);
  const scaleX = Math.abs(tx[0] || 0);
  const hypotScale = Math.hypot(tx[0] || 0, tx[1] || 0);

  let fontSize = 10.5;
  if (hypotScale >= 6 && hypotScale <= 120) {
    fontSize = hypotScale;
  } else if (scaleY >= 6 && scaleY <= 120) {
    fontSize = scaleY;
  } else if (scaleX >= 6 && scaleX <= 120) {
    fontSize = scaleX;
  } else if (itemHeight && itemHeight >= 6 && itemHeight <= 120) {
    fontSize = itemHeight;
  } else {
    fontSize = 10.5;
  }

  fontSize = Math.round(fontSize * 10) / 10;
  if (fontSize < 7) fontSize = 10.5;
  if (fontSize > 72) fontSize = 72;

  return fontSize;
}

console.log("Testing identity tx [1, 0, 0, 1, 50, 700] with itemHeight 12:", safeFontSize([1, 0, 0, 1, 50, 700], 12));
console.log("Testing identity tx [1, 0, 0, 1, 50, 700] without height:", safeFontSize([1, 0, 0, 1, 50, 700], null));
console.log("Testing scale tx [14, 0, 0, 14, 50, 700]:", safeFontSize([14, 0, 0, 14, 50, 700], null));
