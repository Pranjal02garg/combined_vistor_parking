const CSRF_ENDPOINT = "/api/auth/csrf";

type CsrfResponse = {
  csrfToken?: string;
};

let cachedCsrfToken: string | null = null;
let inflightCsrfTokenRequest: Promise<string> | null = null;

export async function getClientCsrfToken(): Promise<string> {
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }

  if (!inflightCsrfTokenRequest) {
    inflightCsrfTokenRequest = (async () => {
      const response = await fetch(CSRF_ENDPOINT, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch CSRF token.");
      }

      const data = (await response.json()) as CsrfResponse;
      const token = data.csrfToken;

      if (!token) {
        throw new Error("CSRF token was missing from response.");
      }

      cachedCsrfToken = token;
      return token;
    })().catch((error) => {
      inflightCsrfTokenRequest = null;
      throw error;
    });
  }

  return inflightCsrfTokenRequest;
}

export function clearClientCsrfTokenCache(): void {
  cachedCsrfToken = null;
  inflightCsrfTokenRequest = null;
}