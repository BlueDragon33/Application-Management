import {
  authenticateAdminPassword,
  createAdminSessionCookie,
  safeReturnPath,
} from "../../../chatgpt-auth";

export const dynamic = "force-dynamic";

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = text(form.get("email"));
  const password = text(form.get("password"));
  const returnTo = safeReturnPath(text(form.get("returnTo")) || "/");

  let authenticatedEmail: string | null = null;
  try {
    authenticatedEmail = await authenticateAdminPassword(email, password);
  } catch {
    authenticatedEmail = null;
  }

  if (!authenticatedEmail) {
    const target = new URL("/login", request.url);
    target.searchParams.set("error", "1");
    target.searchParams.set("return_to", returnTo);
    return new Response(null, {
      status: 303,
      headers: {
        location: target.toString(),
        "cache-control": "no-store, private",
      },
    });
  }

  try {
    const sessionCookie = await createAdminSessionCookie(authenticatedEmail);
    return new Response(null, {
      status: 303,
      headers: {
        location: new URL(returnTo, request.url).toString(),
        "set-cookie": sessionCookie,
        "cache-control": "no-store, private",
      },
    });
  } catch {
    return Response.json(
      { error: "Hệ thống đăng nhập chưa được cấu hình đầy đủ." },
      { status: 503, headers: { "cache-control": "no-store, private" } },
    );
  }
}
