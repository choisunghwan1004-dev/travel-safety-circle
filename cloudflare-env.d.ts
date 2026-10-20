declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    OPENAI_API_KEY?: string;
    SOLAPI_API_KEY?: string;
    SOLAPI_API_SECRET?: string;
    SOLAPI_FROM?: string;
    RESEND_API_KEY?: string;
    ALERT_EMAIL_FROM?: string;
    ALERT_SCHEDULER_READY?: string;
    BUCKET?: R2Bucket;
  }
}
