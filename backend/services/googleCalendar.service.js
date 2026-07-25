// backend/services/googleCalendar.service.js
const { google } = require('googleapis');
const env = require('../config/env');

const isConfigured = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
if (!isConfigured) {
  console.warn('[Google Calendar] GOOGLE_CLIENT_ID/SECRET not set — calendar sync will be unavailable.');
}

const makeOAuthClient = () => new google.auth.OAuth2(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_CALENDAR_REDIRECT_URI
);

// state carries the business ID through the OAuth round-trip so the
// callback knows which business to attach the resulting refresh token to.
const getAuthUrl = (businessId) => {
  const client = makeOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',      // required to get a refresh_token back
    prompt: 'consent',           // force a refresh_token even on re-auth
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: businessId,
  });
};

const exchangeCodeForRefreshToken = async (code) => {
  const client = makeOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens.refresh_token || null; // null if the user had already granted consent before and Google didn't re-issue one
};

// Creates a Calendar event for a booking. Fire-and-forget by design from
// the caller's side — a calendar sync failure should never block a
// booking from succeeding.
const createBookingEvent = async ({ refreshToken, calendarId, business, booking }) => {
  if (!isConfigured || !refreshToken) return null;
  try {
    const client = makeOAuthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const calendar = google.calendar({ version: 'v3', auth: client });

    const start = new Date(`${booking.booking_date}T${booking.booking_time}`);
    const end = new Date(start.getTime() + (booking.duration_minutes || 60) * 60000);

    const { data } = await calendar.events.insert({
      calendarId: calendarId || 'primary',
      requestBody: {
        summary: `${booking.customer_name} — ${business.name}`,
        description: `Booking via SpotGH. Confirmation code: ${booking.confirmation_code}.${booking.notes ? `\n\nNotes: ${booking.notes}` : ''}`,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: booking.customer_email ? [{ email: booking.customer_email }] : [],
      },
    });
    return data.id;
  } catch (err) {
    console.error('[Google Calendar] event creation failed:', err.message);
    return null;
  }
};

module.exports = { isConfigured, getAuthUrl, exchangeCodeForRefreshToken, createBookingEvent };
