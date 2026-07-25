// backend/services/sms.service.js
const axios = require('axios');
const env = require('../config/env');

const isConfigured = !!env.ARKESEL_API_KEY;
if (!isConfigured) {
  console.warn('[SMS] ARKESEL_API_KEY not set — SMS will be skipped, only in-app/email notifications will fire.');
}

// Ghana numbers only, in the +233XXXXXXXXX format Arkesel expects.
const toArkeselFormat = (phone) => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('233')) return digits;
  if (digits.startsWith('0'))   return '233' + digits.slice(1);
  return null; // not a recognizable Ghana number — don't guess
};

// Fire-and-forget by design, same as sendEmail: a notification-delivery
// failure should never break the request that triggered it (e.g. a booking
// still succeeds even if the SMS provider is down).
const sendSMS = async (phone, message) => {
  if (!isConfigured) return;
  const recipient = toArkeselFormat(phone);
  if (!recipient) return;
  try {
    await axios.post('https://sms.arkesel.com/api/v2/sms/send', {
      sender: env.ARKESEL_SENDER_ID,
      message,
      recipients: [recipient],
    }, {
      headers: { 'api-key': env.ARKESEL_API_KEY },
      timeout: 8000,
    });
  } catch (err) {
    console.error('[SMS] send failed:', err.response?.data || err.message);
  }
};

module.exports = { sendSMS };
