/**
 * Family Hub — Google Sheets backend for Randy and his household.
 * Paste this whole file into Extensions → Apps Script on a new Google Sheet.
 *
 * Secrets stay in Script properties (Project settings → Script properties).
 * Nothing in this file is a password or a token.
 *
 *   ACCESS_CODE          shared code both phones type once
 *   PARTNER_NAME         optional, used only the first time the sheet is empty
 *   SMARTTHINGS_TOKEN    SmartThings personal access token
 *   BLINK_EMAIL          optional, experimental Blink login
 *   BLINK_PASSWORD       optional, experimental Blink login
 *   DIGEST_EMAILS        optional extra digest addresses (the app settings are preferred)
 *   GOOGLE_CALENDAR_ID   optional fallback calendar id
 *
 * Deploy as a web app: Execute as me, Who has access: Anyone.
 * The access code is what keeps strangers out. "Anyone" only lets the page reach the script.
 *
 * Set the script time zone to America/New_York (Project settings) so the
 * morning digest arrives at the hour you picked, Eastern time.
 */
const COLUMNS = {
  users: ['id', 'name', 'role', 'active', 'createdAt'],
  settings: ['id', 'randyName', 'partnerName', 'farmName', 'location', 'digestEmails', 'digestHour', 'calendarId', 'calendarSync', 'mileageRate', 'createdAt'],
  accounts: ['id', 'name', 'type', 'book', 'balance', 'institution', 'notes', 'updatedAt'],
  transactions: ['id', 'date', 'accountId', 'amount', 'type', 'categoryId', 'book', 'payee', 'memo', 'refType', 'refId', 'createdBy', 'createdAt'],
  categories: ['id', 'name', 'book', 'kind', 'monthly', 'sort', 'active'],
  budgets: ['id', 'categoryId', 'month', 'amount'],
  bills: ['id', 'name', 'payee', 'amount', 'dueDay', 'startMonth', 'book', 'categoryId', 'accountId', 'autopay', 'assignedTo', 'active', 'notes'],
  billPayments: ['id', 'billId', 'dueDate', 'paidDate', 'amount', 'paidBy', 'accountId', 'transactionId'],
  subscriptions: ['id', 'name', 'amount', 'cadence', 'nextDate', 'book', 'categoryId', 'assignedTo', 'active', 'notes'],
  debts: ['id', 'name', 'principal', 'apr', 'payment', 'book', 'kind', 'notes'],
  snapshots: ['id', 'date', 'assets', 'liabilities', 'net', 'note'],
  goals: ['id', 'name', 'kind', 'scope', 'owner', 'targetAmount', 'currentAmount', 'targetDate', 'status', 'notes'],
  milestones: ['id', 'goalId', 'name', 'done', 'dueDate', 'sort'],
  projects: ['id', 'name', 'area', 'status', 'budget', 'spent', 'owner', 'startDate', 'targetDate', 'notes'],
  tasks: ['id', 'projectId', 'title', 'assignee', 'status', 'dueDate', 'notes'],
  events: ['id', 'title', 'date', 'time', 'endTime', 'owner', 'category', 'source', 'sourceId', 'notes', 'gcalId'],
  lists: ['id', 'name', 'kind', 'sort'],
  listItems: ['id', 'listId', 'name', 'aisle', 'qty', 'checked', 'staple', 'addedBy', 'createdAt'],
  chores: ['id', 'title', 'assignee', 'dueDate', 'cadence', 'status', 'area', 'notes', 'doneAt', 'doneBy'],
  meals: ['id', 'date', 'slot', 'title', 'notes'],
  mealItems: ['id', 'mealId', 'name', 'qty', 'aisle'],
  eggs: ['id', 'date', 'species', 'count', 'notes', 'loggedBy'],
  eggSales: ['id', 'date', 'customerId', 'species', 'dozens', 'price', 'total', 'paid', 'notes', 'transactionId'],
  customers: ['id', 'name', 'phone', 'email', 'kind', 'notes'],
  jobs: ['id', 'number', 'customerId', 'customerName', 'service', 'status', 'date', 'address', 'description', 'hours', 'rate', 'amount', 'mileage', 'paidDate', 'notes', 'assignedTo', 'transactionId'],
  equipment: ['id', 'name', 'type', 'hours', 'status', 'notes'],
  serviceLogs: ['id', 'equipmentId', 'date', 'hours', 'what', 'cost', 'notes', 'by'],
  flock: ['id', 'species', 'breed', 'count', 'acquired', 'status', 'notes'],
  mileage: ['id', 'date', 'vehicle', 'miles', 'hours', 'purpose', 'book', 'jobId', 'notes'],
  trips: ['id', 'name', 'destination', 'startDate', 'endDate', 'departTime', 'travelers', 'budget', 'spent', 'trackMoney', 'notes'],
  itinerary: ['id', 'tripId', 'date', 'time', 'kind', 'title', 'address', 'confirmation', 'notes', 'sort'],
  tripItems: ['id', 'tripId', 'listName', 'kind', 'assignee', 'text', 'done', 'sort'],
  templates: ['id', 'name', 'kind', 'notes'],
  templateItems: ['id', 'templateId', 'text', 'assignee', 'sort']
};

const NUMERIC = ['balance', 'amount', 'monthly', 'sort', 'dueDay', 'digestHour', 'mileageRate', 'principal', 'apr', 'payment', 'assets', 'liabilities', 'net', 'targetAmount', 'currentAmount', 'budget', 'spent', 'count', 'dozens', 'price', 'total', 'hours', 'rate', 'mileage', 'miles', 'cost'];
const DATA = Object.keys(COLUMNS);

function doGet() {
  return out({ ok: true, app: 'family-hub', message: 'Family Hub backend is running.' });
}

function doPost(e) {
  let p;
  try { p = JSON.parse(e && e.postData && e.postData.contents || ''); }
  catch (err) { return out({ ok: false, error: 'bad request' }); }
  return handle(p || {});
}

function handle(p) {
  try {
    const denied = authorize(p.code);
    if (denied) return out(denied);
    if (p.action === 'list') return listAll();
    if (p.action === 'batch') return batch(p);
    if (p.action === 'set' || p.action === 'delete') return single(p);
    if (p.action === 'st') return stHandle(p);
    if (p.action === 'blink') return blinkHandle(p);
    if (p.action === 'calendar') return calendarHandle(p);
    if (p.action === 'digest') return out(sendDigest());
    return out({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

function authorize(code) {
  const expected = String(PropertiesService.getScriptProperties().getProperty('ACCESS_CODE') || '').trim();
  if (!expected) return { ok: false, error: 'Set the ACCESS_CODE script property, then deploy a new version.' };
  if (String(code || '') !== expected) return { ok: false, error: 'unauthorized' };
  return null;
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function listAll() {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    ensureBaseline();
    const body = { ok: true };
    DATA.forEach(function (name) { body[name] = readAll(name); });
    return out(body);
  } finally { lock.releaseLock(); }
}

function single(p) {
  if (!COLUMNS[p.collection]) return out({ ok: false, error: 'unknown collection' });
  if (!okId(p.id)) return out({ ok: false, error: 'bad id' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { applyOp({ op: p.action === 'delete' ? 'delete' : 'set', collection: p.collection, id: p.id, data: p.data || {} }); }
  finally { lock.releaseLock(); }
  return out({ ok: true });
}

function checkOp(op) {
  op = op || {};
  if (!COLUMNS[op.collection]) throw new Error('unknown collection');
  if (!okId(op.id)) throw new Error('bad id');
  if (op.op !== 'delete' && op.op !== 'set' && op.op !== 'update') throw new Error('bad op');
}

function batch(p) {
  if (p.batchId && !okId(p.batchId)) return out({ ok: false, error: 'bad batch' });
  const ops = Array.isArray(p.ops) ? p.ops : null;
  if (!ops || ops.length > 80) return out({ ok: false, error: 'bad batch' });
  try { for (let i = 0; i < ops.length; i++) checkOp(ops[i]); }
  catch (err) { return out({ ok: false, error: String(err && err.message || err) }); }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    for (let i = 0; i < ops.length; i++) applyOp(ops[i]);
  } finally { lock.releaseLock(); }
  return out({ ok: true });
}

function okId(id) { return /^[A-Za-z0-9_-]{4,40}$/.test(String(id || '')); }

function applyOp(op) {
  if (op.op === 'delete') { deleteDoc(op.collection, op.id); return; }
  const data = Object.assign({}, op.data || {});
  if (op.collection === 'jobs') assignJobNumber(op.id, data);
  if (op.op === 'update') {
    const cur = readDoc(op.collection, op.id) || {};
    writeDoc(op.collection, op.id, Object.assign(cur, data));
  } else writeDoc(op.collection, op.id, data);
}

function assignJobNumber(id, data) {
  const cur = readDoc('jobs', id);
  if (cur && cur.number) { data.number = cur.number; return; }
  let num = String(data.number || '');
  if (!/^JOB-\d+$/.test(num) || jobNumberTaken(num, id)) num = allocateJobNumber();
  data.number = num;
}

function jobRows() {
  const sh = sheet('jobs');
  const last = sh.getLastRow();
  if (last < 2) return [];
  const hm = headerMap(sh);
  const numCol = hm.map.number != null ? hm.map.number + 1 : 2;
  return sh.getRange(2, 1, last - 1, Math.max(numCol, 2)).getValues().filter(function (r) { return r[0] !== ''; });
}

function jobNumberTaken(number, exceptId) {
  const hm = headerMap(sheet('jobs'));
  const idx = hm.map.number != null ? hm.map.number : 1;
  const rows = jobRows();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][idx] || rows[i][1]) === String(number) && String(rows[i][0]) !== String(exceptId)) return true;
  }
  return false;
}

function allocateJobNumber() {
  let max = 1000;
  const hm = headerMap(sheet('jobs'));
  const idx = hm.map.number != null ? hm.map.number : 1;
  jobRows().forEach(function (r) {
    const n = parseInt(String(r[idx] || '').replace(/\D/g, ''), 10);
    if (n > max) max = n;
  });
  return 'JOB-' + (max + 1);
}

function sheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  const cols = COLUMNS[name];
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
    cols.forEach(function (c, i) {
      const r = sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1), 1);
      if (NUMERIC.indexOf(c) === -1) r.setNumberFormat('@');
    });
  } else {
    const width = Math.max(sh.getLastColumn(), 1);
    const headers = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h || ''); });
    cols.forEach(function (c) {
      if (headers.indexOf(c) === -1) {
        const col = headers.length + 1;
        sh.getRange(1, col).setValue(c).setFontWeight('bold');
        if (NUMERIC.indexOf(c) === -1) sh.getRange(2, col, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat('@');
        headers.push(c);
      }
    });
  }
  return sh;
}

function headerMap(sh) {
  const width = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h || ''); });
  const map = {};
  headers.forEach(function (h, i) { if (h && map[h] == null) map[h] = i; });
  return { headers: headers, map: map, width: headers.length };
}

function cellValue(c, v) {
  if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone() || 'America/New_York', 'yyyy-MM-dd');
  if (NUMERIC.indexOf(c) !== -1) return (v === '' || v === null || v === undefined) ? '' : Number(v);
  return v === null || v === undefined ? '' : String(v);
}

function toObj(cols, row, map) {
  const o = {};
  cols.forEach(function (c) {
    const idx = map ? map[c] : null;
    o[c] = cellValue(c, idx == null ? '' : row[idx]);
  });
  return o;
}

function readAll(name) {
  const sh = sheet(name);
  const cols = COLUMNS[name];
  const last = sh.getLastRow();
  if (last < 2) return [];
  const hm = headerMap(sh);
  return sh.getRange(2, 1, last - 1, Math.max(hm.width, 1)).getValues()
    .filter(function (r) { return r[0] !== ''; })
    .map(function (r) { return toObj(cols, r, hm.map); });
}

function findRow(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const hit = sh.getRange(2, 1, last - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

function readDoc(name, id) {
  const sh = sheet(name);
  const r = findRow(sh, id);
  if (!r) return null;
  const hm = headerMap(sh);
  return toObj(COLUMNS[name], sh.getRange(r, 1, 1, Math.max(hm.width, 1)).getValues()[0], hm.map);
}

function sheetSafe(v) {
  const s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) return "'" + s;
  return s;
}

function writeDoc(name, id, data) {
  const sh = sheet(name);
  const cols = COLUMNS[name];
  data.id = id;
  const hm = headerMap(sh);
  const width = Math.max(hm.width, cols.length);
  const row = new Array(width).fill('');
  cols.forEach(function (c) {
    const idx = hm.map[c];
    if (idx == null) return;
    const v = data[c];
    if (v === null || v === undefined) row[idx] = '';
    else if (NUMERIC.indexOf(c) !== -1) row[idx] = v === '' ? '' : Number(v);
    else row[idx] = sheetSafe(String(v).slice(0, 8000));
  });
  const r = findRow(sh, id) || sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, width).setValues([row]);
}

function deleteDoc(name, id) {
  const sh = sheet(name);
  const r = findRow(sh, id);
  if (r) sh.deleteRow(r);
}

/** Run once from the editor. Creates every tab and the starter rows. */
function setup() {
  DATA.forEach(function (name) { sheet(name); });
  ensureBaseline();
}

function ensureBaseline() {
  const props = PropertiesService.getScriptProperties();
  const now = new Date().toISOString();
  if (!readAll('users').length) {
    const randy = String(props.getProperty('RANDY_NAME') || 'Randy Johnson').slice(0, 80);
    const partner = String(props.getProperty('PARTNER_NAME') || 'Partner').slice(0, 80);
    writeDoc('users', 'user_randy', { name: randy, role: 'owner', active: 'yes', createdAt: now });
    writeDoc('users', 'user_partner', { name: partner, role: 'owner', active: 'yes', createdAt: now });
  }
  if (!readDoc('settings', 'hub')) {
    writeDoc('settings', 'hub', {
      randyName: 'Randy Johnson',
      partnerName: String(props.getProperty('PARTNER_NAME') || 'Partner').slice(0, 80),
      farmName: 'CW Johnson Farms LLC',
      location: 'Lillington, NC',
      digestEmails: String(props.getProperty('DIGEST_EMAILS') || ''),
      digestHour: 6,
      calendarId: String(props.getProperty('GOOGLE_CALENDAR_ID') || ''),
      calendarSync: 'off',
      mileageRate: '',
      createdAt: now
    });
  }
  if (!readAll('categories').length) {
    const seed = [
      ['cat_groceries', 'Groceries', 'Personal', 'expense', 600, 1],
      ['cat_electric', 'Electric', 'Personal', 'expense', 200, 2],
      ['cat_phone', 'Phone', 'Personal', 'expense', 120, 3],
      ['cat_house', 'Household', 'Personal', 'expense', 200, 4],
      ['cat_subs', 'Subscriptions', 'Personal', 'expense', 40, 5],
      ['cat_pins', 'Insurance', 'Personal', 'expense', '', 6],
      ['cat_pay', 'Paycheck', 'Personal', 'income', '', 7],
      ['cat_feed', 'Feed', 'Farm', 'expense', 180, 10],
      ['cat_fuel', 'Fuel', 'Farm', 'expense', 250, 11],
      ['cat_equip', 'Equipment', 'Farm', 'expense', 100, 12],
      ['cat_fsup', 'Farm supplies', 'Farm', 'expense', 80, 13],
      ['cat_fins', 'Farm insurance', 'Farm', 'expense', '', 14],
      ['cat_eggs', 'Egg sales', 'Farm', 'income', '', 20],
      ['cat_tractor', 'Tractor services', 'Farm', 'income', '', 21]
    ];
    seed.forEach(function (row) {
      writeDoc('categories', row[0], { name: row[1], book: row[2], kind: row[3], monthly: row[4], sort: row[5], active: 'yes' });
    });
  }
  if (!readAll('lists').length) {
    writeDoc('lists', 'list_groc', { name: 'Grocery', kind: 'grocery', sort: 1 });
    writeDoc('lists', 'list_farm', { name: 'Farm supply', kind: 'farm', sort: 2 });
    writeDoc('lists', 'list_hard', { name: 'Hardware', kind: 'hardware', sort: 3 });
  }
  if (!readAll('templates').length) {
    writeDoc('templates', 'tpl_leave', { name: 'Before we leave', kind: 'farm', notes: 'House and farm close-up.' });
    writeDoc('templateItems', 'tpi1', { templateId: 'tpl_leave', text: 'Feed and water covered', assignee: 'user_randy', sort: 1 });
    writeDoc('templateItems', 'tpi2', { templateId: 'tpl_leave', text: 'Egg collection covered', assignee: 'user_partner', sort: 2 });
    writeDoc('templateItems', 'tpi3', { templateId: 'tpl_leave', text: 'Coop secured', assignee: 'user_randy', sort: 3 });
    writeDoc('templateItems', 'tpi4', { templateId: 'tpl_leave', text: 'Thermostat set and doors locked', assignee: 'shared', sort: 4 });
  }
}

/* Dates below match openCycle in js/logic.js. The email is built here, not from the phone. */
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function isoDay(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }
function monthKey(iso) { return String(iso || '').slice(0, 7); }
function utcMs(iso) {
  return Date.UTC(+String(iso).slice(0, 4), +String(iso).slice(5, 7) - 1, +String(iso).slice(8, 10));
}
function fromUtc(ms) {
  const d = new Date(ms);
  return isoDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
function addDays(iso, n) { return fromUtc(utcMs(iso) + n * 86400000); }
function diffDays(from, to) { return Math.round((utcMs(to) - utcMs(from)) / 86400000); }
function addMonthsKey(month, n) {
  const dt = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7) - 1 + n, 1));
  return isoDay(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1).slice(0, 7);
}
function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function cycleDate(month, dueDay) {
  const y = +month.slice(0, 4);
  const m = +month.slice(5, 7);
  const last = daysInMonth(y, m);
  const day = Math.max(1, Math.min(last, parseInt(dueDay, 10) || 1));
  return isoDay(y, m, day);
}
function todayIso() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/New_York', 'yyyy-MM-dd');
}
function moneyText(n) {
  const v = Math.round((Number(n) + 1e-9) * 100) / 100;
  const sign = v < 0 ? '-' : '';
  return sign + '$' + Math.abs(v).toFixed(2);
}
function openCycle(bill, payments, day) {
  if (!bill || String(bill.active) === 'no') return '';
  const paid = {};
  (payments || []).forEach(function (p) { if (p.billId === bill.id && p.dueDate) paid[String(p.dueDate)] = true; });
  let month = bill.startMonth || monthKey(day);
  if (!/^\d{4}-\d{2}$/.test(String(month))) month = monthKey(day);
  for (let i = 0; i < 14; i++) {
    const due = cycleDate(month, bill.dueDay);
    if (!paid[due]) return due;
    month = addMonthsKey(month, 1);
  }
  return '';
}
function serviceName(key) {
  const map = { driveway: 'Driveway maintenance', bushhog: 'Bush hogging', grading: 'Grading', brush: 'Brush cleanup', stump: 'Stump grinding', other: 'Other' };
  return map[key] || key || 'Service';
}
function userName(users, id) {
  for (let i = 0; i < users.length; i++) if (users[i].id === id) return users[i].name;
  return '';
}

function digestRecipients() {
  const settings = readDoc('settings', 'hub') || {};
  const raw = String(settings.digestEmails || PropertiesService.getScriptProperties().getProperty('DIGEST_EMAILS') || '');
  const seen = {};
  const outList = [];
  raw.split(/[,;\s]+/).forEach(function (part) {
    const email = String(part || '').trim();
    if (email.indexOf('@') < 1 || seen[email]) return;
    seen[email] = true;
    outList.push(email);
  });
  return outList;
}

function digestText() {
  const day = todayIso();
  const settings = readDoc('settings', 'hub') || {};
  const users = readAll('users');
  const lines = [(settings.farmName || 'Family Hub') + ' — ' + day, ''];
  lines.push('Bills');
  const payments = readAll('billPayments');
  let bills = 0;
  readAll('bills').forEach(function (bill) {
    const due = openCycle(bill, payments, day);
    if (!due) return;
    const days = diffDays(day, due);
    if (days > 7) return;
    bills++;
    const who = userName(users, bill.assignedTo);
    const flag = days < 0 ? 'OVERDUE' : (days === 0 ? 'TODAY' : 'DUE');
    lines.push('- ' + flag + '  ' + bill.name + '  ' + moneyText(bill.amount) + '  ' + due + (who ? '  (' + who + ')' : '') + (String(bill.autopay) === 'yes' ? '  autopay' : ''));
  });
  if (!bills) lines.push('- None due in the next 7 days.');
  lines.push('');
  lines.push('Today and the next 7 days');
  const end = addDays(day, 7);
  let count = 0;
  readAll('events').forEach(function (ev) {
    if (!ev.date || ev.date < day || ev.date > end) return;
    count++;
    const who = userName(users, ev.owner);
    lines.push('- ' + ev.date + (ev.time ? ' ' + ev.time : '') + '  ' + ev.title + (who ? '  (' + who + ')' : ''));
  });
  readAll('jobs').forEach(function (job) {
    if (!job.date || job.date < day || job.date > end) return;
    if (job.status === 'cancelled' || job.status === 'quote' || job.status === 'paid') return;
    count++;
    lines.push('- JOB  ' + job.date + '  ' + (job.number || '') + '  ' + (job.customerName || serviceName(job.service)) + '  ' + (job.status || ''));
  });
  if (!count) lines.push('- Nothing on the calendar.');
  lines.push('');
  lines.push('Sent by Family Hub. This email does not include the access code.');
  return lines.join('\n');
}

function sendDigest() {
  try {
    const settings = readDoc('settings', 'hub') || {};
    if (settings.calendarSync === 'push' || settings.calendarSync === 'both') {
      try { calendarSync(settings.calendarSync === 'both' ? 'both' : 'push'); } catch (calErr) {}
    }
  } catch (e) {}
  const to = digestRecipients();
  if (!to.length) return { ok: true, skipped: true, error: 'No digest email is saved yet.' };
  MailApp.sendEmail(to.join(','), 'Family Hub daily digest', digestText());
  return { ok: true, sent: true, recipients: to.length };
}

/** Time-driven. Run installDigestTrigger once from the editor after you save an email. */
function familyDigest() { sendDigest(); }

function digestHour() {
  const row = readDoc('settings', 'hub') || {};
  let h = parseInt(row.digestHour, 10);
  if (!isFinite(h) || h < 0 || h > 23) h = 6;
  return h;
}

/** Run once from the editor. Replaces any older Family Hub digest trigger. Does not change the web app URL. */
function installDigestTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'familyDigest') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('familyDigest').timeBased().everyDays(1).atHour(digestHour()).create();
}

function calendarId() {
  const settings = readDoc('settings', 'hub') || {};
  return String(settings.calendarId || PropertiesService.getScriptProperties().getProperty('GOOGLE_CALENDAR_ID') || '').trim();
}

function localDate(date, time) {
  const bits = String(date || '').split('-');
  const hm = String(time || '00:00').split(':');
  return new Date(Number(bits[0]), Number(bits[1]) - 1, Number(bits[2]), Number(hm[0] || 0), Number(hm[1] || 0), 0);
}

function hubMarker(id) { return '[hub:' + id + ']'; }

function calendarHandle(p) {
  try {
    const result = calendarSync(String(p.op || 'both'));
    return out(result);
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

function calendarSync(op) {
  const id = calendarId();
  if (!id) return { ok: false, error: 'Add a Google Calendar id in Settings first.' };
  const cal = CalendarApp.getCalendarById(id);
  if (!cal) return { ok: false, error: 'That calendar was not found on the Google account that owns this script.' };
  const day = todayIso();
  const start = localDate(addDays(day, -1), '00:00');
  const end = localDate(addDays(day, 60), '23:59');
  const existing = cal.getEvents(start, end);
  const byMarker = {};
  existing.forEach(function (ev) {
    const desc = String(ev.getDescription() || '');
    const match = desc.match(/\[hub:([A-Za-z0-9_-]{4,40})\]/);
    if (match) byMarker[match[1]] = ev;
  });
  let pushed = 0;
  let pulled = 0;
  if (op !== 'pull') {
    const plans = calendarPlans(day);
    plans.forEach(function (plan) {
      const desc = (plan.notes ? plan.notes + '\n' : '') + hubMarker(plan.id);
      const ev = byMarker[plan.id];
      if (plan.allDay) {
        const when = localDate(plan.date, '00:00');
        if (ev) { ev.setTitle(plan.title); ev.setDescription(desc); }
        else cal.createAllDayEvent(plan.title, when, localDate(addDays(plan.date, 1), '00:00'), { description: desc });
      } else if (ev && !ev.isAllDayEvent()) {
        ev.setTitle(plan.title);
        ev.setDescription(desc);
        ev.setTime(plan.start, plan.end);
      } else {
        if (ev) ev.deleteEvent();
        cal.createEvent(plan.title, plan.start, plan.end, { description: desc });
      }
      pushed++;
    });
  }
  if (op !== 'push') {
    const rows = readAll('events');
    existing.forEach(function (ev) {
      const desc = String(ev.getDescription() || '');
      if (desc.indexOf('[hub:') >= 0) return;
      const gid = ev.getId();
      let row = null;
      for (let i = 0; i < rows.length; i++) if (rows[i].gcalId === gid) row = rows[i];
      const when = ev.isAllDayEvent() ? ev.getAllDayStartDate() : ev.getStartTime();
      const date = Utilities.formatDate(when, Session.getScriptTimeZone() || 'America/New_York', 'yyyy-MM-dd');
      const time = ev.isAllDayEvent() ? '' : Utilities.formatDate(ev.getStartTime(), Session.getScriptTimeZone() || 'America/New_York', 'HH:mm');
      const endTime = ev.isAllDayEvent() ? '' : Utilities.formatDate(ev.getEndTime(), Session.getScriptTimeZone() || 'America/New_York', 'HH:mm');
      const data = {
        title: ev.getTitle() || 'Calendar',
        date: date,
        time: time,
        endTime: endTime,
        owner: 'shared',
        category: 'family',
        source: 'gcal',
        sourceId: '',
        notes: desc.slice(0, 500),
        gcalId: gid
      };
      const rowId = row ? row.id : shortId('gcal', gid);
      writeDoc('events', rowId, Object.assign(row || {}, data));
      pulled++;
    });
  }
  return { ok: true, pushed: pushed, pulled: pulled };
}

function calendarPlans(day) {
  const plans = [];
  readAll('events').forEach(function (ev) {
    if (!ev.date || ev.date < addDays(day, -1) || ev.date > addDays(day, 60)) return;
    if (ev.source === 'gcal' || ev.source === 'bill' || ev.source === 'job') return;
    plans.push(planFrom(ev.id, ev.title || 'Event', ev.date, ev.time, ev.endTime, ev.notes || ''));
  });
  const payments = readAll('billPayments');
  readAll('bills').forEach(function (bill) {
    if (String(bill.active) === 'no') return;
    let month = bill.startMonth || monthKey(day);
    for (let i = 0; i < 4; i++) {
      const due = cycleDate(month, bill.dueDay);
      if (due >= addDays(day, -1) && due <= addDays(day, 60)) {
        const paid = payments.some(function (p) { return p.billId === bill.id && String(p.dueDate) === due; });
        plans.push(planFrom('bill_' + bill.id + '_' + due, bill.name + (paid ? ' (paid)' : ' due'), due, '', '', moneyText(bill.amount)));
      }
      month = addMonthsKey(month, 1);
    }
  });
  readAll('jobs').forEach(function (job) {
    if (!job.date || job.status === 'cancelled' || job.status === 'quote') return;
    if (job.date < addDays(day, -1) || job.date > addDays(day, 60)) return;
    plans.push(planFrom('job_' + job.id, serviceName(job.service) + (job.customerName ? ' · ' + job.customerName : ''), job.date, '', '', job.address || ''));
  });
  readAll('trips').forEach(function (trip) {
    if (!trip.startDate || trip.startDate > addDays(day, 60)) return;
    if (trip.endDate && trip.endDate < addDays(day, -1)) return;
    plans.push(planFrom('trip_' + trip.id, (trip.name || 'Trip') + (trip.destination ? ' · ' + trip.destination : ''), trip.startDate, trip.departTime || '', '', 'Through ' + (trip.endDate || trip.startDate)));
  });
  return plans.slice(0, 80);
}

function planFrom(id, title, date, time, endTime, notes) {
  const allDay = !time;
  const start = localDate(date, time || '09:00');
  const end = endTime ? localDate(date, endTime) : new Date(start.getTime() + 60 * 60 * 1000);
  if (end.getTime() <= start.getTime()) end.setTime(start.getTime() + 60 * 60 * 1000);
  return { id: String(id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40), title: String(title).slice(0, 140), date: date, allDay: allDay, start: start, end: end, notes: String(notes || '').slice(0, 500) };
}

function shortId(prefix, raw) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(raw || ''));
  let hex = '';
  for (let i = 0; i < digest.length && hex.length < 16; i++) {
    const v = (digest[i] + 256) % 256;
    hex += (v < 16 ? '0' : '') + v.toString(16);
  }
  return (prefix + '_' + hex).slice(0, 40);
}

/* SmartThings proxy. The token never leaves the script. Commands are an allowlist. */
const ST_ALLOW = {
  switch: { on: 'none', off: 'none' },
  lock: { lock: 'none', unlock: 'none' },
  audioVolume: { volumeUp: 'none', volumeDown: 'none', setVolume: 'percent' },
  audioMute: { mute: 'none', unmute: 'none', setMute: 'mute' },
  mediaInputSource: { setInputSource: 'text' },
  'samsungvd.mediaInputSource': { setInputSource: 'text' },
  thermostatMode: { setThermostatMode: 'mode' },
  thermostatHeatingSetpoint: { setHeatingSetpoint: 'temp' },
  thermostatCoolingSetpoint: { setCoolingSetpoint: 'temp' },
  thermostatFanMode: { setThermostatFanMode: 'fan' },
  switchLevel: { setLevel: 'percent' }
};

function stHandle(p) {
  try {
    const token = String(PropertiesService.getScriptProperties().getProperty('SMARTTHINGS_TOKEN') || '').trim();
    if (!token) return out({ ok: false, configured: false, error: 'SMARTTHINGS_TOKEN is not set in Script Properties.' });
    if (p.op === 'list') return out(stList(token));
    if (p.op === 'command') return out(stCommand(token, p));
    return out({ ok: false, error: 'unknown smartthings op' });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

function stFetch(token, path, method, body) {
  const res = UrlFetchApp.fetch('https://api.smartthings.com/v1' + path, {
    method: method || 'get',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'Content-Type': 'application/json' },
    payload: body ? JSON.stringify(body) : undefined,
    muteHttpExceptions: true
  });
  const text = res.getContentText() || '';
  let json = {};
  try { json = JSON.parse(text); } catch (e) {}
  return { code: res.getResponseCode(), json: json };
}

function stList(token) {
  let path = '/devices';
  const items = [];
  for (let page = 0; page < 3 && path; page++) {
    const res = stFetch(token, path, 'get');
    if (res.code === 401 || res.code === 403) return { ok: false, configured: true, error: 'SmartThings did not accept the token.' };
    if (res.code >= 300) return { ok: false, configured: true, error: 'SmartThings returned ' + res.code + '.' };
    (res.json.items || []).forEach(function (item) { items.push(item); });
    const next = res.json._links && res.json._links.next && res.json._links.next.href;
    if (!next) path = '';
    else {
      const marker = String(next);
      const cut = marker.indexOf('/devices');
      path = cut >= 0 ? marker.slice(cut) : '';
    }
  }
  const slice = items.slice(0, 30);
  const requests = [];
  slice.forEach(function (device) {
    const id = encodeURIComponent(device.deviceId);
    requests.push('https://api.smartthings.com/v1/devices/' + id + '/status');
    requests.push('https://api.smartthings.com/v1/devices/' + id + '/health');
  });
  const responses = requests.length ? UrlFetchApp.fetchAll(requests.map(function (url) {
    return { url: url, method: 'get', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, muteHttpExceptions: true };
  })) : [];
  const devices = slice.map(function (device, index) {
    let status = {};
    let health = 'UNKNOWN';
    try { status = JSON.parse(responses[index * 2].getContentText() || '{}'); } catch (e) {}
    try {
      const healthJson = JSON.parse(responses[index * 2 + 1].getContentText() || '{}');
      health = healthJson.state || 'UNKNOWN';
    } catch (e2) {}
    return normalizeDevice(device, status, health);
  });
  return { ok: true, configured: true, truncated: items.length > slice.length, devices: devices };
}

function capIds(device) {
  const ids = [];
  (device.components || []).forEach(function (comp) {
    (comp.capabilities || []).forEach(function (cap) {
      if (cap.id && ids.indexOf(cap.id) < 0) ids.push(cap.id);
    });
  });
  return ids;
}

function attr(status, cap, name) {
  try {
    const block = status.components.main[cap][name];
    if (block && typeof block === 'object' && block.value != null) return block.value;
    return block == null ? '' : block;
  } catch (e) { return ''; }
}

function deviceKind(caps) {
  if (caps.indexOf('thermostatMode') >= 0) return 'thermostat';
  if (caps.indexOf('washerOperatingState') >= 0) return 'washer';
  if (caps.indexOf('dryerOperatingState') >= 0) return 'dryer';
  if (caps.indexOf('audioVolume') >= 0 || caps.indexOf('mediaInputSource') >= 0) return 'tv';
  if (caps.indexOf('lock') >= 0) return 'lock';
  if (caps.indexOf('switch') >= 0) return 'switch';
  return 'sensor';
}

function normalizeDevice(device, status, health) {
  const caps = capIds(device);
  const unit = attr(status, 'temperatureMeasurement', 'temperature');
  let tempUnit = 'F';
  try {
    const block = status.components.main.temperatureMeasurement.temperature;
    if (block && block.unit) tempUnit = String(block.unit).toUpperCase().indexOf('C') === 0 ? 'C' : 'F';
  } catch (e) {}
  return {
    id: device.deviceId,
    name: device.label || device.name || 'Device',
    kind: deviceKind(caps),
    health: health || 'UNKNOWN',
    capabilities: caps,
    status: {
      switch: attr(status, 'switch', 'switch'),
      volume: attr(status, 'audioVolume', 'volume'),
      mute: attr(status, 'audioMute', 'mute'),
      inputSource: attr(status, 'mediaInputSource', 'inputSource') || attr(status, 'samsungvd.mediaInputSource', 'inputSource'),
      thermostatMode: attr(status, 'thermostatMode', 'thermostatMode'),
      heatingSetpoint: attr(status, 'thermostatHeatingSetpoint', 'heatingSetpoint'),
      coolingSetpoint: attr(status, 'thermostatCoolingSetpoint', 'coolingSetpoint'),
      fanMode: attr(status, 'thermostatFanMode', 'thermostatFanMode'),
      temperature: unit,
      tempUnit: tempUnit,
      washerState: attr(status, 'washerOperatingState', 'machineState'),
      washerJob: attr(status, 'washerOperatingState', 'washerJobState'),
      dryerState: attr(status, 'dryerOperatingState', 'machineState'),
      dryerJob: attr(status, 'dryerOperatingState', 'dryerJobState'),
      completionTime: attr(status, 'washerOperatingState', 'completionTime') || attr(status, 'dryerOperatingState', 'completionTime'),
      lock: attr(status, 'lock', 'lock'),
      contact: attr(status, 'contactSensor', 'contact'),
      motion: attr(status, 'motionSensor', 'motion'),
      battery: attr(status, 'battery', 'battery'),
      level: attr(status, 'switchLevel', 'level')
    }
  };
}

function stArg(kind, value) {
  if (kind === 'none') return [];
  if (kind === 'percent') {
    const n = Number(value);
    if (!isFinite(n) || n < 0 || n > 100) throw new Error('Volume and level must be between 0 and 100.');
    return [Math.round(n)];
  }
  if (kind === 'temp') {
    const n = Number(value);
    if (!isFinite(n) || n < 40 || n > 95) throw new Error('Setpoint must be between 40 and 95.');
    return [Math.round(n)];
  }
  if (kind === 'mode') {
    const mode = String(value || '').toLowerCase();
    if (['off', 'heat', 'cool', 'auto', 'eco'].indexOf(mode) < 0) throw new Error('That thermostat mode is not allowed.');
    return [mode];
  }
  if (kind === 'fan') {
    const fan = String(value || '').toLowerCase();
    if (['auto', 'on', 'circulate'].indexOf(fan) < 0) throw new Error('That fan mode is not allowed.');
    return [fan];
  }
  if (kind === 'mute') {
    const mute = String(value || '').toLowerCase();
    if (['muted', 'unmuted'].indexOf(mute) < 0) throw new Error('Mute must be muted or unmuted.');
    return [mute];
  }
  const text = String(value || '').trim();
  if (!text || text.length > 40) throw new Error('That input name is not allowed.');
  return [text];
}

function stCommand(token, p) {
  const deviceId = String(p.deviceId || '');
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(deviceId)) return { ok: false, error: 'That device id is not valid.' };
  const capability = String(p.capability || '');
  const command = String(p.command || '');
  const spec = ST_ALLOW[capability];
  if (!spec || !spec[command]) return { ok: false, error: 'That command is not allowed.' };
  let args;
  try { args = stArg(spec[command], p.argument); }
  catch (err) { return { ok: false, error: String(err.message || err) }; }
  const res = stFetch(token, '/devices/' + encodeURIComponent(deviceId) + '/commands', 'post', {
    commands: [{ component: 'main', capability: capability, command: command, arguments: args }]
  });
  if (res.code === 401 || res.code === 403) return { ok: false, error: 'SmartThings did not accept the token.' };
  if (res.code >= 300) return { ok: false, error: 'SmartThings returned ' + res.code + '.' };
  return { ok: true, accepted: true };
}

/* Blink has no official public API. This block is optional and experimental.
   A failure here returns an error for this card only. Login tokens stay in Script properties. */
function blinkHandle(p) {
  try {
    return out(blinkOp(p || {}));
  } catch (err) {
    return out({ ok: false, experimental: true, error: 'Blink: ' + String(err && err.message || err) });
  }
}

function blinkBase(tier) {
  const clean = String(tier || 'prod').toLowerCase().replace(/[^a-z0-9]/g, '') || 'prod';
  return 'https://rest-' + clean + '.immedia-semi.com';
}

function blinkFetch(url, method, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['token-auth'] = token;
  const res = UrlFetchApp.fetch(url, {
    method: method || 'get',
    headers: headers,
    payload: body ? JSON.stringify(body) : undefined,
    muteHttpExceptions: true
  });
  const text = res.getContentText() || '';
  let json = {};
  try { json = JSON.parse(text); } catch (e) { json = {}; }
  return { code: res.getResponseCode(), json: json, blob: res.getBlob(), type: res.getBlob().getContentType() || '' };
}

function blinkMessage(json, fallback) {
  if (!json) return fallback;
  return String(json.message || json.error || json.code || fallback).slice(0, 180);
}

function blinkSaveSession(json) {
  const props = PropertiesService.getScriptProperties();
  const account = json.account || {};
  const auth = json.auth || {};
  if (auth.token) props.setProperty('BLINK_TOKEN', String(auth.token));
  if (account.account_id != null) props.setProperty('BLINK_ACCOUNT_ID', String(account.account_id));
  if (account.client_id != null) props.setProperty('BLINK_CLIENT_ID', String(account.client_id));
  if (account.user_id != null) props.setProperty('BLINK_USER_ID', String(account.user_id));
  if (account.tier) props.setProperty('BLINK_TIER', String(account.tier));
}

function blinkNeedsPin(json) {
  const account = json.account || {};
  const verification = json.verification || {};
  const client = json.client || {};
  if (account.client_verification_required) return true;
  if (client.verification_required) return true;
  if (verification.phone && verification.phone.required) return true;
  if (verification.email && verification.email.required) return true;
  return false;
}

function blinkUniqueId() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('BLINK_UNIQUE_ID');
  if (!id) {
    id = Utilities.getUuid();
    props.setProperty('BLINK_UNIQUE_ID', id);
  }
  return id;
}

function blinkOp(p) {
  const props = PropertiesService.getScriptProperties();
  const email = String(props.getProperty('BLINK_EMAIL') || '').trim();
  const password = String(props.getProperty('BLINK_PASSWORD') || '');
  const configured = !!(email && password);
  const op = String(p.op || 'status');
  if (!configured && op !== 'status') {
    return { ok: false, experimental: true, configured: false, error: 'Set BLINK_EMAIL and BLINK_PASSWORD in Script Properties, then redeploy a new version.' };
  }
  if (op === 'status' && !configured) return { ok: true, experimental: true, configured: false, signedIn: false };
  if (op === 'login') return blinkLogin(email, password);
  if (op === 'verify') return blinkVerify(p.pin);
  if (op === 'cameras' || op === 'status') return blinkCameras();
  if (op === 'arm' || op === 'disarm') return blinkArm(op, p.networkId);
  if (op === 'thumbnail') return blinkThumbnail(p.networkId, p.cameraId);
  return { ok: false, experimental: true, error: 'Unknown Blink action.' };
}

function blinkLogin(email, password) {
  const body = {
    app_version: '30.0',
    client_name: 'family-hub',
    client_type: 'android',
    device_identifier: 'family-hub',
    email: email,
    os_version: '14',
    password: password,
    reauth: true,
    unique_id: blinkUniqueId()
  };
  let res = blinkFetch(blinkBase('prod') + '/api/v5/account/login', 'post', '', body);
  const tier = res.json && res.json.account && res.json.account.tier;
  if (tier && res.code >= 400) res = blinkFetch(blinkBase(tier) + '/api/v5/account/login', 'post', '', body);
  if (res.code >= 400 || !(res.json && res.json.auth)) {
    return { ok: false, experimental: true, configured: true, error: 'Blink login failed. ' + blinkMessage(res.json, 'Check the email and password.') };
  }
  blinkSaveSession(res.json);
  if (blinkNeedsPin(res.json)) {
    return { ok: true, experimental: true, configured: true, needsPin: true, message: 'Blink sent a verification PIN. Enter it here. It is checked by the script and not saved in the sheet.' };
  }
  return blinkCameras();
}

function blinkVerify(pin) {
  const clean = String(pin || '').replace(/\D/g, '');
  if (!/^\d{4,8}$/.test(clean)) return { ok: false, experimental: true, error: 'Enter the numeric PIN Blink sent.' };
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('BLINK_TOKEN') || '';
  const account = props.getProperty('BLINK_ACCOUNT_ID') || '';
  const client = props.getProperty('BLINK_CLIENT_ID') || '';
  const user = props.getProperty('BLINK_USER_ID') || account;
  const base = blinkBase(props.getProperty('BLINK_TIER'));
  if (!token || !account || !client) return { ok: false, experimental: true, needsPin: true, error: 'Sign in to Blink first.' };
  const v5 = blinkFetch(base + '/api/v5/accounts/' + encodeURIComponent(account) + '/users/' + encodeURIComponent(user) + '/clients/' + encodeURIComponent(client) + '/client_verification/pin/verify', 'post', token, { pin: clean, trusted: true });
  let ok = v5.code < 300;
  if (!ok) {
    const v4 = blinkFetch(base + '/api/v4/account/' + encodeURIComponent(account) + '/client/' + encodeURIComponent(client) + '/pin/verify', 'post', token, { pin: clean });
    ok = v4.code < 300;
    if (!ok) return { ok: false, experimental: true, needsPin: true, error: 'Blink did not accept that PIN. ' + blinkMessage(v5.json, '') };
  }
  return blinkCameras();
}

function blinkSession() {
  const props = PropertiesService.getScriptProperties();
  return {
    token: props.getProperty('BLINK_TOKEN') || '',
    account: props.getProperty('BLINK_ACCOUNT_ID') || '',
    tier: props.getProperty('BLINK_TIER') || 'prod'
  };
}

function blinkCameras() {
  const session = blinkSession();
  if (!session.token || !session.account) {
    return { ok: true, experimental: true, configured: true, signedIn: false, cameras: [], networks: [] };
  }
  const base = blinkBase(session.tier);
  const res = blinkFetch(base + '/api/v3/accounts/' + encodeURIComponent(session.account) + '/homescreen', 'get', session.token);
  if (res.code === 401 || res.code === 403) {
    return { ok: true, experimental: true, configured: true, signedIn: false, error: 'Blink needs you to sign in again.' };
  }
  if (res.code >= 300) return { ok: false, experimental: true, configured: true, error: 'Blink homescreen returned ' + res.code + '.' };
  const networks = [];
  const cameras = [];
  const rawNetworks = Array.isArray(res.json.networks) ? res.json.networks : [];
  rawNetworks.forEach(function (network) {
    const networkId = String(network.id || network.network_id || '');
    networks.push({ id: networkId, name: network.name || 'Home', armed: !!network.armed });
    const cams = Array.isArray(network.cameras) ? network.cameras : [];
    cams.forEach(function (cam) {
      cameras.push({ id: String(cam.id || ''), name: cam.name || 'Camera', networkId: networkId, thumbnail: !!(cam.thumbnail) });
    });
  });
  try { CacheService.getScriptCache().put('blink-home', JSON.stringify(res.json).slice(0, 90000), 300); } catch (e) {}
  return { ok: true, experimental: true, configured: true, signedIn: true, networks: networks, cameras: cameras };
}

function blinkArm(op, networkId) {
  const id = String(networkId || '');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return { ok: false, experimental: true, error: 'Pick a Blink system first.' };
  const session = blinkSession();
  if (!session.token) return { ok: false, experimental: true, signedIn: false, error: 'Sign in to Blink first.' };
  const base = blinkBase(session.tier);
  const path = op === 'disarm' ? 'disarm' : 'arm';
  let res = blinkFetch(base + '/api/v1/accounts/' + encodeURIComponent(session.account) + '/networks/' + encodeURIComponent(id) + '/state/' + path, 'post', session.token, {});
  if (res.code >= 300) res = blinkFetch(base + '/network/' + encodeURIComponent(id) + '/' + path, 'post', session.token, {});
  if (res.code >= 300) return { ok: false, experimental: true, error: 'Blink ' + path + ' returned ' + res.code + '.' };
  return { ok: true, experimental: true, accepted: true, op: path };
}

function blinkThumbnail(networkId, cameraId) {
  const network = String(networkId || '');
  const camera = String(cameraId || '');
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(network) || !/^[A-Za-z0-9_-]{1,40}$/.test(camera)) {
    return { ok: false, experimental: true, error: 'That camera was not recognized.' };
  }
  const session = blinkSession();
  if (!session.token) return { ok: false, experimental: true, error: 'Sign in to Blink first.' };
  const base = blinkBase(session.tier);
  let path = '';
  try {
    const cached = JSON.parse(CacheService.getScriptCache().get('blink-home') || '{}');
    (cached.networks || []).forEach(function (networkRow) {
      if (String(networkRow.id || networkRow.network_id) !== network) return;
      (networkRow.cameras || []).forEach(function (cam) {
        if (String(cam.id) === camera && cam.thumbnail) path = String(cam.thumbnail);
      });
    });
  } catch (e) {}
  if (!path) {
    blinkFetch(base + '/network/' + encodeURIComponent(network) + '/camera/' + encodeURIComponent(camera) + '/thumbnail', 'post', session.token, {});
    return { ok: false, experimental: true, error: 'Thumbnail requested. Wait a few seconds and try again.' };
  }
  const url = path.indexOf('http') === 0 ? path : base + (path.charAt(0) === '/' ? '' : '/') + path;
  const res = blinkFetch(url, 'get', session.token);
  if (res.code >= 300) return { ok: false, experimental: true, error: 'Blink thumbnail returned ' + res.code + '.' };
  const bytes = res.blob.getBytes();
  if (!bytes || bytes.length < 20 || bytes.length > 400000) return { ok: false, experimental: true, error: 'That thumbnail was empty or too large.' };
  const mime = String(res.type || 'image/jpeg').indexOf('image/') === 0 ? res.type : 'image/jpeg';
  return { ok: true, experimental: true, dataUrl: 'data:' + mime + ';base64,' + Utilities.base64Encode(bytes) };
}
