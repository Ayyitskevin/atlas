# Deployment

Atlas is still early, but the runtime should behave like an operator-owned self-hosted app: the API must fail loudly when dependencies are wrong, storage probes should be run before launch, and attachment maintenance should be scheduled instead of left to manual cleanup.

## Runtime Checklist

1. Build and deploy the repository to the runtime checkout, for example `/opt/atlas`.
2. Create an `atlas` service user with ownership of the checkout and no shared shell secrets.
3. Copy the environment template and fill real values:

   ```bash
   sudo install -d -m 0750 -o root -g atlas /etc/atlas
   sudo install -m 0640 -o root -g atlas infra/systemd/atlas.env.example /etc/atlas/atlas.env
   ```

4. Run preflight from the checkout before starting or after changing infrastructure:

   ```bash
   sudo -u atlas bash -lc 'set -a; source /etc/atlas/atlas.env; set +a; cd /opt/atlas && corepack pnpm preflight'
   ```

`/etc/atlas/atlas.env` should be treated as a secret file. It carries database, Redis, S3-compatible storage, scanner, email, and JWT settings because Atlas validates the shared runtime config at import time.

## Attachment Maintenance Timer

Atlas stores attachment metadata separately from S3-compatible objects. Pending browser uploads and retained soft-deleted objects are cleaned by `pnpm cleanup:attachments`, which defaults to a dry run. Production should schedule the confirmed command after a dry-run check.

Install the checked-in systemd examples:

```bash
sudo install -m 0644 infra/systemd/atlas-attachment-maintenance.service /etc/systemd/system/
sudo install -m 0644 infra/systemd/atlas-attachment-maintenance-dry-run.service /etc/systemd/system/
sudo install -m 0644 infra/systemd/atlas-attachment-maintenance.timer /etc/systemd/system/
sudo systemctl daemon-reload
```

Run the dry-run service first:

```bash
sudo systemctl start atlas-attachment-maintenance-dry-run.service
sudo journalctl -u atlas-attachment-maintenance-dry-run.service -n 100 --no-pager
```

If the dry-run output matches the expected cleanup window, run one confirmed pass:

```bash
sudo systemctl start atlas-attachment-maintenance.service
sudo journalctl -u atlas-attachment-maintenance.service -n 100 --no-pager
```

Then enable the daily timer:

```bash
sudo systemctl enable --now atlas-attachment-maintenance.timer
systemctl list-timers atlas-attachment-maintenance.timer
```

The timer runs daily around 03:15 with a randomized delay. The service exits non-zero when confirmed object deletion failures remain, so failed maintenance appears in `systemctl --failed` and the unit journal.

Tune cleanup windows in `/etc/atlas/atlas.env`:

- `ATLAS_PENDING_UPLOAD_TTL_HOURS`: pending initial uploads and replacement versions older than this are expired; default is `24`.
- `ATLAS_DELETED_ATTACHMENT_OBJECT_RETENTION_DAYS`: soft-deleted attachment objects older than this are deleted; default is `30`.

## Scanner Preflight

The default scanner provider is `noop`, and preflight reports `attachmentScanner: "skipped"`. When using ClamAV, configure:

```bash
ATTACHMENT_SCAN_PROVIDER=clamav
CLAMAV_HOST=127.0.0.1
CLAMAV_PORT=3310
```

Run `corepack pnpm preflight` after changing scanner settings. With `ATTACHMENT_SCAN_PROVIDER=clamav`, preflight requires a successful clamd `PING` before reporting success.
