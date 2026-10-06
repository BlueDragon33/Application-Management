# PC Manager Desktop Agent Gateway v1

## Purpose

PC Manager is a native Windows client and normally sits behind NAT/firewalls. P8 therefore uses an outbound-only management channel: PC Manager initiates HTTPS requests to Application Management. The control plane never connects to localhost and no inbound Windows port is opened.

## Public agent endpoint

`GET /api/desktop-agent` returns the protocol manifest.

`POST /api/desktop-agent` supports exactly:

- `register`
- `challenge`
- `heartbeat`
- `ack`

Registration is intentionally pending by default. A device cannot receive remote commands until an Application Management owner approves it.

## Identity and proof

Each installation owns a P-256 key pair. The server stores only the public JWK and derives the stable device ID from that public key.

Every heartbeat or command acknowledgement requires a one-time two-minute challenge. The signed message is:

```text
pc-manager-agent/v1:<action>:<deviceId>:<challenge>
```

Challenges are deleted before signature verification completes so replay cannot reuse a nonce.

## Server policy

The heartbeat returns:

- approval state;
- release channel;
- entitlement/license state;
- update policy;
- typed pending commands;
- recommended heartbeat interval.

Offline is a client-side state inferred from transport failure and last successful heartbeat. Server presence is derived from `last_seen_at`; neither side invents an online state without a successful exchange.

## Typed command allow-list

P8 accepts only:

- `CHECK_UPDATE`
- `RUN_HEALTH_SCAN`
- `REFRESH_DEVICE_STATUS`
- `DISABLE_LICENSE`

No command accepts a shell string, PowerShell string, arbitrary executable, registry path, download URL, or generic file operation.

## Admin endpoint

`POST /api/desktop-agent-admin` remains behind normal Application Management authentication plus the existing approved P-256 central admin-device proof. Only `owner` may approve/block devices, alter license/channel/update policy, or queue typed commands.

## Storage

D1 tables are isolated from the central QT- admin-device registry:

- `desktop_agent_devices`
- `desktop_agent_challenges`
- `desktop_agent_commands`
- `desktop_agent_audit`

The PC Manager namespace is `PC-`; it is not shared with QT-/BE-/SK-/HN-/BM-/GU-/KT-/CAD- registries.
