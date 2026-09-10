# Client device control invariants

This change locks the first production-safety pass for client-device orchestration.

- Application Management remains the central control-plane. Each client remains the owner of its device registry.
- Dashboard bootstrap is read-only. Opening, focusing or refreshing the control center must not mutate client state.
- Bauman device counts come from `/api/control/devices`; the control center must never represent an unqueried Bauman registry as zero devices.
- Health_Care and RU_LIFE use publisher/owner device actions. Bauman device mutation remains owner-only.
- RU_LIFE approval requires the existing `userName` and `userCode` binding before approval.
- Health_Care, RU_LIFE and Bauman use block semantics for removal from access. Boi Ech keeps its explicit spam-device deletion flow.
- Every device mutation is followed by a read-back from the owning client. A success response is returned only after the expected state is observed.
- Auto-approval changes remain behind the explicit `set-auto-approval` action; bootstrap never applies automation.

Further UI work should render `block` and `delete` as separate labels and add filtered bulk actions without changing these backend invariants.
