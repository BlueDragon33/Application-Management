import { clearAdminSessionCookie, safeReturnPath } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnPath(url.searchParams.get("return_to") || "/login");
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL(returnTo, request.url).toString(),
      "set-cookie": clearAdminSessionCookie(),
      "cache-control": "no-store, private",
    },
  });
}
