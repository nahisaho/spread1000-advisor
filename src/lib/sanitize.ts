export function sanitizeExcelCell(value: string): string {
  const dangerousChars = ['=', '+', '-', '@'];
  if (dangerousChars.some((c) => value.startsWith(c))) {
    return `'${value}`;
  }
  return value;
}

export function validateEndpointUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname;
    // Allow localhost and 127.0.0.1 for Ollama
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    // Block private/internal IPs
    if (/^(10|172\.(1[6-9]|2\d|3[01])|192\.168)\./.test(hostname)) return false;
    if (hostname === '169.254.169.254') return false; // cloud metadata endpoint
    return true;
  } catch {
    return false;
  }
}
