# Connection-first ADF project

What `ingestron init sales --connector postgresql --connectivity private --via adf`
creates: one PostgreSQL connection that ADF copies through a self-hosted
integration runtime, one standard listing both packs, `packs: [databricks@1,
adf@1]`, and the ADF resource names set in the platform.

| File                          | What it shows                                                            |
| ----------------------------- | ------------------------------------------------------------------------ |
| `project.yaml`                | The source's server and database as values, the same in each environment |
| `standard.yaml`               | Databricks first, so it names and types the tables; ADF copies           |
| `platform.yaml`               | ADF's landing storage, Key Vault, runtime and resource names             |
| `connections/postgresql.yaml` | The source, reached privately, with its password in Key Vault            |
| `flows/postgresql.yaml`       | The tables ADF copies, each with its contract                            |
| `contracts/*.yaml`            | ODCS contracts: the columns and their types                              |

Replace the example server, objects and storage with yours before deploying.
