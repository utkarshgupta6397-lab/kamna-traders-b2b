/**
 * Validates the Origin or Referer header against the Host header to protect against CSRF.
 * @param request The incoming Request object.
 * @returns boolean True if the origin is valid or cannot be definitively proven invalid, false if a cross-site request is detected.
 */
export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  const forwardedHost = request.headers.get('x-forwarded-host');

  if (!host && !forwardedHost) {
    return true; // Be lenient if host cannot be determined
  }

  const isMatchingHost = (targetHost: string) => {
    if (host && targetHost.toLowerCase() === host.toLowerCase()) return true;
    if (forwardedHost && targetHost.toLowerCase() === forwardedHost.toLowerCase()) return true;
    if (host && targetHost.split(':')[0].toLowerCase() === host.split(':')[0].toLowerCase()) return true;
    if (forwardedHost && targetHost.split(':')[0].toLowerCase() === forwardedHost.split(':')[0].toLowerCase()) return true;
    return false;
  };

  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (!isMatchingHost(originUrl.host)) {
        return false;
      }
    } catch {
      return false;
    }
  } else if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (!isMatchingHost(refererUrl.host)) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}
