import { ControlAccessError, getControlDatabase } from "./control-device.server";
import { listManagedAppDevices, type ManagedAppDevice, type ManagedAppId } from "./managed-app-device.server";

export type ManagedAppDeviceProfile = {
  personName: string | null;
  personCode: string | null;
  groupName: string | null;
  purpose: string | null;
  adminNote: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type ManagedAppDeviceWithProfile = ManagedAppDevice & { profile: ManagedAppDeviceProfile | null };

type ProfileRow = {
  device_id: string;
  person_name: string | null;
  person_code: string | null;
  group_name: string | null;
  purpose: string | null;
  admin_note: string | null;
  updated_by: string | null;
  updated_at: string | null;
};

let profileTableReady: Promise<void> | null = null;

async function ensureProfileTable() {
  if (profileTableReady) return profileTableReady;
  profileTableReady = (async () => {
    const database = await getControlDatabase();
    await database.batch([
      database.prepare(`CREATE TABLE IF NOT EXISTS managed_app_device_profiles (
        app_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        person_name TEXT,
        person_code TEXT,
        group_name TEXT,
        purpose TEXT,
        admin_note TEXT,
        updated_by TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (app_id, device_id)
      )`),
      database.prepare("CREATE INDEX IF NOT EXISTS managed_app_device_profiles_person_idx ON managed_app_device_profiles(app_id, person_code, person_name)"),
    ]);
  })().catch((error) => {
    profileTableReady = null;
    throw error;
  });
  return profileTableReady;
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max) : "";
}

function profileFromRow(row: ProfileRow): ManagedAppDeviceProfile {
  return {
    personName: row.person_name,
    personCode: row.person_code,
    groupName: row.group_name,
    purpose: row.purpose,
    adminNote: row.admin_note,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export async function profileMapForManagedApp(appId: ManagedAppId) {
  await ensureProfileTable();
  const database = await getControlDatabase();
  const result = await database.prepare(
    `SELECT device_id, person_name, person_code, group_name, purpose, admin_note, updated_by, updated_at
       FROM managed_app_device_profiles WHERE app_id = ?`,
  ).bind(appId).all<ProfileRow>();
  return new Map(result.results.map((row) => [row.device_id, profileFromRow(row)]));
}

export async function listManagedAppDevicesWithProfiles(appId: ManagedAppId): Promise<ManagedAppDeviceWithProfile[]> {
  const [devices, profiles] = await Promise.all([listManagedAppDevices(appId), profileMapForManagedApp(appId)]);
  return devices.map((device) => ({ ...device, profile: profiles.get(device.deviceId) || null }));
}

export async function updateManagedAppDeviceProfile(input: {
  appId: ManagedAppId;
  deviceId: unknown;
  personName?: unknown;
  personCode?: unknown;
  groupName?: unknown;
  purpose?: unknown;
  adminNote?: unknown;
  actor: string;
}) {
  const deviceId = typeof input.deviceId === "string" ? input.deviceId : "";
  if (!/^[a-f0-9]{64}$/.test(deviceId)) {
    throw new ControlAccessError("Mã thiết bị Hòa nhập Nga không hợp lệ.", 400, "INVALID_DEVICE");
  }
  const devices = await listManagedAppDevices(input.appId);
  if (!devices.some((device) => device.deviceId === deviceId)) {
    throw new ControlAccessError("Không tìm thấy thiết bị Hòa nhập Nga.", 404, "DEVICE_NOT_FOUND");
  }

  const profile = {
    personName: clean(input.personName, 160) || null,
    personCode: clean(input.personCode, 80) || null,
    groupName: clean(input.groupName, 120) || null,
    purpose: clean(input.purpose, 240) || null,
    adminNote: clean(input.adminNote, 1200) || null,
  };
  await ensureProfileTable();
  const database = await getControlDatabase();
  await database.prepare(
    `INSERT INTO managed_app_device_profiles
      (app_id, device_id, person_name, person_code, group_name, purpose, admin_note, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(app_id, device_id) DO UPDATE SET
       person_name = excluded.person_name,
       person_code = excluded.person_code,
       group_name = excluded.group_name,
       purpose = excluded.purpose,
       admin_note = excluded.admin_note,
       updated_by = excluded.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
  ).bind(input.appId, deviceId, profile.personName, profile.personCode, profile.groupName, profile.purpose, profile.adminNote, input.actor).run();
  await database.prepare(
    "INSERT INTO control_audit_log (actor, action, target, detail_json) VALUES (?, ?, ?, ?)",
  ).bind(input.actor, "managed_app_device.profile_updated", `${input.appId}:${deviceId}`, JSON.stringify({
    personName: profile.personName,
    personCode: profile.personCode,
    groupName: profile.groupName,
    hasPurpose: !!profile.purpose,
    hasAdminNote: !!profile.adminNote,
  })).run();

  const profiles = await profileMapForManagedApp(input.appId);
  return profiles.get(deviceId) || null;
}
