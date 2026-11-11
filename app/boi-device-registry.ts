type BoiDeviceBinding = {
  deviceId: string;
  status: "pending" | "approved" | "blocked";
};

export type BoiDeviceRegistry = {
  ok: true;
  application: "boi-ech";
  contract: "boi-device-registry.v2";
  readOnly: true;
  devices: BoiDeviceBinding[];
  counts: { total: number };
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function parseBoiDeviceRegistry(value: unknown): BoiDeviceRegistry | null {
  const body = record(value);
  const counts = record(body.counts);
  if (body.ok !== true || body.application !== "boi-ech" || body.contract !== "boi-device-registry.v2"
    || body.readOnly !== true || !Array.isArray(body.devices) || Object.keys(body).length !== 6
    || counts.total !== body.devices.length || Object.keys(counts).length !== 1) return null;

  const seen = new Set<string>();
  const devices: BoiDeviceBinding[] = [];
  for (const value of body.devices) {
    const { deviceId, status, ...extra } = record(value);
    if (typeof deviceId !== "string" || !/^[a-f0-9]{64}$/.test(deviceId) || seen.has(deviceId)
      || (status !== "pending" && status !== "approved" && status !== "blocked") || Object.keys(extra).length) return null;
    seen.add(deviceId);
    devices.push({ deviceId, status });
  }
  return { ok: true, application: "boi-ech", contract: "boi-device-registry.v2", readOnly: true, devices, counts: { total: devices.length } };
}
