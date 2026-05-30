import Purchase from '../models/purchaseModel.js';
import asyncHandler from 'express-async-handler';

// @desc    Create a new purchase
// @route   POST /api/purchases
// @access  Private
const createPurchase = asyncHandler(async (req, res) => {
  const {
    supplier,
    items,
    totalAmount,
    paymentStatus,
    paidAmount,
    date,
    clientId,
    createdAt,
  } = req.body;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  if (!supplier || !supplier.trim()) {
    res.status(400);
    throw new Error('Supplier name is required');
  }

  if (!items || items.length === 0) {
    res.status(400);
    throw new Error('At least one item is required');
  }

  for (const item of items) {
    if (!item.description || item.quantity == null || item.unitPrice == null) {
      res.status(400);
      throw new Error('Each item must have a description, quantity, and unit price');
    }
    item.totalPrice = Number(item.quantity) * Number(item.unitPrice);
  }

  const computedTotal = items.reduce((sum, i) => sum + i.totalPrice, 0);

  let parsedCreatedAt;
  if (createdAt !== undefined && createdAt !== null && createdAt !== '') {
    parsedCreatedAt = new Date(createdAt);
    if (Number.isNaN(parsedCreatedAt.getTime())) {
      res.status(400);
      throw new Error('Invalid createdAt. Use a valid date string or timestamp.');
    }
  }

  const purchase = new Purchase({
    supplier: supplier.trim(),
    items,
    totalAmount: totalAmount ?? computedTotal,
    paymentStatus: paymentStatus || 'pending',
    paidAmount: paymentStatus === 'paid' ? (totalAmount ?? computedTotal) : (Number(paidAmount) || 0),
    purchaseDate: date ? new Date(date) : Date.now(),
    clientId,
    recordedBy: req.user?._id,
    ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
  });

  const createdPurchase = await purchase.save();
  res.status(201).json(createdPurchase);
});

// @desc    Get all purchases
// @route   GET /api/purchases
// @access  Private
const getPurchases = asyncHandler(async (req, res) => {
  const { clientId, supplier, startDate, endDate } = req.query;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const query = { clientId: clientId.trim() };

  if (startDate || endDate) {
    query.purchaseDate = {};
    if (startDate) {
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      query.purchaseDate.$gte = startOfDay;
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.purchaseDate.$lte = endOfDay;
    }
  }

  if (supplier) {
    query.supplier = new RegExp(supplier, 'i');
  }

  const purchases = await Purchase.find(query).sort({ purchaseDate: -1 });
  res.json(purchases);
});

// @desc    Update purchase
// @route   PUT /api/purchases/:id
// @access  Private
const updatePurchase = asyncHandler(async (req, res) => {
  const {
    clientId,
    supplier,
    items,
    totalAmount,
    paymentStatus,
    paidAmount,
    date,
  } = req.body;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const purchase = await Purchase.findOne({ _id: req.params.id, clientId });

  if (!purchase) {
    res.status(404);
    throw new Error('Purchase not found or does not belong to this client');
  }

  if (supplier) purchase.supplier = supplier.trim();
  if (paymentStatus) {
    purchase.paymentStatus = paymentStatus;
    if (paymentStatus === 'paid') {
      purchase.paidAmount = purchase.totalAmount;
    } else if (paidAmount !== undefined) {
      purchase.paidAmount = Number(paidAmount) || 0;
    }
  } else if (paidAmount !== undefined) {
    purchase.paidAmount = Number(paidAmount) || 0;
  }
  if (date) purchase.purchaseDate = new Date(date);

  if (items && items.length > 0) {
    for (const item of items) {
      item.totalPrice = Number(item.quantity) * Number(item.unitPrice);
    }
    purchase.items = items;
    purchase.totalAmount = totalAmount ?? items.reduce((sum, i) => sum + i.totalPrice, 0);
  } else if (totalAmount != null) {
    purchase.totalAmount = totalAmount;
  }

  const updatedPurchase = await purchase.save();
  res.json(updatedPurchase);
});

// @desc    Delete a purchase
// @route   DELETE /api/purchases/:id
// @access  Private
const deletePurchase = asyncHandler(async (req, res) => {
  const { clientId } = req.query;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const purchase = await Purchase.findOne({ _id: req.params.id, clientId });

  if (!purchase) {
    res.status(404);
    throw new Error('Purchase not found or does not belong to this client');
  }

  await purchase.deleteOne();
  res.json({ message: 'Purchase removed' });
});

export {
  createPurchase,
  getPurchases,
  updatePurchase,
  deletePurchase,
};
