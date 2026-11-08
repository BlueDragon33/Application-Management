# Google session persistence and 30-minute Authenticator confirmation

Owner requested the existing Google sign-in to remain active on the same browser until logout, and Authenticator confirmation for important changes to last 30 minutes. This follow-up starts from approved hotfix merge `4086fc69bf4ce04d492a6f0010b0e7e2a105fdb1`; it is a separate release artifact from PR378.

Keep Google OIDC verification, Owner/Reviewer/Viewer authorization, existing D1 tables and opaque HttpOnly/Secure host cookie. Google server sessions use `expires_at=0` as a revocable persistent-session marker; only Google may use it. Non-expired legacy Google sessions are promoted on successful authentication. Expired credentials are never revived. Password recovery remains 12 hours and lockout remains 15 minutes. Logout and inactive-account rejection revoke access.

Implementation choice: the browser cookie has a rolling 365-day Max-Age, refreshed on authenticated HTML navigation, within the existing cookie format and SameSite=Lax behavior. The app does not impose a separate Google-session deadline. Clearing browser storage, browser cookie limits and provider security challenges remain external constraints. Renewal must preserve other cookies, never undo an explicit session deletion/replacement, and use private/no-store responses. API/static requests do not receive renewal cookies.

Authenticator confirmation stays bound to the current server session, lasts strictly less than 1800 seconds, rejects future timestamps and is not extended by ordinary actions or Google-session renewal. At expiry, sensitive actions ask for Authenticator while the Google session remains signed in. Existing enrollment, authorization and wrong-code checks remain enforced.

Alternative considered: only increase the fixed login TTL. Rejected because it still forces periodic app sign-in. No new auth service, browser storage token, schema migration, role/scope change, paid service, new Worker/site or hosted Actions. The persistence details above are implementation choices, not additional Owner policy claims.

Production exact-SHA approval for the new package remains separate. Real Google/Authenticator browser checks require Owner confirmation; fixture results must not be represented as Google end-to-end acceptance.
