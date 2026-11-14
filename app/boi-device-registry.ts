export type BoiDeviceBinding = {
  deviceId: string;
  status: "pending" | "approved" | "blocked";
  /** Owner-only verified identity: a browser key, not physical-device attestation. */
  account?: { accountId: string; name: string | null; role: "manager" | "teacher" | "learner" | null };
  browserLabel?: string | null;
  clientClass?: "desktop" | "phone" | "tablet";
  progress?: { completed: number; total: number } | null;
};

export type BoiDeviceRegistry = {
  ok: true;
  application: "boi-ech";
  contract: "boi-device-registry.v2" | "boi-device-registry-owner.v1";
  readOnly: true;
  devices: BoiDeviceBinding[];
  counts: { total: number };
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function parseBoiDeviceRegistry(value: unknown): BoiDeviceRegistry | null {
  const body = record(value), counts = record(body.counts);
  const ownerView = body.contract === "boi-device-registry-owner.v1";
  if (body.ok !== true || body.application !== "boi-ech"
    || (!ownerView && body.contract !== "boi-device-registry.v2")
    || body.readOnly !== true || !Array.isArray(body.devices) || Object.keys(body).length !== 6
    || counts.total !== body.devices.length || Object.keys(counts).length !== 1) return null;

  const seen = new Set<string>();
  const devices: BoiDeviceBinding[] = [];
  for (const value of body.devices) {
    const row = record(value);
    const { deviceId, status, ...extra } = row;
    if (typeof deviceId !== "string" || !/^[a-f0-9]{64}$/.test(deviceId) || seen.has(deviceId)
      || (status !== "pending" && status !== "approved" && status !== "blocked")) return null;
    if (ownerView) {
      const account = record(row.account);
      const { accountId, name, role } = account;
      const label = row.browserLabel, cls = row.clientClass, progress = row.progress;
      const p = record(progress);
      const progressValid = progress === null ||
        (typeof progress === "object" && !Array.isArray(progress) && Object.keys(p).length === 2
          && Number.isSafeInteger(p.completed) && Number(p.completed) >= 0
          && Number.isSafeInteger(p.total) && Number(p.total) === 8
          && Number(p.completed) <= 8);
      if (Object.keys(extra).length !== 4 || !("account" in extra) || !("browserLabel" in extra)
        || !("progress" in extra) || !progressValid
        || !("clientClass" in extra) || Object.keys(account).length !== 3
        || typeof accountId !== "string" || !/^acc_[a-f0-9]{64}$/.test(accountId)
        || (name !== null && (typeof name !== "string" || name.length > 160))
        || (role !== null && role !== "learner" && role !== "teacher" && role !== "manager")
        || (label !== null && (typeof label !== "string" || label.length > 80))
        || (cls !== "desktop" && cls !== "phone" && cls !== "tablet")) return null;
      devices.push({ deviceId, status, account: { accountId, name: name as string | null,
        role: role as "manager" | "teacher" | "learner" | null },
        browserLabel: label as string | null, clientClass: cls,
        progress: progress as { completed: number; total: number } | null });
    } else {
      if (Object.keys(extra).length) return null;
      devices.push({ deviceId, status });
    }
    seen.add(deviceId);
  }
  return { ok: true, application: "boi-ech",
    contract: ownerView ? "boi-device-registry-owner.v1" : "boi-device-registry.v2",
    readOnly: true, devices, counts: { total: devices.length } };
}
