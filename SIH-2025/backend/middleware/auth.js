const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Express authentication middleware
 * Verifies JWT token and attaches user data to request
 */
const auth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.header('Authorization');
    let token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    // Treat non-tokens as missing
    if (token && (token === 'null' || token === 'undefined' || token.trim() === '')) {
      token = null;
    }

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token. User not found.' 
      });
    }

    // Attach user data to request
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    });
  }
};

module.exports = auth;
