// backend/config/env.js
// Central place to validate all environment variables at startup
require('dotenv').config();

// Accept both naming conventions (Supabase docs use SERVICE_ROLE_KEY, our .env.example uses SERVICE_KEY)
if (!process.env.SUPABASE_SERVICE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
}

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
  'JWT_SECRET',
];

const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error('\n❌ Missing required environment variables:');
  missing.forEach(k => console.error(`   - ${k}`));
  console.error('\nCopy .env.example to .env and fill in the values.\n');
  process.exit(1);
}

// In production, a few more variables become hard requirements even though
// they're optional in development. Booting without them wouldn't crash —
// it would silently sign cookies with a guessable default secret, or leave
// the Paystack webhook unable to verify signatures — so we fail loudly instead.
if (process.env.NODE_ENV === 'production') {
  const prodRequired = ['APP_SECRET', 'PAYSTACK_SECRET_KEY'];
  const insecureDefault = !process.env.APP_SECRET || process.env.APP_SECRET === 'change-this-to-a-long-random-string';
  const prodMissing = prodRequired.filter(key => !process.env[key]);
  if (prodMissing.length || insecureDefault) {
    console.error('\n❌ Not safe to run in production:');
    prodMissing.forEach(k => console.error(`   - ${k} is not set`));
    if (insecureDefault && !prodMissing.includes('APP_SECRET')) console.error('   - APP_SECRET is still the example placeholder — generate a real one');
    console.error('\nGenerate a secret with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n');
    process.exit(1);
  }
}

// Auto-detect public URL from Railway / Render if APP_URL not set explicitly
const autoUrl = process.env.RAILWAY_STATIC_URL
  ? `https://${process.env.RAILWAY_STATIC_URL}`
  : process.env.RENDER_EXTERNAL_URL
  ? process.env.RENDER_EXTERNAL_URL
  : null;

module.exports = {
  NODE_ENV:       process.env.NODE_ENV || 'development',
  PORT:           parseInt(process.env.PORT) || 3000,
  APP_URL:        process.env.APP_URL || autoUrl || 'http://localhost:3000',
  APP_NAME:       process.env.APP_NAME || 'SpotGH',
  APP_SECRET:     process.env.APP_SECRET || 'dev-secret',
  // The bare domain customers see in the address bar, e.g. "spotgh.com".
  // A business with slug "buka-restaurant" gets buka-restaurant.spotgh.com
  // once your DNS has a wildcard record (*.spotgh.com) pointing at this server.
  ROOT_DOMAIN:    process.env.ROOT_DOMAIN || 'localhost',

  SUPABASE_URL:         process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY:    process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY:    process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  JWT_SECRET:     process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT) || 587,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM || '"SpotGH" <noreply@spotgh.com>',

  PAYSTACK_PUBLIC_KEY:      process.env.PAYSTACK_PUBLIC_KEY || '',
  PAYSTACK_SECRET_KEY:      process.env.PAYSTACK_SECRET_KEY || '',
  HCAPTCHA_SECRET:          process.env.HCAPTCHA_SECRET || '',
  HCAPTCHA_SITE_KEY:        process.env.HCAPTCHA_SITE_KEY || '',

  ARKESEL_API_KEY:   process.env.ARKESEL_API_KEY || '',
  ARKESEL_SENDER_ID: process.env.ARKESEL_SENDER_ID || 'SpotGH',

  ANTHROPIC_API_KEY:   process.env.ANTHROPIC_API_KEY || '',
  GOOGLE_CLIENT_ID:      process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET:  process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALENDAR_REDIRECT_URI: process.env.GOOGLE_CALENDAR_REDIRECT_URI || '',
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',
  GA_TRACKING_ID:      process.env.GA_TRACKING_ID || '',
  CREATOR_EMAIL:       process.env.CREATOR_EMAIL || '',

  IS_PROD: process.env.NODE_ENV === 'production',
  IS_DEV:  process.env.NODE_ENV !== 'production',
};
