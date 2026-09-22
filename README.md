# Ingestron documentation

The source for [docs.ingestron.io](https://docs.ingestron.io). Guides cover the
published core, CLI, local provider and connectors.

Use Node 22.12 or newer and pnpm 10.15.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm validate
pnpm samples:github
```

Pages live in `content/docs`. Downloadable examples live in `public/examples`.
Follow [the writing guide](CONTRIBUTING.md). Tests check local links, navigation,
release references and the actual example files against the published CLI.
The GitHub example check downloads dependencies and uses synthetic loopback HTTP;
it does not contact a live GitHub data source or need a token.

Deploy the reviewed site with `pnpm deploy:cloudflare`. The existing worker serves
`docs.ingestron.io`; deployment requires authorised Cloudflare access. Check the
home page, search, example downloads and a retired route after deployment.

Original code and documentation are Apache-2.0, licensed by Otrera Limited.
See [LICENSE](LICENSE) and [NOTICE](NOTICE). Framework packages retain their own terms.
