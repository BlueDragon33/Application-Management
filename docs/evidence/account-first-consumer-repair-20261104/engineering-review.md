# Independent source engineering review

Scope: source diff from Central `3cf2f7d703d762f38dcfdcbbf9ac90acf3c39bf0`; existing BOIECH application source unchanged at `fbf70057a232e3c1f6115311afc0385e80e6dbb6`. Read-only automated engineering reviewer; not an Owner approval or Reviewer A/B acceptance.

Two Important findings were reproduced:
1. Font-scale hydration deferred to a timer while persistence wrote initial `normal` first, overwriting saved `large`/`xlarge`. Fixed by explicit hydration completion before persistence.
2. Navigation could unmount the Owner panel before a request returned `STEP_UP_REQUIRED`; a stale authentication callback then created a promise with no mounted dialog. Fixed by mounted-state guard and cleanup settlement.

Both fixes have production-source behavioral tests, with red and green evidence. Reviewer independently reran the unmount/initialization tests: 3/3 passed. Follow-up source inspection found no further actionable Critical/Important issue in the changed effects/account fences. Real browser/Safari, live D1 and authority admission were not performed.

REVIEW BLOCKED; CI PENDING; global D1 10/10 BLOCKED.
