import asyncHandler from 'express-async-handler';
import generateToken, { generateTokenPair, verifyToken } from '../utils/generateToken.js';
import Admin from '../models/adminModel.js';
import Order from '../models/orderModel.js';
import Sale from '../models/saleModel.js';
import Wage from '../models/wageModel.js';
import Expense from '../models/expenseModel.js';
import Stock from '../models/stockModel.js';
import Employee from '../models/employeeModel.js';
import Income from '../models/incomeModel.js';
import Billing from '../models/billingModel.js';
import Purchase from '../models/purchaseModel.js';

// @desc    Create a new admin
// @route   POST /api/admins
// @access  Private/Admin
const createAdmin = asyncHandler(async (req, res) => {
  const { name, username, password, email } = req.body;

  const adminExists = await Admin.findOne({ username });

  if (adminExists) {
    res.status(400);
    throw new Error('Admin already exists');
  }

  const slashIndex = username.indexOf('/');
  if (slashIndex !== -1) {
    // username is like "bbk/admin" — client ID is "bbk"
    const clientId = username.slice(0, slashIndex);
    const conflict = await Admin.findOne({ username: clientId });
    if (conflict) {
      res.status(400);
      throw new Error(`Client ID "${clientId}" conflicts with an existing username`);
    }
  } else {
    // username is plain like "bbk" — check no existing user has this as their client ID prefix
    const conflict = await Admin.findOne({ username: new RegExp(`^${username}/`) });
    if (conflict) {
      res.status(400);
      throw new Error(`Username "${username}" conflicts with an existing client ID`);
    }
  }

  const admin = await Admin.create({
    name,
    username,
    password,
    ...(email && { email }),
  });

  if (admin) {
    res.status(201).json({
      _id: admin._id,
      name: admin.name,
      username: admin.username,
      active: admin.active,
    });
  } else {
    res.status(400);
    throw new Error('Invalid admin data');
  }
});

// @desc    Get all admins
// @route   GET /api/admins
// @access  Private/Admin
const getAdmins = asyncHandler(async (req, res) => {
  const admins = await Admin.find({}).select('-password');
  res.json(admins);
});

// @desc    Delete admin
// @route   DELETE /api/admins/:id
// @access  Private/Admin
const deleteAdmin = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id);

  if (!admin) {
    res.status(404);
    throw new Error('Admin not found');
  }

  await admin.deleteOne();
  res.json({ message: 'Admin removed' });
});

// @desc    Toggle admin active status
// @route   PUT /api/admins/:id/active
// @access  Private/Admin
const toggleAdminStatus = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params.id);
  
  if (!admin) {
    res.status(404);
    throw new Error('Admin not found');
  }

  admin.active = !admin.active;
  const updatedAdmin = await admin.save();
  res.json({
    _id: updatedAdmin._id,
    name: updatedAdmin.name,
    username: updatedAdmin.username,
    active: updatedAdmin.active,
  });
});

// @desc    Auth admin & get token
// @route   POST /api/admins/login
// @access  Public
const authAdmin = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  
  const admin = await Admin.findOne({ username });

  if (admin && (await admin.matchPassword(password))) {
    await Admin.updateOne({ _id: admin._id }, { $set: { lastLogin: new Date() } });

    const tokens = generateTokenPair(admin._id);

    res.json({
      _id: admin._id,
      name: admin.name,
      username: admin.username,
      email: admin.email,
      active: admin.active,
      lastLogin: admin.lastLogin,
      ...tokens,
    });
  } else {
    res.status(401);
    throw new Error('Invalid username or password');
  }
});

// @desc    Forgot password
// @route   POST /api/admins/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  const admin = await Admin.findOne({ email });
  
  if (!admin) {
    res.status(404);
    throw new Error('No admin found with that email');
  }
  
  // Generate reset token
  const resetToken = admin.createPasswordResetToken();
  await admin.save({ validateBeforeSave: false });
  
  // In production, send email with reset token
  console.log(`Password reset token for ${admin.email}: ${resetToken}`);
  
  res.json({
    message: 'Password reset token sent to email',
    // In development, include token for testing
    ...(process.env.NODE_ENV === 'development' && { resetToken })
  });
});

// @desc    Reset password
// @route   POST /api/admins/reset-password
// @access  Public (no JWT required)
const resetPassword = asyncHandler(async (req, res) => {
  const { username, newPassword } = req.body;

  const admin = await Admin.findOne({ username: username?.toLowerCase() });

  if (!admin) {
    res.status(404);
    throw new Error('Admin not found');
  }

  admin.password = newPassword;
  admin.loginAttempts = 0;
  admin.lockUntil = undefined;

  await admin.save();

  res.json({ message: 'Password reset successful' });
});

// @desc    Refresh token
// @route   POST /api/admins/refresh-token
// @access  Public
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    res.status(401);
    throw new Error('Refresh token required');
  }

  try {
    const decoded = verifyToken(token);
    const admin = await Admin.findById(decoded.id).select('-password');

    if (!admin || !admin.active) {
      res.status(401);
      throw new Error('Invalid refresh token');
    }

    const tokens = generateTokenPair(admin._id);
    res.json(tokens);
  } catch (error) {
    res.status(401);
    throw new Error('Invalid refresh token');
  }
});

// @desc    Logout admin
// @route   POST /api/admins/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  // Token is blacklisted in middleware
  res.json({
    message: 'Logged out successfully'
  });
});

// @desc    Get admin profile
// @route   GET /api/admins/profile
// @access  Public (no JWT required)
const getAdminProfile = asyncHandler(async (req, res) => {
  // Try to get admin ID from query params first, then from req.admin if available
  const adminId = req.query.adminId || (req.admin && req.admin._id);
  
  if (!adminId) {
    res.status(400);
    throw new Error('Admin ID is required. Provide it as query parameter ?adminId=<id>');
  }

  const admin = await Admin.findById(adminId).select('-password');
  
  if (!admin) {
    res.status(404);
    throw new Error('Admin not found');
  }

  res.json({
    _id: admin._id,
    name: admin.name,
    username: admin.username,
    email: admin.email,
    active: admin.active,
    createdAt: admin.createdAt,
    lastLogin: admin.lastLogin,
  });
});

const getDashboard = asyncHandler(async (req, res) => {
  const { clientId, startDate, endDate, year } = req.query;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const clientIdTrimmed = String(clientId).trim();

  const now = new Date();
  const rangeStart = startDate
  ? new Date(Date.UTC(
      new Date(startDate).getUTCFullYear(),
      new Date(startDate).getUTCMonth(),
      new Date(startDate).getUTCDate(),5,30,0
    ))
  : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

const rangeEnd = endDate
  ? new Date(Date.UTC(
      new Date(endDate).getUTCFullYear(),
      new Date(endDate).getUTCMonth(),
      new Date(endDate).getUTCDate() + 1
    ))
  : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const createdAtFilter = { $gte: rangeStart, $lte: rangeEnd };

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const orderMatch = { clientId: clientIdTrimmed };
  const saleMatch = { clientId: clientIdTrimmed };
  const wageMatch = { clientId: clientIdTrimmed };
  const expenseMatch = { clientId: clientIdTrimmed };
  const incomeMatch = { clientId: clientIdTrimmed };
  orderMatch.createdAt = createdAtFilter;
  saleMatch.createdAt = createdAtFilter;
  wageMatch.createdAt = createdAtFilter;
  expenseMatch.createdAt = createdAtFilter;
  incomeMatch.date = createdAtFilter;

  const normalizeItemType = (itemType) => {
    if (!itemType) return 'other';
    const t = String(itemType).toLowerCase();
    if (t === 'others') return 'other';
    return t;
  };

  const yearNumber = Number.parseInt(String(year || now.getFullYear()), 10);
  const yearStart = new Date(yearNumber, 0, 1, 0, 0, 0, 0);
  const yearEndExclusive = new Date(yearNumber + 1, 0, 1, 0, 0, 0, 0);

  // Check if a specific month is requested
  const month = req.query.month ? Number.parseInt(req.query.month, 10) : null;
  const monthFilter = month && month >= 1 && month <= 12 ? month : null;

  // Create year match filter
  const yearMatch = { clientId: clientIdTrimmed, createdAt: { $gte: yearStart, $lt: yearEndExclusive } };
  const yearIncomeMatch = { clientId: clientIdTrimmed, date: { $gte: yearStart, $lt: yearEndExclusive } };
  
  // If specific month is requested, filter to that month only
  if (monthFilter) {
    const monthStart = new Date(yearNumber, monthFilter - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(yearNumber, monthFilter, 0, 23, 59, 59, 999);
    yearMatch.createdAt = { $gte: monthStart, $lte: monthEnd };
    yearIncomeMatch.date = { $gte: monthStart, $lte: monthEnd };
  }
  const [
    paidOrderAgg,
    processedOrderAgg,
    todayCreatedOrdersAgg,
    pendingOrdersExcludingTodayAgg,
    todayWageBagsAgg,
    paidSaleAgg,
    salesByItemAgg,
    wagesAgg,
    expensesAgg,
    incomeAgg,
    salaryAgg,
    yearPaidOrdersAgg,
    yearPaidSalesAgg,
    yearWagesAgg,
    yearExpensesAgg,
    yearIncomeAgg,
    yearSalesByItemAgg,
    stockDocs,
    orderStatusesAgg,
    paidBillingAgg,
    purchaseRangeAgg,
    yearBillingAgg,
    yearPurchaseAgg,
  ] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          ...orderMatch,
          status: 'PAID & CLOSE',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          totalBags: { $sum: '$numberOfBags' },
          count: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: null,
          totalBags: { $sum: '$numberOfBags' },
          count: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          clientId: clientIdTrimmed,
          createdAt: { $gte: todayStart, $lte: todayEnd },
        },
      },
      {
        $group: {
          _id: null,
          totalBags: { $sum: '$numberOfBags' },
          count: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          clientId: clientIdTrimmed,
          status: { $in: ['CREATED', 'INITIAL STOCKING'] },
          createdAt: { $lt: todayStart },
        },
      },
      {
        $group: {
          _id: null,
          totalBags: { $sum: '$numberOfBags' },
          count: { $sum: 1 },
        },
      },
    ]),
    Wage.aggregate([
      {
        $match: {
          clientId: clientIdTrimmed,
          updatedAt: { $gte: todayStart, $lte: todayEnd },
        },
      },
      {
        $group: {
          _id: null,
          totalBags: { $sum: '$bags' },
          count: { $sum: 1 },
        },
      },
    ]),
    Sale.aggregate([
      {
        $match: {
          ...saleMatch,
          paymentStatus: 'Paid',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
    ]),
    Sale.aggregate([
      {
        $match: {
          ...saleMatch,
          paymentStatus: 'Paid',
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.itemType',
          quantity: { $sum: '$items.quantity' },
          amount: { $sum: '$items.amount' },
        },
      },
    ]),
    Wage.aggregate([
      { $match: wageMatch },
      {
        $group: {
          _id: null,
          totalWage: { $sum: '$totalWage' },
          count: { $sum: 1 },
        },
      },
    ]),
    Expense.aggregate([
      { $match: expenseMatch },
      {
        $group: {
          _id: null,
          totalExpense: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]),
    Income.aggregate([
  { $match: incomeMatch },
  {
    $group: {
      _id: null,
      totalIncome: { $sum: '$amount' },
      count: { $sum: 1 },
    },
  },
]),
    Employee.aggregate([
      { $match: { clientId: clientIdTrimmed, isActive: true } },
      {
        $group: {
          _id: null,
          totalSalary: { $sum: '$salary' },
          count: { $sum: 1 },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          ...yearMatch,
          status: 'PAID & CLOSE',
        },
      },
      {
        $group: {
          _id: monthFilter ? null : { $month: '$createdAt' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ]),
    Sale.aggregate([
      {
        $match: {
          ...yearMatch,
          paymentStatus: 'Paid',
        },
      },
      {
        $group: {
          _id: monthFilter ? null : { $month: '$createdAt' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ]),
    Wage.aggregate([
      {
        $match: yearMatch,
      },
      {
        $group: {
          _id: monthFilter ? null : { $month: '$createdAt' },
          totalWage: { $sum: '$totalWage' },
        },
      },
    ]),
    Expense.aggregate([
      {
        $match: yearMatch,
      },
      {
        $group: {
          _id: monthFilter ? null : { $month: '$createdAt' },
          totalExpense: { $sum: '$amount' },
        },
      },
    ]),
    Income.aggregate([
      {
        $match: yearIncomeMatch,
      },
      {
        $group: {
          _id: monthFilter ? null : { $month: '$date' },
          totalIncome: { $sum: '$amount' },
        },
      },
    ]),
    Sale.aggregate([
      {
        $match: {
          ...yearMatch,
          paymentStatus: 'Paid',
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: monthFilter ? '$items.itemType' : { month: { $month: '$createdAt' }, itemType: '$items.itemType' },
          quantity: { $sum: '$items.quantity' },
          amount: { $sum: '$items.amount' },
        },
      },
    ]),
    Stock.find({ clientId: clientIdTrimmed }).select('itemType availableQuantity'),
    // Dynamic: group orders by their actual status value
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalBags: { $sum: '$numberOfBags' },
        },
      },
    ]),
    // Paid billing invoices in date range (contributes to revenue)
    Billing.aggregate([
      { $match: { clientId: clientIdTrimmed, status: 'paid', invoiceDate: createdAtFilter } },
      { $group: { _id: null, totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
    // Purchases in date range (contributes to expense)
    Purchase.aggregate([
      { $match: { clientId: clientIdTrimmed, purchaseDate: createdAtFilter } },
      { $group: { _id: null, totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
    // Yearly paid billing by month
    Billing.aggregate([
      { $match: { clientId: clientIdTrimmed, status: 'paid', invoiceDate: { $gte: yearStart, $lt: yearEndExclusive } } },
      {
        $group: {
          _id: monthFilter ? null : { $month: '$invoiceDate' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ]),
    // Yearly purchases by month
    Purchase.aggregate([
      { $match: { clientId: clientIdTrimmed, purchaseDate: { $gte: yearStart, $lt: yearEndExclusive } } },
      {
        $group: {
          _id: monthFilter ? null : { $month: '$purchaseDate' },
          totalAmount: { $sum: '$totalAmount' },
        },
      },
    ]),
  ]);

  const paidOrders = paidOrderAgg?.[0] || { totalAmount: 0, totalBags: 0, count: 0 };
  const processedOrders = processedOrderAgg?.[0] || { totalBags: 0, count: 0 };
  const todayCreatedOrders = todayCreatedOrdersAgg?.[0] || { totalBags: 0, count: 0 };
  const pendingOrdersExcludingToday = pendingOrdersExcludingTodayAgg?.[0] || { totalBags: 0, count: 0 };
  const todayWageBags = todayWageBagsAgg?.[0] || { totalBags: 0, count: 0 };
  const paidSales = paidSaleAgg?.[0] || { totalAmount: 0, count: 0 };
  const wages = wagesAgg?.[0] || { totalWage: 0, count: 0 };
  const expenses = expensesAgg?.[0] || { totalExpense: 0, count: 0 };
  const incomes = incomeAgg?.[0] || { totalIncome: 0, count: 0 };
  const salaries = salaryAgg?.[0] || { totalSalary: 0, count: 0 };

  // Build a dynamic dictionary keyed by actual status value stored in DB
  const orderStatusesDict = {};
  for (const row of orderStatusesAgg || []) {
    if (row._id) {
      orderStatusesDict[row._id] = {
        count: row.count || 0,
        totalBags: row.totalBags || 0,
      };
    }
  }
const salesByItemType = {
    bran: { quantity: 0, amount: 0 },
    husk: { quantity: 0, amount: 0 },
    'black rice': { quantity: 0, amount: 0 },
    'broken rice': { quantity: 0, amount: 0 },
    other: { quantity: 0, amount: 0 },
  };
  for (const row of salesByItemAgg || []) {
    const key = normalizeItemType(row._id);
    if (!salesByItemType[key]) {
      salesByItemType[key] = { quantity: 0, amount: 0 };
    }
    salesByItemType[key].quantity = row.quantity || 0;
    salesByItemType[key].amount = row.amount || 0;
  }

  const stockByItemType = {
    bran: 0,
    husk: 0,
    'black rice': 0,
    'broken rice': 0,
    other: 0,
    Karika: 0
  };
  for (const s of stockDocs || []) {
    const key = normalizeItemType(s.itemType);
    stockByItemType[key] = s.availableQuantity || 0;
  }

  const paidBillings  = paidBillingAgg?.[0]  || { totalAmount: 0, count: 0 };
  const purchaseRange = purchaseRangeAgg?.[0] || { totalAmount: 0, count: 0 };

  const revenueOrders  = paidOrders.totalAmount    || 0;
  const revenueSales   = paidSales.totalAmount      || 0;
  const revenueIncome  = incomes.totalIncome        || 0;
  const revenueBilling = paidBillings.totalAmount   || 0;
  const revenueTotal   = revenueOrders + revenueSales + revenueIncome + revenueBilling;

  const expenseWages    = wages.totalWage         || 0;
  const expenseSalary   = salaries.totalSalary    || 0;
  const expenseOther    = expenses.totalExpense   || 0;
  const expensePurchase = purchaseRange.totalAmount || 0;
  const expenseTotal    = expenseWages + expenseSalary + expenseOther + expensePurchase;
const todaySummaryTotalOrder = pendingOrdersExcludingToday.totalBags || 0;
  const todaySummaryPaddyTaken = todayWageBags.totalBags || 0;
  const todaySummaryNewOrder = todayCreatedOrders.totalBags || 0;
  const todaySummaryOutput = todaySummaryTotalOrder - todaySummaryPaddyTaken + todaySummaryNewOrder;

  const yearMonths = monthFilter ? null : Array.from({ length: 12 }, (_, i) => {
    const byItemType = {
      bran: { quantity: 0, amount: 0 },
      husk: { quantity: 0, amount: 0 },
      'black rice': { quantity: 0, amount: 0 },
      'broken rice': { quantity: 0, amount: 0 },
      other: { quantity: 0, amount: 0 },
    };

    return {
      month: i + 1,
      revenue: { orders: 0, sales: 0, billing: 0, total: 0 },
      expense: { wages: 0, salary: expenseSalary, other: 0, purchase: 0, total: 0 },
      profit: 0,
      sales: { byItemType },
    };
  });

  // Process yearly data
  if (monthFilter) {
    // Single month data - create one month entry
    const singleMonthData = {
      month: monthFilter,
      revenue: { orders: 0, sales: 0, billing: 0, total: 0 },
      expense: { wages: 0, salary: expenseSalary, other: 0, purchase: 0, total: 0 },
      profit: 0,
      sales: { byItemType: {
        bran: { quantity: 0, amount: 0 },
        husk: { quantity: 0, amount: 0 },
        'black rice': { quantity: 0, amount: 0 },
        'broken rice': { quantity: 0, amount: 0 },
        other: { quantity: 0, amount: 0 },
      }},
    };

    // Set single month data from aggregations
    if (yearPaidOrdersAgg?.[0]) {
      singleMonthData.revenue.orders = yearPaidOrdersAgg[0].totalAmount || 0;
    }
    if (yearPaidSalesAgg?.[0]) {
      singleMonthData.revenue.sales = yearPaidSalesAgg[0].totalAmount || 0;
    }
    if (yearBillingAgg?.[0]) {
      singleMonthData.revenue.billing = yearBillingAgg[0].totalAmount || 0;
    }
    if (yearWagesAgg?.[0]) {
      singleMonthData.expense.wages = yearWagesAgg[0].totalWage || 0;
    }
    if (yearExpensesAgg?.[0]) {
      singleMonthData.expense.other = yearExpensesAgg[0].totalExpense || 0;
    }
    if (yearPurchaseAgg?.[0]) {
      singleMonthData.expense.purchase = yearPurchaseAgg[0].totalAmount || 0;
    }

    // Process sales by item type for single month
    for (const row of yearSalesByItemAgg || []) {
      const key = normalizeItemType(row._id);
      if (singleMonthData.sales.byItemType[key]) {
        singleMonthData.sales.byItemType[key].quantity = row.quantity || 0;
        singleMonthData.sales.byItemType[key].amount = row.amount || 0;
      }
    }

    singleMonthData.revenue.total = (singleMonthData.revenue.orders || 0) + (singleMonthData.revenue.sales || 0) + (yearIncomeAgg?.[0]?.totalIncome || 0) + (singleMonthData.revenue.billing || 0);
    singleMonthData.expense.total = (singleMonthData.expense.wages || 0) + (singleMonthData.expense.salary || 0) + (singleMonthData.expense.other || 0) + (singleMonthData.expense.purchase || 0);
    singleMonthData.profit = singleMonthData.revenue.total - singleMonthData.expense.total;

    res.json({
      revenue: {
        orders: revenueOrders,
        sales: revenueSales,
        billing: revenueBilling,
        total: revenueTotal,
      },
      expense: {
        wages: expenseWages,
        salary: expenseSalary,
        other: expenseOther,
        purchase: expensePurchase,
        total: expenseTotal,
      },
      profit: revenueTotal - expenseTotal,
      todaySummary: {
        totalOrder: todaySummaryTotalOrder,
        paddyTaken: todaySummaryPaddyTaken,
        newOrder: todaySummaryNewOrder,
        output: todaySummaryOutput,
      },
      paddyProcessed: {
        totalBags: processedOrders.totalBags || 0,
        paidBags: paidOrders.totalBags || 0,
      },
      sales: {
        byItemType: salesByItemType,
      },
      stock: {
        available: stockByItemType,
      },
      orderStatuses: orderStatusesDict,
      yearly: {
        year: yearNumber,
        months: [singleMonthData],
      },
    });
    return;
  }

  // Original yearly processing for all months
  for (const row of yearPaidOrdersAgg || []) {
    const idx = (row._id || 0) - 1;
    if (yearMonths[idx]) yearMonths[idx].revenue.orders = row.totalAmount || 0;
  }
  for (const row of yearPaidSalesAgg || []) {
    const idx = (row._id || 0) - 1;
    if (yearMonths[idx]) yearMonths[idx].revenue.sales = row.totalAmount || 0;
  }
  for (const row of yearBillingAgg || []) {
    const idx = (row._id || 0) - 1;
    if (yearMonths[idx]) yearMonths[idx].revenue.billing = row.totalAmount || 0;
  }
  for (const row of yearWagesAgg || []) {
    const idx = (row._id || 0) - 1;
    if (yearMonths[idx]) yearMonths[idx].expense.wages = row.totalWage || 0;
  }
  for (const row of yearExpensesAgg || []) {
    const idx = (row._id || 0) - 1;
    if (yearMonths[idx]) yearMonths[idx].expense.other = row.totalExpense || 0;
  }
  for (const row of yearPurchaseAgg || []) {
    const idx = (row._id || 0) - 1;
    if (yearMonths[idx]) yearMonths[idx].expense.purchase = row.totalAmount || 0;
  }
  for (const row of yearSalesByItemAgg || []) {
    const idx = (row._id?.month || 0) - 1;
    const key = normalizeItemType(row._id?.itemType);
    if (yearMonths[idx]?.sales?.byItemType?.[key]) {
      yearMonths[idx].sales.byItemType[key].quantity = row.quantity || 0;
      yearMonths[idx].sales.byItemType[key].amount = row.amount || 0;
    } else if (yearMonths[idx]) {
      yearMonths[idx].sales.byItemType[key] = {
        quantity: row.quantity || 0,
        amount: row.amount || 0,
      };
    }
  }

  for (const m of yearMonths) {
    const monthIncome = yearIncomeAgg?.find(row => (row._id || 0) === m.month)?.totalIncome || 0;
    m.revenue.total = (m.revenue.orders || 0) + (m.revenue.sales || 0) + (m.revenue.billing || 0) + monthIncome;
    m.expense.total = (m.expense.wages || 0) + (m.expense.salary || 0) + (m.expense.other || 0) + (m.expense.purchase || 0);
    m.profit = m.revenue.total - m.expense.total;
  }

  res.json({
    revenue: {
      orders: revenueOrders,
      sales: revenueSales,
      billing: revenueBilling,
      total: revenueTotal,
    },
    expense: {
      wages: expenseWages,
      salary: expenseSalary,
      other: expenseOther,
      purchase: expensePurchase,
      total: expenseTotal,
    },
    profit: revenueTotal - expenseTotal,
    todaySummary: {
      totalOrder: todaySummaryTotalOrder,
      paddyTaken: todaySummaryPaddyTaken,
      newOrder: todaySummaryNewOrder,
      output: todaySummaryOutput,
    },
    paddyProcessed: {
      totalBags: processedOrders.totalBags || 0,
      paidBags: paidOrders.totalBags || 0,
    },
    sales: {
      byItemType: salesByItemType,
    },
    stock: {
      available: stockByItemType,
    },
    orderStatuses: orderStatusesDict,
    yearly: {
      year: yearNumber,
      months: yearMonths,
    },
  });
});

export { 
  createAdmin, 
  getAdmins, 
  deleteAdmin, 
  toggleAdminStatus, 
  authAdmin, 
  getAdminProfile,
  getDashboard,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout
};
