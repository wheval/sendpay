import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * Authentication middleware
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const publicKey = process.env.JWT_PUBLIC_KEY_PEM || process.env.JWT_PUBLIC_KEY;
    const issuer = process.env.JWT_ISSUER;
    const audience = process.env.JWT_AUDIENCE;
    if (!publicKey) {
      throw new Error('JWT_PUBLIC_KEY_PEM not configured');
    }

    // Verify JWT token (RS256)
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: issuer || undefined,
      audience: audience || undefined,
    }) as any;
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-__v');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const secret = process.env.JWT_SECRET;
      if (secret) {
        const decoded = jwt.verify(token, secret) as any;
        const user = await User.findById(decoded.userId).select('-__v');
        if (user) {
          req.user = user;
        }
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Generate JWT token
 */
export const generateToken = (userId: string): string => {
  const privateKey = process.env.JWT_PRIVATE_KEY_PEM || process.env.JWT_PRIVATE_KEY;
  const issuer = process.env.JWT_ISSUER;
  const audience = process.env.JWT_AUDIENCE;
  if (!privateKey) {
    throw new Error('JWT_PRIVATE_KEY_PEM not configured');
  }

  return jwt.sign(
    { 
      userId,
      sub: userId  // Add standard 'sub' field for ChipiPay
    },
    privateKey,
    {
      algorithm: 'RS256',
      expiresIn: '7d',
      issuer: issuer || undefined,
      audience: audience || undefined,
    }
  );
};

/**
 * Verify JWT token without database lookup
 */
export const verifyToken = (token: string): any => {
  const publicKey = process.env.JWT_PUBLIC_KEY_PEM || process.env.JWT_PUBLIC_KEY;
  const issuer = process.env.JWT_ISSUER;
  const audience = process.env.JWT_AUDIENCE;
  if (!publicKey) {
    throw new Error('JWT_PUBLIC_KEY_PEM not configured');
  }

  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: issuer || undefined,
    audience: audience || undefined,
  });
};
