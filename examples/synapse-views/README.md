# Serve files as SQL

The Synapse workspace pipelines copy the ERP's Azure SQL tables into storage,
one file per table, and serverless SQL shows them to reports as views:
`packs: [synapse@2]`, `ingest: { default: synapse-copy }` and
`store: { default: synapse-view }` in `standard.yaml`.

`ingestron apply` writes:

- `build/synapse/workspace/<environment>/`: the copy pipeline, its trigger,
  linked services and datasets, as the workspace's Git integration lays them
  out;
- `build/synapse/checks.sql`, with `checks/<environment>.sql`: the checks of
  the contracts' required columns, counted each time it runs. `bronze` keeps
  the rows as they arrived and only counts its checks, and `silver` and `gold`
  check theirs;
- `build/synapse/views.sql`: a view per table over its file,
  `[bronze].[customers]` and `[bronze].[invoices]`, and
  `[silver].[customer_totals]` over the invoices view, from
  `transforms/customer_totals.yaml`. Each view is followed by a `GRANT SELECT`
  to its roles, in its own database. `environments/<environment>.sql` sets
  each environment's database and the database user each role is.

Who may read each view: `synapse.manage.grants: true` in `platform.yaml`
turns grants on. The contract of `customer_totals` names the role
`finance-analysts`, and the standard's `bronze` layer grants
`data-engineers` on every view in it. `principals` in `platform.yaml` says
which database user each role is in each environment, from the values in
`project.yaml`, such as `sales-finance-analysts-dev` in `dev`. Synapse
serverless has no data masking or row-level security, so a masked
classification or a row filter would be a `NOT_APPLIED` warning here.

Run `sqlcmd -i environments/<environment>.sql` from `build/synapse/` after
each change to the definitions; loads need nothing more. `ingestron request`
lists what the platform team creates: the database, a master key if it has
none, the external data source `landing` with its credential, Storage Blob Data
Reader on the landing storage for the Synapse workspace's managed identity, and
each role's database user, with the rights views over files need.
