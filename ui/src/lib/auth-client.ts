import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { polarClient } from "@polar-sh/better-auth/client";

const isCloudMode = !!process.env.NEXT_PUBLIC_CONVEX_URL;

// Local mode: no-op auth client that never touches the network
const noopSession = { data: null, isPending: false, error: null };
const noopClient = {
  useSession: () => noopSession,
  signIn: { email: async () => ({ error: null }) },
  signUp: { email: async () => ({ error: null }) },
  signOut: async () => {},
  checkoutEmbed: async () => {},
} as unknown as ReturnType<typeof createAuthClient>;

function buildClient() {
  if (!isCloudMode) return noopClient;
  return createAuthClient({
    plugins: [convexClient(), polarClient()],
  });
}

export const authClient = buildClient();
export const { useSession, signIn, signUp, signOut } = authClient;
