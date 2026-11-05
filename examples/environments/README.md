# Environments

One set of definitions, three environments. `project.yaml` gives values per
environment; the platform and connection read them.

`ingestron apply` writes one bundle, `build/databricks/`, with a target for
each environment. Its [`databricks.yml`](build/databricks/databricks.yml)
shows what differs:

|                                       | `dev`         | `test`         | `prod`         |
| ------------------------------------- | ------------- | -------------- | -------------- |
| Catalog (`finance_{{ environment }}`) | `finance_dev` | `finance_test` | `finance_prod` |
| Workspace                             | shared        | shared         | its own        |
| Landing path                          | `dev_landing` | `test_landing` | `prod_landing` |
| Bundle mode                           | development   | production     | production     |
| Daily refresh job                     | paused        | paused         | running        |

Mode and pause follow the environment's name by default: `dev` is in
development mode, every other environment in production mode, and schedules
run only in `prod` or `production`. A platform can set `mode` and
`schedule.paused` itself, from values if they differ per environment.
