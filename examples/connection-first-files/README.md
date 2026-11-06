# Connection-first files project

What `ingestron init shop --connector files --connectivity public --via databricks --env dev`
creates: one files connection that Databricks reads directly with Auto Loader,
and a standard with only the Databricks pack, so every other choice is a pack
default. The landing folder and the table's object are `REPLACE_ME`, each with
a comment saying what it is.

| File                    | What it shows                                     |
| ----------------------- | ------------------------------------------------- |
| `project.yaml`          | The landing folder as a value, still `REPLACE_ME` |
| `standard.yaml`         | `packs: [databricks@2]`                           |
| `connections/shop.yaml` | The files source and its folder                   |
| `flows/orders.yaml`     | The table read from the folder, with its contract |
| `contracts/*.yaml`      | ODCS contracts: the columns and their types       |

`ingestron plan` warns about each `REPLACE_ME`, and `ingestron check` fails
until each is written.
