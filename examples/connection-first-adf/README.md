# Connection-first ADF project

What `ingestron init sales --connector postgresql --connectivity private --via adf-databricks`
creates, with a `--set` for each value it leaves as `REPLACE_ME`, and then the
ADF resource names set by hand: one PostgreSQL connection that ADF copies
through a self-hosted integration runtime, and one standard listing both packs,
`packs: [databricks@2, adf@2]`.

| File                          | What it shows                                                               |
| ----------------------------- | --------------------------------------------------------------------------- |
| `project.yaml`                | Each environment's storage account and Key Vault, and the ADF names' prefix |
| `standard.yaml`               | Databricks first, so it names and types the tables; ADF copies; the window  |
| `platform.yaml`               | ADF's landing storage, Key Vault, runtime and shared resource names         |
| `connections/postgresql.yaml` | The source, reached privately, with its password in Key Vault               |
| `flows/postgresql.yaml`       | The table ADF copies, its contract, and the pipeline's and trigger's names  |
| `contracts/*.yaml`            | ODCS contracts: the columns and their types                                 |

The values are synthetic: replace the server, objects, storage and vault with
yours before deploying.
