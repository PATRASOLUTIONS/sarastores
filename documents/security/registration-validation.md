# Registration validation

Implemented and checked on 2026-10-25.

The later live name-validation and automatic web sign-in changes were made after the user stopped verification; no tests or build were run for those changes. The results below describe the earlier verified snapshot.

Successful `/register` submissions request `startSession: true`. The signup handler issues the normal signed, HttpOnly session cookie for the newly created customer, and the form navigates directly to its safe return destination or `/dashboard`. Email ownership remains unverified until the verification link is used. Clients omitting the flag retain account-creation-only behavior.

The `/register` form and POST `/api/auth/signup` share the validators in [lib/registration-validation.ts](../../lib/registration-validation.ts). Invalid identity input is rejected before credential hashing, account writes, consent records or email sending. The browser validates names on every change as well as blur and submit, displays accessible field errors immediately, and disables submission while a name error is present. It preserves spaces while the person types. Email validation runs on blur and submit.

## Names

- Required; trimmed, NFC-normalized and repeated horizontal Unicode spaces collapsed.
- Maximum 100 characters using the same JavaScript string-length limit on client and server. Single-character names are accepted to accommodate legitimate international names.
- Unicode letters, combining marks, internal script joiners, spaces, hyphens, straight/curly apostrophes and initials are supported. Numbers, markup, emoji, punctuation-only values and malformed separator sequences are rejected.
- Typing-error heuristics reject the explicitly reported junk sample, placeholder values, keyboard sequences of at least six letters, six repeated letters, and repeated chunks. ASCII words of at least 16 letters are also rejected when they combine very few vowels with unusually long consonant runs. These checks avoid dictionaries and vowel rules for non-Latin scripts; unfamiliar names can still produce false positives, and random input cannot always be identified reliably.

These are registration-specific rules; business names and unrelated form schemas were not changed.

## Email addresses

- `validator.js` validates address syntax, supported local parts and length; `tldts` checks recognized public suffixes. Domain labels must have valid boundaries and lengths. An address is not rejected solely because the hostname is itself listed as a public suffix; suffix-list membership is not proof that the hostname cannot host mail.
- Trimmed, lowercased and NFC-normalized. International domain names are converted to their canonical ASCII representation. Plus tags and dots in local parts are preserved; provider-specific aliases are not merged.
- Maximum 254 characters overall and 64 for the local part. IP literals, internal hostnames, empty/overlong domain labels, invalid hyphen boundaries, URL syntax and unrecognized suffixes are rejected. The supplied `.csdfsdfsdf` example fails the public-domain policy.
- Unicode domains, long recognized suffixes and multi-label suffixes are supported. Unicode local parts requiring SMTPUTF8 are not supported by this account flow.
- A recognized suffix does **not** prove a domain is registered, accepts mail, or has the supplied inbox. No DNS/provider call is made during syntax validation. Accounts remain unverified until the existing verification flow confirms ownership. Keep the public-suffix dependency current as suffix rules change.
- Login and password recovery use the same canonical email normalization, so accepted international domains can be used for those operations too.

## Duplicate and concurrent signup handling

[lib/account-email-index.ts](../../lib/account-email-index.ts) creates an idempotent unique `users.email` index with case-insensitive collation before signup can insert. The lookup uses that same collation. A duplicate insertion caught after a concurrent lookup returns `409 EMAIL_EXISTS`, without a second consent record or verification email.

The index is also defined in [scripts/create-core-indexes.mjs](../../scripts/create-core-indexes.mjs). No live database index command was run during this change. The application establishes the index when handling a valid signup. If permissions or conflicting legacy records prevent index creation, signup returns 503 with Retry-After and does not insert. Conflicting legacy accounts require operator reconciliation; the code never merges or deletes them automatically.

## Verification

- `npm test`: **766 passed; zero failures** after the authentication follow-up review, including repeated modifier-apostrophe and oversized-input regressions.
- Focused registration/authentication/client/security checks: **169 passed** before the final full-suite run.
- `npx tsc --noEmit`: passed.
- Production build: passed with its built-in lint/type gates and all 215 static pages, using an isolated read-only database fixture. Existing nonblocking lint/configuration warnings remain. The temporary build output was removed and the original framework declaration/configuration files restored.

The tests exercise actual shared schemas, form handlers, signup/login/recovery routes and index enforcement calls through synthetic fixtures. Concurrent signup tests force the duplicate insert path and assert one account, one consent record and one verification email. Database storage and email delivery are isolated; these results do not certify production database permissions, index deployment, DNS or SMTP delivery.

Name character checks use bounded, simple expressions and a direct check of internal script joiners. They avoid ambiguous repeated Unicode groups and support legitimate apostrophe prefixes such as `Gerard ’t Hooft`.
