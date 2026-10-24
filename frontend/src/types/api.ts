export interface ApiHealthResponse {
  status: string;
  app_name: string;
  version: string;
  timestamp: string;
  environment: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  path?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
