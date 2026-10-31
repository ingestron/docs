# Ingestron documentation

The site at [docs.ingestron.io](https://docs.ingestron.io): how to install
Ingestron, write definitions, and generate Databricks and Azure Data Factory
files. Reference pages are rendered from the published packages, so they match
the code; every example is a project the tests resolve and generate.

```sh
pnpm install
pnpm dev        # serve the site locally
pnpm validate   # format, licences, types, tests, build and links
```

Requires Node 22.13 or later and pnpm 10. Pages live in `content/docs/`, the
guide examples in `examples/`, and the CI templates readers copy in
`ci-templates/`. How pages are written: [CONTRIBUTING.md](CONTRIBUTING.md) and
the [writing standard](documentation-standard.md). The site is a static export
served by a Cloudflare Worker (`wrangler.jsonc`).

## Contact

Questions and feedback: hello@ingestron.io. Security reports: security@ingestron.io
(see [SECURITY.md](SECURITY.md)). Privacy: privacy@ingestron.io.

## Licence

Licensed under the [Apache License 2.0](LICENSE); see [NOTICE](NOTICE). Made by
[IntentLabs](https://intentlabs.dev).
