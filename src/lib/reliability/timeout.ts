export class OperationTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(`${operation} timed out after ${timeoutMs}ms.`);
    this.name = "OperationTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  const resolvedTimeout = Math.max(1, Math.round(timeoutMs));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new OperationTimeoutError(label, resolvedTimeout)), resolvedTimeout);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function timeoutMs(envName: string, fallback: number) {
  const value = Number(process.env[envName]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}