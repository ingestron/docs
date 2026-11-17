# DuckDB environments

The DuckDB starter with two environments, `dev` and `prod`, on the same
machine. `project.yaml` gives each its own `published` folder, and
`platform.yaml` reads it with `${values.published}`.

`ingestron apply` writes `build/duckdb/dev/` and `build/duckdb/prod/`: the
same tables, each environment's `run.sql` publishing to its own folder.
