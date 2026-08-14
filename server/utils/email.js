import nodemailer from 'nodemailer';

// ============================================================================
// [SECURITY - MED-04]: Flexible Production / Development Email Delivery Service
// ============================================================================
// PROBLEM SOLVED:
// Previously, the app relied exclusively on Ethereal test accounts (`nodemailer.createTestAccount()`),
// which meant real emails were NEVER delivered to user inboxes in production.
//
// SOLUTION:
// 1. Production Mode: When `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are provided in .env
//    (e.g., SendGrid, Resend, Mailgun, or Gmail SMTP), Nodemailer delivers REAL emails.
// 2. Development Mode: If SMTP keys are absent, it falls back to Ethereal mock transport
//    and prints a preview link in the terminal console so local dev works seamlessly.
// ============================================================================
export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    let transporter;

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      // Production Transporter — Connects to real SMTP service
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      console.log('📧 [EMAIL]: Using Production SMTP Transporter (%s)', process.env.SMTP_HOST);
    } else {
      // Local Dev Fallback — Ethereal test account (logs preview link in terminal)
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.warn('⚠️ [EMAIL]: Real SMTP credentials not found in .env — using Ethereal test transport.');
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || '"ResearchHub Communities" <no-reply@researchhub.com>',
      to,
      subject,
      text,
      html: html || text,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email sent to %s. Message ID: %s', to, info.messageId);
    
    // Print Ethereal preview link only in development mode
    if (!process.env.SMTP_HOST) {
      console.log('🔗 Dev Email Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }

    return true;
  } catch (err) {
    console.error('❌ Failed to send email:', err);
    return false;
  }
};
