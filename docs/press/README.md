# Press

Anything written or drawn to be posted somewhere other than the product: ship
logs, post copy, and the images that go with them.

They live in the repository for one plain reason — **it is the one place that
is reachable from a phone.** A published web page cannot hand you a file: the
sandbox that runs it blocks every download the page starts itself, links and
scripts alike. GitHub serves the raw file, so the file goes here.

## What is here

| File | What it is |
|---|---|
| `x-post-<date>.md` | The post text, long and short, ready to copy |
| `x-card-<date>.png` | 1200×1500 (4:5), the tallest portrait X shows uncropped |
| `ship-log-<date>.png` | The long version, with what each change was for |
| `og-card.html` | The link card the product itself serves — not dated, see below |
| `render-og.mjs` | Renders that card to `apps/web/public/og-vicehub.png` |
| `*.html` | The source each image was rendered from |

Everything here is dated and nothing is overwritten. A ship log is a record of
one week; the next one does not replace it.

**The link card is the exception, and deliberately so.** `og-card.html` is what
someone sees when a ViceHub link is pasted into X, Discord or WhatsApp. Whoever
shows that card keeps it cached for weeks, so it says nothing that expires — no
dates, no "in development", no counts. It is the one image here that is
overwritten rather than dated:

```bash
node docs/press/render-og.mjs
```

The fonts are fetched and embedded before rendering, because the browser that
takes the picture has no network access to Google Fonts — and a page that does
not get its fonts draws itself in another one without complaining. The script
refuses to save if Archivo did not load.

## The images are generated, not drawn

Each `.png` is a screenshot of the `.html` beside it, so the HTML is the
original and the image is the output. To change an image, change the HTML and
render it again rather than editing pixels.

The pages use ViceHub's own tokens and typefaces — the ones in
`apps/web/src/styles/theme.css` — so that what gets posted looks like the
product and not like a template. If the palette changes there, it should change
here too.

## Before posting

Numbers go stale faster than prose. "8 shipped" was true on the day it was
written and stopped being true at the next merge — check the count and the test
totals against the repository before anything goes out, because a wrong number
in public is worth more attention than a late post.
