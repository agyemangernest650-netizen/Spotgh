// backend/services/fraud.service.js
// Lightweight rule-based fraud signals — no ML, just heuristics that are cheap
// to run inline after key actions (order placed, review posted, account created).
const { supabaseAdmin } = require('../config/supabase');

async function flag(entityType, entityId, reason, severity = 'low') {
  await supabaseAdmin.from('fraud_flags').insert({ entity_type: entityType, entity_id: entityId, reason, severity });
}

// Call after an order is placed
async function checkOrder(order) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // last hour
  const { count } = await supabaseAdmin.from('orders').select('id', { count: 'exact', head: true })
    .eq('customer_phone', order.customer_phone).gte('created_at', since);
  if (count >= 5) await flag('order', order.id, `${count} orders from the same phone number in the last hour`, 'medium');
  if (Number(order.total) > 5000) await flag('order', order.id, `Unusually large order total: GH₵${order.total}`, 'low');
}

// Call after a review is posted
async function checkReview(review) {
  if (review.rating === 5 && review.content && review.content.length < 12) await flag('review', review.id, 'Very short 5-star review — possible incentivized/fake review pattern', 'low');
}

// Call after a new user signs up
async function checkNewUser(user) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const domain = (user.email || '').split('@')[1];
  if (domain) {
    const { count } = await supabaseAdmin.from('users').select('id', { count: 'exact', head: true })
      .ilike('email', `%@${domain}`).gte('created_at', since);
    if (count >= 10) await flag('user', user.id, `${count} signups from @${domain} in the last 24h`, 'low');
  }
}

module.exports = { flag, checkOrder, checkReview, checkNewUser };
