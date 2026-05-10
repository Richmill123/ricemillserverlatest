import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// In-memory store for rate limiting
const memoryStore = new Map();

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of memoryStore.entries()) {
    if (data.resetTime.getTime() <= now) {
      memoryStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

// Rate limiting configurations
export const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    // trust proxy is set at the app level (app.set('trust proxy', 1));
    // disable the duplicate header check to prevent ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
    validate: { xForwardedForHeader: false },
    store: {
      async increment(key) {
        const now = Date.now();
        const existing = memoryStore.get(key);
        
        if (!existing || existing.resetTime.getTime() <= now) {
          const newData = {
            totalHits: 1,
            resetTime: new Date(now + windowMs)
          };
          memoryStore.set(key, newData);
          return newData;
        }
        
        existing.totalHits++;
        return existing;
      },
      async decrement(key) {
        const existing = memoryStore.get(key);
        if (existing && existing.totalHits > 0) {
          existing.totalHits--;
        }
      },
      async resetKey(key) {
        memoryStore.delete(key);
      }
    }
  });
};

// Different rate limits for different endpoints — values read from env
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000;

export const authRateLimit = createRateLimit(
  windowMs,
  parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 50,
  'Too many authentication attempts, please try again later'
);

export const generalRateLimit = createRateLimit(
  windowMs,
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 200,
  'Too many requests from this IP, please try again later'
);

export const strictRateLimit = createRateLimit(
  windowMs,
  parseInt(process.env.STRICT_RATE_LIMIT_MAX, 10) || 50,
  'Too many requests from this IP, please try again later'
);

// Security headers configuration
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// CORS configuration
export const corsOptions = {
  origin: function (origin, callback) {
    // Allow no-origin requests (curl, mobile) and null-origin (file:// pages)
    if (!origin || origin === 'null') return callback(null, true);

    // If ALLOWED_ORIGINS is set, enforce the whitelist; otherwise allow all
    if (process.env.ALLOWED_ORIGINS) {
      const allowed = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
      return callback(null, allowed.includes(origin));
    }

    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400
};

// Input validation patterns
export const validationPatterns = {
  username: /^[a-zA-Z0-9_\\/]{3,20}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s\-\(\)]+$/,
  alphanumeric: /^[a-zA-Z0-9\s\-_.,]+$/,
  amount: /^\d+(\.\d{1,2})?$/,
  quantity: /^\d+$/,
  clientId: /^[a-f\d]{24}$/i
};

// Security middleware functions
export const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Remove potential XSS characters
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else if (typeof value === 'object') {
        sanitized[key] = sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };
  
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  
  next();
};

// Request logging for security monitoring
export const securityLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - IP: ${ip} - User-Agent: ${userAgent}`);
  
  // Log suspicious activities
  if (req.path.includes('/admin') || req.path.includes('/login')) {
    console.log(`[SECURITY] Admin access attempt: ${req.method} ${req.originalUrl} from IP: ${ip}`);
  }
  
  next();
};

export default {
  authRateLimit,
  generalRateLimit,
  strictRateLimit,
  helmetConfig,
  corsOptions,
  validationPatterns,
  sanitizeInput,
  securityLogger
};
