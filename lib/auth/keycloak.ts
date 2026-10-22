// Keycloak via openid-client: authorization code + PKCE, confidential client, RP-initiated logout.
import * as oidc from "openid-client";
import { cookies } from "next/headers";
import { appUrl, type AuthProvider } from "./provider";
import { cookieOptions, seal, unseal } from "./session";

const TX_COOKIE = "z_oidc";
const TX_MAX_AGE_S = 600;

// Production requires an https issuer. OIDC_ALLOW_HTTP=1 lifts that for a local dry run of the
// production image against the compose Keycloak only (docs/deploy.md); never in a real deployment.
function allowHttp() {
  if (process.env.NODE_ENV !== "production") return true;
  if (process.env.OIDC_ALLOW_HTTP !== "1") return false;
  console.warn("OIDC_ALLOW_HTTP=1: plain-http OIDC in production mode. Local dry runs only!");
  return true;
}

let config: Promise<oidc.Configuration> | undefined;
function getConfig() {
  config ??= oidc
    .discovery(
      new URL(process.env.OIDC_ISSUER!),
      process.env.OIDC_CLIENT_ID!,
      undefined,
      oidc.ClientSecretPost(process.env.OIDC_CLIENT_SECRET!),
      // The dev Keycloak is plain http; real issuers must be https.
      allowHttp() ? { execute: [oidc.allowInsecureRequests] } : undefined,
    )
    .catch((e) => {
      config = undefined; // retry discovery on the next request
      throw e;
    });
  return config;
}

const redirectUri = () => appUrl("/auth/callback").href;

export const keycloakProvider: AuthProvider = {
  async loginUrl(next) {
    const cfg = await getConfig();
    const verifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    (await cookies()).set(
      TX_COOKIE,
      await seal({ verifier, state, nonce, next }, TX_MAX_AGE_S),
      cookieOptions(TX_MAX_AGE_S),
    );
    return oidc.buildAuthorizationUrl(cfg, {
      redirect_uri: redirectUri(),
      scope: "openid profile",
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
      state,
      nonce,
    }).href;
  },

  async logoutUrl(idToken) {
    const cfg = await getConfig();
    return oidc.buildEndSessionUrl(cfg, {
      post_logout_redirect_uri: appUrl("/").href,
      ...(idToken ? { id_token_hint: idToken } : { client_id: process.env.OIDC_CLIENT_ID! }),
    }).href;
  },
};

export type Claims = { sub: string; displayName: string };

/** Completes the code flow for the callback URL; returns the mapped claims and the ID token. */
export async function finishLogin(callbackUrl: URL) {
  const jar = await cookies();
  const tx = await unseal<{ verifier: string; state: string; nonce: string; next: string }>(
    jar.get(TX_COOKIE)?.value,
  );
  jar.delete(TX_COOKIE);
  if (!tx) throw new Error("login transaction missing or expired");

  const tokens = await oidc.authorizationCodeGrant(await getConfig(), callbackUrl, {
    pkceCodeVerifier: tx.verifier,
    expectedState: tx.state,
    expectedNonce: tx.nonce,
    idTokenExpected: true,
  });
  const c = tokens.claims()!;
  // Claim mapping: adjust here once the network's claims are confirmed.
  // Only identity and the display name come from Keycloak; the handle is chosen in Z.
  const claims: Claims = {
    sub: c.sub,
    displayName: String(c.name ?? c.preferred_username ?? c.sub),
  };
  return { claims, idToken: tokens.id_token, next: tx.next };
}
