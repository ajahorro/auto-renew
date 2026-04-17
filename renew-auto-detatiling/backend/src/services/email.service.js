const nodemailer = require("nodemailer");
const prisma = require("../config/prisma");

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  const settings = await prisma.businessSettings.findFirst();

  if (settings?.smtpHost && settings?.smtpPort && settings?.smtpUser && settings?.smtpPassword) {
    transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpPort === 465,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPassword
      }
    });
  } else {
    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
    const smtpPass = process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD;
    
    if (smtpUser && smtpPass) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });
    }
  }

  return transporter;
}

async function sendEmail(to, subject, html) {
  try {
    const transport = await getTransporter();
    
    if (!transport) {
      console.log(`[EMAIL MOCK] To: ${to}, Subject: ${subject}`);
      console.log(`[EMAIL MOCK] Body: ${html}`);
      return { success: true, messageId: "mock-" + Date.now() };
    }

    const settings = await prisma.businessSettings.findFirst();
    const fromEmail = settings?.smtpFrom || process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_USER;

    const info = await transport.sendMail({
      from: fromEmail,
      to,
      subject,
      html
    });

    console.log(`Email sent: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Email error:", error.message);
    console.log(`[EMAIL FALLBACK] To: ${to}, Subject: ${subject}`);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendEmail
};