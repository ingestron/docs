# Quality checks

One contract's checks, generated for three engines. Each environment builds the
readings table on a different one, so you can compare what each does with the
same rules: `databricks` keeps it as a streaming table, `duckdb` as a DuckDB
table, and `synapse` as a Synapse serverless view over the files Azure Data
Factory lands. `project.yaml` gives each environment its methods, and the
standard uses them as its defaults. A real project builds its tables on one
engine.

The checks:

| Check                                    | From                                     | Action                                  |
| ---------------------------------------- | ---------------------------------------- | --------------------------------------- |
| `sensor_id_not_null`, `read_at_not_null` | `required: true` in the contract         | `drop`, from the standard's `required`  |
| `sensor_id_pattern`                      | the contract's `pattern` for `sensor_id` | `warn`, from the standard's `default`   |
| `known_unit`                             | the contract's `known_unit` rule         | `warn`, from the standard's `default`   |
| `plausible_temperature`                  | the flow's own expectation               | `fail`, written on the expectation      |
| `has_readings`                           | the contract's table rule, `rowCount`    | `warn`: a table check never drops a row |

The `bronze` layer does `check` and `quarantine`, so every engine checks its
rows there, and the standard's `quarantine: true` and `results: true` reach
it.

`ingestron apply` writes:

- `build/databricks/`: [the table](build/databricks/src/iot/bronze/readings.sql)
  with a constraint per check and `readings_quarantine` beside it, and
  `tasks/iot/apply_contract.py`, which counts `has_readings` after each
  refresh because the platform turns on `databricks.manage.checks`;
- `build/duckdb/duckdb/run.sql`: the checks counted and printed in the run's
  transaction, the rows kept apart in `bronze.readings_quarantine`, and each
  result in `bronze._ingestron_checks`;
- `build/synapse/views.sql`: a view that leaves out the rows a `drop` check
  fails, and `build/synapse/checks.sql`, which counts every check and raises an
  error when `plausible_temperature` fails.

Synapse cannot apply four of these, and `ingestron plan` says so under
`Not applied on this platform`: the `pattern` rule, the `fail` action,
quarantine and results.
