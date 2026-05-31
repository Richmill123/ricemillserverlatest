import Billing from '../models/billingModel.js';
import asyncHandler from 'express-async-handler';

// @desc    Create a new invoice
// @route   POST /api/billing
// @access  Private
const createInvoice = asyncHandler(async (req, res) => {
  const {
    customerName,
    billNumber,
    items,
    totalAmount,
    status,
    date,
    notes,
    clientId,
    createdAt,
  } = req.body;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  if (!customerName || !String(customerName).trim()) {
    res.status(400);
    throw new Error('Customer name is required');
  }

  if (!items || items.length === 0) {
    res.status(400);
    throw new Error('At least one item is required');
  }

  // Validate items and compute amounts
  let computedTotal = 0;
  for (const item of items) {
    if (!item.description || item.quantity == null || item.rate == null) {
      res.status(400);
      throw new Error('Each item must have a description, quantity, and rate');
    }
    item.amount = Number(item.quantity) * Number(item.rate);
    computedTotal += item.amount;
  }

  // Auto-generate sequential invoice number (sort by createdAt for reliability)
  const lastInvoice = await Billing.findOne({ clientId }).sort({ createdAt: -1 });
  let invoiceNo = 'INV0001';
  if (lastInvoice?.invoiceNo) {
    const match = lastInvoice.invoiceNo.match(/INV(\d+)/);
    const lastNumber = match ? parseInt(match[1], 10) : 0;
    if (!Number.isNaN(lastNumber)) {
      invoiceNo = `INV${String(lastNumber + 1).padStart(4, '0')}`;
    }
  }

  let parsedCreatedAt;
  if (createdAt !== undefined && createdAt !== null && createdAt !== '') {
    parsedCreatedAt = new Date(createdAt);
    if (Number.isNaN(parsedCreatedAt.getTime())) {
      res.status(400);
      throw new Error('Invalid createdAt. Use a valid date string or timestamp.');
    }
  }

  const invoice = new Billing({
    invoiceNo,
    billNumber: billNumber ? String(billNumber).trim() : undefined,
    invoiceDate: date ? new Date(date) : Date.now(),
    customerName: String(customerName).trim(),
    items,
    totalAmount: totalAmount ?? computedTotal,
    status: status || 'draft',
    notes: notes ? String(notes).trim() : undefined,
    clientId,
    recordedBy: req.user?._id,
    ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
  });

  try {
    const createdInvoice = await invoice.save();
    res.status(201).json(createdInvoice);
  } catch (err) {
    if (err.code === 11000) {
      res.status(409);
      throw new Error('Invoice number conflict — please retry');
    }
    throw err;
  }
});

// @desc    Get all invoices
// @route   GET /api/billing
// @access  Private
const getInvoices = asyncHandler(async (req, res) => {
  const { clientId, customerName, status, startDate, endDate } = req.query;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const query = { clientId: clientId.trim() };

  if (startDate || endDate) {
    query.invoiceDate = {};
    if (startDate) {
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      query.invoiceDate.$gte = startOfDay;
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.invoiceDate.$lte = endOfDay;
    }
  }

  if (customerName) {
    query.customerName = new RegExp(customerName, 'i');
  }

  if (status) {
    query.status = status;
  }

  const invoices = await Billing.find(query).sort({ invoiceDate: -1 });
  res.json(invoices);
});

// @desc    Update invoice
// @route   PUT /api/billing/:id
// @access  Private
const updateInvoice = asyncHandler(async (req, res) => {
  const {
    clientId,
    customerName,
    billNumber,
    items,
    totalAmount,
    date,
    status,
    notes,
  } = req.body;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const invoice = await Billing.findOne({ _id: req.params.id, clientId });

  if (!invoice) {
    res.status(404);
    throw new Error('Invoice not found or does not belong to this client');
  }

  if (customerName) invoice.customerName = String(customerName).trim();
  if (billNumber !== undefined) invoice.billNumber = billNumber ? String(billNumber).trim() : undefined;
  if (date) invoice.invoiceDate = new Date(date);
  if (status) invoice.status = status;
  if (notes !== undefined) invoice.notes = notes ? String(notes).trim() : undefined;

  if (items && items.length > 0) {
    let computedTotal = 0;
    for (const item of items) {
      if (!item.description || item.quantity == null || item.rate == null) {
        res.status(400);
        throw new Error('Each item must have a description, quantity, and rate');
      }
      item.amount = Number(item.quantity) * Number(item.rate);
      computedTotal += item.amount;
    }
    invoice.items = items;
    invoice.totalAmount = totalAmount ?? computedTotal;
  } else if (totalAmount != null) {
    invoice.totalAmount = totalAmount;
  }

  const updatedInvoice = await invoice.save();
  res.json(updatedInvoice);
});

// @desc    Delete an invoice
// @route   DELETE /api/billing/:id
// @access  Private
const deleteInvoice = asyncHandler(async (req, res) => {
  const { clientId } = req.query;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const invoice = await Billing.findOne({ _id: req.params.id, clientId });

  if (!invoice) {
    res.status(404);
    throw new Error('Invoice not found or does not belong to this client');
  }

  await invoice.deleteOne();
  res.json({ message: 'Invoice removed' });
});

export {
  createInvoice,
  getInvoices,
  updateInvoice,
  deleteInvoice,
};
