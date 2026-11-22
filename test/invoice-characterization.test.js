'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

function makeBilledOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 1,
    date: '01/06/2026',
    customer: 'Characterization customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('Invoice figures match checkout HSN GST and billed total', function () {
  const order = makeBilledOrder([
    { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ]);

  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.tax, order.tax);
  assert.equal(invoiceFigures.cgst, 2.5);
  assert.equal(invoiceFigures.sgst, 2.5);
  assert.equal(invoiceFigures.total, order.total);
});

test('Invoice figures use checkout coupon base and maximum discount', function () {
  const order = makeBilledOrder([
    { id: 2, sku: 'RICE-5K', name: 'Bulk rice', hsn: '1006', price: 5000, qty: 1 }
  ], 'SAVE10');

  const invoiceFigures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 150);
  assert.equal(order.tax, 242.5);
  assert.equal(order.total, 5092.5);
  assert.equal(invoiceFigures.discount, order.discount);
  assert.equal(invoiceFigures.tax, order.tax);
  assert.equal(invoiceFigures.total, order.total);
});

test('GST reconciliation reports a match for billed invoice figures', function () {
  const order = makeBilledOrder([
    { id: 3, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ]);
  const db = { orders: [order] };

  const reconciliation = reports.getGstReconciliation(db);

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.rows[0].ledgerTotal, 105);
  assert.equal(reconciliation.rows[0].invoiceTotal, 105);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);
});
