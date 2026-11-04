# Northwind on Azure

ADF copies four tables from Northwind, Microsoft's sample database, into
landing storage, and Databricks reads the landed files into tables: `packs:
[databricks@1, adf@1]` in `standard.yaml`. The platform pages' screenshots
of Azure Data Factory, and of Databricks on the ADF route, show this project,
deployed.

The standard sets how the team builds its ADF pipelines, under
`ingest.settings.adf-copy`:

- `pattern: foreach`: one Copy activity inside a ForEach over the pipeline's
  `tables` parameter, four copies at a time (`parallel: 4`);
- `activity`: two retries, a minute apart, and an hour's timeout for each copy;
- `audit_columns`: `_loaded_at`, `_run_id` and `_source` on every landed row;
- `folder` and `annotations`: the factory folder `ingestron/northwind`, and a
  `northwind` annotation on the pipeline.

`ingestron apply` writes, under `build/dev/`:

- `adf/`: the pipeline `pl_northwind_northwind`, its trigger every 24 hours
  (stopped outside production), the linked services and the datasets;
- `databricks/`: the bundle, with a pipeline that reads each table's files
  into `bronze` and builds `silver.daily_sales` from
  `transforms/daily_sales.yaml`;
- `products/`: a passport for each data product in `products/`.

The server in `connections/northwind.yaml`, and the storage, Key Vault,
runtime and workspace in `project.yaml`, are synthetic: replace them with your
own before you deploy.
