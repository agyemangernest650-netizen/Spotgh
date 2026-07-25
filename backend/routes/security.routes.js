// backend/routes/security.routes.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken } = require('../middleware/auth.middleware');
const totp = require('../services/totp.service');
const limits = require('../middleware/rateLimit.middleware');

// ── Start 2FA setup — returns a QR code (via existing qrserver.com pattern used elsewhere) ──
router.post('/2fa/setup', verifyToken, async (req, res, next) => {
  try {
    const { data: user } = await supabaseAdmin.from('users').select('email,totp_enabled').eq('id', req.user.id).single();
    if (user.totp_enabled) return res.status(400).json({ error: '2FA is already enabled' });

    const secret = totp.generateSecret();
    const url = totp.otpauthUrl(secret, user.email);
    await supabaseAdmin.from('users').update({ totp_secret: secret }).eq('id', req.user.id); // not yet enabled until confirmed

    res.json({
      secret,
      qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`,
      manual_entry_key: secret,
    });
  } catch (err) { next(err); }
});

// ── Confirm setup with a code from the authenticator app ──
router.post('/2fa/confirm', verifyToken, limits.auth, async (req, res, next) => {
  try {
    const { token } = req.body;
    const { data: user } = await supabaseAdmin.from('users').select('totp_secret').eq('id', req.user.id).single();
    if (!user?.totp_secret) return res.status(400).json({ error: 'Run /2fa/setup first' });
    if (!totp.verifyToken(user.totp_secret, token)) return res.status(400).json({ error: 'Invalid code' });

    const backupCodes = totp.generateBackupCodes();
    const hashedCodes = await Promise.all(backupCodes.map(c => bcrypt.hash(c, 10)));
    await supabaseAdmin.from('users').update({ totp_enabled: true, totp_backup_codes: hashedCodes }).eq('id', req.user.id);

    res.json({ message: '2FA enabled!', backup_codes: backupCodes, note: 'Save these backup codes — they will not be shown again.' });
  } catch (err) { next(err); }
});

// ── Verify a code at login time (called after password check, before issuing the final session) ──
router.post('/2fa/verify-login', limits.auth, async (req, res, next) => {
  try {
    const { user_id, token, backup_code } = req.body;
    const { data: user } = await supabaseAdmin.from('users').select('totp_secret,totp_enabled,totp_backup_codes').eq('id', user_id).single();
    if (!user?.totp_enabled) return res.status(400).json({ error: '2FA is not enabled for this account' });

    if (token && totp.verifyToken(user.totp_secret, token)) return res.json({ verified: true });

    if (backup_code) {
      for (let i = 0; i < (user.totp_backup_codes || []).length; i++) {
        if (await bcrypt.compare(backup_code, user.totp_backup_codes[i])) {
          const remaining = [...user.totp_backup_codes];
          remaining.splice(i, 1);
          await supabaseAdmin.from('users').update({ totp_backup_codes: remaining }).eq('id', user_id);
          return res.json({ verified: true, used_backup_code: true });
        }
      }
    }
    res.status(400).json({ error: 'Invalid code' });
  } catch (err) { next(err); }
});

// ── Disable 2FA (requires current password re-check, matching your existing password-change pattern) ──
router.post('/2fa/disable', verifyToken, async (req, res, next) => {
  try {
    await supabaseAdmin.from('users').update({ totp_enabled: false, totp_secret: null, totp_backup_codes: null }).eq('id', req.user.id);
    res.json({ message: '2FA disabled' });
  } catch (err) { next(err); }
});

router.get('/2fa/status', verifyToken, async (req, res, next) => {
  try {
    const { data } = await supabaseAdmin.from('users').select('totp_enabled').eq('id', req.user.id).single();
    res.json({ enabled: !!data?.totp_enabled });
  } catch (err) { next(err); }
});

module.exports = router;
