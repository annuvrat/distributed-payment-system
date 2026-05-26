class ApiError extends Error {
  statusCode: number;
  data: any;
  message: string;
  success: boolean;
  errors: any[];

  constructor(
    statusCode: number,
    message: string = 'Something went wrong',
    errors: any[] = [],
    stack: string = '',
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message: string = 'Bad Request', errors: any[] = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message: string = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message: string = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message: string = 'Not Found') {
    return new ApiError(404, message);
  }

  static internal(message: string = 'Internal Server Error') {
    return new ApiError(500, message);
  }
}

export { ApiError };
