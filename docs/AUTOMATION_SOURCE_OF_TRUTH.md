# Automation source of truth

Device automation belongs to the application that owns the device registry.

- Bơi ếch: `automation.enabled` from `/api/control/overview?activityDays=0`.
- Health_Care: `automation.autoApproveDevices` from `/api/control/automation`.
- Application Management reads those endpoints with a short-lived read-only viewer ticket.
- `control_audit_log` records policy changes for audit/recovery only. It must not override a live policy returned by a client.
- Dashboard bootstrap and focus/visibility synchronization are read-only and never execute device approval/block/delete actions.

If a client is temporarily unreachable, the most recent central audit state may be used as a display resilience fallback. A successful live response always wins over that fallback.
