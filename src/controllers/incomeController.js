import Income from '../models/incomeModel.js';
import asyncHandler from 'express-async-handler';

// @desc    Create a new income
// @route   POST /api/income
// @access  Private
const createIncome = asyncHandler(async (req, res) => {
  const {
    item,
    description,
    amount,
    category,
    date,
    paymentMethod,
    receiptNumber,
    clientId,
    createdAt,
  } = req.body;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  let parsedCreatedAt;
  if (createdAt !== undefined && createdAt !== null && createdAt !== '') {
    parsedCreatedAt = new Date(createdAt);
    if (Number.isNaN(parsedCreatedAt.getTime())) {
      res.status(400);
      throw new Error('Invalid createdAt. Use a valid date string or timestamp.');
    }
  }

  const income = new Income({
    item,
    description,
    amount,
    category: category || 'Other',
    date: date || Date.now(),
    paymentMethod: paymentMethod || 'Cash',
    receiptNumber,
    clientId,
    recordedBy: req.user?._id,
    ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
  });

  const createdIncome = await income.save();
  res.status(201).json(createdIncome);
});

// @desc    Get all income
// @route   GET /api/income
// @access  Private
const getIncome  = asyncHandler(async (req, res) => {
  const { clientId, category, startDate, endDate } = req.query;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const query = { clientId: clientId.trim() };

  // Add date filtering if startDate and/or endDate are provided
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      query.createdAt.$gte = startOfDay;
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endOfDay;
    }
  }
  if (category) {
    query.category = category;
  }

  const income = await Income.find(query).sort({ date: -1 });
  res.json(income);
});


// @desc    Update income
// @route   PUT /api/income/:id
// @access  Private
const updateIncome  = asyncHandler(async (req, res) => {
  const {
    clientId,
    item,
    description,
    amount,
    category,
    date,
    paymentMethod,
    receiptNumber,
  } = req.body;
  
  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const income = await Income.findOne({ _id: req.params.id, clientId });
  
  if (!income) {
    res.status(404);
    throw new Error('Income not found or does not belong to this client');
  }

  if (item !== undefined) income.item = item;
  if (description !== undefined) income.description = description;
  if (amount !== undefined) income.amount = amount;
  if (category !== undefined) income.category = category;
  if (date !== undefined) income.date = date;
  if (paymentMethod !== undefined) income.paymentMethod = paymentMethod;
  if (receiptNumber !== undefined) income.receiptNumber = receiptNumber;

  const updatedIncome = await income.save();
  res.json(updatedIncome);
});

// @desc    Delete an income
// @route   DELETE /api/income/:id
// @access  Private/Admin
const deleteIncome  = asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  
  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const income = await Income.findOne({ _id: req.params.id, clientId });
  
  if (!income) {
    res.status(404);
    throw new Error('Income not found or does not belong to this client');
  }

  await income.deleteOne();
  res.json({ message: 'Income removed' });
});


export {
  createIncome ,
  getIncome ,
  updateIncome ,
  deleteIncome 
};
