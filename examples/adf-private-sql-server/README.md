# Private SQL Server into landing storage

The factory copies an ERP's `customers` and `invoices` from a SQL Server that
only a self-hosted integration runtime reaches, into landing storage, every
hour: `packs: [adf@2]` and `store: { default: none }` in `standard.yaml`.
Each copy reads the rows changed since the last one, by the flow's cursor
(`load: { default: incremental }`).

`ingestron apply` writes one factory for both environments to `build/adf/`,
with a parameter file for `dev` and for `prod`. The environments differ in
their storage account and Key Vault.
