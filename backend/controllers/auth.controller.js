// backend/controllers/auth.controller.js
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { notify } = require('../services/supabase.service');
const { sendEmail, wrap } = require('../services/email.service');
const env  = require('../config/env');

const makeToken = (userId, role, expiresIn) =>
  jwt.sign({ userId, role }, env.JWT_SECRET, { expiresIn: expiresIn || env.JWT_EXPIRES_IN });

const setTokenCookie = (res, token) =>
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure:   env.IS_PROD,
    sameSite: 'strict',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { email, password, full_name, phone, role = 'user' } = req.body;
    if (!email || !password || !full_name)
      return res.status(400).json({ error: 'email, password and full_name are required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
    if (authErr) {
      if (authErr.message.includes('already registered'))
        return res.status(409).json({ error: 'Email already in use' });
      throw authErr;
    }

    // CREATOR_EMAIL (.env) is the one-time bootstrap for admin access —
    // whoever registers with that exact email becomes 'creator'. This is
    // checked after the safeRole whitelist above, so it can't be spoofed
    // by passing role in the request body; it only fires because they
    // actually own (and verified, via Supabase Auth) that specific email.
    const isCreatorEmail = env.CREATOR_EMAIL && email.toLowerCase() === env.CREATOR_EMAIL.toLowerCase();
    const safeRole = isCreatorEmail ? 'creator' : (['user', 'business_owner'].includes(role) ? role : 'user');
    const { data: user, error: dbErr } = await supabaseAdmin
      .from('users')
      .insert({ id: authData.user.id, email, full_name, phone: phone || null, role: safeRole })
      .select().single();
    if (dbErr) throw dbErr;
    require('../services/fraud.service').checkNewUser(user).catch(() => {});

    await notify(user.id, 'success', '🎉 Welcome to SpotGH!',
      'Your account is ready. Browse businesses or add your own.',
      safeRole === 'business_owner' ? '/pricing' : '/directory');

    const token = makeToken(user.id, user.role);
    setTokenCookie(res, token);
    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    });
  } catch (err) { next(err); }
};

// POST /api/auth/oauth/exchange
// The frontend runs Supabase's hosted Google/Facebook OAuth flow directly
// (see login.js), which gives it a Supabase session. We verify that
// session server-side, then either link it to an existing account or
// create a new one — and issue our own JWT cookie exactly like
// register/login do, so the rest of the app doesn't need to know OAuth
// was involved at all.
exports.oauthExchange = async (req, res, next) => {
  try {
    const { access_token } = req.body;
    if (!access_token) return res.status(400).json({ error: 'access_token is required' });

    const { data: authUser, error: authErr } = await supabase.auth.getUser(access_token);
    if (authErr || !authUser?.user) return res.status(401).json({ error: 'Invalid or expired session' });
    const su = authUser.user;
    if (!su.email) return res.status(400).json({ error: 'Your account needs a verified email address to sign in — please allow email access and try again.' });

    let { data: user } = await supabaseAdmin.from('users').select('*').eq('id', su.id).single();
    let isNew = false;

    if (!user) {
      // Same email, different auth identity — e.g. they originally
      // registered with email/password and are now trying Google/Facebook
      // for the first time. users.email is UNIQUE, so without this check
      // the insert below would fail with an opaque DB error instead of a
      // clear message telling them what actually happened.
      const { data: emailMatch } = await supabaseAdmin.from('users').select('id').eq('email', su.email).maybeSingle();
      if (emailMatch) return res.status(409).json({ error: 'An account already exists with this email. Please sign in with your password instead.', code: 'EMAIL_IN_USE' });

      isNew = true;
      const fullName = su.user_metadata?.full_name || su.user_metadata?.name || su.email.split('@')[0];
      const avatarUrl = su.user_metadata?.avatar_url || su.user_metadata?.picture || null;
      const isCreatorEmail = env.CREATOR_EMAIL && su.email.toLowerCase() === env.CREATOR_EMAIL.toLowerCase();
      const { data: created, error: dbErr } = await supabaseAdmin.from('users').insert({
        id: su.id, email: su.email, full_name: fullName, avatar_url: avatarUrl,
        role: isCreatorEmail ? 'creator' : 'user', is_verified: true, // OAuth providers already verify email ownership
      }).select().single();
      if (dbErr) throw dbErr;
      user = created;
    }

    if (!user.is_active) return res.status(403).json({ error: 'Account suspended' });
    if (user.is_banned)  return res.status(403).json({ error: 'Account banned' });

    await supabaseAdmin.from('users').update({
      last_login_at: new Date().toISOString(),
      login_count: (user.login_count || 0) + 1,
    }).eq('id', user.id);

    if (isNew) {
      await notify(user.id, 'success', '🎉 Welcome to SpotGH!',
        'Your account is ready. Browse businesses or add your own.', '/directory');
    }

    const token = makeToken(user.id, user.role);
    setTokenCookie(res, token);
    res.json({
      message: isNew ? 'Account created successfully' : 'Login successful',
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, avatar_url: user.avatar_url },
    });
  } catch (err) { next(err); }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email and password are required' });

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) {
      if (authErr.message && authErr.message.toLowerCase().includes('email not confirmed'))
        return res.status(403).json({ error: 'Please verify your email before logging in. Check your inbox, or request a new link at /api/auth/resend-verification.', code: 'EMAIL_NOT_VERIFIED' });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { data: user, error: dbErr } = await supabaseAdmin
      .from('users').select('*').eq('id', authData.user.id).single();
    if (dbErr || !user) return res.status(404).json({ error: 'User profile not found' });
    if (!user.is_active) return res.status(403).json({ error: 'Account suspended' });
    if (user.is_banned)  return res.status(403).json({ error: 'Account banned' });

    // If 2FA is enabled, don't issue a full session yet — the frontend must call
    // POST /api/security/2fa/verify-login with this pending token + a code first,
    // then exchange it via POST /api/auth/login/2fa-complete below.
    if (user.totp_enabled) {
      const pendingToken = makeToken(user.id, user.role, '5m');
      return res.json({ requires_2fa: true, pending_token: pendingToken, user_id: user.id });
    }

    await supabaseAdmin.from('users').update({
      last_login_at: new Date().toISOString(),
      login_count: (user.login_count || 0) + 1,
    }).eq('id', user.id);

    const token = makeToken(user.id, user.role);
    setTokenCookie(res, token);
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, avatar_url: user.avatar_url },
    });
  } catch (err) { next(err); }
};

// POST /api/auth/login/2fa-complete — exchange a verified pending_token for a real session
exports.completeTwoFactorLogin = async (req, res, next) => {
  try {
    const { pending_token, token, backup_code } = req.body;
    if (!pending_token) return res.status(400).json({ error: 'pending_token is required' });
    let decoded;
    try { decoded = jwt.verify(pending_token, env.JWT_SECRET); }
    catch { return res.status(401).json({ error: 'Login session expired, please sign in again' }); }

    const totp = require('../services/totp.service');
    const bcrypt = require('bcryptjs');
    const { data: user } = await supabaseAdmin.from('users').select('*').eq('id', decoded.userId).single();
    if (!user?.totp_enabled) return res.status(400).json({ error: '2FA is not enabled for this account' });

    let ok = token && totp.verifyToken(user.totp_secret, token);
    if (!ok && backup_code) {
      for (let i = 0; i < (user.totp_backup_codes || []).length; i++) {
        if (await bcrypt.compare(backup_code, user.totp_backup_codes[i])) {
          const remaining = [...user.totp_backup_codes]; remaining.splice(i, 1);
          await supabaseAdmin.from('users').update({ totp_backup_codes: remaining }).eq('id', user.id);
          ok = true; break;
        }
      }
    }
    if (!ok) return res.status(400).json({ error: 'Invalid code' });

    await supabaseAdmin.from('users').update({
      last_login_at: new Date().toISOString(), login_count: (user.login_count || 0) + 1,
    }).eq('id', user.id);

    const sessionToken = makeToken(user.id, user.role);
    setTokenCookie(res, sessionToken);
    res.json({
      message: 'Login successful', token: sessionToken,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, avatar_url: user.avatar_url },
    });
  } catch (err) { next(err); }
};

// POST /api/auth/logout
exports.logout = (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out successfully' });
};

// GET /api/auth/me
exports.me = async (req, res, next) => {
  try {
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id,email,full_name,phone,avatar_url,role,is_verified,referral_code,created_at')
      .eq('id', req.user.id).single();
    if (error) throw error;
    res.json({ user });
  } catch (err) { next(err); }
};

// PATCH /api/auth/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { full_name, phone } = req.body;
    const updates = {};
    if (full_name) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;
    const { data: user, error } = await supabaseAdmin
      .from('users').update(updates).eq('id', req.user.id).select().single();
    if (error) throw error;
    res.json({ user, message: 'Profile updated' });
  } catch (err) { next(err); }
};

// POST /api/auth/forgot-password
// POST /api/auth/forgot-password
// Generates our own short-lived reset token (the frontend's forgot-password.js
// expects to handle a ?token= param itself and POST it to /auth/reset-password —
// Supabase's built-in magic-link flow doesn't match that UI, so we don't use it).
// POST /api/auth/resend-verification
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    // Supabase owns the actual confirmation link/token (set up under
    // Authentication → Email Templates in the Supabase dashboard) — this
    // just re-triggers it rather than building a parallel system.
    await supabase.auth.resend({ type: 'signup', email }).catch(() => {});
    // Same response regardless of outcome, to avoid leaking which emails are registered.
    res.json({ message: 'If that email is registered and not yet verified, a new verification link has been sent.' });
  } catch (err) { next(err); }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const { data: user } = await supabaseAdmin.from('users').select('id,email,full_name').eq('email', email).maybeSingle();

    // Always respond the same way, whether or not the email exists, to avoid leaking which emails are registered.
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await supabaseAdmin.from('users').update({ reset_token_hash: hash, reset_token_expires: expires.toISOString() }).eq('id', user.id);
      const link = `${env.APP_URL}/forgot-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
      await sendEmail(user.email, 'Reset your SpotGH password',
        wrap('Reset your password', `Hi ${user.full_name || 'there'}, click below to set a new password. This link expires in 1 hour. If you didn't request this, you can ignore this email.`,
        'Reset Password', link));
    }
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) { next(err); }
};

// POST /api/auth/reset-password  { token, password }
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and new password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const { data: user } = await supabaseAdmin.from('users').select('id,role').eq('reset_token_hash', hash).gt('reset_token_expires', new Date().toISOString()).maybeSingle();
    if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });

    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password });
    if (pwErr) throw pwErr;
    await supabaseAdmin.from('users').update({ reset_token_hash: null, reset_token_expires: null }).eq('id', user.id);

    const authToken = makeToken(user.id, user.role);
    setTokenCookie(res, authToken);
    res.json({ message: 'Password updated successfully', token: authToken });
  } catch (err) { next(err); }
};

// PATCH /api/auth/password  { current_password, new_password }  (logged-in user changing their own password)
exports.changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Current and new password required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: req.user.email, password: current_password });
    if (verifyErr) return res.status(401).json({ error: 'Current password is incorrect' });

    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(req.user.id, { password: new_password });
    if (pwErr) throw pwErr;
    res.json({ message: 'Password changed successfully' });
  } catch (err) { next(err); }
};
