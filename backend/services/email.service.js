// backend/services/email.service.js
const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;
if (env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_PORT === 465,
    auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASS },
  });
} else {
  console.warn('[Email] EMAIL_HOST/EMAIL_USER/EMAIL_PASS not set — emails will be skipped, only in-app notifications will fire.');
}

const sendEmail = async (to, subject, html) => {
  if (!transporter || !to) return;
  try {
    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, html });
  } catch (err) {
    console.error('[Email]', err.message);
  }
};

const wrap = (title, bodyHtml, ctaText, ctaUrl) => `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1A1917">
    <h2 style="font-family:Arial,sans-serif;color:#4E0DAD;margin-bottom:4px">SpotGH</h2>
    <h3 style="margin:16px 0 8px">${title}</h3>
    <div style="font-size:14px;line-height:1.6;color:#4A4845">${bodyHtml}</div>
    ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#4E0DAD;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">${ctaText || 'View'}</a>` : ''}
    <p style="margin-top:32px;font-size:12px;color:#7A7874">SpotGH · Connecting Ghana's businesses to customers.</p>
  </div>`;

module.exports = { sendEmail, wrap };
