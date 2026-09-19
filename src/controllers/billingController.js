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

  let parsedCreatedAt;
  if (createdAt !== undefined && createdAt !== null && createdAt !== '') {
    parsedCreatedAt = new Date(createdAt);
    if (Number.isNaN(parsedCreatedAt.getTime())) {
      res.status(400);
      throw new Error('Invalid createdAt. Use a valid date string or timestamp.');
    }
  }

  const invoiceData = {
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
  };

  // Retry up to 5 times in case of concurrent invoice number collision
  let createdInvoice;
  for (let attempt = 0; attempt < 5; attempt++) {
    const [agg] = await Billing.aggregate([
      { $match: { clientId } },
      { $project: { num: { $toInt: { $substr: ['$invoiceNo', 3, -1] } } } },
      { $group: { _id: null, maxNum: { $max: '$num' } } },
    ]);
    const nextNum = (agg?.maxNum ?? 0) + 1;
    const invoiceNo = `INV${String(nextNum).padStart(4, '0')}`;

    const invoice = new Billing({ ...invoiceData, invoiceNo });
    try {
      createdInvoice = await invoice.save();
      break;
    } catch (err) {
      if (err.code === 11000 && attempt < 4) continue;
      throw err;
    }
  }

  res.status(201).json(createdInvoice);
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

  let query = { clientId: clientId.trim() };

  if (startDate || endDate) {
    const dateFilter = {};
    if (startDate) {
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      dateFilter.$gte = startOfDay;
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      dateFilter.$lte = endOfDay;
    }
    const nameFilter = customerName ? { customerName: new RegExp(customerName, 'i') } : {};
    if (status) {
      // Explicit status filter: apply date range strictly, no pending override
      query = { clientId: clientId.trim(), invoiceDate: dateFilter, status, ...nameFilter };
    } else {
      // No status filter: always include unpaid/partial invoices from previous months
      query = {
        $or: [
          { clientId: clientId.trim(), invoiceDate: dateFilter, ...nameFilter },
          { clientId: clientId.trim(), status: { $in: ['draft', 'sent', 'unpaid', 'partial'] }, ...nameFilter },
        ],
      };
    }
  } else {
    if (customerName) query.customerName = new RegExp(customerName, 'i');
    if (status) query.status = status;
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
