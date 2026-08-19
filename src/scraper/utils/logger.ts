type Scope =
  | "SCRAPER"
  | "CATALOG"
  | "DETAIL"
  | "EPISODES"
  | "DATABASE"
  | "SCHEDULE"
  | "RESULT"
  | "ERROR";

function timestamp() {
  return new Date().toISOString();
}

export const logger = {
  log(scope: Scope, message: string) {
    console.log(`[${scope}] ${message}`);
  },
  error(scope: Scope, message: string, err?: unknown) {
    const detail = err instanceof Error ? err.message : err ? String(err) : "";
    console.error(`[${scope}] ${timestamp()} ${message} ${detail}`.trim());
  },
};
