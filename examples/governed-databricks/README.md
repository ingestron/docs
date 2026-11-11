# Grant, mask and filter on Databricks

ADF copies a web shop's customers and orders from Azure SQL, and Databricks
keeps the tables (`packs: [databricks@2, adf@2]`). Each table says who may
read it, the sensitive columns are masked, and each reader sees only the rows
of their own region.

Who may read a table:

- Each contract's `roles` name who reads its tables. `regional_sales`, in
  `silver`, is read by `finance-analysts` and `marketing-analysts`.
- A layer can change that. `bronze` holds the raw rows, so it grants none of
  its contracts' roles (`contract: false`) and grants `data-engineers` on
  every table in it. `marketing-analysts`, the role of `customers`, is not
  granted there.
- `principals` in `platform.yaml` says which group each role is in each
  environment, from the values in `project.yaml`, such as
  `shop-marketing-analysts-dev` in `dev`.
- `governance.access.grants: exact` in the standard takes away any other
  privilege granted directly on these tables. The run_as service principal
  and `shop-data-stewards` keep theirs.

What readers see:

- `email` is `confidential`, so readers see a hash of it; `phone` is
  `restricted`, so readers see no value (`governance.masks`).
- `region` is tagged `region` in each contract, so the filter `region_rows`
  passes it to the team's own function `region_filter`, which says which rows
  each reader sees (`governance.filters`).
- The run_as service principal and `shop-data-stewards`
  (`databricks.governance.unmasked`) see every value and every row.

Each of these is switched on in the platform's `databricks.manage`: `grants`,
`masks`, `filters`, and `tags`, which masks and filters match.
`manage.schemas` is on too, so the bundle creates the schemas and the
policies go on each schema.

`ingestron apply` writes `build/databricks/`. After each refresh,
`tasks/shop/apply_contract.py` sets the tags, creates the mask functions in
`dev_governance.functions` (`prod_governance.functions` in `prod`), grants and
revokes, then makes the policies. `prerequisites/<environment>.sql` gives the
run_as service principal what that needs, and `ingestron request --env dev`
lists what must exist first: each group, the function `region_filter`, and
the governed tags `classification` and `region`.
