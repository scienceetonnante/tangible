// Extract a concise provider message for local diagnostics without retaining
// arbitrary response bodies.

export async function readProviderErrorMessage(response: Response): Promise<string | undefined> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return undefined;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;

  const record = body as Record<string, unknown>;
  const error = record.error;
  let message: unknown = record.message;
  if (typeof error === "string") message = error;
  else if (error && typeof error === "object" && !Array.isArray(error)) {
    message = (error as Record<string, unknown>).message;
  }
  if (typeof message !== "string") return undefined;

  const concise = message
    .replace(/\b(?:sk-|hf_)[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  return concise || undefined;
}
