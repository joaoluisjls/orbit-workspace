import { createFileRoute } from "@tanstack/react-router";

// The public GET leg of the Mercado Livre OAuth callback.
// Lovable Cloud serves the app under /_server, so the endpoint is:
//   https://<app>/.server/marketplace/ml-oauth?state=...&code=...
// Register that exact URL as the redirect URI in Mercado Livre DevCenter.
export const Route = createFileRoute("/_server/marketplace/ml-oauth")({
  // Server handlers for the Mercado Livre OAuth flow live in
  // src/server/marketplace-ml-oauth.server.ts; Lovable Cloud's runtime attaches
  // mlOauthGet/mlOauthPost to this file route.
  component: () => null,
});
