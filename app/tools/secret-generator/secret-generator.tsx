"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./secret-generator.module.css";

type PresetId = "github" | "service" | "login" | "custom";
type CharacterOptions = {
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
};

const ALPHABETS = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{}:,.?",
  urlSafe: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_",
} as const;

const PRESETS: Record<PresetId, { label: string; description: string; length: number; options: CharacterOptions; urlSafe: boolean }> = {
  github: {
    label: "GitHub / Cloudflare Secret",
    description: "Khuyên dùng cho APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET và Environment secrets.",
    length: 64,
    options: { upper: true, lower: true, digits: true, symbols: false },
    urlSafe: true,
  },
  service: {
    label: "API / Service Secret",
    description: "Chuỗi mạnh, dễ dán vào biến môi trường và Authorization Bearer.",
    length: 48,
    options: { upper: true, lower: true, digits: true, symbols: false },
    urlSafe: true,
  },
  login: {
    label: "Mật khẩu đăng nhập",
    description: "Có chữ hoa, chữ thường, số và ký tự đặc biệt; phù hợp tài khoản thông thường.",
    length: 24,
    options: { upper: true, lower: true, digits: true, symbols: true },
    urlSafe: false,
  },
  custom: {
    label: "Tùy chỉnh",
    description: "Tự chọn độ dài và nhóm ký tự.",
    length: 32,
    options: { upper: true, lower: true, digits: true, symbols: true },
    urlSafe: false,
  },
};

function randomIndex(maxExclusive: number) {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 256) {
    throw new Error("Invalid random range");
  }
  const limit = 256 - (256 % maxExclusive);
  const byte = new Uint8Array(1);
  do {
    crypto.getRandomValues(byte);
  } while (byte[0] >= limit);
  return byte[0] % maxExclusive;
}

function secureShuffle(values: string[]) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

function selectedCharacterSets(options: CharacterOptions) {
  const sets: string[] = [];
  if (options.upper) sets.push(ALPHABETS.upper);
  if (options.lower) sets.push(ALPHABETS.lower);
  if (options.digits) sets.push(ALPHABETS.digits);
  if (options.symbols) sets.push(ALPHABETS.symbols);
  return sets;
}

function generateSecret(length: number, options: CharacterOptions, urlSafe: boolean) {
  const normalizedLength = Math.max(12, Math.min(128, Math.round(length)));
  if (urlSafe) {
    return Array.from({ length: normalizedLength }, () => ALPHABETS.urlSafe[randomIndex(ALPHABETS.urlSafe.length)]).join("");
  }

  const sets = selectedCharacterSets(options);
  if (!sets.length) throw new Error("Chọn ít nhất một nhóm ký tự.");
  const alphabet = sets.join("");
  const result = sets.map((set) => set[randomIndex(set.length)]);
  while (result.length < normalizedLength) result.push(alphabet[randomIndex(alphabet.length)]);
  return secureShuffle(result).join("");
}

function alphabetSize(options: CharacterOptions, urlSafe: boolean) {
  if (urlSafe) return ALPHABETS.urlSafe.length;
  return selectedCharacterSets(options).reduce((total, set) => total + set.length, 0);
}

function strengthLabel(entropy: number) {
  if (entropy >= 256) return "Cực mạnh";
  if (entropy >= 160) return "Rất mạnh";
  if (entropy >= 100) return "Mạnh";
  return "Nên tăng độ dài";
}

export default function SecretGenerator({ user }: { user: { displayName: string; email: string } }) {
  const [preset, setPreset] = useState<PresetId>("github");
  const [length, setLength] = useState(PRESETS.github.length);
  const [options, setOptions] = useState<CharacterOptions>(PRESETS.github.options);
  const [urlSafe, setUrlSafe] = useState(true);
  const [secret, setSecret] = useState("");
  const [visible, setVisible] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [error, setError] = useState("");

  const entropy = useMemo(() => {
    const size = alphabetSize(options, urlSafe);
    return size > 1 ? Math.floor(length * Math.log2(size)) : 0;
  }, [length, options, urlSafe]);

  const regenerate = () => {
    try {
      setSecret(generateSecret(length, options, urlSafe));
      setError("");
      setCopyState("idle");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo secret.");
    }
  };

  useEffect(() => {
    regenerate();
    // Initial generation must happen in the browser because Web Crypto is browser-owned here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (next: PresetId) => {
    const value = PRESETS[next];
    setPreset(next);
    setLength(value.length);
    setOptions(value.options);
    setUrlSafe(value.urlSafe);
    setError("");
    setCopyState("idle");
    queueMicrotask(() => {
      try {
        setSecret(generateSecret(value.length, value.options, value.urlSafe));
      } catch {
        setSecret("");
      }
    });
  };

  const copySecret = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
    }
  };

  const updateOption = (key: keyof CharacterOptions, checked: boolean) => {
    setPreset("custom");
    setUrlSafe(false);
    setOptions((current) => ({ ...current, [key]: checked }));
  };

  return <main className={styles.shell}>
    <div className={styles.ambientOne}/><div className={styles.ambientTwo}/>
    <header className={styles.topbar}>
      <Link href="/" className={styles.backLink}>← Trung tâm quản trị</Link>
      <div className={styles.identity}><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{user.email}</small></div></div>
    </header>

    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <span className={styles.eyebrow}>SECURITY UTILITY · LOCAL-ONLY</span>
        <h1>Trình tạo mật khẩu & Secret</h1>
        <p>Tạo khóa bằng <strong>Web Crypto</strong> ngay trên thiết bị. Secret không được gửi lên API, không lưu localStorage và không xuất hiện trong URL.</p>
        <div className={styles.securityStrip}>
          <span>✓ crypto.getRandomValues</span><span>✓ Không lưu lịch sử</span><span>✓ Không gửi mạng</span><span>✓ Copy thủ công</span>
        </div>
      </div>
      <aside className={styles.targetCard}>
        <span>DÙNG NGAY CHO PREVIEW</span>
        <code>APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET</code>
        <p>Preset mặc định tạo 64 ký tự URL-safe, khoảng 384 bit entropy.</p>
      </aside>
    </section>

    <section className={styles.workspace}>
      <aside className={styles.presets}>
        <div className={styles.sectionTitle}><span>01</span><div><strong>Mục đích sử dụng</strong><small>Chọn preset an toàn</small></div></div>
        <div className={styles.presetGrid}>
          {(Object.keys(PRESETS) as PresetId[]).map((id) => <button key={id} type="button" data-active={preset === id} onClick={() => applyPreset(id)}>
            <strong>{PRESETS[id].label}</strong><small>{PRESETS[id].description}</small>
          </button>)}
        </div>
      </aside>

      <div className={styles.generatorCard}>
        <div className={styles.sectionTitle}><span>02</span><div><strong>Secret mới</strong><small>Tạo mới bất cứ lúc nào</small></div></div>
        <div className={styles.secretBox}>
          <label htmlFor="generated-secret">Giá trị</label>
          <div className={styles.secretLine}>
            <input id="generated-secret" readOnly value={secret} type={visible ? "text" : "password"} spellCheck={false} autoComplete="off" aria-describedby="secret-status"/>
            <button type="button" onClick={() => setVisible((value) => !value)}>{visible ? "Ẩn" : "Hiện"}</button>
          </div>
          <div id="secret-status" className={styles.secretMeta} aria-live="polite">
            <span>{secret.length} ký tự</span><span>≈ {entropy} bit</span><strong>{strengthLabel(entropy)}</strong>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={regenerate}>Tạo secret mới</button>
          <button type="button" className={styles.secondary} onClick={copySecret}>{copyState === "copied" ? "Đã sao chép ✓" : copyState === "error" ? "Không copy được" : "Sao chép"}</button>
        </div>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}

        <div className={styles.controls}>
          <div className={styles.lengthControl}>
            <label htmlFor="secret-length"><span>Độ dài</span><strong>{length}</strong></label>
            <input id="secret-length" type="range" min={12} max={128} step={1} value={length} onChange={(event) => { setPreset("custom"); setLength(Number(event.target.value)); }}/>
            <div><span>12</span><span>128</span></div>
          </div>

          <div className={styles.characterControl}>
            <div className={styles.controlHeading}><span>Nhóm ký tự</span>{urlSafe ? <b>URL-safe</b> : null}</div>
            <label><input type="checkbox" checked={options.upper} disabled={urlSafe} onChange={(event) => updateOption("upper", event.target.checked)}/><span>ABC</span><small>Chữ hoa</small></label>
            <label><input type="checkbox" checked={options.lower} disabled={urlSafe} onChange={(event) => updateOption("lower", event.target.checked)}/><span>abc</span><small>Chữ thường</small></label>
            <label><input type="checkbox" checked={options.digits} disabled={urlSafe} onChange={(event) => updateOption("digits", event.target.checked)}/><span>123</span><small>Chữ số</small></label>
            <label><input type="checkbox" checked={options.symbols} disabled={urlSafe} onChange={(event) => updateOption("symbols", event.target.checked)}/><span>!@#</span><small>Ký tự đặc biệt</small></label>
          </div>
        </div>
      </div>
    </section>

    <section className={styles.instructions}>
      <div className={styles.sectionTitle}><span>03</span><div><strong>Cách dùng cho GitHub Environment</strong><small>Không đưa secret vào source code</small></div></div>
      <ol>
        <li><span>1</span><p>Chọn <strong>GitHub / Cloudflare Secret</strong> và bấm <strong>Tạo secret mới</strong>.</p></li>
        <li><span>2</span><p>Bấm <strong>Sao chép</strong>, sau đó mở GitHub → Settings → Environments → <code>application-management-preview</code>.</p></li>
        <li><span>3</span><p>Tạo secret tên <code>APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET</code>, dán giá trị và lưu.</p></li>
        <li><span>4</span><p>Sau khi lưu trên GitHub, có thể tạo lại chuỗi mới trên trang này để xóa giá trị cũ khỏi màn hình.</p></li>
      </ol>
    </section>

    <footer className={styles.footer}>Application Management · Security Utility · Không lưu secret phía server</footer>
  </main>;
}
