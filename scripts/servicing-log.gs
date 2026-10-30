// Adds a row to the "Servicing log" tab when the site logs a job as done.
// Paste into the sheet's Extensions → Apps Script, then follow the README
// ("Logging servicing jobs") to save a token and deploy it as a web app.

const TAB = 'Servicing log';

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, message: 'Bad request.' });
  }
  const token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token || req.token !== token) return reply({ ok: false, message: 'Not allowed.' });
  if (!/^[a-z0-9-]{1,40}$/.test(req.id || '') || !/^\d{4}-\d{2}-\d{2}$/.test(req.date || '')) {
    return reply({ ok: false, message: 'Bad request.' });
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TAB);
  if (!sheet) return reply({ ok: false, message: 'There’s no "' + TAB + '" tab.' });
  const row = sheet.getLastRow() + 1;
  // the date as plain text, so it reads back exactly as written
  sheet.getRange(row, 1).setNumberFormat('@');
  sheet.getRange(row, 1, 1, 4).setValues([[req.date, String(req.job || '').slice(0, 120), req.id, String(req.note || '').slice(0, 200)]]);
  return reply({ ok: true });
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
