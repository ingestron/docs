# Flow triggers on Synapse

The Synapse workspace pipelines copy an ERP's Azure SQL tables into landing storage, one file per table replaced by each run, and serverless SQL shows them as views, with `packs: [synapse@2]`.

The standard lets flows write their own triggers (`operations.schedule: { per: flow }`),
in Europe/London, and in `prod` allows no start between 02:15 and 02:45. The
`erp` flow writes an hourly tumbling window and a Sunday reload of the
invoices from a date it passes as a parameter, which the invoices' `filter`
reads.
