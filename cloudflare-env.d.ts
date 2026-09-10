declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    CONTROL_OWNER_EMAILS?: string;
    CONTROL_SERVICE_SECRET?: string;
    BOI_ECH_BASE_URL?: string;
    HEALTH_CARE_BASE_URL?: string;
    HEALTH_CONTROL_SERVICE_SECRET?: string;
    RU_LIFE_BASE_URL?: string;
    RU_LIFE_CONTROL_SERVICE_SECRET?: string;
    BAUMAN_CONTROL_BASE_URL?: string;
    BAUMAN_CONTROL_SERVICE_SECRET?: string;
    GROWUP_BASE_URL?: string;

    // Local-only identity bridge. LOCAL_DEV_AUTH is accepted only on loopback hosts.
    LOCAL_DEV_AUTH?: string;
    LOCAL_DEV_USER_ID?: string;
    LOCAL_DEV_USER_EMAIL?: string;
    LOCAL_DEV_USER_NAME?: string;

    // Reserved for the future Cloudflare Access authentication adapter.
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
  }
}
