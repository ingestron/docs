# Connection-first files project

What `ingestron init shop --connector files --via databricks` creates: one files
connection that Databricks reads directly with Auto Loader, and a standard with
only the Databricks pack, so every other choice is a pack default.

| File                    | What it shows                                           |
| ----------------------- | ------------------------------------------------------- |
| `project.yaml`          | The landing folder as a value                           |
| `standard.yaml`         | `packs: [databricks@1]`                                 |
| `connections/shop.yaml` | The files source and its folder                         |
| `flows/*.yaml`          | The tables read from the folder, each with its contract |
| `contracts/*.yaml`      | ODCS contracts: the columns and their types             |

Replace the example folder and objects with yours before deploying.
