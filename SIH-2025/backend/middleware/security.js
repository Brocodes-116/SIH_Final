const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');

/**
 * Security middleware for enhanced protection
 */

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message || 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: message || 'Too many requests, please try again later.',
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// General API rate limiting (raised to accommodate dashboard polling)
const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  2000, // allow up to 2000 requests per window per IP (for dashboard polling)
  'Too many API requests, please try again later.'
);

// Authentication rate limiting (stricter)
const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 login attempts per window
  'Too many authentication attempts, please try again later.'
);

// Position update rate limiting
const positionRateLimit = createRateLimit(
  60 * 1000, // 1 minute
  20, // 20 position updates per minute
  'Too many position updates, please slow down.'
);

// SOS rate limiting (reasonable for emergency situations)
const sosRateLimit = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  10, // 10 SOS calls per 5 minutes (allows for testing and real emergencies)
  'Too many SOS calls, please wait before trying again.'
);

// Geofencing management rate limiting
const geofencingRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  20, // 20 geofencing operations per window
  'Too many geofencing operations, please slow down.'
);

// Input validation middleware
const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input data',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Validation rules
const authValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').optional().isLength({ min: 2 }).withMessage('Name must be at least 2 characters')
];

const positionValidation = [
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('lon').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('accuracy').optional().isFloat({ min: 0 }).withMessage('Accuracy must be a positive number'),
  body('timestamp').isISO8601().withMessage('Valid timestamp is required')
];

const geofencingValidation = [
  body('name').isLength({ min: 1, max: 100 }).withMessage('Zone name must be 1-100 characters'),
  body('coordinates').isArray({ min: 3 }).withMessage('Coordinates must be an array with at least 3 points'),
  body('alertLevel').optional().isIn(['low', 'medium', 'high']).withMessage('Alert level must be low, medium, or high'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description must be less than 500 characters')
];

// Security headers middleware
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  
  req.requestId = requestId;
  req.startTime = start;
  
  // Log request (use originalUrl to include mounted prefixes)
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${req.ip} - ${requestId}`);
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 400 ? 'ERROR' : 'INFO';
    
    console.log(`[${new Date().toISOString()}] ${level} ${req.method} ${req.originalUrl} - ${status} - ${duration}ms - ${requestId}`);
  });
  
  next();
};

// IP whitelist middleware (for admin operations)
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    if (allowedIPs.length === 0) {
      return next(); // No whitelist configured
    }
    
    const clientIP = req.ip || req.connection.remoteAddress;
    const isAllowed = allowedIPs.some(ip => {
      if (ip.includes('/')) {
        // CIDR notation support
        return isIPInCIDR(clientIP, ip);
      }
      return clientIP === ip;
    });
    
    if (!isAllowed) {
      console.log(`Blocked request from unauthorized IP: ${clientIP}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied from this IP address'
      });
    }
    
    next();
  };
};

// Simple CIDR check (basic implementation)
const isIPInCIDR = (ip, cidr) => {
  // This is a simplified implementation
  // In production, use a proper CIDR library
  const [network, prefix] = cidr.split('/');
  const ipParts = ip.split('.').map(Number);
  const networkParts = network.split('.').map(Number);
  
  if (ipParts.length !== 4 || networkParts.length !== 4) {
    return false;
  }
  
  const mask = (0xffffffff << (32 - parseInt(prefix))) >>> 0;
  const ipInt = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const networkInt = (networkParts[0] << 24) | (networkParts[1] << 16) | (networkParts[2] << 8) | networkParts[3];
  
  return (ipInt & mask) === (networkInt & mask);
};

// Data sanitization middleware
const sanitizeData = (req, res, next) => {
  // Remove potentially dangerous characters from string inputs
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  };
  
  // Recursively sanitize object
  const sanitizeObject = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitizeString(obj);
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    if (typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };
  
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  next();
};

// Privacy controls middleware
const privacyControls = (req, res, next) => {
  // Add privacy headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Add privacy notice header
  res.setHeader('X-Privacy-Notice', 'Location data is collected for safety purposes only');
  
  next();
};

// Location data validation
const validateLocationData = (req, res, next) => {
  const { lat, lon, accuracy } = req.body;
  
  // Check for reasonable location bounds (basic validation)
  if (lat !== undefined && (lat < -90 || lat > 90)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid latitude value'
    });
  }
  
  if (lon !== undefined && (lon < -180 || lon > 180)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid longitude value'
    });
  }
  
  if (accuracy !== undefined && (accuracy < 0 || accuracy > 1000)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid accuracy value'
    });
  }
  
  next();
};

module.exports = {
  // Rate limiting
  generalRateLimit,
  authRateLimit,
  positionRateLimit,
  sosRateLimit,
  geofencingRateLimit,
  
  // Validation
  validateInput,
  authValidation,
  positionValidation,
  geofencingValidation,
  body,
  
  // Security
  securityHeaders,
  requestLogger,
  ipWhitelist,
  sanitizeData,
  privacyControls,
  validateLocationData
};
