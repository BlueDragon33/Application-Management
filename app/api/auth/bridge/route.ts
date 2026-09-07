import { createMedicineAccessCookie, verifyMedicineAccessTicket } from "../../../medicine-access.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const target = new URL("/ru-medcheck", request.url);
  const ticket = new URL(request.url).searchParams.get("ticket")?.trim() || "";
  const access = await verifyMedicineAccessTicket(ticket);
  if (!access) {
    target.searchParams.set("access", "invalid");
    return new Response(null, { status: 303, headers: { location: target.toString(), "cache-control": "no-store, private" } });
  }

  try {
    return new Response(null, {
      status: 303,
      headers: {
        location: target.toString(),
        "set-cookie": await createMedicineAccessCookie(access, request.url),
        "cache-control": "no-store, private",
      },
    });
  } catch {
    target.searchParams.set("access", "unavailable");
    return new Response(null, { status: 303, headers: { location: target.toString(), "cache-control": "no-store, private" } });
  }
}
