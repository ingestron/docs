# Change data

The source files hold one row per change: a key, a time and an operation.
The flow orders each key's changes by `changed_at`, with `sequence`.

- `accounts` keeps `history: latest`: [the table](build/databricks/src/crm/bronze/accounts.sql)
  keeps only the current row per key (`STORED AS SCD TYPE 1`); a change whose
  `operation` is `DELETE` removes the key, by `load.deletes.when`.
- `contacts` keeps `history: full`: [the table](build/databricks/src/crm/bronze/contacts.sql)
  keeps every version (`STORED AS SCD TYPE 2`), keyed by two columns in
  `primaryKeyPosition` order.

Each also gets a `<table>_changes` streaming table with the records as
received. Keys come from the contract's `primaryKey` columns. `history`,
`sequence` and `load.deletes.when` are intent; `except_columns`, the columns
left out of the kept table, is a setting of the `streaming-table` method.
Without a key or a `sequence`, loading fails with `METHOD_CHECK`.
