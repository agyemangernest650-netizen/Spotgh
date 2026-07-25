// backend/routes/invoices.routes.js
const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireOwnership } = require('../middleware/auth.middleware');

// ── Generate an invoice record from a completed order (owner) ──
router.post('/from-order/:orderId', verifyToken, async (req, res, next) => {
  try {
    const { data: order } = await supabaseAdmin.from('orders')
      .select('*,businesses(id,owner_id,name),order_items(quantity,price_snapshot,name_snapshot)').eq('id', req.params.orderId).single();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.businesses?.owner_id !== req.user.id && req.user.role !== 'creator')
      return res.status(403).json({ error: 'Not your business' });

    const { data: existing } = await supabaseAdmin.from('invoices').select('id').eq('order_id', order.id).maybeSingle();
    if (existing) return res.json({ invoice_id: existing.id, message: 'Invoice already exists for this order' });

    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    const lineItems = (order.order_items || []).map(i => ({ name: i.name_snapshot, qty: i.quantity, unit_price: i.price_snapshot, total: i.quantity * i.price_snapshot }));

    const { data: invoice, error } = await supabaseAdmin.from('invoices').insert({
      invoice_number: invoiceNumber, order_id: order.id, business_id: order.business_id,
      customer_name: order.customer_name, customer_email: order.customer_email, customer_phone: order.customer_phone,
      line_items: lineItems, subtotal: order.subtotal, discount_amount: order.discount_amount || 0,
      total: order.total, status: 'paid',
    }).select().single();
    if (error) throw error;
    res.status(201).json({ invoice });
  } catch (err) { next(err); }
});

// ── List a business's invoices (owner) ────────────────────────
router.get('/business/:businessId', verifyToken, requireOwnership, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('invoices').select('*').eq('business_id', req.params.businessId).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    res.json({ invoices: data });
  } catch (err) { next(err); }
});

// ── Fetch one invoice as JSON (used by the printable view) ────
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('invoices').select('*,businesses(name,logo_url,phone,email,address,city)').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ invoice: data });
  } catch (err) { next(err); }
});

// ── Printable HTML receipt (opens in browser, "Print > Save as PDF") ──
router.get('/:id/print', async (req, res, next) => {
  try {
    const { data: inv } = await supabaseAdmin.from('invoices').select('*,businesses(name,logo_url,phone,email,address,city)').eq('id', req.params.id).single();
    if (!inv) return res.status(404).send('Invoice not found');
    const rows = (inv.line_items || []).map(i => `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">GH₵${Number(i.unit_price).toFixed(2)}</td><td style="text-align:right">GH₵${Number(i.total).toFixed(2)}</td></tr>`).join('');
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${inv.invoice_number}</title>
      <style>body{font-family:Arial,sans-serif;max-width:640px;margin:2rem auto;color:#222}
      h1{font-size:1.4rem}table{width:100%;border-collapse:collapse;margin-top:1.5rem}
      th,td{padding:.5rem;border-bottom:1px solid #eee;font-size:.9rem}th{text-align:left;color:#888;font-weight:600}
      .totals{margin-top:1rem;text-align:right}.totals div{margin:.25rem 0}
      .grand{font-weight:800;font-size:1.1rem;border-top:2px solid #222;padding-top:.5rem}
      @media print{body{margin:0}}</style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>${inv.businesses?.logo_url ? `<img src="${inv.businesses.logo_url}" style="height:48px">` : ''}<h1>${inv.businesses?.name || ''}</h1>
        <p style="color:#666;font-size:.85rem">${inv.businesses?.address || ''} ${inv.businesses?.city || ''}<br>${inv.businesses?.phone || ''} ${inv.businesses?.email || ''}</p></div>
        <div style="text-align:right"><h2>INVOICE</h2><p style="font-size:.85rem;color:#666">${inv.invoice_number}<br>${new Date(inv.created_at).toLocaleDateString('en-GB')}</p></div>
      </div>
      <p><strong>Billed to:</strong> ${inv.customer_name}${inv.customer_phone ? ` · ${inv.customer_phone}` : ''}</p>
      <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals">
        <div>Subtotal: GH₵${Number(inv.subtotal).toFixed(2)}</div>
        ${inv.discount_amount ? `<div>Discount: -GH₵${Number(inv.discount_amount).toFixed(2)}</div>` : ''}
        ${inv.tax_amount ? `<div>Tax: GH₵${Number(inv.tax_amount).toFixed(2)}</div>` : ''}
        <div class="grand">Total: GH₵${Number(inv.total).toFixed(2)}</div>
      </div>
      <p style="margin-top:2rem;font-size:.75rem;color:#999;text-align:center">Generated by SpotGH · spotgh.com</p>
      <script>window.onload=()=>window.print()</script>
      </body></html>`);
  } catch (err) { next(err); }
});

module.exports = router;
