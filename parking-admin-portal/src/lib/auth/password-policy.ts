import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/constants";

const asciiUppercase = /[A-Z]/;
const asciiLowercase = /[a-z]/;
const numberPattern = /[0-9]/;
const symbolPattern = /[^A-Za-z0-9]/;

function hasUppercase(value: string): boolean {
  if (asciiUppercase.test(value)) {
    return true;
  }

  // Fallback that works in older browsers without Unicode property escapes.
  return value.toLowerCase() !== value;
}

function hasLowercase(value: string): boolean {
  if (asciiLowercase.test(value)) {
    return true;
  }

  // Fallback that works in older browsers without Unicode property escapes.
  return value.toUpperCase() !== value;
}

function hasNumber(value: string): boolean {
  return numberPattern.test(value);
}

function hasSymbol(value: string): boolean {
  return symbolPattern.test(value);
}

export function getPasswordValidationErrors(password: string): string[] {
  const errors: string[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    );
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(
      `Password must be at most ${MAX_PASSWORD_LENGTH} characters long.`,
    );
  }

  if (!hasUppercase(password)) {
    errors.push("Password must include at least one uppercase letter.");
  }

  if (!hasLowercase(password)) {
    errors.push("Password must include at least one lowercase letter.");
  }

  if (!hasNumber(password)) {
    errors.push("Password must include at least one number.");
  }

  if (!hasSymbol(password)) {
    errors.push("Password must include at least one symbol.");
  }

  return errors;
}

export function isPasswordValid(password: string): boolean {
  return getPasswordValidationErrors(password).length === 0;
}

export function getPasswordChecklist(password: string) {
  return {
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    maxLength: password.length <= MAX_PASSWORD_LENGTH,
    uppercase: hasUppercase(password),
    lowercase: hasLowercase(password),
    number: hasNumber(password),
    symbol: hasSymbol(password),
  };
}
