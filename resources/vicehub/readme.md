# ViceHub — the server resource

Reports your server to ViceHub: whether it is up, and how many people
are inside. It is what makes a server show as online in the directory
without anyone having to flip a switch by hand.

## Which servers

ViceHub is for **GTA VI** roleplay communities. On the platform side the
ingest is plain HTTP — one request carrying a key — so any server that
can make a request can report itself, whatever engine it runs.

This resource is the **reference implementation**, written for the FiveM
runtime because that is what exists today to install and test for real.
When there are server tools for GTA VI, the contract on the other side
is the same and this file is what changes.

## Install

1. Copy the `vicehub` folder into your server's resources
   (`resources/`).

2. Open your server's page on ViceHub, go to **Server keys**, and create
   one. **The key is shown once.** Copy it there and then — we keep only
   a digest of it, and anyone who loses it generates another.

3. In `server.cfg`:

   ```cfg
   ensure vicehub
   set vicehub_key "vh_<prefix>_<secret>"
   ```

4. Start the server. The console should say:

   ```
   [ViceHub] Connected as "Your Server's Name".
   ```

   If another name shows up, the key belongs to a different server.

## What leaves

One request a minute, carrying one line of JSON:

```json
{ "playersOnline": 37 }
```

And nothing else. No player list, no identifiers, nothing about who is
playing.

## Where the key must not be

The key is a secret of the server: whoever holds it can tell lies about
it — that it is online when it is not, or busier than it is. Do not put
it in a public repository or in a client script. If you think it has
leaked, revoke it on the same page where you created it and make
another; revoking takes effect immediately.

What the key **cannot** do: touch accounts, treasuries or plans. It
speaks for one server and nothing more.

## If something goes wrong

The resource writes to the console, and repeats a warning only when it
changes — a misconfigured server will not fill your log with the same
line every minute.

| What you read | What is happening |
|---|---|
| `No vicehub_key in server.cfg` | the key is missing |
| `Key rejected` | the key is wrong, or was revoked |
| `Could not reach ViceHub` | network or platform down — it retries on its own, waiting longer each time |
| `Reporting again.` | it recovered |

## Address

By default it points at the public installation. For your own:

```cfg
set vicehub_url "https://your-installation/api/v1"
```

## Tests

The resource runs inside the game, but what decides whether it is
correct needs no game at all — what goes in the body, what it does when
the key is rejected, how long it waits before trying again. That runs
against a fake runtime shaped like the parts the resource uses:

```bash
npm run test:lua
```
