# Define a data product on Data Factory

The factory copies the web shop's orders and customers from Azure SQL into
landing storage, and the landed files are the product (`packs: [adf@2]`).
Nothing builds tables, so there is no `sales` product here. On top, one **data product**, an Open Data Product Standard file in
`products/`:

- `customers` publishes the customers table (contract `shop.customers`), owned
  by Mia Chen. Its name and email columns are classified `confidential`, and
  the contract says who may use them: `marketing-analysts`, for campaign
  reporting, approved by Mia.

The standard's `governance` section says what every product must give: an
owner and a purpose; a classification for every column it publishes, one of
four values; and, for a contract with confidential or restricted columns, the
roles that may use it, each with a purpose and an approver. `ingestron check`
fails until every product meets these, so a pull request that breaks one is
stopped. Remove `classification: confidential` from `email` to see it:

```text
contracts/customers.yaml:13:17  error  COLUMN_UNCLASSIFIED
  Column "email" of the contract "shop.customers" has no classification; "customers" publishes it, and the standard requires one.
```

`ingestron apply` writes, beside the pipelines, `build/products/<environment>/`:
a `README.md` listing the products, and a passport per product, `customers.md`. A passport says, in plain words, who owns the product and what
it is for, which table it is in this environment and where, its columns and
which are sensitive, its quality checks, how fresh it is, who may use it, its
lineage as a diagram, and the governance rules it meets. It is generated with
the pipelines, so it is always up to date.

DuckDB has no users or permissions, so it cannot grant `marketing-analysts`
access to `customers`. Planning says so, as a `NOT_APPLIED` warning on the
contract's role. The platform team has decided to live with it: who may read
the published files is set on the storage account. So `platform.yaml` accepts
the warning, with that reason, in its `accept` list. The plan then prints
`1 accepted warning (platform.yaml)` in place of the warning. Accepting a
warning does not grant anything: the passport's "Who may use it" still says
`Not enforced on DuckDB: DuckDB has no access control.`
