import Suspense from '../models/suspenseModel.js';
import asyncHandler from 'express-async-handler';

// @desc    Create a suspense record
// @route   POST /api/suspense
const createSuspense = asyncHandler(async (req, res) => {
  const {
    employeeId,
    employeeName,
    totalDebt,
    totalAdvance,
    date,
    clientId,
    createdAt,
  } = req.body;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  if (!employeeId || !employeeName) {
    res.status(400);
    throw new Error('Employee ID and Employee Name are required');
  }

  let parsedCreatedAt;
  if (createdAt !== undefined && createdAt !== null && createdAt !== '') {
    parsedCreatedAt = new Date(createdAt);
    if (Number.isNaN(parsedCreatedAt.getTime())) {
      res.status(400);
      throw new Error('Invalid createdAt. Use a valid date string or timestamp.');
    }
  } else if (date) {
    parsedCreatedAt = new Date(date);
    if (Number.isNaN(parsedCreatedAt.getTime())) {
      parsedCreatedAt = undefined;
    }
  }

  const suspense = new Suspense({
    employeeId: String(employeeId).trim(),
    employeeName: String(employeeName).trim(),
    totalDebt: Number(totalDebt) || 0,
    totalAdvance: Number(totalAdvance) || 0,
    date: date || Date.now(),
    clientId,
    ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
  });

  const created = await suspense.save();
  res.status(201).json(created);
});

// @desc    Get all suspense records
// @route   GET /api/suspense
const getSuspense = asyncHandler(async (req, res) => {
  const { clientId, startDate, endDate } = req.query;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const query = { clientId: clientId.trim() };

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

  const records = await Suspense.find(query).sort({ date: -1 });
  res.json(records);
});

// @desc    Update a suspense record
// @route   PUT /api/suspense/:id
const updateSuspense = asyncHandler(async (req, res) => {
  const {
    clientId,
    employeeId,
    employeeName,
    totalDebt,
    totalAdvance,
    date,
  } = req.body;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const suspense = await Suspense.findOne({ _id: req.params.id, clientId });

  if (!suspense) {
    res.status(404);
    throw new Error('Suspense record not found or does not belong to this client');
  }

  if (employeeId !== undefined) suspense.employeeId = String(employeeId).trim();
  if (employeeName !== undefined) suspense.employeeName = String(employeeName).trim();
  if (totalDebt !== undefined) suspense.totalDebt = Number(totalDebt) || 0;
  if (totalAdvance !== undefined) suspense.totalAdvance = Number(totalAdvance) || 0;
  if (date !== undefined) {
    suspense.date = date;
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) {
      suspense.createdAt = parsed;
    }
  }

  const updated = await suspense.save();
  res.json(updated);
});

// @desc    Delete a suspense record
// @route   DELETE /api/suspense/:id
const deleteSuspense = asyncHandler(async (req, res) => {
  const { clientId } = req.query;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const suspense = await Suspense.findOne({ _id: req.params.id, clientId });

  if (!suspense) {
    res.status(404);
    throw new Error('Suspense record not found or does not belong to this client');
  }

  await suspense.deleteOne();
  res.json({ message: 'Suspense record removed' });
});

export {
  createSuspense,
  getSuspense,
  updateSuspense,
  deleteSuspense,
};
