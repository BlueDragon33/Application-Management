import { introspectManagedAppSession, managedAppSessionErrorResponse } from "../../../../managed-app-session.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { accessToken?: unknown };
    const session = await introspectManagedAppSession("hoa-nhap-nga", body.accessToken);
    return Response.json({ ok: true, session }, {
      headers: {
        "cache-control": "no-store, private",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return managedAppSessionErrorResponse(error);
  }
}
