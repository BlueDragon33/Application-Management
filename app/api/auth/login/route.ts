import { chatGPTSignInPath, safeReturnPath } from "../../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const returnToValue = form.get("returnTo");
  const returnTo = safeReturnPath(typeof returnToValue === "string" ? returnToValue : "/");
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL(chatGPTSignInPath(returnTo), request.url).toString(),
      "cache-control": "no-store, private",
    },
  });
}
