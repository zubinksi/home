// Writes to the "Home Projects & Vendors" sheet on the site's behalf:
//  - a row on the "Servicing log" tab when a job is logged as done, and
//  - on the "Projects" tab, a quote, an item marked done, or a new item, and
//  - a row on the "Open items" tab when an open item is ticked or unticked.
// Paste into the sheet's Extensions → Apps Script, then follow the README
// ("Logging servicing jobs") to save a token and deploy it as a web app. After
// changing this code, deploy a new version (Deploy → Manage deployments → edit
// → Version: New version) or the old code keeps running.

const SERVICE_TAB = 'Servicing log';
const PROJECTS_TAB = 'Projects';
const ITEMS_TAB = 'Open items';
const QUOTE_COLUMN = 5; // E, beside the hidden row numbers in D

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, message: 'Bad request.' });
  }
  const token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token || req.token !== token) return reply({ ok: false, message: 'Not allowed.' });
  // one change at a time, so two quick taps can't write over each other
  const lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    if (req.kind === 'project') return project(req);
    if (req.kind === 'item') return item(req);
    return service(req);
  } finally {
    lock.releaseLock();
  }
}

function service(req) {
  if (!/^[a-z0-9-]{1,40}$/.test(req.id || '') || !/^\d{4}-\d{2}-\d{2}$/.test(req.date || '')) {
    return reply({ ok: false, message: 'Bad request.' });
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SERVICE_TAB);
  if (!sheet) return reply({ ok: false, message: 'There’s no "' + SERVICE_TAB + '" tab.' });
  const row = sheet.getLastRow() + 1;
  // the date as plain text, so it reads back exactly as written
  sheet.getRange(row, 1).setNumberFormat('@');
  sheet.getRange(row, 1, 1, 4).setValues([[req.date, String(req.job || '').slice(0, 120), req.id, String(req.note || '').slice(0, 200)]]);
  return reply({ ok: true });
}

function project(req) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PROJECTS_TAB);
  if (!sheet) return reply({ ok: false, message: 'There’s no "' + PROJECTS_TAB + '" tab.' });
  // the row must still hold the item the page saw, or the sheet changed meanwhile
  const holds = (row, raw) =>
    Number.isInteger(row) && row >= 4 && row <= sheet.getMaxRows() && String(sheet.getRange(row, 1).getDisplayValue()).trim() === String(raw || '').trim();
  const moved = reply({ ok: false, message: 'The sheet changed since this page loaded. Reload and try again.' });

  if (req.action === 'quote') {
    if (!holds(req.row, req.raw)) return moved;
    sheet.getRange(req.row, QUOTE_COLUMN).setValue(req.quote === null ? '' : Number(req.quote));
    return reply({ ok: true });
  }
  if (req.action === 'done') {
    if (!holds(req.row, req.raw) || (req.column !== 2 && req.column !== 3)) return moved;
    sheet.getRange(req.row, req.column).setValue(Number(req.cost));
    return reply({ ok: true });
  }
  if (req.action === 'add') {
    if (!holds(req.afterRow, req.afterRaw)) return moved;
    const text = String(req.text || '').trim().slice(0, 160);
    if (!text) return reply({ ok: false, message: 'What’s the item?' });
    sheet.insertRowAfter(req.afterRow);
    const row = req.afterRow + 1;
    sheet.getRange(row, 1).setValue((req.optional ? 'Optional: ' : '') + text);
    if (req.quote !== null && req.quote !== undefined) sheet.getRange(row, QUOTE_COLUMN).setValue(Number(req.quote));
    return reply({ ok: true });
  }
  return reply({ ok: false, message: 'Bad request.' });
}

// a log, one row per tick or untick; the site reads the latest row for each item
function item(req) {
  if (!/^[A-Za-z0-9:@._-]{1,120}$/.test(req.id || '') || typeof req.done !== 'boolean') {
    return reply({ ok: false, message: 'Bad request.' });
  }
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(ITEMS_TAB);
  if (!sheet) {
    sheet = book.insertSheet(ITEMS_TAB);
    sheet.getRange(1, 1, 1, 4).setValues([['When', 'Item ID', 'Item', 'Done']]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  const row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1).setNumberFormat('@');
  sheet.getRange(row, 1, 1, 4).setValues([[new Date().toISOString(), req.id, String(req.text || '').slice(0, 400), req.done ? 'TRUE' : 'FALSE']]);
  return reply({ ok: true });
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
