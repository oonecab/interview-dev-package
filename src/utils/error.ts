import { ApiRequestError } from '../api/client';

/** Extract a human-readable message from any error value. */
export function getErrorMessage(error: unknown, fallback = '未知错误'): string {
  if (error instanceof ApiRequestError) {
    return error.serverMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
