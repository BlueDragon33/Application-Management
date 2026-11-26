import type { AudioClip } from "./audio-assets";

export const chatterboxCandidateAssets = [
  {
    "id": "chatterbox-preview-01",
    "ru": "библиотека",
    "bytes": 9165,
    "sha256": "142df19d3b77e985aa76d030e52e47364015ee72d7572753ec783a77c4ed1d88"
  },
  {
    "id": "chatterbox-preview-02",
    "ru": "аудитория",
    "bytes": 8301,
    "sha256": "4b816bf6650adc951e13f147b4052eb2c7292e3c0b7450e79d144bf7c7be2686"
  },
  {
    "id": "chatterbox-preview-03",
    "ru": "общежитие",
    "bytes": 8013,
    "sha256": "33dadd67ab29079d37cb3ac7c74c632663494da3e725bfafef4d48e721474362"
  },
  {
    "id": "chatterbox-preview-04",
    "ru": "молоко",
    "bytes": 7581,
    "sha256": "a167964a6b297388bd99bcaa68b0b8db4b2029f8f8a407413b118abc7dc41cad"
  },
  {
    "id": "chatterbox-preview-05",
    "ru": "хорошо",
    "bytes": 7005,
    "sha256": "e0c12bb4914d0732d3b538d392b8f7f91ac8a1c705eeadc9fa78dafcb14ce990"
  },
  {
    "id": "chatterbox-preview-06",
    "ru": "здравствуйте",
    "bytes": 8301,
    "sha256": "47f9f62def0a6e9479594ce89054f42f516baacd189b3384a351dc67c8361ed8"
  },
  {
    "id": "chatterbox-preview-07",
    "ru": "понедельник",
    "bytes": 8301,
    "sha256": "30337708b1b81a8ffa3119f33cf7980a52e6d434c3b88a2e1b82d89aba3a0ce0"
  },
  {
    "id": "chatterbox-preview-08",
    "ru": "воскресенье",
    "bytes": 9165,
    "sha256": "c5e509cf5b50452b041fcce83c80ffa62d9d8a0a0f7d161e859dd2bd3b437845"
  },
  {
    "id": "chatterbox-preview-09",
    "ru": "Который час?",
    "bytes": 8733,
    "sha256": "6fb68f2abf379ec82b79c284b454cc3affe8d7790c744ed1dda3d65a31d88593"
  },
  {
    "id": "chatterbox-preview-10",
    "ru": "Сейчас половина третьего.",
    "bytes": 12621,
    "sha256": "51bf9c818fc8bfcbc14129277d3697642b3e081a5b095657efce0642046bac7c"
  },
  {
    "id": "chatterbox-preview-11",
    "ru": "Я учусь в университете.",
    "bytes": 10461,
    "sha256": "ae45b9b6e5ae5b1c02e6a17ea2ad0e2d64648d0b2c13f90ba2070f39672ed1cd"
  }
] as const;
export type ChatterboxAsset = typeof chatterboxCandidateAssets[number];
export const chatterboxCacheName = "russian-time-trainer-chatterbox-15117885099";

export function chatterboxAsset(clip: AudioClip): ChatterboxAsset | undefined {
  return chatterboxCandidateAssets.find(asset => asset.id === clip.id && asset.ru === clip.ru);
}
export function chatterboxSrc(asset: ChatterboxAsset) {
  return "/russian-time-trainer/chatterbox-candidate/" + asset.id + ".mp3";
}

async function verifiedBytes(response: Response, asset: ChatterboxAsset): Promise<ArrayBuffer> {
  if (!response.ok) throw new Error("Audio unavailable");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== asset.bytes) throw new Error("Audio size mismatch");
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
  if (digest !== asset.sha256) throw new Error("Audio digest mismatch");
  return bytes;
}

// Cache only immutable, public, exact-match candidate media; never session data.
export async function chatterboxBlob(asset: ChatterboxAsset, save = false): Promise<Blob> {
  const src = chatterboxSrc(asset);
  const cache = typeof caches !== "undefined" ? await caches.open(chatterboxCacheName).catch(() => undefined) : undefined;
  if (save && !cache) throw new Error("Offline storage unavailable");
  const hit = await cache?.match(src);
  if (hit) {
    try { return new Blob([await verifiedBytes(hit, asset)], { type: "audio/mpeg" }); }
    catch { await cache?.delete(src); }
  }
  const bytes = await verifiedBytes(await fetch(src, { cache: "no-store", credentials: "omit", redirect: "error" }), asset);
  if (save && cache) await cache.put(src, new Response(bytes, { headers: { "Content-Type": "audio/mpeg" } }));
  return new Blob([bytes], { type: "audio/mpeg" });
}

export async function saveChatterboxOffline() {
  for (const asset of chatterboxCandidateAssets) await chatterboxBlob(asset, true);
  return chatterboxCandidateAssets.length;
}
