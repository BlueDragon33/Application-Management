declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    CONTROL_OWNER_EMAILS?: string;
    CONTROL_SERVICE_SECRET?: string;
    BOI_ECH_BASE_URL?: string;
    BOI_ECH_LOCAL_BASE_URL?: string;
    HEALTH_CARE_BASE_URL?: string;
    HEALTH_CARE_LOCAL_BASE_URL?: string;
    HEALTH_CONTROL_SERVICE_SECRET?: string;
    RU_LIFE_BASE_URL?: string;
    RU_LIFE_LOCAL_BASE_URL?: string;
    RU_LIFE_CONTROL_SERVICE_SECRET?: string;
    BAUMAN_CONTROL_BASE_URL?: string;
    BAUMAN_CONTROL_LOCAL_BASE_URL?: string;
    BAUMAN_APP_ORIGIN?: string;
    BAUMAN_APP_LOCAL_ORIGIN?: string;
    BAUMAN_CONTROL_SERVICE_SECRET?: string;
    GROWUP_BASE_URL?: string;

    // Local-only identity bridge. LOCAL_DEV_AUTH is accepted only on loopback hosts.
    LOCAL_DEV_AUTH?: string;
    LOCAL_DEV_USER_ID?: string;
    LOCAL_DEV_USER_EMAIL?: string;
    LOCAL_DEV_USER_NAME?: string;

    // Cloudflare preview gate. Must be installed with `wrangler secret put`, never as a plain var.
    APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET?: string;
  }
}
