import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { 
  helmetConfig, 
  corsOptions, 
  authRateLimit, 
  generalRateLimit, 
  strictRateLimit,
  sanitizeInput,
  securityLogger
} from './config/security.js';

// Routes
import employeeRoutes from './routes/employeeRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import saleRoutes from './routes/saleRoutes.js';
import wageRoutes from './routes/wageRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import stockRoutes from './routes/stockRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import incomeRoutes from './routes/incomeRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import preferenceRoutes from './routes/preferenceRoutes.js';

// Load environment variables
dotenv.config();

// Kick off an eager connection attempt so warm instances are already connected
connectDB().catch(err => console.error('[DB] Eager connection failed:', err.message));

const app = express();
const PORT = process.env.PORT || 5000;

// Trust Vercel's reverse proxy so express-rate-limit can read X-Forwarded-For
app.set('trust proxy', 1);

// Ensure DB is connected before every request (no-op on warm instances)
app.use((req, res, next) => {
  connectDB().then(() => next()).catch(next);
});

// Security middleware (order matters!)
app.use(helmetConfig);
app.use(securityLogger);
app.use(sanitizeInput);

// CORS configuration
app.use(cors(corsOptions));

// Request logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Body parsing middleware — 5 mb to accommodate base64 logo images
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Rate limiting for different endpoint categories
app.use('/api/admins/login', authRateLimit);
app.use('/api/admins', authRateLimit);

// API Routes with rate limiting
app.use('/api/employees', generalRateLimit, employeeRoutes);
app.use('/api/orders', generalRateLimit, orderRoutes);
app.use('/api/sales', generalRateLimit, saleRoutes);
app.use('/api/wages', generalRateLimit, wageRoutes);
app.use('/api/expenses', generalRateLimit, expenseRoutes);
app.use('/api/stock', strictRateLimit, stockRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/income', generalRateLimit, incomeRoutes);
app.use('/api/purchases', generalRateLimit, purchaseRoutes);
app.use('/api/billing', strictRateLimit, billingRoutes);
app.use('/api/preferences', generalRateLimit, preferenceRoutes);


// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to Rice Mill Management System API',
    endpoints: {
      employees: '/api/employees',
      orders: '/api/orders',
      sales: '/api/sales',
      wages: '/api/wages',
      expenses: '/api/expenses',
      stock: '/api/stock',   
      income: '/api/income',
      purchases: '/api/purchases',
      billing: '/api/billing',
      preferences: '/api/preferences'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Silence noisy browser favicon requests
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/favicon.png', (req, res) => res.status(204).end());

// 404 handler with security logging
app.use((req, res) => {
  console.warn(`[404] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  res.status(404).json({ 
    error: 'Route not found',
    timestamp: new Date().toISOString()
  });
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message} - ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  console.error(err.stack);
  
  // Don't expose stack traces in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({ 
    error: 'Internal Server Error',
    message: isDevelopment ? err.message : 'Something went wrong!',
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: err.stack })
  });
});

// Export app for Vercel serverless
export default app;

// Start server only when running locally (not on Vercel)
if (!process.env.VERCEL) {
  const gracefulShutdown = (signal) => {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

    server.close(() => {
      console.log('HTTP server closed.');

      mongoose.connection.close(() => {
        console.log('MongoDB connection closed.');
        process.exit(0);
      });
    });

    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  const server = app.listen(PORT, () => {
    console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`Health check available at: http://localhost:${PORT}/health`);
  });

  process.on('unhandledRejection', (err) => {
    console.error(`[UNHANDLED REJECTION] ${err.message}`);
    server.close(() => process.exit(1));
  });

  process.on('uncaughtException', (err) => {
    console.error(`[UNCAUGHT EXCEPTION] ${err.message}`);
    console.error(err.stack);
    gracefulShutdown('SIGTERM');
  });

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
