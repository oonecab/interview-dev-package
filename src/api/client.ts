const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

export interface RequestOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>;
  headers?: Record<string, string>;
}

export class ApiRequestError extends Error {
  status: number;
  serverMessage: string;

  constructor(status: number, serverMessage: string) {
    super(`API Error ${status}: ${serverMessage}`);
    this.name = 'ApiRequestError';
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const url = new URL(path, BASE_URL);

  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers: Record<string, string> = {
    ...options.headers,
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let serverMessage = res.statusText;
    try {
      const errorBody = await res.json();
      serverMessage = errorBody.message ?? errorBody.error ?? res.statusText;
    } catch {
      // ignore parse error
    }
    throw new ApiRequestError(res.status, serverMessage);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get<T>(path: string, options?: RequestOptions) {
    return request<T>('GET', path, undefined, options);
  },
  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>('POST', path, body, options);
  },
  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return request<T>('PATCH', path, body, options);
  },
};
