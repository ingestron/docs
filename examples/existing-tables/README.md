# Existing tables

- `sales` lands in bronze from the point-of-sale files.
- `store_sales` joins it with the stores table another team owns. Its code
  names that table as `${values.stores}`, and `project.yaml` gives the name
  for each environment: `dev_reference.core.stores` in dev and
  `prod_reference.core.stores` in prod. In
  [the generated table](build/databricks/src/sales/silver/store_sales.sql)
  the part that differs is `${ingestron.store_sales_value}`, which each target
  of `databricks.yml` sets.

Ingestron never creates or changes the stores table, and does not list it in
`inputs`: `inputs` are tables the project builds.
