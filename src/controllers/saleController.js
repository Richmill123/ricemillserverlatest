import Sale from '../models/saleModel.js';
import Stock from '../models/stockModel.js';
import asyncHandler from 'express-async-handler';

// @desc    Create a new sale
// @route   POST /api/sales
// @access  Private
const createSale = asyncHandler(async (req, res) => {
  const {
    name,
    phoneNumber,
    address,
    items,
    paymentStatus,
    paymentMethod,
    partialAmountPaid,
    clientId,
  } = req.body;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  // Calculate total amount
  const totalAmount = items.reduce((total, item) => {
    return total + (item.quantity * item.rate);
  }, 0);

  // Derive mydebt from paymentStatus
  let mydebt;
  if (paymentStatus === 'Paid') {
    mydebt = 0;
  } else if (paymentStatus === 'Partially Paid') {
    const paid = Number(partialAmountPaid) || 0;
    mydebt = totalAmount - paid;
  } else {
    mydebt = totalAmount; // Pending — full amount is debt
  }

  const sale = new Sale({
    name,
    phoneNumber,
    address,
    items: items.map(item => ({
      itemType: item.itemType,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.quantity * item.rate
    })),
    totalAmount,
    mydebt,
    clientId,
    paymentStatus: paymentStatus || 'Pending',
    paymentMethod: paymentMethod || 'Cash',
  });

  // Update stock for each item — best-effort (sale is not blocked if stock not yet initialised)
  for (const item of items) {
    const stockItem = await Stock.findOne({ itemType: item.itemType, clientId });
    if (stockItem) {
      stockItem.availableQuantity = Math.max(0, stockItem.availableQuantity - item.quantity);
      await stockItem.save();
    }
  }

  const createdSale = await sale.save();
  res.status(201).json(createdSale);
});

// @desc    Get all sales
// @route   GET /api/sales
// @access  Private
const getSales = asyncHandler(async (req, res) => {
  const { clientId, startDate, endDate } = req.query;
  
  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

 var query = { clientId: clientId.trim() };
  
  // Add date filtering if startDate and/or endDate are provided
  // But also include records where mydebt exists and totalAmount === mydebt (and mydebt !== 0)
  if (startDate || endDate) {
    // Create two separate queries: one for date-filtered records, one for debt records
    const dateQuery = { clientId: clientId.trim() };
    const debtQuery = { 
      clientId: clientId.trim(),
      mydebt: { $exists: true, $ne: null, $ne: 0 },
      $expr: { $ne: [{ $subtract: ['$totalAmount', { $ifNull: ['$mydebt', 0] }] }, 0] }
    };
    
    // Add date filters to dateQuery
    if (startDate) {
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      dateQuery.createdAt = { ...dateQuery.createdAt, $gte: startOfDay };
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      dateQuery.createdAt = { ...dateQuery.createdAt, $lte: endOfDay };
    }
    
    // Use $or to combine both queries
    query = {
      $or: [dateQuery, debtQuery]
    };
  } else {
    query = { clientId: clientId.trim() };
  }

  const sales = await Sale.find(query).sort({ createdAt: -1 });
  res.json(sales);
});

// @desc    Update sale
// @route   PUT /api/sales/:id
// @access  Private
const updateSale = asyncHandler(async (req, res) => {
  const { 
    name,
    phoneNumber,
    address,
    items,
    paymentStatus,
    paymentMethod,
    mydebt,
    clientId 
  } = req.body;
  
  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const sale = await Sale.findOne({ _id: req.params.id, clientId });
  
  if (!sale) {
    res.status(404);
    throw new Error('Sale not found or does not belong to this client');
  }

  // Update basic info
  if (name !== undefined) sale.name = name;
  if (phoneNumber !== undefined) sale.phoneNumber = phoneNumber;
  if (address !== undefined) sale.address = address;
  if (mydebt !== undefined) sale.mydebt = mydebt;

  // Update payment info
  if (paymentStatus !== undefined) sale.paymentStatus = paymentStatus;
  if (paymentMethod !== undefined) sale.paymentMethod = paymentMethod;

  // If updating items, handle stock adjustments (best-effort)
  if (items && Array.isArray(items)) {
    // Return old items back to stock
    for (const oldItem of sale.items) {
      const stockItem = await Stock.findOne({ itemType: oldItem.itemType, clientId });
      if (stockItem) {
        stockItem.availableQuantity += oldItem.quantity;
        await stockItem.save();
      }
    }

    // Deduct new items from stock
    for (const newItem of items) {
      const stockItem = await Stock.findOne({ itemType: newItem.itemType, clientId });
      if (stockItem) {
        stockItem.availableQuantity = Math.max(0, stockItem.availableQuantity - newItem.quantity);
        await stockItem.save();
      }
    }

    // Update sale items
    sale.items = items.map(item => ({
      itemType: item.itemType,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.quantity * item.rate
    }));

    // Recalculate total amount
    sale.totalAmount = items.reduce((total, item) => {
      return total + (item.quantity * item.rate);
    }, 0);
  }

  const updatedSale = await sale.save();
  res.json(updatedSale);
});

// @desc    Delete a sale
// @route   DELETE /api/sales/:id
// @access  Private/Admin
const deleteSale = asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  
  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const sale = await Sale.findOne({ _id: req.params.id, clientId });
  
  if (!sale) {
    res.status(404);
    throw new Error('Sale not found or does not belong to this client');
  }

  // Return items to stock on deletion (best-effort)
  for (const item of sale.items) {
    const stockItem = await Stock.findOne({ itemType: item.itemType, clientId });
    if (stockItem) {
      stockItem.availableQuantity += item.quantity;
      await stockItem.save();
    }
  }

  await sale.deleteOne();
  res.json({ message: 'Sale removed' });
});

export {
  createSale,
  getSales,
  updateSale,
  deleteSale,
};
