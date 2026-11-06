# Private SQL Server, with its values written

The `private-sql-server` starter, created with `ingestron init` and a `--set`
for each value the starter leaves as `REPLACE_ME`: the ERP's server, login and
tables, each environment's storage account and Key Vault, and the self-hosted
integration runtime. The values are synthetic, and the window's `start` is
the day the example was created. The
[Azure Data Factory page](https://docs.ingestron.io/docs/platforms/adf#create-it)
shows the command.

`ingestron apply` writes one factory to `build/adf/`, with a parameter file for
`dev` and `prod`, and one bundle to `build/databricks/`.
