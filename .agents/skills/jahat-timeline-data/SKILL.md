---
name: jahat-timeline-data
description: Create or transform project plans into import-ready CSV, XLSX, or JSON files for the Jahat team timeline. Use when an agent needs to prepare, normalize, or validate timeline tasks, milestones, dates, owners, or goal groupings for this app.
---

# Jahat Timeline Data

Create a clean schedule file that the Jahat timeline importer can map without guesswork. Read [the import schema and examples](references/import-schema.md) for exact columns, accepted values, and date rules.

- Prefer the documented CSV headers or JSON keys so the app can map columns automatically. Use XLSX when the user needs multiple sheets or spreadsheet formatting.
- Preserve the source's meaning. Do not invent owners, dates, deadlines, statuses, or milestone relationships; leave unknown optional values blank and call out missing required values.
- Give every task a title and, whenever available, both a start date and a due date. Check that start dates do not come after deadlines.
- Represent goals as milestone rows. Represent sub-deadlines as milestone rows whose `parent` is the exact main milestone title. Link child tasks to either level by exact title. Keep every child date range inside its parent. If the source only groups tasks under a named phase, preserve that group in `parent`; the importer can create the matching milestone automatically.
- Assign work only to an exact team email supplied by the user or present in project data. Leave unknown assignees blank and list them for review.
- Before delivering the file, check row shape, date validity, title uniqueness, milestone references, team email spelling, and whether the file stays within the importer's 500-row and 10 MB limits.
- Deliver the file and a short summary of inferred mappings, omitted information, and any rows needing user review. Do not import it into the live timeline unless the user explicitly asks for that action.
