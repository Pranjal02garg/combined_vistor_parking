export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-session" : "session";
export const CSRF_COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-csrf" : "csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const ACCOUNT_LOCK_MS = 1000 * 60 * 15;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export const LOGIN_RATE_LIMIT_MAX = 8;
export const REGISTER_RATE_LIMIT_MAX = 5;
export const LOGOUT_RATE_LIMIT_MAX = 20;
export const AUTH_RATE_LIMIT_WINDOW_MS = 1000 * 60;

export const MOBILE_LOGIN_RATE_LIMIT_MAX = 8;
export const MOBILE_PASSWORD_CHANGE_RATE_LIMIT_MAX = 5;
export const MOBILE_PROFILE_RATE_LIMIT_MAX = 12;
