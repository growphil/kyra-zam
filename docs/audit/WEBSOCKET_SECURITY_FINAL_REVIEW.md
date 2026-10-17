# KYRA ZAM 2.0 — Final WebSocket Security Hardening & Audit Review

**Document Version:** 1.0.0  
**Date:** October 17, 2026  
**Status:** APPROVED & TESTED (24/24 Tests Passing)  
**Security Classification:** Strict Fail-Closed Handshake Authentication  

---

## 1. Executive Summary

This review documents the architectural elimination of dual-path WebSocket authentication in KYRA ZAM 2.0. Previously, the backend permitted unauthenticated WebSocket connections to connect and remain open for up to 5 seconds pending an in-band `auth` message (`{ type: "auth", token }`). This violated fail-closed security principles, created an ambiguous unauthenticated window, and complicated zero-trust verification.

With this release:
1. **Handshake-Only Authentication**: A WebSocket connection is rejected immediately during connection establishment unless authenticated. Unauthenticated connections never enter the active connection manager (`wsManager`).
2. **Deterministic RFC 6455 Policy Violation Close Code**: Connections without a valid, unexpired token or with inactive/non-existent users are closed with WebSocket close code **`1008` (Policy Violation)** and reason `"Authentication required"`.
3. **In-Band Path & Timeout Eradicated**: The 5-second unauthenticated grace period and the in-band `{ type: "auth" }` message handler have been completely removed.
4. **Database-Authoritative Authorization**: User roles and active status are fetched directly from PostgreSQL (`prisma.user.findUnique({ where: { id: payload.id } })`). Tokens cannot elevate privileges or keep de-activated accounts connected.
5. **Standardized Browser Client Transport**: The frontend client (`RealtimeProvider.tsx`) negotiates authentication using the RFC 6455 standard `Sec-WebSocket-Protocol: ["bearer", "<token>"]` subprotocol, which is fully supported by all modern browsers without exposing credentials in URLs or query strings.
6. **No Token Leakage**: Tokens are forbidden in URL query parameters (`/ws?token=...` is rejected with `1008`) and are excluded from console/stdout logging.

---

## 2. Architecture Comparison

| Dimension | Previous State (Dual-Path) | Hardened State (Strict Handshake-Only) |
| :--- | :--- | :--- |
| **Authentication Flow** | Handshake OR 5-second unauthenticated window with in-band `{ type: "auth", token }` message | Handshake only (`Sec-WebSocket-Protocol` or `Authorization` header) |
| **Fail-Closed Guarantee** | Ambiguous: Unauthenticated sockets opened and sat idle | Strict: Socket is rejected and closed with code `1008` immediately |
| **Unauthenticated Timeout** | 5-second `setTimeout` holding resources | None (Zero resource allocation for unauthenticated requests) |
| **Role Assignment** | Handshake or in-band message | Exclusively derived from `prisma.user.findUnique` database roles |
| **Deactivated Account Handling** | Could stay connected if token was valid until timeout | Handshake fails if `user.isActive === false` |
| **URL Query Parameter `?token=`** | Ambiguous transport risk | Rejected with close code `1008` (avoids access log leakage) |
| **Close Code** | Code `1008` only after 5s timeout or bad message | Immediate code `1008` (Policy Violation) |

---

## 3. Implementation Details

### 3.1 Backend Route Hardening (`backend/src/routes/websocket.ts`)
- The WebSocket route handler extracts the token strictly from:
  1. `request.headers.authorization` (for programmatic Node.js / mobile clients), OR
  2. `request.headers["sec-websocket-protocol"]` parsed for the `bearer` subprotocol format (`bearer, <token>`).
- If missing, invalid, or expired: emits an error event payload and triggers `connection.socket.close(1008, "Authentication required")`.
- Queries `prisma.user.findUnique({ where: { id: payload.id }, select: { id: true, roles: true, isActive: true } })`.
- If user does not exist or `isActive === false`: closes connection with code `1008`.
- Only upon complete validation does `wsManager.add(userId, userRoles, connection)` execute.
- Authenticated sockets support heartbeat ping-pong (`{ type: "ping" }` -> `{ event: "pong", timestamp }`).

### 3.2 Subprotocol Negotiation Plugin (`backend/src/plugins/websocket.ts`)
- Configured `@fastify/websocket` with custom `handleProtocols: (protocols) => protocols.has("bearer") ? "bearer" : false`.
- This ensures RFC 6455 compliance: the server acknowledges the `"bearer"` protocol back to the browser in the HTTP 101 Switching Protocols response header, preventing browser disconnects.

### 3.3 Server Modularization (`backend/src/server.ts`)
- Replaced the previous 140+ line inline route definition with `await app.register(websocketRoutes)`.
- Eliminates code duplication and guarantees identical WebSocket configuration in both production and integration test environments.

### 3.4 Frontend Client (`frontend/src/components/providers/RealtimeProvider.tsx`)
- Updated connection instantiation:
  ```typescript
  const ws = new WebSocket(wsUrl, ["bearer", token]);
  ```
- Guarded connection initiation: if `!token`, sets status to `"disconnected"` and avoids opening unauthenticated sockets.
- Removed `{ type: "auth", token }` message emit from `ws.onopen`.
- On close code `1008`, postpones reconnect with a backoff delay until the user's authentication credentials refresh.

---

## 4. Test Suite Execution & Verification Evidence

All 24 security, auth, and WebSocket integration tests run against real HTTP and WebSocket network listeners using `node -r ts-node/register --test`.

### 4.1 Test Results Output
```text
> backend@1.0.0 test
> node -r ts-node/register --test src/__tests__/*.test.ts

▶ Batch B — Authentication Hardening (CORS, Query Tokens, Expiry, Rotation)
  ▶ B1: CORS Origin Whitelisting
    ✔ 1. Approved origin (localhost:3000) receives CORS allow headers with credentials
    ✔ 2. Untrusted origin (https://evil-attacker.com) is NOT reflected in Access-Control-Allow-Origin
    ✔ 3. Preflight OPTIONS for untrusted origin does not receive CORS allow headers
    ✔ 4. Request without Origin header (server-to-server / curl) succeeds without CORS error
  ✔ B1: CORS Origin Whitelisting
  ▶ B2: JWT Transport Hardening
    ✔ 5. fastify.authenticate rejects token passed exclusively via ?token= query parameter
    ✔ 6. requireRoles rejects token passed exclusively via ?token= query parameter
    ✔ 7. Legitimate request with Authorization: Bearer header succeeds
  ✔ B2: JWT Transport Hardening
  ▶ B3: Token Expiry Alignment
    ✔ 8. Login access token expires in 60m (3600s), NOT 365 days (31536000s)
  ✔ B3: Token Expiry Alignment
  ▶ B4: Refresh Token Rotation & Replay Rejection
    ✔ 9. Successful refresh rotates token and returns new token pair
    ✔ 10. Replaying an already-used refresh token triggers replay detection and revokes all sessions
    ✔ 11. Invalid refresh token format and non-existent tokens fail cleanly with 400 or 401
  ✔ B4: Refresh Token Rotation & Replay Rejection
✔ Batch B — Authentication Hardening (CORS, Query Tokens, Expiry, Rotation)

▶ Batch A — Critical Security & Identity Verification
  ✔ 1. Legitimate active Superadmin can access protected routes
  ✔ 2. Legitimate user without required role receives 403 Forbidden
  ✔ 3. Deactivated user token is rejected with 401 or 403
  ✔ 4. VULNERABILITY REPRODUCTION (RISK-CRIT-01): Token with non-existent user ID must be rejected with 401
  ✔ 5. VULNERABILITY REPRODUCTION (RISK-CRIT-02): Unauthenticated clients in WebSocket manager must not have privileged roles
  ✔ 6. Authorization is derived from database roles, not client-provided role claims
  ✔ 7. WebSocket handshake rejects missing token with close code 1008
  ✔ 8. WebSocket handshake rejects invalid/malformed token with close code 1008
  ✔ 9. WebSocket handshake rejects expired token with close code 1008
  ✔ 10. WebSocket handshake rejects inactive/deactivated user with close code 1008
  ✔ 11. WebSocket handshake rejects non-existent user ID with close code 1008
  ✔ 12. WebSocket handshake rejects token sent in query parameter with close code 1008
  ✔ 13. WebSocket successfully authenticates valid user via handshake subprotocol, derives DB roles, and supports ping/pong
✔ Batch A — Critical Security & Identity Verification

ℹ tests 24
ℹ suites 6
ℹ pass 24
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

### 4.2 WebSocket Test Matrix Breakdown

| Test ID | Scenario Tested | Client Request | Expected Result | Verified Result |
| :--- | :--- | :--- | :--- | :--- |
| **Test 7** | Missing Handshake Token | `ws://host/ws` (no headers) | Close code `1008`, error message event | **PASS (1008)** |
| **Test 8** | Malformed / Invalid JWT | `protocols: ["bearer", "bogus.token"]` | Close code `1008`, error message event | **PASS (1008)** |
| **Test 9** | Expired JWT | `protocols: ["bearer", <expired-jwt>]` | Close code `1008`, error message event | **PASS (1008)** |
| **Test 10** | Deactivated User Account | Token for user with `isActive: false` | Close code `1008`, rejected at DB check | **PASS (1008)** |
| **Test 11** | Non-Existent User ID | Validly signed JWT with non-existent UUID | Close code `1008`, rejected at DB check | **PASS (1008)** |
| **Test 12** | Query Parameter Token Leakage | `ws://host/ws?token=<token>` (no handshake) | Close code `1008`, query token ignored | **PASS (1008)** |
| **Test 13** | Legitimate Authenticated User | `protocols: ["bearer", <valid-token>]` | HTTP 101 upgrade, `ws:connected`, ping/pong ok | **PASS (Connected)** |

---

## 5. Build and Static Quality Verification

1. **Backend TypeScript Compilation (`npm run build` in `backend/`)**:
   - Command: `tsc`
   - Exit Code: `0` (Zero compiler diagnostics or typing errors).
2. **Frontend Production Build (`npm run build` in `frontend/`)**:
   - Command: `next build`
   - Exit Code: `0` (All 80+ dynamic and static app routes compiled successfully).
3. **Git Whitespace & Formatting Check**:
   - Command: `git diff --check`
   - Exit Code: `0` (No whitespace errors, trailing whitespace, or merge artifacts).

---

## 6. Client & Browser Compatibility Assessment

### 6.1 Browser `Sec-WebSocket-Protocol` Compatibility
- **Browser Standard**: The W3C `WebSocket` constructor `new WebSocket(url, protocols)` accepts a subprotocol string or array of strings across all modern browsers:
  - Chrome / Chromium (v16+)
  - Firefox (v11+)
  - Safari (v6+)
  - Edge (all versions)
  - iOS Safari & Android Chrome
- **Standard Limitation**: Standard browser `WebSocket` APIs do **not** support custom HTTP headers (such as `Authorization: Bearer ...`). Therefore, passing the token via `Sec-WebSocket-Protocol: ["bearer", "<token>"]` is the industry-standard mechanism for authenticating browser WebSockets without URL query string credential exposure.
- **RFC 6455 Handshake Rule**: When a client requests `["bearer", "<token>"]`, the server must acknowledge a negotiated protocol in the HTTP 101 response (`Sec-WebSocket-Protocol: bearer`). Our `@fastify/websocket` plugin configuration (`handleProtocols: (protocols) => protocols.has("bearer") ? "bearer" : false`) complies with this requirement.

### 6.2 Token Expiration & Rotation in Long-Lived Sockets
- WebSockets maintain an established TCP connection. If an access token expires while a connection is already open, the connection continues until closed or until the client reconnects.
- On connection close or reconnect, the client must obtain an updated access token (via the refresh token endpoint) to pass the new handshake.
- If the user account is deactivated in the database during an active session, administrative actions or next-connection handshakes immediately reject reconnection.

---

## 7. Audit Conclusion & Next Steps

The WebSocket authentication mechanism is now verified as:
- **Strictly Fail-Closed**
- **Single-Path (Handshake Only)**
- **Database-Authoritative**
- **Free of In-Band Authentication Vulnerabilities & Unauthenticated Resource Leaks**
- **Free of URL Query Parameter Credential Leaks**

All code changes are tested, compiled, and ready for commit and deployment via GitHub Desktop.
