const nodemailer = require('nodemailer');

const configured = Boolean(process.env.SMTP_HOST);
const transporter = configured ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined
}) : null;

async function sendMail({ to, subject, text }) {
  if (!transporter) return { sent: false };
  try {
    await transporter.sendMail({ from: process.env.MAIL_FROM || 'LHAS <no-reply@lhas.local>', to, subject, text });
    return { sent: true };
  } catch (err) {
    console.error('Email failed:', err.message);
    return { sent: false };
  }
}

module.exports = { sendMail, mailConfigured: configured };
