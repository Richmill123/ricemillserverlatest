import Order from '../models/orderModel.js';
import asyncHandler from 'express-async-handler';

const STATUS_MIGRATION = {
  'BOILING': 'BOILING PROCESS COMPLETED',
  'SPLITTING': 'SPLITTING PROCESS COMPLETED',
  'PACKING': 'PACKED & READY',
  'PACKING PROCESS COMPLETED': 'PACKED & READY',
};

const normalizeStatus = (status) => {
  if (!status) return status;
  return STATUS_MIGRATION[status] ?? status;
};

// @desc    Create a new order
// @route   POST /api/orders
// @access  Private
const createOrder = asyncHandler(async (req, res) => {
  const {
    name,
    villageName,
    address,
    phoneNumber,
    totalAmount,
    advanceAmount,
    typeOfPaddy,
    numberOfBags,
    clientId,
    splittingincome,
    status = 'CREATED',
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

  const order = new Order({
    name,
    villageName,
    address,
    phoneNumber,
    numberOfBags,
    totalAmount,
    advanceAmount,
    typeOfPaddy,
    clientId,
    status: normalizeStatus(status),
    splittingincome,
    ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
  });

  const createdOrder = await order.save();
  res.status(201).json(createdOrder);
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
const getOrders = asyncHandler(async (req, res) => {
  const { clientId, startDate, endDate } = req.query;
  
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
    // Always include orders not yet fully paid, regardless of date
    query = {
      $or: [
        { clientId: clientId.trim(), createdAt: dateFilter },
        { clientId: clientId.trim(), status: { $ne: 'PAID & CLOSE' } },
      ],
    };
  }

  const orders = await Order.find(query);
  res.json(orders);
});

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Private
const updateOrder = asyncHandler(async (req, res) => {
  const { 
    name,
    villageName,
    address,
    phoneNumber,
    totalAmount,
    advanceAmount,
    typeOfPaddy,
    numberOfBags,
    status,
    clientId,
    splittingincome 
  } = req.body;
  
  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }
  
  const order = await Order.findOne({ _id: req.params.id, clientId });

  if (!order) {
    res.status(404);
    throw new Error('Order not found or does not belong to this client');
  }

  if (name !== undefined) order.name = name;
  if (villageName !== undefined) order.villageName = villageName;
  if (address !== undefined) order.address = address;
  if (phoneNumber !== undefined) order.phoneNumber = phoneNumber;
  if (totalAmount !== undefined) order.totalAmount = totalAmount;
  if (advanceAmount !== undefined) order.advanceAmount = advanceAmount;
  if (typeOfPaddy !== undefined) order.typeOfPaddy = typeOfPaddy;
  if (numberOfBags !== undefined) order.numberOfBags = numberOfBags;
  const resolvedStatus = normalizeStatus(status);
  if (resolvedStatus !== undefined) order.status = resolvedStatus;
  if (splittingincome !== undefined) order.splittingincome = splittingincome;

  const updatedOrder = await order.save();
  res.json(updatedOrder);
});

// @desc    Delete an order
// @route   DELETE /api/orders/:id
// @access  Private/Admin
const deleteOrder = asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  
  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const order = await Order.findOne({ _id: req.params.id, clientId });
  
  if (!order) {
    res.status(404);
    throw new Error('Order not found or does not belong to this client');
  }

  await order.deleteOne();
  res.json({ message: 'Order removed' });
});

export {
  createOrder,
  getOrders,
  updateOrder,
  deleteOrder,
};
