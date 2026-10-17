import type { AuthProvider } from "./provider";

// Pick any seeded user at /dev/login. Never available when NODE_ENV=production.
export const devProvider: AuthProvider = {
  loginUrl: async () => "/dev/login",
  logoutUrl: async () => "/",
};
