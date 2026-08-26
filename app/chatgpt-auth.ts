import { headers } from "next/headers";

export type ChatGPTUser = {
  displayName: string;
  email: string;
  fullName: string | null;
};

const CLOUDFLARE_ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";
const OAI_EMAIL_HEADER = "oai-authenticated-user-email";
const OAI_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const OAI_FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";

function normalizedEmail(value: string | null) {
  const email = value?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();

  // Production: Cloudflare Access injects this header only after Access policy succeeds.
  // Preview compatibility: keep the previous OpenAI-hosted identity header as fallback.
  const email = normalizedEmail(
    requestHeaders.get(CLOUDFLARE_ACCESS_EMAIL_HEADER)
      ?? requestHeaders.get(OAI_EMAIL_HEADER),
  );
  if (!email) return null;

  const encodedFullName = requestHeaders.get(OAI_FULL_NAME_HEADER);
  const fullName =
    encodedFullName
      && requestHeaders.get(OAI_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    displayName: fullName?.trim() || email.split("@")[0] || email,
    email,
    fullName: fullName?.trim() || null,
  };
}

/**
 * Compatibility helper retained for existing server code.
 * In Cloudflare production, Access itself owns the sign-in flow before the Worker runs.
 */
export async function requireChatGPTUser(_returnTo = "/"): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (!user) {
    throw new Error("CLOUDFLARE_ACCESS_IDENTITY_REQUIRED");
  }
  return user;
}

// Legacy helpers remain exported so older imports keep compiling. Cloudflare Access
// handles production sign-in/sign-out; these paths are not used by the Worker deployment.
export function chatGPTSignInPath(_returnTo = "/"): string {
  return "/";
}

export function chatGPTSignOutPath(_returnTo = "/"): string {
  return "/";
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
