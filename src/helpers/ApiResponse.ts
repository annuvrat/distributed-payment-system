class ApiResponse {
  success: boolean;
  message: string;

  data: any;
  statusCode: number;

  constructor(statusCode: number, data: any, message: string = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }

  static ok(data: any, message: string = 'Success') {
    return new ApiResponse(200, data, message);
  }

  static created(data: any, message: string = 'Created successfully') {
    return new ApiResponse(201, data, message);
  }
}

export { ApiResponse };
