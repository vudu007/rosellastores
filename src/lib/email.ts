import nodemailer from 'nodemailer';
import { EODReport } from '@/types';

function getEmailCredentials() {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER || process.env.EMAIL_USER || null;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_APP_PASSWORD || null;
  return { user, pass };
}

function createTransporter() {
  const { user, pass } = getEmailCredentials();
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: user ?? undefined, pass: pass ?? undefined },
  });
}

function getFromEmail() {
  return process.env.GMAIL_FROM || getEmailCredentials().user || 'Rosellla Stores <noreply@gmail.com>';
}

export function getEmailConfigError(): string | null {
  const vercelEnv = process.env.VERCEL_ENV;
  const prefix = vercelEnv ? `Email not configured (VERCEL_ENV=${vercelEnv}): ` : 'Email not configured: ';
  const { user, pass } = getEmailCredentials();
  if (!user) return `${prefix}missing GMAIL_USER`;
  if (!pass) return `${prefix}missing GMAIL_APP_PASSWORD`;
  return null;
}

export function generateEODEmailHTML(report: EODReport, businessName: string): string {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-NG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; color: #333; }
        .container { max-width: 800px; margin: 0 auto; background: #f9fafb; padding: 20px; }
        .email-wrapper { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #E11D48 0%, #BE123C 100%); color: white; padding: 40px 20px; text-align: center; }
        .header h1 { font-size: 28px; margin-bottom: 5px; }
        .header p { font-size: 14px; opacity: 0.9; }
        .content { padding: 40px 20px; }
        .date-stamp { text-align: center; color: #6B7280; font-size: 14px; margin-bottom: 30px; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 40px; }
        .stat-card { background: #f3f4f6; border-left: 4px solid #E11D48; padding: 20px; border-radius: 8px; }
        .stat-label { font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
        .stat-value { font-size: 24px; font-weight: bold; color: #1F2937; }
        .section { margin-bottom: 40px; }
        .section-title { font-size: 16px; font-weight: 600; color: #1F2937; margin-bottom: 20px; border-bottom: 2px solid #E5E7EB; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #F3F4F6; padding: 12px; text-align: left; font-weight: 600; font-size: 13px; color: #4B5563; border-bottom: 1px solid #E5E7EB; }
        td { padding: 12px; border-bottom: 1px solid #F3F4F6; font-size: 14px; }
        tr:last-child td { border-bottom: none; }
        .text-right { text-align: right; }
        .text-success { color: #10B981; font-weight: 500; }
        .text-warning { color: #F59E0B; font-weight: 500; }
        .alert-box { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin-bottom: 20px; border-radius: 4px; font-size: 13px; color: #92400E; }
        .comparison { background: #F0FDF4; padding: 15px; border-radius: 8px; margin-top: 15px; }
        .comparison-stat { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
        .footer { background: #F9FAFB; padding: 20px; text-align: center; font-size: 12px; color: #6B7280; border-top: 1px solid #E5E7EB; }
        .empty-state { text-align: center; color: #9CA3AF; padding: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="email-wrapper">
          <div class="header">
            <h1>${businessName}</h1>
            <p>End of Day Report</p>
          </div>

          <div class="content">
            <div class="date-stamp">${formatDate(new Date())}</div>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Total Sales</div>
                <div class="stat-value">${report.totalSalesCount}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Total Revenue</div>
                <div class="stat-value" style="color: #10B981;">${formatCurrency(report.totalRevenue)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Total Discounts</div>
                <div class="stat-value">${formatCurrency(report.totalDiscounts)}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Total Expenses</div>
                <div class="stat-value">${formatCurrency(report.totalExpenses)}</div>
              </div>
            </div>

            ${report.lowStockItems.length > 0 ? `
              <div class="alert-box">
                <strong>⚠️ Stock Alert:</strong> ${report.lowStockItems.length} product(s) below minimum threshold
              </div>
            ` : ''}

            <div class="section">
              <div class="section-title">Payment Method Breakdown</div>
              <table>
                <thead>
                  <tr>
                    <th>Payment Method</th>
                    <th class="text-right">Count</th>
                    <th class="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(report.paymentMethodBreakdown).map(([method, data]) => `
                    <tr>
                      <td>${method.replace(/_/g, ' ')}</td>
                      <td class="text-right">${data.count}</td>
                      <td class="text-right text-success">${formatCurrency(data.total)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div class="section">
              <div class="section-title">Top 5 Products</div>
              ${report.topProducts.length > 0 ? `
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th class="text-right">Quantity Sold</th>
                      <th class="text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${report.topProducts.map(product => `
                      <tr>
                        <td>${product.name}</td>
                        <td class="text-right">${product.quantity}</td>
                        <td class="text-right">${formatCurrency(product.revenue)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : '<div class="empty-state">No products sold today</div>'}
            </div>

            ${report.lowStockItems.length > 0 ? `
              <div class="section">
                <div class="section-title">Low Stock Items</div>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th class="text-right">Current Stock</th>
                      <th class="text-right">Threshold</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${report.lowStockItems.map(item => `
                      <tr>
                        <td>${item.name}</td>
                        <td class="text-right text-warning">${item.stockQty}</td>
                        <td class="text-right">${item.lowStockThreshold}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}

            <div class="section">
              <div class="section-title">Day Comparison</div>
              <div class="comparison">
                <div class="comparison-stat">
                  <span>Today's Sales</span>
                  <span class="text-success">${report.totalSalesCount}</span>
                </div>
                <div class="comparison-stat">
                  <span>Yesterday's Sales</span>
                  <span>${report.previousDaySalesCount}</span>
                </div>
                <div class="comparison-stat">
                  <span>Change</span>
                  <span style="color: ${report.totalSalesCount >= report.previousDaySalesCount ? '#10B981' : '#EF4444'};">
                    ${report.totalSalesCount - report.previousDaySalesCount > 0 ? '+' : ''}${report.totalSalesCount - report.previousDaySalesCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>This is an automated end-of-day report. Please do not reply to this email.</p>
            <p>© ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: Buffer; contentType: string }[]
): Promise<boolean> {
  const configError = getEmailConfigError();
  if (configError) {
    console.warn(configError, { to, subject });
    return false;
  }

  try {
    const mailOptions: any = {
      from: getFromEmail(),
      to,
      subject,
      html,
    };

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      }));
    }

    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}`);
    return true;
  } catch (err) {
    console.error('Error sending email via Gmail SMTP:', err);
    return false;
  }
}
