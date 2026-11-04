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
  document fields, CLI commands) are rendered by components in
  `components/reference/`. Change the code, not the page.
- Every page belongs to one of seven areas, each a folder whose `meta.json`
  says `"root": true`. A folder in brackets, such as `how-to/(build)/`,
  sets a page's area without changing its URL. A new page goes in its area's
  folder and `meta.json`, and its URL into `test/page-urls.txt`; a page never
  moves to a new URL without a redirect in `worker/redirects.js`. A section
  that moves or is renamed keeps its old id with `<OldAnchor id="…" />`,
  because a browser cannot redirect a fragment.
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
