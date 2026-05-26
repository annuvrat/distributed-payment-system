import { Context, type Next } from 'hono';
import { ApiError } from '../helpers/ApiError.ts';

export const requireRole = (allowedRoles: string[]) => {
  return async (c: Context, next: Next) => {
    const payload = c.get('jwtPayload') as any;
    
    if (!payload || !payload.role) {
      throw ApiError.unauthorized("Authentication required or role missing");
    }

    if (!allowedRoles.includes(payload.role)) {
      throw ApiError.forbidden("You do not have permission to access this resource");
    }

    await next();
  };
};
