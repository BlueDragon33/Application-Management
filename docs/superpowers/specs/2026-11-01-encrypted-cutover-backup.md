# Private Cloudflare backup before legacy cutover

The accepted cutover plan requires complete private backups before reconciling or retiring either legacy Site. Owner has opted out of repeated questions and authorized continued execution. This package implements only the Cloudflare target backup; Sites source export and cross-origin identity transition remain separate prerequisites.

Use the existing protected INSPECT_PRODUCTION workflow on a dedicated operations branch. An optional explicit backup confirmation and RSA public recipient key authorize read-only exports of the two already verified production D1 databases. Verify actual Worker DB bindings first. Export complete SQL, restore it locally for integrity/count verification, and fetch Boi objects referenced by payment records from the actual BUCKET binding. Missing referenced objects block a complete-backup claim.

Encrypt a compressed archive with a random AES-256-GCM key wrapped by RSA-OAEP-SHA256 (RSA3072 minimum). Only the public recipient key reaches Actions; the private recovery key stays with Owner. Only encrypted output and aggregate metadata may be uploaded. Never print SQL, credentials, object keys, account/device records or raw provider errors. Use private temporary directories and clean them on every outcome. Retain schema, counts and object hashes inside the encrypted manifest. Read-only export is not publication, authority migration or a completed legacy cutover.

Alternatives considered: Time Travel alone is useful rollback metadata but is not the requested portable backup; plaintext public CI artifacts violate the existing plan. Encrypted owner-recoverable export is the implementation choice here, not a new permission grant.
