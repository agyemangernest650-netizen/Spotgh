// backend/services/supabase.service.js
// Reusable database helpers used across controllers
const { supabaseAdmin } = require('../config/supabase');
const slugify = require('slugify');

// ── Slug Generator ────────────────────────────────────────
const generateSlug = async (name, table = 'businesses') => {
  const base = slugify(name, { lower: true, strict: true });
  let slug = base, count = 0;
  while (true) {
    const { data } = await supabaseAdmin.from(table).select('id').eq('slug', slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${++count}`;
  }
  return slug;
};

// ── Notification Helper ───────────────────────────────────
const notify = async (userId, type, title, message, actionUrl = null) => {
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: userId, type, title, message, action_url: actionUrl,
    });
  } catch (err) {
    console.error('[Notify]', err.message);
  }
};

// ── Audit Log Helper ──────────────────────────────────────
const audit = async (actorId, action, entityType, entityId, oldData, newData, req = {}) => {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: actorId,
      actor_role: req.user?.role || 'system',
      action, entity_type: entityType, entity_id: entityId,
      old_data: oldData, new_data: newData,
      ip_address: req.ip || null,
      user_agent: req.headers?.['user-agent'] || null,
    });
  } catch (err) {
    console.error('[Audit]', err.message);
  }
};

// ── Business Health Score ─────────────────────────────────
const calcHealthScore = (biz) => {
  const checks = [
    { key: 'name',        pts: 5,  label: 'Business name' },
    { key: 'description', pts: 8,  label: 'Description' },
    { key: 'tagline',     pts: 3,  label: 'Tagline' },
    { key: 'logo_url',    pts: 8,  label: 'Logo' },
    { key: 'cover_url',   pts: 5,  label: 'Cover photo' },
    { key: 'phone',       pts: 3,  label: 'Phone' },
    { key: 'whatsapp',    pts: 3,  label: 'WhatsApp' },
    { key: 'address',     pts: 3,  label: 'Address' },
    { key: 'city',        pts: 2,  label: 'City' },
  ];
  const scores = checks.map(c => ({ ...c, earned: biz[c.key] ? c.pts : 0 }));
  const galPts  = Math.min(15, (biz.gallery_count  || 0) * 3);
  const psPts   = Math.min(15, ((biz.product_count || 0) + (biz.service_count || 0)) * 3);
  const revPts  = Math.min(20, (biz.review_count   || 0) * 4);
  const ratPts  = biz.avg_rating >= 4.5 ? 10 : biz.avg_rating >= 4 ? 7 : biz.avg_rating >= 3.5 ? 4 : 0;
  scores.push({ label: 'Gallery photos',      pts: 15, earned: galPts  });
  scores.push({ label: 'Products & Services', pts: 15, earned: psPts   });
  scores.push({ label: 'Reviews',             pts: 20, earned: revPts  });
  scores.push({ label: 'Rating quality',      pts: 10, earned: ratPts  });
  const total   = scores.reduce((s, i) => s + i.pts,    0);
  const earned  = scores.reduce((s, i) => s + i.earned, 0);
  const score   = Math.round((earned / total) * 100);
  const grade   = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  const label   = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Fair' : score >= 40 ? 'Needs Work' : 'Poor';
  const tips    = scores.filter(s => s.earned === 0).map(s => `Add your ${s.label.toLowerCase()}`).slice(0, 5);
  return { score, grade, label, scores, tips };
};

// ── Search Filter Sanitizer ────────────────────────────────
// Any time user input is interpolated into a PostgREST filter string (e.g.
// supabase-js's .or(`name.ilike.%${search}%,...`)), characters that are
// syntactically meaningful to PostgREST — comma (separates conditions),
// parentheses (grouping), and the leading/trailing whitespace — let an
// attacker break out of the intended ilike clause and inject extra filter
// conditions of their own (e.g. search=",id.eq.<uuid>" or a crafted string
// that turns the query into one that returns unrelated rows). Strip them
// before building any .or()/.filter() string. This does not affect normal
// search terms, which don't legitimately contain these characters.
const sanitizeSearchTerm = (term) =>
  String(term).replace(/[,().]/g, ' ').trim().slice(0, 200);

// ── Pagination Helper ─────────────────────────────────────
const paginate = (page = 1, limit = 12) => {
  const p   = Math.max(1, parseInt(page));
  const l   = Math.min(50, Math.max(1, parseInt(limit)));
  const offset = (p - 1) * l;
  return { page: p, limit: l, offset, from: offset, to: offset + l - 1 };
};

module.exports = { generateSlug, notify, audit, calcHealthScore, paginate, sanitizeSearchTerm, supabaseAdmin };
