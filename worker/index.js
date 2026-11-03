// docs.ingestron.io Worker. Serves the static Next export from ASSETS and adds
// the root redirect, the moved-page redirects (redirects.js) and security
// headers. Keep it tiny: the Workers Free plan
// allows 10 ms CPU per request.

import { redirectFor } from "./redirects.js";

const securityHeaders = [
  ["Strict-Transport-Security", "max-age=31536000; includeSubDomains"],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["X-Frame-Options", "DENY"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()"],
];

export function redirectResponseFor(url, table) {
  if (url.pathname === "/" || url.pathname === "") {
    return { location: `${url.origin}/docs${url.search}`, status: 307 };
  }
  const target = redirectFor(url, table);
  return target === undefined ? null : { location: `${url.origin}${target}`, status: 301 };
}

export function cacheControlFor(pathname) {
  if (pathname.startsWith("/_next/static/")) return "public, max-age=31536000, immutable";
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const redirect = redirectResponseFor(url);
    if (redirect) {
      return new Response(null, {
        status: redirect.status,
        headers: { Location: redirect.location },
      });
    }
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    for (const [name, value] of securityHeaders) headers.set(name, value);
    const cacheControl = cacheControlFor(url.pathname);
    if (cacheControl) headers.set("Cache-Control", cacheControl);
    if (url.pathname === "/api/search") headers.set("Content-Type", "application/json");
    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers,
    });
  },
};
