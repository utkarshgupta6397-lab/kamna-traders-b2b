/**
 * Validates the Origin or Referer header against the Host header to protect against CSRF.
 * @param request The incoming Request object.
 * @returns boolean True if the origin is valid or cannot be definitively proven invalid, false if a cross-site request is detected.
 */
export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host');

  if (!host) {
    return true; // Be lenient if host cannot be determined
  }

  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return false;
      }
    } catch {
      return false;
    }
  } else if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host !== host) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}
