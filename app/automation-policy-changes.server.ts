import { getControlDatabase } from "./control-device.server";

export type AutomationPolicyField = "autoApprove" | "autoBlockPending";
export type AutomationChangeState = "applied" | "failed";

export async function stageAutomationChange(input: {
  appId: string;
  field: AutomationPolicyField;
  requestedBy: string;
  desired: Record<string, boolean | number>;
}) {
  const changeId = crypto.randomUUID();
  const database = await getControlDatabase();
  await database.prepare(
    "INSERT INTO automation_policy_changes (change_id, app_id, field, desired_json, requested_by) VALUES (?, ?, ?, ?, ?)",
  ).bind(changeId, input.appId, input.field, JSON.stringify(input.desired), input.requestedBy).run();
  return changeId;
}

export async function resolveAutomationChange(
  changeId: string,
  state: AutomationChangeState,
  observed?: Record<string, boolean | number>,
  errorCode?: string,
) {
  const database = await getControlDatabase();
  await database.prepare(
    "UPDATE automation_policy_changes SET state = ?, observed_json = ?, error_code = ?, resolved_at = CURRENT_TIMESTAMP WHERE change_id = ? AND state = 'pending'",
  ).bind(state, observed ? JSON.stringify(observed) : null, errorCode ?? null, changeId).run();
}
