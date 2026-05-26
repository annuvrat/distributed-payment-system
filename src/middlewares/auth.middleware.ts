import { Context, type Next } from 'hono';
import { verify } from 'hono/jwt';
import { ApiError } from '../helpers/ApiError.ts';

export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Access token is missing or invalid');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = await verify(
      token as string,
      process.env.JWT_SECRET as string,
      'HS256',
    );
    c.set('jwtPayload', payload);
    await next();
  } catch (error) {
    throw ApiError.unauthorized('Invalid or expired access token');
  }
};
