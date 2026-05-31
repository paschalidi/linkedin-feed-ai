/**
 * Get the current site URL for auth redirects.
 * Works across local dev, Vercel preview, and Vercel production.
 */
export function getURL(): string {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set this in production env
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Auto-set by Vercel
    "http://localhost:3000/";

  // Make sure to include `https://` when not localhost
  url = url.startsWith("http") ? url : `https://${url}`;

  // Make sure to include a trailing `/`
  url = url.endsWith("/") ? url : `${url}/`;

  return url;
}
