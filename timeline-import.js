/* Read local schedule files and import mapped rows as timeline tasks. */
(() => {
  const $ = (selector) => document.querySelector(selector);
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const MAX_ROWS = 500;
  const fields = {
    title: { label: 'عنوان کار *', aliases: ['title', 'task', 'name', 'کار', 'عنوان', 'تسک', 'فعالیت'] },
    start: { label: 'تاریخ شروع', aliases: ['start', 'start date', 'from', 'شروع', 'آغاز'] },
    due: { label: 'مهلت / پایان *', aliases: ['due', 'deadline', 'due date', 'end date', 'target date', 'مهلت', 'ددلاین', 'پایان', 'سررسید'] },
    type: { label: 'نوع ردیف', aliases: ['type', 'kind', 'نوع', 'نوع کار', 'milestone type', 'is milestone'] },
    parent: { label: 'هدف / نقطه عطف والد', aliases: ['parent', 'parent task', 'goal', 'phase', 'milestone', 'group', 'هدف', 'فاز', 'نقطه عطف', 'وابستگی'] },
    assignee: { label: 'ایمیل مسئول', aliases: ['assignee', 'owner', 'assigned to', 'responsible', 'مسئول', 'مجری', 'ایمیل'] },
    status: { label: 'وضعیت', aliases: ['status', 'state', 'وضعیت', 'حالت'] },
    description: { label: 'جزئیات', aliases: ['description', 'details', 'notes', 'شرح', 'جزئیات', 'توضیحات'] },
  };
  let workbook = null;
  let rawHeaders = [];
  let rawRows = [];
  let records = [];
  let validRows = [];

  function normalize(value) {
    return String(value ?? '').trim().toLocaleLowerCase('fa-IR')
      .replace(/[\u200c\s_\-]+/g, ' ').replace(/[۰-۹٠-٩]/g, digit => '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'.indexOf(digit) % 10);
  }
  function headerScore(header) {
    const token = normalize(header);
    return Object.values(fields).filter(field => field.aliases.some(alias => token === normalize(alias) || token.includes(normalize(alias)))).length;
  }
  function findHeaderRow(rows) {
    let best = 0, bestScore = 0;
    for (let i = 0; i < Math.min(rows.length, 12); i++) {
      const score = (rows[i] || []).reduce((sum, cell) => sum + headerScore(cell), 0);
      if (score > bestScore) { best = i; bestScore = score; }
    }
    return best;
  }
  function toGrid(rows) {
    const headerIndex = findHeaderRow(rows);
    const header = (rows[headerIndex] || []).map((value, index) => String(value || '').trim() || `ستون ${index + 1}`);
    return { headers: header, rows: rows.slice(headerIndex + 1).filter(row => row.some(cell => String(cell ?? '').trim() !== '')) };
  }
  function autoMapping() {
    const mapping = {};
    for (const [key, field] of Object.entries(fields)) {
      mapping[key] = rawHeaders.findIndex(header => field.aliases.some(alias => normalize(header) === normalize(alias) || normalize(header).includes(normalize(alias))));
    }
    return mapping;
  }
  function renderMapping() {
    const host = $('#import-mapping');
    const suggestion = autoMapping();
    host.innerHTML = Object.entries(fields).map(([key, field]) => {
      const selected = suggestion[key];
      const options = [`<option value="-1">— انتخاب ستون —</option>`, ...rawHeaders.map((header, index) => `<option value="${index}" ${index === selected ? 'selected' : ''}>${esc(header)}</option>`)].join('');
      return `<label>${esc(field.label)}<select class="select" data-field="${key}">${options}</select></label>`;
    }).join('');
    host.classList.remove('hidden');
    host.onchange = renderPreview;
    renderPreview();
  }
  function mappedValue(row, key) {
    const index = Number($(`#import-mapping [data-field="${key}"]`)?.value ?? -1);
    return index >= 0 ? row[index] : '';
  }
  function gregorianFromJalali(jy, jm, jd) {
    jy += 1595;
    let days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor((jy % 33 + 3) / 4) + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
    let gy = 400 * Math.floor(days / 146097); days %= 146097;
    if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
    gy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    let gd = days + 1;
    const monthLengths = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm = 1; while (gm <= 12 && gd > monthLengths[gm]) gd -= monthLengths[gm++];
    return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
  }
  function parseDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === 'number' && value > 20000 && value < 100000 && window.XLSX) {
      const parts = XLSX.SSF.parse_date_code(value);
      if (parts) return `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
    }
    const text = normalize(value).replace(/٫/g, '.');
    if (/^1[34]\d{6}$/.test(text)) return gregorianFromJalali(Number(text.slice(0, 4)), Number(text.slice(4, 6)), Number(text.slice(6, 8)));
    const persianMonths = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    const named = text.match(/^(\d{1,2})\s+(.+?)\s+(\d{4})$/);
    if (named) {
      const month = persianMonths.indexOf(named[2]);
      if (month >= 0) return gregorianFromJalali(Number(named[3]), month + 1, Number(named[1]));
    }
    const match = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
    if (!match) return '';
    const [, year, month, date] = match.map(Number);
    if (month < 1 || month > 12 || date < 1 || date > 31) return '';
    return year < 1700 ? gregorianFromJalali(year, month, date) : `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
  }
  function isMilestone(value) {
    return /^(true|1|yes|y|milestone|goal|phase|هدف|نقطه عطف|فاز)$/i.test(normalize(value));
  }
  function parseStatus(value) {
    const token = normalize(value);
    if (/^(done|complete|completed|finished|انجام شده|تمام شده|تکمیل شده)$/.test(token)) return 'done';
    if (/^(doing|in progress|active|در حال انجام|در جریان)$/.test(token)) return 'doing';
    return 'todo';
  }
  function prepareRows() {
    const mapping = Object.fromEntries(Object.keys(fields).map(key => [key, Number($(`#import-mapping [data-field="${key}"]`)?.value ?? -1)]));
    const pick = (row, key) => mapping[key] >= 0 ? row[mapping[key]] : '';
    const milestones = new Map(tasks.filter(task => task.milestone).map(task => [normalize(task.title), task]));
    const prepared = rawRows.slice(0, MAX_ROWS).map((row, offset) => {
      const title = String(pick(row, 'title') ?? '').trim().slice(0, 300);
      const startValue = pick(row, 'start');
      const dueValue = pick(row, 'due');
      const due = parseDate(dueValue) || parseDate(startValue);
      const start = parseDate(startValue) || settings?.start_date || due;
      const typeValue = pick(row, 'type');
      const milestone = isMilestone(typeValue);
      const parentName = String(pick(row, 'parent') || (!milestone && typeValue && !/^(task|کار|عادی)$/i.test(normalize(typeValue)) ? typeValue : '')).trim();
      const rowData = {
        sourceRow: offset + 1,
        title,
        description: String(pick(row, 'description') ?? '').trim().slice(0, 5000),
        start_date: start,
        due_date: due,
        assigneeText: String(pick(row, 'assignee') ?? '').trim(),
        status: parseStatus(pick(row, 'status')),
        milestone,
        parentName,
        error: !title ? 'عنوان خالی است' : !due ? 'تاریخ شروع یا مهلت معتبر نیست' : start > due ? 'شروع بعد از مهلت است' : '',
      };
      if (milestone && title && !milestones.has(normalize(title))) milestones.set(normalize(title), rowData);
      return rowData;
    });
    for (const row of prepared) if (row.parentName && !row.error && !row.milestone && !milestones.has(normalize(row.parentName))) {
      const siblings = prepared.filter(candidate => candidate.parentName && normalize(candidate.parentName) === normalize(row.parentName) && !candidate.error && !candidate.milestone);
      const parent = {
        sourceRow: 0,
        title: row.parentName.slice(0, 300),
        description: '',
        start_date: siblings.map(item => item.start_date).sort()[0],
        due_date: siblings.map(item => item.due_date).sort().at(-1),
        assigneeText: '', status: siblings.every(item => item.status === 'done') ? 'done' : siblings.some(item => item.status === 'doing') ? 'doing' : 'todo',
        milestone: true, parentName: '', error: '', generated: true,
      };
      milestones.set(normalize(row.parentName), parent);
      prepared.push(parent);
    }
    const seen = new Set(tasks.map(task => `${normalize(task.title)}|${task.start_date}|${task.due_date}|${task.milestone}`));
    return prepared.map(row => {
      const signature = `${normalize(row.title)}|${row.start_date}|${row.due_date}|${row.milestone}`;
      if (!row.error && seen.has(signature)) row.error = 'این ردیف از قبل در تایم‌لاین هست';
      else if (!row.error) seen.add(signature);
      const parent = milestones.get(normalize(row.parentName));
      if (!row.error && !row.milestone && parent?.error) row.error = 'تاریخ نقطه عطف والد معتبر نیست';
      row.parentRef = parent && parent !== row && !row.milestone ? parent : null;
      return row;
    });
  }
  function renderPreview() {
    if (!rawRows.length || !rawHeaders.length) return;
    records = prepareRows();
    const membersByEmail = new Map(members.map(member => [normalize(member.email), member.user_id]));
    const unknownAssignees = records.filter(row => !row.error && row.assigneeText && !membersByEmail.has(normalize(row.assigneeText))).length;
    validRows = records.filter(row => !row.error);
    const invalid = records.length - validRows.length;
    $('#import-info').textContent = `${fa(validRows.length)} ردیف آمادهٔ ورود · ${fa(invalid)} ردیف نادیده گرفته می‌شود${unknownAssignees ? ` · ${fa(unknownAssignees)} مسئول شناخته‌شده نیست و بدون مسئول وارد می‌شود` : ''}${rawRows.length > MAX_ROWS ? ` · فقط ${fa(MAX_ROWS)} ردیف اول بررسی شد` : ''}`;
    $('#import-apply').disabled = !validRows.length;
    const preview = records.slice(0, 8);
    $('#import-preview').innerHTML = `<table class="table table-xs"><thead><tr><th>عنوان</th><th>شروع</th><th>مهلت</th><th>نوع</th><th>وضعیت</th></tr></thead><tbody>${preview.map(row => `<tr><td>${esc(row.title || '—')}${row.generated ? '<small class="block muted">هدف خودکار از گروه فایل</small>' : row.parentName ? `<small class="block muted">هدف: ${esc(row.parentName)}</small>` : ''}</td><td dir="ltr">${esc(row.start_date || '—')}</td><td dir="ltr">${esc(row.due_date || '—')}</td><td>${row.milestone ? 'نقطه عطف' : 'کار'}</td><td>${esc(row.error || (row.assigneeText && !membersByEmail.has(normalize(row.assigneeText)) ? 'مسئول نامشخص' : 'آماده'))}</td></tr>`).join('')}</tbody></table>${records.length > preview.length ? `<p class="muted text-xs mt-2">پیش‌نمایش ${fa(preview.length)} ردیف اول از ${fa(records.length)} ردیف</p>` : ''}`;
  }
  async function parseWorkbookSheet(name) {
    if (!workbook || !name) return;
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
    const grid = toGrid(rows);
    rawHeaders = grid.headers;
    rawRows = grid.rows;
    if (!rawHeaders.length || !rawRows.length) {
      records = []; validRows = [];
      $('#import-mapping').classList.add('hidden');
      $('#import-preview').replaceChildren();
      $('#import-apply').disabled = true;
      $('#import-info').textContent = 'این برگه ردیف قابل ورود ندارد؛ برگهٔ دیگری را انتخاب کنید.';
      return;
    }
    renderMapping();
  }
  async function readFile(file) {
    if (!file) return;
    if (!isAdmin) { notice('فقط مدیر می‌تواند برنامه را وارد کند.'); return; }
    workbook = null; rawHeaders = []; rawRows = []; records = []; validRows = [];
    $('#import-preview').replaceChildren();
    $('#import-mapping').classList.add('hidden');
    $('#import-apply').disabled = true;
    if (file.size > MAX_FILE_BYTES) { notice('حجم فایل باید کمتر از ۱۰ مگابایت باشد.'); return; }
    $('#import-info').textContent = 'در حال خواندن فایل روی همین دستگاه…';
    $('#import-preview').replaceChildren();
    try {
      const bytes = await file.arrayBuffer();
      if (/\.json$/i.test(file.name)) {
        workbook = null;
        const json = JSON.parse(new TextDecoder().decode(bytes));
        const items = Array.isArray(json) ? json : json.tasks || json.rows || json.data;
        if (!Array.isArray(items) || !items.length || !items.every(item => item && typeof item === 'object' && !Array.isArray(item))) throw new Error('ساختار JSON باید آرایه‌ای از ردیف‌های کاری باشد.');
        rawHeaders = [...new Set(items.flatMap(item => Object.keys(item)))];
        rawRows = items.map(item => rawHeaders.map(header => item[header] ?? ''));
        $('#sheet-wrap').classList.add('hidden');
        renderMapping();
      } else {
        if (!window.XLSX) throw new Error('کتابخانهٔ خواندن اکسل بارگذاری نشده است.');
        workbook = XLSX.read(bytes, { type: 'array', cellDates: true, cellFormula: false, bookVBA: false });
        if (!workbook.SheetNames.length) throw new Error('برگه‌ای در فایل پیدا نشد.');
        const sheetSelect = $('#import-sheet');
        sheetSelect.innerHTML = workbook.SheetNames.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
        $('#sheet-wrap').classList.toggle('hidden', workbook.SheetNames.length < 2);
        const firstWithRows = workbook.SheetNames.find(name => toGrid(XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' })).rows.length > 0) || workbook.SheetNames[0];
        sheetSelect.value = firstWithRows;
        await parseWorkbookSheet(firstWithRows);
      }
      if (rawRows.length > MAX_ROWS) $('#import-info').textContent += ` (حداکثر ${fa(MAX_ROWS)} ردیف قابل ورود است)`;
    } catch (error) {
      workbook = null; rawHeaders = []; rawRows = []; validRows = [];
      $('#import-mapping').classList.add('hidden');
      $('#import-apply').disabled = true;
      $('#import-info').textContent = error.message || 'خواندن این فایل ممکن نشد.';
    }
  }
  async function importRows() {
    if (!isAdmin || !validRows.length) return;
    const memberByEmail = new Map(members.map(member => [normalize(member.email), member.user_id]));
    const ids = new Map(records.filter(row => row.milestone && !row.error && !tasks.some(task => task.milestone && normalize(task.title) === normalize(row.title))).map(row => [row, crypto.randomUUID()]));
    for (const row of records) {
      if (row.parentRef && ids.has(row.parentRef)) row.milestone_id = ids.get(row.parentRef);
      else if (row.parentRef?.id) row.milestone_id = row.parentRef.id;
      else row.milestone_id = null;
    }
    const payload = validRows.map(row => ({
      id: ids.get(row) || crypto.randomUUID(),
      title: row.title,
      description: row.description,
      start_date: row.start_date,
      due_date: row.due_date,
      assignee: memberByEmail.get(normalize(row.assigneeText)) || null,
      status: row.status,
      milestone: row.milestone,
      milestone_id: row.milestone_id || null,
    }));
    const button = $('#import-apply');
    button.disabled = true;
    button.textContent = 'در حال ذخیره…';
    const { error } = await client.from('timeline_tasks').insert(payload);
    button.textContent = 'واردکردن ردیف‌های معتبر';
    if (error) {
      button.disabled = false;
      $('#import-info').textContent = 'ذخیره انجام نشد؛ دسترسی یا ساختار فایل را بررسی کنید. هیچ ردیفی وارد نشد.';
      return;
    }
    const count = payload.length;
    $('#import-panel').classList.add('hidden');
    $('#import-file').value = '';
    workbook = null; rawHeaders = []; rawRows = []; records = []; validRows = [];
    await load();
    notice(`${fa(count)} کار و نقطه عطف وارد شد؛ مقیاس زمانی از تاریخ‌های فایل ساخته شد.`);
  }

  $('#import-open').addEventListener('click', () => {
    if (!isAdmin) return;
    $('#import-panel').classList.remove('hidden');
    $('#import-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  $('#import-cancel').addEventListener('click', () => $('#import-panel').classList.add('hidden'));
  $('#import-file').addEventListener('change', event => readFile(event.currentTarget.files?.[0]));
  $('#import-sheet').addEventListener('change', event => parseWorkbookSheet(event.currentTarget.value));
  $('#import-apply').addEventListener('click', importRows);
})();
$('#download-template').addEventListener('click', event => {
  event.preventDefault();
  const content = '\uFEFFعنوان,تاریخ شروع,مهلت,مسئول,وضعیت,نوع,هدف والد,جزئیات\nهدف نمونه,1405/08/22,1405/08/30,,شروع نشده,نقطه عطف,,\nیک کار نمونه,1405/08/22,1405/08/25,,شروع نشده,کار,هدف نمونه,\n';
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'jahat-timeline-template.csv';
  link.click();
  URL.revokeObjectURL(url);
});
