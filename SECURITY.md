# Security

## Report a vulnerability

Email security@ingestron.io. Do not open a public issue. Include the page's
address, what you saw and how to reproduce it.
We acknowledge reports within five working days and agree a disclosure date
with you.

## Supported versions

The live site at docs.ingestron.io is the supported version; fixes are
published there.

## Design

The site is static: it is built ahead of time and served as files, with no
forms, accounts or server-side code beyond serving pages.

Dependencies are pinned exactly and updated one reviewed change at a time;
`pnpm validate` checks their licences.
