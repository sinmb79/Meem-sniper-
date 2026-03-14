export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 10_000
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Request failed (${response.status}): ${body}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function retry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 500): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) {
        break;
      }

      const delayMs = baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
