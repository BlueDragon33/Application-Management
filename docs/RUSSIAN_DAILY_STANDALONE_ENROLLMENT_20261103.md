# Russian Daily standalone · Application-Management enrollment candidate

Status: **SOURCE-ONLY / PENDING / NOT HOSTED / NOT DEPLOYED**.

- Child application id: `russian-daily`.
- Standalone source: `BlueDragon33/Bauman-Russian-iOS` / `web/russian-daily-standalone`, candidate 0e5775d465ea13d674304adbbc02a1de468ba8f7.
- Planned cloud host: ChatGPT Sites, **not yet provisioned**; no `publicUrl` until real HTTPS readback.
- New Application-Management catalog/management route: `/apps/russian-daily` (source candidate only), while existing legacy `/tools/russian-daily` and `/russian-daily/` continue untouched until a reviewed transition.
- Do not infer SSO/control API from the catalog entry. `status=planned`, `contractState=pending`.
- User data cannot be transparently copied across origins. Require backup on the old app, confirmation and restore on the new Site, then verify Safari.
- After a genuine ChatGPT Site URL exists, change only this registry's `publicUrl` once in an independently reviewed source PR. Later Russian Daily app releases belong to its standalone host, not App-Management.
- For native iOS/WidgetKit: continue separate P0/B4/RU03 and device QA gates; web PWA does not satisfy them.
- No GitHub Actions, server, database, release, merge, approval, credential, or Site was created by this candidate.

## Source-selection reconciliation (2026-11-03)
- Use the dedicated `candidate/russian-daily-standalone-sites-pwa-20261103-v2` with complete PWA source, including Pair/Contrast and separate images. The earlier `candidate/russian-daily-standalone-chatgpt-sites-20261103` is an alternative isolated source candidate, not a second application registry entry or independent deployment.
- Keep one `russian-daily` application ID, `planned/pending`, no publicUrl. The existing `/tools/russian-daily` remains unmodified and local browser data is never silently moved.
- The standalone v2 currently provides 5 illustrative contrast pairs and local schedule/backup; full ICS/Telegram behavior from the legacy app is NOT parity-certified. Do not retire or redirect legacy until separate functional migration QA passes.
