# Retail, with its values written

The `retail` starter, created with `ingestron init` and a `--set` for each
value the starter leaves as `REPLACE_ME`: each environment's workspace and
storage account, and who the pipelines run as, who manages and views them, and
where failures are mailed. The values are synthetic. The
[Databricks page](https://docs.ingestron.io/docs/platforms/databricks#create-it)
shows the command.

`ingestron apply` writes one bundle to `build/databricks/`, with a `dev` and a
`prod` target.
