# Active Next Action scope correction — 2026-11-03

Status: SOURCE CANDIDATE / REVIEW_BLOCKED / NO PRODUCTION DEPLOYMENT.

Owner clarification: Active Next Action is a ChatGPT Project conversation button that sends a fresh dynamic next-turn prompt, not a UI control inside the standalone Russian Daily website and not a server-side task executor in Application-Management.

Removed the Russian Daily management-page button, its server action and its obsolete button-specific tests from the candidate tree. Preserved the real catalog route, authentication, source-linked metadata, and the fallback to the existing Russian Daily tool; no public URL invented.

Previous records RUSSIAN_DAILY_ONE_CLICK_NEXT_ACTION_20261103.md and RUSSIAN_DAILY_ACTIVE_NEXT_ACTION_QA_20261103.md are historical QA for the *removed, misplaced feature*; they do not provide acceptance evidence for the corrected app or ChatGPT UI.

For the chat-only capability, see BlueDragon33/Bauman-Russian-iOS/docs/chatgpt-project/ACTIVE_NEXT_ACTION_CHAT_CONTRACT.md (candidate). That document is a prompt-scope convention, not a permanent UI installation. Two buttons can be rendered by the assistant in the ChatGPT conversation, and each must re-read latest project state when pressed.

ZERO-SPEND: no Actions, production change, account-billing mutation, autonomous reviewer, or merge. Review gates remain BLOCKED.

## Vercel access checked later on 2026-11-03
Read-only Vercel connector calls confirmed an authenticated Hobby account in active status. The accessible project list showed Software Blueprint Hub, not Russian Daily. Billing charges readback returned costs_not_found, so remaining quota/exact cost is not proven. There is no scope-limited Preview issuer grant or independent reviewer approval. No Vercel project, Preview URL, merge or Production was created. Old statement about Vercel being unconnected is superseded for this current readback.
