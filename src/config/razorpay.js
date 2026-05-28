// Change these values here OR set the corresponding env vars in Vercel dashboard
export const RAZORPAY_CONFIG = {
  KEY_ID:         process.env.RAZORPAY_KEY_ID        || 'rzp_test_YOUR_KEY_ID',
  KEY_SECRET:     process.env.RAZORPAY_KEY_SECRET     || 'YOUR_KEY_SECRET',
  PLAN_ID:        process.env.RAZORPAY_PLAN_ID        || '',   // Create monthly ₹2000 plan in Razorpay dashboard, paste ID here
  WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  AMOUNT:         parseInt(process.env.RAZORPAY_AMOUNT || '200000', 10), // paise (₹2000)
  CURRENCY:       'INR',
  COMPANY_NAME:   process.env.COMPANY_NAME || 'Rice Mill Management System',
  TOTAL_COUNT:    120, // 10 years max billing cycles
};
