import { getControlDatabase } from "./control-device.server";

export type MedicineLevel = 1 | 2 | 3 | 4 | 5;
export type MedicineRule = {
  id: string;
  name: string;
  synonyms: string[];
  level: MedicineLevel;
  category: string;
  basis: string;
  sourceIds: string[];
  reviewRequired: boolean;
  condition?: string | null;
  enabled?: boolean;
};

export const medicineMeta = {
  version: "RU-MED-2026.09.05-v4",
  jurisdiction: "Russian Federation",
  updatedAt: "2026-09-05",
  verifiedAt: "2026-09-05",
  disclaimer: "Công cụ sàng lọc quy định của Liên bang Nga; không thay thế chỉ định y tế, tư vấn pháp lý hoặc xác nhận của cơ quan hải quan.",
  levels: {
    1: { label: "Không phát hiện thành phần kiểm soát", action: "Chưa phát hiện hoạt chất thuộc bộ quy tắc kiểm soát Nga hiện có. Kết quả này không phải xác nhận nhập cảnh tuyệt đối." },
    2: { label: "Lưu ý", action: "Chưa phát hiện kiểm soát đặc biệt trong bộ dữ liệu hiện tại; vẫn phải dùng thuốc đúng hướng dẫn và kiểm tra toàn bộ công thức." },
    3: { label: "Kiểm tra điều kiện / nồng độ", action: "Chưa nên kết luận. Cần kiểm tra hàm lượng, nồng độ, dạng phối hợp và giấy tờ áp dụng tại Nga." },
    4: { label: "Kiểm soát chặt", action: "Không tự mang hoặc tự sử dụng trước khi kiểm tra đơn thuốc, hồ sơ y tế và thủ tục áp dụng." },
    5: { label: "Kiểm soát đặc biệt", action: "Không tự mang hoặc tự sử dụng khi chưa có xác minh chính thức và hồ sơ phù hợp." },
  },
  sources: [
    { id: "RU-61FZ-50", title: "Luật Liên bang Nga số 61-FZ, Điều 50 – nhập thuốc cho mục đích cá nhân", edition: "bản sửa đổi 04.08.2026, hiệu lực các thay đổi từ 01.09.2026", url: "https://www.consultant.ru/document/cons_doc_LAW_99350/2f83905386fba9be32b129bf200996d6ce1ffd28/" },
    { id: "RU-681-IV", title: "Nghị định Chính phủ Nga số 681 – Danh sách IV tiền chất", edition: "bản sửa đổi 11.06.2025, thay đổi hiệu lực 27.07.2025", url: "https://www.consultant.ru/document/cons_doc_LAW_19243/2491b2c4b4cfc639b76e34fed4aec5746cee815a/" },
    { id: "RU-681-II", title: "Nghị định Chính phủ Nga số 681 – Danh sách II chất gây nghiện/hướng thần bị hạn chế lưu hành", edition: "bản sửa đổi 11.06.2025, thay đổi hiệu lực 27.07.2025", url: "https://www.consultant.ru/document/cons_doc_LAW_19243/" },
    { id: "RU-681-III", title: "Nghị định Chính phủ Nga số 681 – Danh sách III chất hướng thần", edition: "bản sửa đổi 11.06.2025, thay đổi hiệu lực 27.07.2025", url: "https://www.consultant.ru/document/cons_doc_LAW_19243/930d574c211e4a71b8d0e0b70dc5238ab45a0ea8/" },
    { id: "RU-459N", title: "Lệnh Bộ Y tế Nga số 459n – thuốc phải hạch toán định lượng", edition: "bản sửa đổi 28.10.2025; văn bản có hiệu lực đến 01.09.2030", url: "https://www.consultant.ru/document/cons_doc_LAW_458706/ff65a23b2872726dce4eb726ac0a67e05f754042/" },
    { id: "RU-964", title: "Nghị định Chính phủ Nga ngày 29.12.2007 số 964 – danh sách chất có tác dụng mạnh và chất độc", edition: "bản sửa đổi 01.11.2025", url: "https://www.consultant.ru/document/cons_doc_LAW_74146/" },
  ],
} as const;

export const medicineSeedRules: MedicineRule[] = [
  { id: "paracetamol", name: "Paracetamol", synonyms: ["acetaminophen", "парацетамол"], level: 1, category: "common", basis: "Không thuộc các nhóm kiểm soát đặc biệt được bộ dữ liệu này theo dõi.", sourceIds: [], reviewRequired: false },
  { id: "ibuprofen", name: "Ibuprofen", synonyms: ["ибупрофен"], level: 1, category: "common", basis: "Không thuộc các nhóm kiểm soát đặc biệt được bộ dữ liệu này theo dõi.", sourceIds: [], reviewRequired: false },
  { id: "diclofenac", name: "Diclofenac", synonyms: ["диклофенак"], level: 1, category: "common", basis: "Không thuộc các nhóm kiểm soát đặc biệt được bộ dữ liệu này theo dõi.", sourceIds: [], reviewRequired: false },
  { id: "naproxen", name: "Naproxen", synonyms: ["напроксен"], level: 1, category: "common", basis: "Không thuộc các nhóm kiểm soát đặc biệt được bộ dữ liệu này theo dõi.", sourceIds: [], reviewRequired: false },
  { id: "phenylephrine", name: "Phenylephrine", synonyms: ["phenylephrine hydrochloride", "phenylephrine hcl", "фенилэфрин"], level: 1, category: "cold", basis: "Không đồng nhất với pseudoephedrine; vẫn cần kiểm tra toàn bộ công thức phối hợp.", sourceIds: [], reviewRequired: false },
  { id: "chlorpheniramine", name: "Chlorpheniramine", synonyms: ["chlorpheniramine maleate", "chlorphenamine", "хлорфенамин"], level: 1, category: "antihistamine", basis: "Không thuộc nhóm opioid/tiền chất được bộ dữ liệu này đánh dấu.", sourceIds: [], reviewRequired: false },
  { id: "pseudoephedrine", name: "Pseudoephedrine", synonyms: ["pseudoephedrine hydrochloride", "pseudoephedrine hcl", "псевдоэфедрин"], level: 3, category: "precursor", basis: "Nga kiểm soát pseudoephedrine như tiền chất theo ngưỡng nồng độ; thuốc phối hợp phải kiểm tra điều kiện cụ thể.", sourceIds: ["RU-681-IV", "RU-459N"], reviewRequired: true, condition: "concentration_or_combination" },
  { id: "ephedrine", name: "Ephedrine", synonyms: ["ephedrine hydrochloride", "ephedrine hcl", "эфедрин"], level: 3, category: "precursor", basis: "Nga kiểm soát ephedrine theo ngưỡng nồng độ trong danh mục tiền chất.", sourceIds: ["RU-681-IV"], reviewRequired: true, condition: "concentration" },
  { id: "phenylpropanolamine", name: "Phenylpropanolamine / Norephedrine", synonyms: ["phenylpropanolamine", "phenylpropanolamine hcl", "norephedrine", "фенилпропаноламин", "норэфедрин"], level: 3, category: "precursor", basis: "Cần đối chiếu đúng đồng phân và ngưỡng nồng độ theo danh mục tiền chất Nga.", sourceIds: ["RU-681-IV"], reviewRequired: true, condition: "concentration" },
  { id: "dextromethorphan", name: "Dextromethorphan", synonyms: ["dextromethorphan hydrobromide", "dextromethorphan hbr", "декстрометорфан"], level: 4, category: "psychotropic_control", basis: "Dextromethorphan có trong Danh sách III chất hướng thần tại Nga; dạng phối hợp có ngưỡng hàm lượng riêng cần kiểm tra.", sourceIds: ["RU-681-III", "RU-459N"], reviewRequired: true, condition: "dose_or_combination" },
  { id: "tramadol", name: "Tramadol", synonyms: ["tramadol hydrochloride", "трамадол"], level: 4, category: "potent_substance", basis: "Tramadol thuộc nhóm thuốc/chất phải hạch toán định lượng và cần kiểm tra chặt tại Nga.", sourceIds: ["RU-964", "RU-459N"], reviewRequired: true },
  { id: "phenobarbital", name: "Phenobarbital", synonyms: ["phenobarbitone", "фенобарбитал"], level: 4, category: "psychotropic_control", basis: "Thuộc nhóm thuốc/chất được kiểm soát tại Nga.", sourceIds: ["RU-459N"], reviewRequired: true },
  { id: "diazepam", name: "Diazepam", synonyms: ["диазепам"], level: 4, category: "psychotropic_control", basis: "Thuộc Danh sách III chất hướng thần được kiểm soát tại Nga.", sourceIds: ["RU-681-III", "RU-459N"], reviewRequired: true },
  { id: "clonazepam", name: "Clonazepam", synonyms: ["клоназепам"], level: 4, category: "psychotropic_control", basis: "Thuộc Danh sách III chất hướng thần được kiểm soát tại Nga.", sourceIds: ["RU-681-III", "RU-459N"], reviewRequired: true },
  { id: "lorazepam", name: "Lorazepam", synonyms: ["лоразепам"], level: 4, category: "psychotropic_control", basis: "Thuộc nhóm chất hướng thần được kiểm soát tại Nga.", sourceIds: ["RU-681-III", "RU-459N"], reviewRequired: true },
  { id: "zolpidem", name: "Zolpidem", synonyms: ["золпидем"], level: 4, category: "psychotropic_control", basis: "Thuộc Danh sách III chất hướng thần được kiểm soát tại Nga.", sourceIds: ["RU-681-III", "RU-459N"], reviewRequired: true },
  { id: "pregabalin", name: "Pregabalin", synonyms: ["прегабалин"], level: 4, category: "potent_substance", basis: "Pregabalin có trong danh sách chất có tác dụng mạnh và danh mục thuốc phải hạch toán định lượng tại Nga.", sourceIds: ["RU-964", "RU-459N"], reviewRequired: true },
  { id: "tapentadol", name: "Tapentadol", synonyms: ["тапентадол"], level: 4, category: "potent_substance", basis: "Tapentadol có trong danh sách chất có tác dụng mạnh và danh mục thuốc phải hạch toán định lượng tại Nga.", sourceIds: ["RU-964", "RU-459N"], reviewRequired: true },
  { id: "codeine", name: "Codeine", synonyms: ["codeine phosphate", "кодеин"], level: 5, category: "narcotic_control", basis: "Codeine thuộc nhóm thuốc/chất gây nghiện được kiểm soát; dạng phối hợp phải kiểm tra riêng.", sourceIds: ["RU-681-II", "RU-459N"], reviewRequired: true, condition: "form_or_combination" },
  { id: "morphine", name: "Morphine", synonyms: ["morphine sulfate", "morphine hydrochloride", "морфин"], level: 5, category: "narcotic_control", basis: "Thuộc nhóm thuốc/chất gây nghiện được kiểm soát đặc biệt tại Nga.", sourceIds: ["RU-681-II", "RU-459N"], reviewRequired: true },
  { id: "fentanyl", name: "Fentanyl", synonyms: ["фентанил"], level: 5, category: "narcotic_control", basis: "Opioid mạnh thuộc nhóm kiểm soát đặc biệt tại Nga.", sourceIds: ["RU-681-II", "RU-459N"], reviewRequired: true },
  { id: "oxycodone", name: "Oxycodone", synonyms: ["оксикодон"], level: 5, category: "narcotic_control", basis: "Thuộc nhóm thuốc/chất gây nghiện được kiểm soát đặc biệt tại Nga.", sourceIds: ["RU-681-II", "RU-459N"], reviewRequired: true },
  { id: "hydromorphone", name: "Hydromorphone", synonyms: ["гидроморфон"], level: 5, category: "narcotic_control", basis: "Thuộc nhóm thuốc/chất gây nghiện được kiểm soát đặc biệt tại Nga.", sourceIds: ["RU-681-II", "RU-459N"], reviewRequired: true },
  { id: "buprenorphine", name: "Buprenorphine", synonyms: ["бупренорфин"], level: 5, category: "narcotic_control", basis: "Thuộc nhóm thuốc/chất gây nghiện được kiểm soát đặc biệt tại Nga.", sourceIds: ["RU-681-II", "RU-459N"], reviewRequired: true },
  { id: "methadone", name: "Methadone", synonyms: ["метадон"], level: 5, category: "narcotic_control", basis: "Thuộc nhóm chất gây nghiện được kiểm soát đặc biệt tại Nga.", sourceIds: ["RU-681-II", "RU-459N"], reviewRequired: true },
  { id: "ketamine", name: "Ketamine", synonyms: ["кетамин"], level: 5, category: "psychotropic_control", basis: "Ketamine thuộc Danh sách II chất hướng thần bị hạn chế lưu hành tại Nga.", sourceIds: ["RU-681-II", "RU-459N"], reviewRequired: true },
];

function normalizeMedicineText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsMedicineTerm(text: string, term: string) {
  const clean = normalizeMedicineText(term);
  if (!clean) return false;
  const pattern = new RegExp(`(^|[^a-zа-я0-9])${escapeRegExp(clean).replace(/\\ /g, "\\s+")}($|[^a-zа-я0-9])`, "iu");
  return pattern.test(text);
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

export function createMedicineReviewToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function getMedicineDatabase() {
  const database = await getControlDatabase();
  await database.batch([
    database.prepare(`CREATE TABLE IF NOT EXISTS medicine_rules (
      id text PRIMARY KEY NOT NULL, name text NOT NULL, synonyms_json text NOT NULL DEFAULT '[]', level integer NOT NULL,
      category text NOT NULL, basis text NOT NULL, source_ids_json text NOT NULL DEFAULT '[]', review_required integer NOT NULL DEFAULT 0,
      condition text, enabled integer NOT NULL DEFAULT 1, updated_by text, updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    database.prepare("CREATE INDEX IF NOT EXISTS medicine_rules_level_idx ON medicine_rules (level)"),
    database.prepare(`CREATE TABLE IF NOT EXISTS medicine_reviews (
      id text PRIMARY KEY NOT NULL, created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status text NOT NULL DEFAULT 'pending', medicine_name text, ocr_text text NOT NULL, matched_rule_ids_json text NOT NULL DEFAULT '[]',
      proposed_level integer NOT NULL, confidence integer NOT NULL DEFAULT 0, note text, admin_note text, decision text, reviewed_by text, reviewed_at text,
      public_token_hash text)`),
    database.prepare("CREATE INDEX IF NOT EXISTS medicine_reviews_status_idx ON medicine_reviews (status, created_at)"),
    database.prepare(`CREATE TABLE IF NOT EXISTS medicine_audit_log (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL, actor text NOT NULL, action text NOT NULL, target text NOT NULL,
      detail_json text NOT NULL DEFAULT '{}', created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    database.prepare(`CREATE TABLE IF NOT EXISTS medicine_settings (
      key text PRIMARY KEY NOT NULL, value text NOT NULL, updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    database.prepare(`CREATE TABLE IF NOT EXISTS medicine_rate_limits (
      key text PRIMARY KEY NOT NULL, count integer NOT NULL DEFAULT 1, expires_at integer NOT NULL)`),
  ]);
  const columns = await database.prepare("PRAGMA table_info(medicine_reviews)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "public_token_hash")) {
    await database.prepare("ALTER TABLE medicine_reviews ADD COLUMN public_token_hash text").run();
  }
  return database;
}

export async function ensureMedicineSeed() {
  const database = await getMedicineDatabase();
  const current = await database.prepare("SELECT value FROM medicine_settings WHERE key = 'seed_version'").first<{ value: string }>();
  if (current?.value === medicineMeta.version) return database;
  await database.batch(medicineSeedRules.map((rule) => database.prepare(
    `INSERT INTO medicine_rules
      (id, name, synonyms_json, level, category, basis, source_ids_json, review_required, condition, enabled, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, synonyms_json = excluded.synonyms_json, level = excluded.level,
       category = excluded.category, basis = excluded.basis, source_ids_json = excluded.source_ids_json,
       review_required = excluded.review_required, condition = excluded.condition, enabled = 1,
       updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP
     WHERE medicine_rules.updated_by IS NULL OR medicine_rules.updated_by LIKE 'system-seed%'`,
  ).bind(rule.id, rule.name, JSON.stringify(rule.synonyms), rule.level, rule.category, rule.basis, JSON.stringify(rule.sourceIds), rule.reviewRequired ? 1 : 0, rule.condition ?? null, `system-seed:${medicineMeta.version}`)));
  await database.prepare(
    `INSERT INTO medicine_settings (key, value, updated_at) VALUES ('seed_version', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
  ).bind(medicineMeta.version).run();
  return database;
}

export async function readMedicineRules(includeDisabled = false) {
  const database = await ensureMedicineSeed();
  const result = await database.prepare(
    `SELECT id, name, synonyms_json, level, category, basis, source_ids_json, review_required, condition, enabled, updated_by, updated_at
       FROM medicine_rules ${includeDisabled ? "" : "WHERE enabled = 1"} ORDER BY level DESC, name ASC`,
  ).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    id: String(row.id), name: String(row.name), synonyms: JSON.parse(String(row.synonyms_json || "[]")) as string[],
    level: Number(row.level) as MedicineLevel, category: String(row.category), basis: String(row.basis),
    sourceIds: JSON.parse(String(row.source_ids_json || "[]")) as string[], reviewRequired: Number(row.review_required) === 1,
    condition: row.condition ? String(row.condition) : null, enabled: Number(row.enabled) === 1,
    updatedBy: row.updated_by ? String(row.updated_by) : null, updatedAt: row.updated_at ? String(row.updated_at) : null,
  }));
}

export async function analyzeMedicineText(value: string) {
  const text = normalizeMedicineText(value);
  const rules = await readMedicineRules(false);
  const matched = rules.filter((rule) => [rule.name, ...rule.synonyms].some((term) => containsMedicineTerm(text, term)));
  const level = (matched.length ? Math.max(...matched.map((rule) => rule.level)) : 2) as MedicineLevel;
  return {
    matched,
    matchedRuleIds: matched.map((rule) => rule.id),
    level,
    reviewRequired: matched.length === 0 || matched.some((rule) => rule.reviewRequired) || level >= 3,
  };
}

export async function consumeMedicineReviewQuota(request: Request) {
  const ip = request.headers.get("cf-connecting-ip")?.trim();
  if (!ip) return;
  const now = Date.now();
  const bucket = Math.floor(now / 3_600_000);
  const key = await sha256Hex(`ru-medcheck-review:${bucket}:${ip}`);
  const database = await getMedicineDatabase();
  await database.batch([
    database.prepare("DELETE FROM medicine_rate_limits WHERE expires_at < ?").bind(now),
    database.prepare(
      `INSERT INTO medicine_rate_limits (key, count, expires_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET count = medicine_rate_limits.count + 1, expires_at = excluded.expires_at`,
    ).bind(key, now + 3_900_000),
  ]);
  const state = await database.prepare("SELECT count FROM medicine_rate_limits WHERE key = ?").bind(key).first<{ count: number }>();
  if ((state?.count ?? 0) > 30) throw new Error("RATE_LIMITED");
}

export async function medicineAudit(actor: string, action: string, target: string, detail: Record<string, unknown> = {}) {
  const database = await getMedicineDatabase();
  await database.prepare("INSERT INTO medicine_audit_log (actor, action, target, detail_json) VALUES (?, ?, ?, ?)")
    .bind(actor, action, target, JSON.stringify(detail)).run();
}

export function medicineJson(data: unknown, status = 200, isPrivate = false) {
  return Response.json(data, { status, headers: { "cache-control": isPrivate ? "no-store, private" : "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
}

export function textValue(value: unknown, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
