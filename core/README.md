# Core runner: NATS creds setup

This app supports two NATS auth modes:

- Token (simple): `NATS_URL` + `NATS_AUTH_TOKEN`
- NKEY/JWT (recommended for long‑lived TCP): `.creds` file via `NATS_CREDS_FILE`

## 1) Place your creds file

Save the full creds block you received (including BEGIN/END sections) to `core/runner.creds`.

Example (do not commit this file):

```
-----BEGIN NATS USER JWT-----
<JWT>
------END NATS USER JWT------

-----BEGIN USER NKEY SEED-----
<SEED>
------END USER NKEY SEED------
```

`.gitignore` is configured to ignore `*.creds`.

## 2) Configure env

In your root `.env` (already templated):

```
NATS_URL=tls://connect.ngs.global:4222
NATS_CREDS_FILE=core/runner.creds
```

Sync into `core/.env`:

```
pnpm run env:sync
```

## 3) Connect examples

Rust (nats crate):

```rust
use std::fs;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let url = std::env::var("NATS_URL")?;
    let creds_path = std::env::var("NATS_CREDS_FILE")?;
    let creds = fs::read_to_string(creds_path)?;
    let opts = nats::Options::with_credentials(creds);
    let nc = opts.with_name("core-runner").connect(&url)?;
    nc.publish("spell.ping", b"hello")?;
    Ok(())
}
```

Node (nats.js):

```ts
import { connect, credsAuthenticator } from "nats";
import { readFileSync } from "node:fs";

const url = process.env.NATS_URL!;
const creds = readFileSync(process.env.NATS_CREDS_FILE!, "utf8");
const nc = await connect({ servers: url, authenticator: credsAuthenticator(new TextEncoder().encode(creds)) });
await nc.publish("spell.ping", new TextEncoder().encode("hello"));
await nc.drain();
```

Notes:
- For NGS (connect.ngs.global), TLS is required (already implied by the `tls://` URL).
- Do not store creds in git or images. Mount or inject at runtime.

