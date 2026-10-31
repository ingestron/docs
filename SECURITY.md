# Security

## Report a vulnerability

Email security@ingestron.io. Do not open a public issue. Include the version of
the documentation site, what you ran, and the smallest definitions that reproduce the problem.
We acknowledge reports within five working days and agree a disclosure date
with you.

## Supported versions

Security fixes go into the latest `1.x` release.

## Design

The site is static: it is built ahead of time and served as files, with no
forms, accounts or server-side code beyond serving pages.

Dependencies are pinned exactly and updated one reviewed change at a time;
`pnpm validate` checks their licences.
