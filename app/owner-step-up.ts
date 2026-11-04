// A rejected step-up happens before mutation. Retry that specific rejection once;
// ambiguous transport failures and CAS conflicts are never sent again automatically.
export async function runOwnerStepUp<T>(run: () => Promise<T>, authenticate?: () => Promise<boolean>): Promise<T> {
  try { return await run(); }
  catch (error) {
    const data = error && typeof error === "object" && "data" in error ? error.data : null;
    if (!data || typeof data !== "object" || !("code" in data) || data.code !== "STEP_UP_REQUIRED" || !authenticate) throw error;
    if (!await authenticate()) throw error;
    return run();
  }
}
