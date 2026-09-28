# X post — the day it goes live

**Not published yet.** This is the post for the day the site answers on its own
address, written now so that it does not have to be written at two in the
morning after a deploy. When it goes out, rename it `x-post-<date>.md` — the
convention in this folder is that everything published is dated and nothing is
overwritten.

Three things to do before posting:

1. **Fill in the address.** Every `vicehub.com` below is a placeholder for
   whatever domain is actually serving.
2. **Re-count.** The numbers were true when this was written and stop being
   true at the next merge. `npm run test` and `npm run test:integration` print
   them; the count below is unit plus integration, and the Lua checks for the
   game-server resource are separate.
3. **Post the link on its own line, and attach nothing.** X, Discord and
   WhatsApp all render the card the site now serves —
   `apps/web/public/og-vicehub.png`, 1200×630 — and an attached image replaces
   it with a picture that carries no link. If images are wanted instead of the
   card, the screens are in [`docs/media/tema/`](../media/tema/); pick at most
   four and lead with the landing page.

It continues the post before it, which ended on "what is left is not code: a
database, a host, a domain, and the payment keys."

---

That list is empty now. ViceHub is live: **vicehub.com**

It's tooling for GTA VI roleplay communities — the tab you keep open next to the game.

Here is what you can do on it today, without asking anyone for anything:

— **Run a crew.** Members, roles, who can spend, and a treasury with two-sided bookkeeping. Every movement is a debit somewhere and a credit somewhere else, joined by one id.

— **Pay for showing up.** A server pays the crews that play on it, and a crew splits what it earns by *confirmed* attendance — the list the event actually recorded, not the one whoever proposed typed out.

— **Be found.** Crew and server directories, a recruitment board that a crew turns on for itself, and a table on every server of the crews playing there, ranked by the xp they've won from the events they finished. Ties share a place. Nobody breaks them by who joined first.

— **Ask, and get an answer that stays.** A forum in five sections, searchable, where whoever asked marks the reply that solved it. Readable without an account, because the person who most needs the answer usually doesn't have one yet.

— **Sell to the server you play on.** A market per server, with conversations, reviews, and prices in game money. No real money changes hands there, and that is a decision, not a gap.

Nothing here is a mock-up. All of it has been running against a database since before this post — the whole thing was rehearsed from an empty database, in production mode, before it was pointed at a real one.

It is in English, Portuguese, Spanish and French.

First testers get lifetime access, handed out one at a time. If you run a server, reply and say so.

2,783 tests, 0 skipped. Built in the open, from the first commit.

#GTA6 #GTAVI #GTARP #BuildInPublic #IndieDev

---

## Short version

If it has to fit without a "show more":

---

That list is empty now. ViceHub is live: **vicehub.com**

Tooling for GTA VI roleplay communities. Run your crew, move what it earns, and pay by who actually turned up — the confirmed list, not the one somebody typed.

Crew and server directories, a recruitment board, a forum whose answers stay, and a market per server. In four languages.

First testers get lifetime access, one at a time. If you run a server, reply.

#GTA6 #GTARP #BuildInPublic

---

## The reply to keep ready

Someone always asks this within the hour, and the answer is better written
calmly now than quickly then:

---

FiveM is how the reference resource talks to the platform — it's the runtime, not the audience. ViceHub doesn't care what your server runs: it takes a small report from it (how many are on, nothing about who) and everything else works without the game at all.
