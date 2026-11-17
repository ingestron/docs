# Run a flow on its own triggers

An ERP flow on Azure Data Factory that writes two triggers of its own: an
hourly tumbling window that copies the rows changed in each hour, and a weekly
schedule that copies again in full and merges by key: `customers` entirely,
and `invoices` only from `min_date`, the last 30 days.
The values are synthetic.

- [The standard](standard.yaml) lets flows write triggers
  (`operations.schedule: { per: flow }`), reads their times in `Europe/London`,
  and in `prod` allows no run to start between 02:15 and 02:45.
- [The flow](flows/erp.yaml) writes the triggers, the `min_date` parameter, and
  the `invoices` table's `filter` that reads it.
- Both tables have a primary key in their contract, and `bronze` keeps
  `history: latest`, so overlapping and repeated rows are merged, not
  duplicated.

`ingestron apply` writes one pipeline and two triggers to `build/adf/factory/`:
a `TumblingWindowTrigger` and a `ScheduleTrigger`, both started only in `prod`.
The tumbling window has `backfill: true` because its `start` is in the past by
the time you read this; without it, `plan` stops with `FIRST_WRITE`.
