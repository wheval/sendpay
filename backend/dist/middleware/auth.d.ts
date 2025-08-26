import { Request, Response, NextFunction } from 'express';
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
export declare const authenticateToken: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Generate JWT token
 */
export declare const generateToken: (userId: string) => string;
/**
 * Verify JWT token without database lookup
 */
export declare const verifyToken: (token: string) => any;
//# sourceMappingURL=auth.d.ts.map