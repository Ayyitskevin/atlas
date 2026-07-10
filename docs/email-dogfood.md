# Atlas email dogfood loop

Use this when you want a second human (or second inbox) in a real workspace.

## Providers

| `EMAIL_PROVIDER` | Behavior |
|------------------|----------|
| `noop` (default) | Accepts sends, records `stubbed` outcomes. Safe for local CI. |
| `resend` | Sends via Resend HTTP API. Requires `RESEND_API_KEY` and a verified from-domain. |

## Staging / real mail checklist

1. Create a Resend account and API key.
2. Verify a sending domain (or use Resend’s onboarding domain for tests).
3. Set in the API environment (never commit secrets):

```bash
EMAIL_PROVIDER=resend
EMAIL_FROM="Atlas <no-reply@your-domain.example>"
RESEND_API_KEY=re_xxxxxxxx
WEB_ORIGIN=https://your-atlas-web.example   # links in invite/verify/reset emails
```

4. DNS for production domains (typical):
   - SPF include for Resend
   - DKIM CNAMEs from Resend
   - Optional DMARC policy once mail is stable

5. Confirm API readiness and a probe send:

```bash
corepack pnpm preflight
# register a user, request verification, invite a second email
```

## Golden path (multi-user)

1. **Owner registers** at `/register` (password ≥ 12 chars).
2. **Verify email** from the link (`/login?verifyToken=...`) or the in-app “Resend verification” banner.
3. **Create workspace** + project + sections.
4. **Invite member** (Admin): role MEMBER or GUEST; copy invite link or open the emailed link.
5. **Member accepts** at `/invite?token=...` while logged in as the invited email.
6. **Assign a task** or **@mention** the member in a comment.
7. With email preferences enabled, member receives in-app notification + optional email (if opted in).
8. **Inbox → Open task** deep-links to the project board and marks the notification read.

Password recovery:

1. `/login` → Forgot password → request reset.
2. Open `/login?resetToken=...` (or paste token on the reset form).
3. Set a new password and log in.

## Local stub path

Leave `EMAIL_PROVIDER=noop`. Invite accept tokens still appear in the admin UI (`acceptToken` / invite link). Verification and reset “send” succeed as stubbed deliveries—use admin invite links and manual token capture for offline dogfood.

## Related endpoints

- `POST /auth/email/request-verification`
- `POST /auth/email/verify`
- `POST /auth/password/request-reset`
- `POST /auth/password/reset`
- Workspace invitations + Resend/noop invitation email seam

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Stubbed always | `EMAIL_PROVIDER` still `noop` |
| Resend 403/401 | API key + from-domain verification |
| Broken links | `WEB_ORIGIN` must match the public web origin |
| Invite email mismatch | Accept while logged in as the invited address |
