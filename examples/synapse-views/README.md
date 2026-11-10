# Serve files as SQL

ADF copies the ERP's tables into storage, one file per table, and Synapse
serverless SQL shows them to reports as views: `packs: [synapse@2, adf@2]` and
`store: { default: synapse-view }` in `standard.yaml`. Synapse is listed first
even though ADF runs first: the first pack names and types the views; ADF only
copies.

`ingestron apply` writes:

- `build/adf/`: the copy pipeline, its trigger, linked services and datasets,
  and a parameter file for each environment;
- `build/synapse/checks.sql`, with `checks/<environment>.sql`: the checks of
  the contracts' required columns, counted each time it runs. `bronze` keeps
  the rows as they arrived and only counts its checks, and `silver` and `gold`
  check theirs;
- `build/synapse/views.sql`: a view per table over its file,
  `[bronze].[customers]` and `[bronze].[invoices]`, and
  `[silver].[customer_totals]` over the invoices view, from
  `transforms/customer_totals.yaml`, with `environments/<environment>.sql`
  setting each environment's database.

Run `sqlcmd -i environments/<environment>.sql` from `build/synapse/` after
each change to the definitions; loads need nothing more. `ingestron request`
lists what the platform team creates: the database, a master key if it has
none, the external data source `landing` with its credential, Storage Blob Data
Reader on the landing storage for the Synapse workspace's managed identity, and
report users' access.
