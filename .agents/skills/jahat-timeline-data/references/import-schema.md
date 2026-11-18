# Timeline import schema

The manager-only importer reads XLSX/XLS, CSV, or JSON locally in the browser. It previews rows and field mappings before sending task records to Supabase. A file is not uploaded. The importer accepts up to 10 MB and imports at most the first 500 data rows.

## Recommended CSV columns

Use these exact Persian headers for CSV/Excel, or the equivalent JSON keys below. The app detects these names automatically; the manager can change mappings in the preview.

| Column | Required | Meaning |
| --- | --- | --- |
| `عنوان` | Yes | Task or milestone title, max 300 characters |
| `تاریخ شروع` | No* | Start date |
| `مهلت` | No* | Due/deadline date |
| `مسئول` | No | Exact team member email; unknown emails import unassigned |
| `وضعیت` | No | `شروع نشده`, `در حال انجام`, or `انجام شده` |
| `نوع` | No | `کار` or `نقطه عطف` |
| `هدف والد` | No | Exact title of the parent milestone for a task or sub-deadline |
| `جزئیات` | No | Description, max 5,000 characters |

*Every row needs at least one valid date. If start is omitted, the project start date is used when set, otherwise the due date is used. If due is omitted, the start date is also used. Include both dates whenever the source provides them.

## Accepted date formats

Prefer ISO `YYYY-MM-DD` (for example `2026-11-13`). Gregorian `YYYY/MM/DD` and `YYYY.MM.DD` are also accepted. Jalali dates are supported as `1405/08/22`, `1405-08-22`, Persian digits, or day-month-name-year (for example `۲۲ آبان ۱۴۰۵`). Excel serial dates are read from spreadsheets. Dates must represent real calendar days and each start must be on or before its due date.

## Milestones and grouping

An explicit milestone row uses `نوع = نقطه عطف`; its `عنوان` becomes the goal title. A sub-deadline also uses `نوع = نقطه عطف` and sets `هدف والد` to the exact main milestone title. A task uses `نوع = کار` and may refer to either milestone. Keep every child start and due date inside its parent range. Put milestone rows before their tasks for readability.

A schedule may instead provide a group/phase name in a parent column without a separate milestone row. Preserve that name in `هدف والد`; the importer generates a milestone spanning the earliest child start through the latest child deadline. Do not turn arbitrary task categories or assignee names into milestones.

The `نوع` values recognized as milestones include `نقطه عطف`, `هدف`, `فاز`, `milestone`, `goal`, `phase`, `true`, `yes`, and `1`. Unrecognized or blank type values default to a regular task. Parent references should be exact and consistent.

## Status and assignee rules

- Done: `انجام شده`, `تمام شده`, `تکمیل شده`, `done`, `complete`, or `completed`.
- In progress: `در حال انجام`, `در جریان`, `doing`, `in progress`, or `active`.
- All other/blank values default to not started (`todo`). Prefer the three Persian values shown above.
- `مسئول` must match a team email exactly. Display names are not resolved to accounts. The importer warns and leaves unmatched assignees blank.

## Example CSV

```csv
عنوان,تاریخ شروع,مهلت,مسئول,وضعیت,نوع,هدف والد,جزئیات
راه‌اندازی کمپین,1405/08/22,1405/09/10,,شروع نشده,نقطه عطف,,هدف نمونه
آماده‌سازی,1405/08/22,1405/08/28,,در حال انجام,نقطه عطف,راه‌اندازی کمپین,هدف مرحله اول
آماده‌سازی محتوا,1405/08/22,1405/08/28,,در حال انجام,کار,آماده‌سازی,نسخه اولیه و بازبینی
انتشار کمپین,1405/08/29,1405/09/10,,شروع نشده,کار,راه‌اندازی کمپین,انتشار و کنترل نتیجه
```

## JSON shape

A JSON file can be either an array of task objects or an object containing a `tasks`, `rows`, or `data` array. Use these keys for automatic mapping:

```json
{
  "tasks": [
    {
      "title": "راه‌اندازی کمپین",
      "start_date": "1405/08/22",
      "due_date": "1405/09/10",
      "assignee": "",
      "status": "todo",
      "type": "milestone",
      "parent": "",
      "description": ""
    },
    {
      "title": "آماده‌سازی محتوا",
      "start_date": "1405/08/22",
      "due_date": "1405/08/28",
      "assignee": "",
      "status": "doing",
      "type": "task",
      "parent": "راه‌اندازی کمپین",
      "description": "نسخه اولیه و بازبینی"
    }
  ]
}
```

## Before returning a file

Check that every task has a title and at least one usable date; normalize all dates to one calendar system; ensure start ≤ due; match each child parent to exactly one milestone title or preserve the parent group for automatic milestone generation; check duplicate title/date/type rows; verify assignee emails against the authorized team list; and state which information was missing instead of guessing. Do not include credentials, service keys, or private idea-matrix data in timeline files.
