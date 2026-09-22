# Writing for Ingestron

Help the reader complete a task. Write as you would explain it to another developer:
use familiar words, direct verbs and short paragraphs. Say “Save your token in
`.env`”, not “configure the secure credential boundary”. Use New Zealand English.

Start with the outcome and prerequisites. Explain new terms where they first appear.
Show working commands and tell the reader what file or result to expect. Keep
internal release gates, backlog IDs and marketing language out of procedures.

Use task titles: “Install a plugin”, “Read GitHub issues”, “Retry a run”. Keep the
main path short; link to concepts, limits and troubleshooting when the reader needs
more detail. Avoid repeated warnings or preview banners. Do not add pages just to
increase coverage. Remove claims that no longer match the published product.

Downloadable examples are the source of truth. Test them, including important
failure paths. Use exact versions for reproducible walkthroughs. Never put tokens,
customer data or unverifiable performance claims in a page or screenshot.

Before a PR, run `pnpm validate`. Run `pnpm samples:github` when changing its example
or procedure. Review desktop and narrow layouts after structural changes. State
whether evidence is synthetic or from a real source; neither proves another user's
success. The skill `ingestron-docs-learning-design` uses this same writing approach.
