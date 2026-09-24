const PDFDocument = require("pdfkit");
const fs = require("fs");
const crypto = require("crypto");

const record = {
  id: 1,
  owner_name: "Test Department",
  phone: "1234567890",
  email: "test@example.com",
  total_area: 7651.98,
  created_at: new Date()
};

const doc = new PDFDocument({ 
  margin: 50,
  size: 'A4',
  info: {
    Title: `Land Record - ${record.owner_name}`,
    Author: 'LandSecureX System',
  }
});

const colors = {
  primary: "#0f172a",
  accent: "#0ea5e9",
  text: "#334155",
  lightText: "#64748b",
  border: "#e2e8f0",
  rowBg: "#f8fafc",
  white: "#ffffff"
};

doc.pipe(fs.createWriteStream("test_report.pdf"));

// --- Logic from index.js ---
doc.rect(0, 0, 612, 110).fill(colors.primary);
doc.fillColor(colors.accent).fontSize(28).text("LandSecureX", 50, 35, { characterSpacing: 1 });
doc.fillColor(colors.white).fontSize(9).text("OFFICIAL GOVERNMENT SPATIAL REGISTERY", 50, 72, { characterSpacing: 2 });
doc.fillColor(colors.white).fontSize(8).text("REPORT ID", 450, 35, { align: "right" });
doc.fontSize(12).text(`#LSX-REC-${record.id.toString().padStart(4, '0')}`, 450, 48, { align: "right" });
doc.fontSize(8).text("GENERATED ON", 450, 68, { align: "right" });
doc.fontSize(10).text(new Date().toLocaleString(), 400, 80, { align: "right", width: 162 });

doc.y = 150;
doc.fillColor(colors.primary).fontSize(18).text("Land Record Analysis & Verification", 50, 140);
doc.rect(50, 165, 50, 3).fill(colors.accent);
doc.moveDown(2);

const drawRow = (label, value) => {
  const currentY = doc.y;
  doc.rect(50, currentY, 512, 24).fill(doc.y % 48 === 0 ? colors.white : colors.rowBg);
  doc.fillColor(colors.lightText).fontSize(10).text(label, 65, currentY + 7);
  doc.fillColor(colors.text).fontSize(11).text(value, 200, currentY + 7, { bold: true });
  doc.moveTo(50, currentY + 24).lineTo(562, currentY + 24).strokeColor(colors.border).lineWidth(0.5).stroke();
  doc.y = currentY + 24;
};

doc.fillColor(colors.primary).fontSize(14).text("Ownership Information", 50, 200);
doc.moveDown(0.5);
doc.y = 220;
drawRow("Official Owner", record.owner_name);
drawRow("Contact Number", record.phone || "Not Registered");
drawRow("Contact Email", record.email || "Not Registered");

doc.moveDown(2);
const spatialY = doc.y + 10;
doc.fillColor(colors.primary).fontSize(14).text("Spatial & Geographic Data", 50, spatialY);
doc.moveDown(0.5);
doc.y = spatialY + 20;
drawRow("Total Registered Area", `${record.total_area.toFixed(2)} sq. meters`);
drawRow("Coordinate System", "WGS 84 / Pseudo-Mercator (EPSG:3857)");
drawRow("Registration Date", new Date(record.created_at).toLocaleDateString());

doc.moveDown(2);
doc.fillColor(colors.primary).fontSize(14).text("Digital Map Perspective", 50, doc.y);
doc.moveDown(0.5);
const mapY = doc.y;
doc.rect(50, mapY, 512, 220).strokeColor(colors.border).lineWidth(1).stroke();
doc.rect(55, mapY + 5, 502, 210).fill("#f1f5f9");
doc.strokeColor(colors.border).lineWidth(0.5);
doc.moveTo(306, mapY + 5).lineTo(306, mapY + 215).stroke();
doc.moveTo(55, mapY + 110).lineTo(557, mapY + 110).stroke();
doc.fillColor(colors.lightText).fontSize(9).text("GEOSPATIAL DATA VISUALIZED IN GIS DASHBOARD", 55, mapY + 105, { align: "center", width: 502 });
doc.fontSize(7).text(`CENTER COORDS: [LAT/LNG LOCK]`, 65, mapY + 195);
doc.text(`SCALE: REAL-TIME ADAPTIVE`, 65, mapY + 203);

const footerY = 760;
doc.moveTo(50, footerY).lineTo(562, footerY).strokeColor(colors.border).lineWidth(1).stroke();
doc.rect(50, footerY + 15, 120, 40).fill(colors.rowBg);
doc.fillColor(colors.accent).fontSize(8).text("VERIFIED BY", 60, footerY + 22);
doc.fillColor(colors.primary).fontSize(10).text("LandSecureX AI", 60, footerY + 33);
doc.fillColor(colors.lightText).fontSize(8).text(
  "This document is a computer-generated official record for spatial monitoring purposes. " +
  "The spatial data is property of the respective government departments. Digital signatures are authenticated via LandSecureX core engine.",
  185, footerY + 15, { width: 377, align: "right", lineGap: 2 }
);
doc.fontSize(7).text(`HASH: ${crypto.createHash('md5').update(record.id + record.owner_name).digest('hex').toUpperCase()}`, 185, footerY + 50, { align: "right", width: 377 });

doc.end();
console.log("Test report PDF generated as test_report.pdf");
