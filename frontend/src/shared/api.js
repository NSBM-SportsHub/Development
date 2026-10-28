const API_BASE = "/api";
let csrfToken = null;
let sessionRequest = null;
let unauthorizedHandler = () => {};

export class ApiError extends Error {
  constructor(message, { status = 0, code = "REQUEST_FAILED", fields = {} } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields || {};
  }
}

export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
  return () => { unauthorizedHandler = () => {}; };
}

async function request(path, { method = "GET", body, signal, skipCsrf = false } = {}) {
  if (method !== "GET" && !skipCsrf && !csrfToken) await getSession();
  const headers = { Accept: "application/json" };
  if (body !== undefined || method !== "GET") headers["Content-Type"] = "application/json";
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method, headers, credentials: "include", signal,
      ...(body !== undefined || method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("Cannot reach SportsHub. Start the PHP API at http://127.0.0.1:8000 and try again.", { code: "NETWORK_ERROR" });
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("SportsHub could not read the server response. Check that the PHP API is running at http://127.0.0.1:8000.", { status: response.status, code: "INVALID_RESPONSE" });
  }
  if (payload?.data?.csrf_token) csrfToken = payload.data.csrf_token;
  if (!response.ok || payload?.error) {
    if (response.status === 419 || payload?.error?.code === "csrf_mismatch") csrfToken = null;
    if (response.status === 401 && !["/auth/login", "/auth/register"].includes(path)) {
      csrfToken = null;
      unauthorizedHandler();
    }
    throw new ApiError(payload?.error?.message || "The request could not be completed. Please try again.", {
      status: response.status,
      code: payload?.error?.code,
      fields: payload?.error?.fields,
    });
  }
  if (!payload || !("data" in payload)) {
    throw new ApiError("The server returned an unexpected response. Please check the API configuration.", { status: response.status, code: "INVALID_RESPONSE" });
  }
  return payload.data;
}

export function getSession() {
  if (!sessionRequest) {
    sessionRequest = request("/auth/session", { skipCsrf: true }).finally(() => { sessionRequest = null; });
  }
  return sessionRequest;
}

export async function refreshSession() {
  csrfToken = null;
  return getSession();
}

export const api = {
  get: (path, options = {}) => request(path, options),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
};
