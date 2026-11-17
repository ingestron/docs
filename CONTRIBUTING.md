# Contributing

Help the reader finish a real task without the author beside them. Describe
only what the code in this repository does today. This applies to every page,
example README, package README and user-facing command text.

## Where things go

- User documentation lives only in `content/docs/`. Package READMEs
  say what the package is, how to install it and how to develop it, and link
  to the site.
- Samples live in `examples/<name>/` here (one idea each); the starters
  (complete projects to start from) are the CLI's project templates. Pages show their files
  with `<Example name="<name>" file="…" />`, or part of one with `pick` or
  `from` and `to`; never paste sample YAML into a page. `<Template>` shows
  part of a file in `ci-templates/` the same way. What a sample uses comes from resolving it; never hand-write it.
- Facts the code knows (settings, defaults, connector facts, error codes,
  document fields, CLI commands, what each pack does with intent, and the
  published standards' files) are rendered by components in
  `components/reference/`. Change the code, not the page.
- Each platform has a site of its own, chosen with the picker in the header:
  `synapse/`, `databricks/`, `adf/` and `duckdb/`, each with the same
  sections (Get started, Guides, Standards, Connectors, then its own Concepts
  and Reference pages). A section is a folder in brackets, such as
  `synapse/(guides)/`, whose `meta.json` says `"root": true`; the brackets set
  the tab without changing the URL, `/docs/synapse/<page>`. The pages that
  read the same everywhere (definitions, YAML, the command line, the editor,
  errors) are in `concepts/` and `(reference)/`, one address each, with no
  platform's text in them. `lib/platforms.ts` says which section and
  platforms each page belongs to; `test/areas.test.ts` and
  `test/platform-paths.test.ts` pin them. A page never moves to a new URL
  without a redirect in `worker/redirects.js` or a page at the old URL that
  lists its versions; a section that moves or is renamed keeps its old id
  with `<OldAnchor id="…" />`, because a browser cannot redirect a fragment.
- A page several platforms show is written once, in `content/shared/`, and
  each of those platforms has a stub: front matter and one `<include>`,
  nothing else. **Edit the shared file, never a stub**, and read a change to a
  shared file on every platform that shows it. Text for some platforms goes
  in `<Only on="synapse databricks">…</Only>`; a link to a page on the
  reader's own platform is `/docs/~/<page>`, and a component's
  `platform="~"` is the page's platform. The build keeps only the page's
  platform's text (`lib/remark-only.ts`), so its contents and search hold
  nothing else. `test/stubs.test.ts` fails when a stub holds text of its own
  or a product-wide page holds `<Only>`.
- **A platform's docs name no other platform**, in prose, YAML, commands,
  outputs, alt text, links or examples. Each example on a platform's page is
  that platform's own project; an example named `<name>-~` is the page's
  platform's, such as `data-products-synapse`. Data Factory into another
  platform is a combined site of its own, `/docs/adf-<platform>`, listed
  under **Combined** in the picker, and its pages may name its two
  platforms. `test/platform-leak.test.ts` checks the pages' text and
  `pnpm check:links` the built pages, components included; nothing is
  allowed. Product-wide pages (Concepts, Reference, the home page) may name
  every platform. Keep `<Only>` blocks out of list items: Prettier
  re-indents them there.
- Connector pages are generated per platform: a connector's notes are one
  file in `content/shared/connectors/`, and `pnpm stubs` writes each
  platform's stubs, its Connectors `meta.json` and the old
  `/docs/connectors/<id>` pages from the connector facts.
  `test/connector-sites.test.ts` fails when they are out of date.
- A code block says what it is. `sh` fences are commands to run; `yaml`, `json`,
  `csv` and `dotenv` fences and `<Example>` files are files to write; an
  untitled `text` fence is what Ingestron prints; an `<Example>` under `build/`
  is a file Ingestron writes. Never type the `$` prompt: the site draws it.
  Where the rule misplaces a block, mark the fence, as in
  `json kind="plain"`. `lib/block-kind.ts` has the whole rule.
- Organise by the reader's job. Steps that differ between the CLI and VS Code
  go in `<ToolSteps>`; a page under Tools only when one tool alone has the
  feature.

## One voice

Read the [writing standard](documentation-standard.md) before writing or
restructuring. In short:

- Write to the reader: “Run”, “Open”, “Save”, “Check”. Use familiar words.
- Lead with the outcome. Explain a term where the reader first needs it.
- Show a small working example, then the values the reader changes.
- Show the expected file or output after each meaningful step.
- Warn only for a concrete consequence at that step. No preview banners,
  backlog IDs, release gates or padding. British English spelling (organisation, colour,
  behaviour).

## Check

Run `pnpm validate` under Node 22. After a structural change, look at the
pages at desktop and phone width, in light and dark, and with the keyboard.

## Licence

Ingestron is licensed under the [Apache License 2.0](LICENSE). By contributing,
you agree that your contribution is licensed under the same terms.

Every commit is signed off under the
[Developer Certificate of Origin 1.1](https://developercertificate.org/): add
`-s` to `git commit`, which appends `Signed-off-by: Your Name <you@example.com>`
matching the commit author. `pnpm dco:check` checks the commits since
`origin/main`; pull requests run it too.

## Conduct

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).
