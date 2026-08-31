# Security Audit

## Summary

LedgerView is not yet production-safe. The codebase shows a functional prototype architecture, but several security controls are still missing or intentionally simplified for demonstration purposes.

## Findings

### 1. Secrets exposure

- The repo does not currently commit real secrets.
- However, the app depends on environment variables for production secrets, and they must be managed outside the repo.
- Risk: medium if `.env` is accidentally committed or if environment variables are printed in logs.

### 2. Frontend API keys

- No frontend API keys are used in the static HTML client.
- This is good practice.
- However, the frontend still contains a simulated backend connection flow, which should be restricted to approved origins.

### 3. JWT weaknesses

- JWTs are signed with a secret and have expiration times, which is acceptable.
- The prototype still uses a simple bearer token flow and should add refresh rotation, secret rotation, and stronger token revocation measures in production.

### 4. CORS issues

- `CORS_ORIGIN` is implemented via a configured allowlist, which is good.
- Risk remains if the deployed default is too permissive or includes wildcard origins.

### 5. Input validation

- OTP phone validation exists.
- Watchlist inputs are validated for required names and symbol values.
- More validation is needed for rate limiting and malformed requests in public production deployment.

### 6. Rate limiting

- Not implemented.
- Public APIs should be rate-limited at the reverse proxy or app level.

### 7. Mongo injection risk

- Mongoose prevents much of the risk, but additional validation and strict query patterns are recommended.
- The app should also enforce schema-level sanitization and reject unsafe query patterns.

### 8. XSS risk

- The frontend is static markup and uses a fair amount of dynamically generated HTML.
- Since it is a client-only document, it should avoid unescaped user content before public release.
- Any user-entered profile or watchlist names should be sanitized before rendering.

## Recommendations

1. Use a real secret manager and never commit `.env` files.
2. Restrict CORS to exact, approved domains.
3. Add rate limiting and request validation.
4. Implement a proper SMS OTP provider.
5. Add structured request logging and monitoring.
6. Use a sanitization layer for user-controlled strings.
7. Review third-party package vulnerabilities and patch them routinely.
