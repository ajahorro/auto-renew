const nodemailer = require("nodemailer");
require("dotenv").config();

async function test() {
  console.log("Testing SMTP with:", process.env.SMTP_USER);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });

  try {
    await transporter.verify();
    console.log("SMTP Connection successful!");
    
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.SMTP_USER, // send to self
      subject: "RENEW SMTP Test",
      text: "If you receive this, SMTP is working."
    });
    console.log("Email sent:", info.messageId);
  } catch (error) {
    console.error("SMTP Test failed:", error);
  }
}

test();
