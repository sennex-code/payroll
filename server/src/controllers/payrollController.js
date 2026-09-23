import {
  getPayrollByEmployee,
  getPayrollForBulk,
} from "./employeeController.js";
import emailService from "../services/emailService.js";
import pool from "../config/db.js";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

// --- HELPERS ---

const getBase64Image = (fileName) => {
  try {
    const filePath = path.join(process.cwd(), "public", "images", fileName);
    const bitmap = fs.readFileSync(filePath);
    return `data:image/png;base64,${bitmap.toString("base64")}`;
  } catch (error) {
    console.error(`Error loading image ${fileName}:`, error);
    return "";
  }
};

/**
 * Shared logic to generate PDF and send Email
 * Reused by both single and bulk functions
 */
const processSinglePayslip = async (payrollRecord, period, browser) => {
  const fmtPeso = (n) =>
    `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const payPeriodLabel = new Date(
    payrollRecord.period_start || `${period}-01`,
  ).toLocaleString("default", { month: "long", year: "numeric" });

  // Data Prep: Deductions
  let deductionItems = payrollRecord.deduction_reasons
    ? String(payrollRecord.deduction_reasons)
        .split(" | ")
        .map((line) => {
          const [label, amount] = line.split("=").map((p) => p?.trim());
          return { label: label || line, amount: amount || "" };
        })
    : [];

  const totalAbsenceVal = Number(payrollRecord.absence_deductions || 0);
  if (totalAbsenceVal > 0) {
    const alreadyListed = deductionItems.some(
      (item) =>
        item.label.toLowerCase().includes("absence") ||
        item.label.toLowerCase().includes("undertime"),
    );
    if (!alreadyListed) {
      deductionItems.unshift({
        label: "Absences / Undertime",
        amount: fmtPeso(totalAbsenceVal),
      });
    }
  }

  // Data Prep: Incentives
  const incentiveLines = payrollRecord.incentive_reasons
    ? String(payrollRecord.incentive_reasons)
        .split(" | ")
        .filter(Boolean)
        .join(", ")
    : "Incentives";

  const logoBase64 = getBase64Image("wah-logo.png");
  const topLogoBase64 = getBase64Image("wah-top-logo.png");

  // PDF Generation
  const page = await browser.newPage();
  const pdfHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { size: A4; margin: 0; }
          * { -webkit-print-color-adjust: exact; box-sizing: border-box; }
          body { font-family: 'Courier New', Courier, monospace; margin: 0; padding: 40px; background: white; color: #1e293b; }
          .print-container { width: 100%; border: 1.5px solid #334155; position: relative; min-height: 900px; }
          .header { display: flex; align-items: center; border-bottom: 1px solid #334155; padding: 15px; }
          .header-text { flex-grow: 1; text-align: center; font-size: 16px; font-weight: bold; }
          .info-section { border-bottom: 1px solid #334155; padding: 15px; font-size: 14px; }
          .grid-container { display: flex; width: 100%; border-bottom: 1px solid #334155; }
          .column { width: 50%; padding: 15px; }
          .column-left { border-right: 1px solid #334155; }
          .col-title { font-weight: bold; margin-bottom: 10px; display: flex; justify-content: space-between; font-size: 13px; }
          .line-item { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px; }
          .summary-section { padding: 30px 20px; }
          .summary-table { margin: 0 auto; width: 70%; }
          .summary-line { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .net-pay { margin-top: 15px; padding-top: 10px; border-top: 2px solid #334155; font-weight: bold; font-size: 18px; display: flex; justify-content: space-between; }
          .footer-note { text-align: center; font-size: 11px; padding: 15px; color: #64748b; position: absolute; bottom: 0; width: 100%; }
          .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.06; width: 450px; z-index: 0; }
          .content-layer { position: relative; z-index: 10; }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${logoBase64 ? `<img src="${logoBase64}" class="watermark" />` : ""}
          <div class="content-layer">
            <div class="header">
              ${topLogoBase64 ? `<img src="${topLogoBase64}" style="width: 120px;" />` : ""}
              <div class="header-text">Wireless for Health Initiative, Inc.</div>
            </div>
            <div class="info-section">
              <div><strong>PAYROLL PERIOD:</strong> ${payPeriodLabel}</div>
              <div><strong>EMPLOYEE NAME:</strong> ${payrollRecord.last_name}, ${payrollRecord.first_name}</div>
            </div>
            <div class="grid-container">
              <div class="column column-left">
                <div class="col-title"><span>EARNINGS & ALLOWANCES</span><span>PHP</span></div>
                <div class="line-item"><span>Basic Pay</span><span>${fmtPeso(payrollRecord.basic_pay)}</span></div>
                ${Number(payrollRecord.incentives) > 0 ? `<div class="line-item"><span>${incentiveLines}</span><span>${fmtPeso(payrollRecord.incentives)}</span></div>` : ""}
              </div>
              <div class="column">
                <div class="col-title"><span>DEDUCTIONS (IOU)</span><span>PHP</span></div>
                ${
                  deductionItems.length > 0
                    ? deductionItems
                        .map(
                          (i) =>
                            `<div class="line-item"><span>${i.label}</span><span>${i.amount}</span></div>`,
                        )
                        .join("")
                    : `<div class="line-item"><span>None</span><span>₱0.00</span></div>`
                }
              </div>
            </div>
            <div class="summary-section">
              <div class="summary-table">
                <div class="summary-line" style="font-weight:bold;"><span>PAY SUMMARY</span><span>PHP</span></div>
                <div class="summary-line"><span>Total Gross</span><span>${fmtPeso(payrollRecord.gross_pay)}</span></div>
                <div class="summary-line"><span>Total Deductions</span><span>${fmtPeso(payrollRecord.absence_deductions)}</span></div>
                <div class="net-pay"><span>NET SALARY & WAGES:</span><span>${fmtPeso(payrollRecord.net_pay)}</span></div>
              </div>
            </div>
            <div class="footer-note">*** WAH Confidential - Maximum Restrictions ***</div>
          </div>
        </div>
      </body>
      </html>
    `;

  await page.setContent(pdfHtmlContent, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
  await page.close();

  // Email Sending
  return await emailService.send({
    to: payrollRecord.email,
    subject: `Payslip for ${payPeriodLabel}`,
    html: `
       <div style="font-family: sans-serif; color: #333; line-height: 1.5;">
  <p>Good day!</p>
  
  <p>Kindly see the attached <b>Payslip</b> for your reference.</p>
  <p>You can also see the payslip in <b>WahPayroll.com</b></p>
  
  <p>If you have any concerns, please don't hesitate to let me know.</p>
  
  <p style="margin-bottom: 0;">--</p>
  
  <div style="margin-top: 5px;">
    <strong style="color: #1a3a5f;">Finance Team</strong><br>
    <strong style="color: #2b78c5; font-size: 1.1em;">Wireless Access for Health Initiative Inc. (WAH)</strong>
  </div>

  <div style="margin-top: 15px; font-size: 0.9em; color: #666;">
    2nd Floor, Diwa ng Tarlac, Romulo Blvd.<br>
    San Vicente, Tarlac City 2300<br>
    Web: <a href="http://www.wah.ph" style="color: #2b78c5;">www.wah.ph</a><br>
    Facebook: <a href="http://www.facebook.com/wah.ph" style="color: #2b78c5;">http://www.facebook.com/wah.ph</a><br>
    Linkedin: <a href="https://linkedin.com/company/wahteam" style="color: #2b78c5;">linkedin.com/company/wahteam</a><br>
    Telefax: +6345 985 5607<br>
    Mobile: +63917 529 7095 / +63998 565 1432
  </div>

  <div style="margin-top: 30px; font-size: 0.75em; color: #444; border-top: 1px solid #eee; pt: 10px; text-align: justify;">
    <strong>CONFIDENTIALITY NOTICE:</strong> This email message, including any attachments, is for the sole use of the intended recipient(s) and may contain confidential and/or privileged information. Any unauthorized review, use or disclosure, or distribution is prohibited. If you are not the intended recipient, please contact the sender immediately and destroy all copies of the original message.
  </div>
</div>`,
    attachments: [
      {
        filename: `Payslip_${payrollRecord.last_name}_${period}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
};

// --- EXPORTED CONTROLLERS ---

export const sendBulkPayslips = async (req, res) => {
  let browser;
  try {
    const { period } = req.body;
    const payrolls = await getPayrollForBulk(pool, period);

    if (!payrolls || payrolls.length === 0) {
      return res
        .status(404)
        .json({ message: "No payroll records found for this period." });
    }

    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    let successCount = 0;
    let failureCount = 0;

    for (const record of payrolls) {
      try {
        if (!record.email) {
          failureCount++;
          continue;
        }
        await processSinglePayslip(record, period, browser);
        successCount++;
      } catch (err) {
        console.error(`Failed to send to ${record.last_name}:`, err);
        failureCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk processing complete.`,
      details: { sent: successCount, failed: failureCount },
    });
  } catch (error) {
    console.error("Bulk Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    if (browser) await browser.close();
  }
};

export const sendPayslip = async (req, res) => {
  let browser;
  try {
    const { emp_id } = req.params;
    const { period } = req.body;

    const payrollRecord = await getPayrollByEmployee(pool, emp_id, period);

    if (!payrollRecord)
      return res.status(404).json({ message: "Payroll record not found" });
    if (!payrollRecord.email)
      return res.status(400).json({ message: "Employee email not found." });

    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    await processSinglePayslip(payrollRecord, period, browser);

    res
      .status(200)
      .json({ success: true, message: "Payslip sent successfully." });
  } catch (error) {
    console.error("Single Send Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    if (browser) await browser.close();
  }
};
