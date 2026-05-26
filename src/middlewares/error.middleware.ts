import { Context } from 'hono';
import { ApiError } from '../helpers/ApiError.ts';
import { z } from 'zod';

export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof z.ZodError) {
    return c.json(
      {
        success: false,
        message: err.issues[0]?.message || 'Validation error',
        errors: err.issues,
      },
      400,
    );
  }

  if (err instanceof ApiError) {
    return c.json(
      {
        success: err.success,
        message: err.message,
        errors: err.errors,
        data: err.data,
      },
      err.statusCode as any,
    );
  }

  // Default error response for unhandled errors
  console.error(`[Error]: ${err.stack || err.message}`);
  return c.json(
    {
      success: false,
      message: 'Internal Server Error',
      errors: [err.message],
    },
    500,
  );
};
