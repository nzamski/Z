# Keycloak client for Z

Z logs in with OpenID Connect, authorization code + PKCE, as a **confidential** client
(`openid-client`, `lib/auth/keycloak.ts`). No passwords are stored in Z; users are keyed on the
token's `sub`.

## Client settings

| Setting                         | Value                                                               |
| ------------------------------- | ------------------------------------------------------------------- |
| Client ID                       | `z` (or set `OIDC_CLIENT_ID`)                                       |
| Client authentication           | On (confidential); secret goes to `OIDC_CLIENT_SECRET`              |
| Standard flow                   | On. All other flows (implicit, direct grants, service accounts) off |
| PKCE                            | Required, `S256`                                                    |
| Valid redirect URIs             | `https://<route-host>/auth/callback` (exact, no wildcard)           |
| Valid post-logout redirect URIs | `https://<route-host>/`                                             |
| Web origins                     | `https://<route-host>`                                              |
| Scopes                          | `openid profile`                                                    |

`OIDC_ISSUER` is the realm URL, `https://<keycloak-host>/realms/<realm>`. It must be `https`
in production (the app refuses plain http unless `OIDC_ALLOW_HTTP=1`, which is for local dry
runs only). `APP_URL` must be the public Route URL, since it builds the redirect URI.

The dev realm (`dev/keycloak/realm-z.json`) is the reference: same flow, but `localhost`
redirect URIs, a dev secret and three test users. Never reuse its secret.

## Claim mapping (PLAN.md Q2, still open)

Mapped in `finishLogin` (`lib/auth/keycloak.ts`) on every login:

| Z field        | Claim                | Notes                                                                                                                                                  |
| -------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| identity       | `sub`                | stable key; never changes for a user                                                                                                                   |
| `handle`       | `preferred_username` | falls back to `sub`. Must be unique and stable; if taken by another active user, the new user gets `<handle>_<6 chars of sub>` and a warning is logged |
| `display_name` | `name`               | falls back to `preferred_username`, then `sub`                                                                                                         |

Confirm with the Keycloak admins that `preferred_username` is unique and doesn't get reassigned.
If not, map the handle from another claim (one line in `finishLogin`).

## Sessions and logout

- After login Z keeps its own encrypted cookie session (`z_session`, HttpOnly, Secure,
  SameSite=Lax, `SESSION_MAX_AGE_HOURS`, default 4). It does not refresh Keycloak tokens.
  When it expires, the next page load goes through Keycloak again: silent while the Keycloak
  SSO session lasts, a login form after that. A user disabled in Keycloak keeps using Z until
  then; to cut someone off sooner, suspend them in Z (docs/moderation.md).
- `POST /auth/logout` clears the cookie and redirects to Keycloak's end-session endpoint with
  the ID token hint, ending the SSO session too. (There is no logout button in the UI by
  request; the route exists.)
