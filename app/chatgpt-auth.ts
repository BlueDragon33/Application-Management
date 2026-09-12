import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";
const LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;

function normalizedEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

async function runtimeVariables() {
  try {
    const workers = await import("cloudflare:workers");
    return workers.env as unknown as Record<string, unknown>;
  } catch {
    return process.env as unknown as Record<string, unknown>;
  }
}

function localDevelopmentUser(requestHeaders: Headers, runtime: Record<string, unknown>): ChatGPTUser | null {
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host")?.trim() || "";
  if (!LOOPBACK_HOST.test(host)) return null;
  if (runtime.LOCAL_DEV_AUTH !== "1") return null;

  const email = normalizedEmail(typeof runtime.LOCAL_DEV_USER_EMAIL === "string" ? runtime.LOCAL_DEV_USER_EMAIL : null);
  if (!email) return null;
  const configuredId = typeof runtime.LOCAL_DEV_USER_ID === "string" ? runtime.LOCAL_DEV_USER_ID.trim() : "";
  const configuredName = typeof runtime.LOCAL_DEV_USER_NAME === "string" ? runtime.LOCAL_DEV_USER_NAME.trim() : "";

  return {
    userId: configuredId || `local:${email}`,
    displayName: configuredName || email.split("@")[0] || "Local Owner",
    email,
    fullName: configuredName || null,
  };
}

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  const userId = requestHeaders.get(USER_ID_HEADER)?.trim() ?? "";
  const email = normalizedEmail(requestHeaders.get(USER_EMAIL_HEADER));

  // ChatGPT Sites identity and the Cloudflare preview Worker identity bridge both
  // arrive through these internal headers. Public Cloudflare requests can never
  // set them directly because worker/preview-access.ts strips and overwrites them
  // only after the preview secret gate succeeds.
  if (userId && email) {
    const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
    const fullName = encodedFullName
      && requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

    return {
      userId,
      displayName: fullName || email.split("@")[0] || email,
      email,
      fullName,
    };
  }

  const runtime = await runtimeVariables();
  const localUser = localDevelopmentUser(requestHeaders, runtime);
  if (localUser) return localUser;

  return null;
}

export async function requireChatGPTUser(returnTo = "/"): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo = "/") {
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function chatGPTSignOutPath(returnTo = "/") {
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function safeReturnPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local" || isReservedAuthPath(url.pathname)) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function isReservedAuthPath(pathname: string) {
  return pathname === SIGN_IN_PATH || pathname === SIGN_OUT_PATH || pathname === CALLBACK_PATH;
}
