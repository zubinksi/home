// The Apps Script bound to the "Home Projects & Vendors" sheet (see
// scripts/servicing-log.gs and the README), which writes to the sheet on the
// site's behalf. Shared by the servicing log and the projects tab.
// SERVICE_LOG_SCRIPT_URL is the script's web app URL; SERVICE_LOG_TOKEN the
// token saved in its properties.

/**
 * Sends one request to the script. Returns [status, body].
 * @param {{ url?: string, token?: string }} config
 * @param {Record<string, unknown>} payload
 * @returns {Promise<[number, object]>}
 */
export async function callScript(config, payload) {
  if (!config.url || !config.token) {
    return [501, { error: 'not-set-up', message: 'Saving isn’t set up yet: the sheet’s script isn’t connected.' }];
  }
  try {
    // Apps Script answers a POST with a redirect to its result, which fetch follows
    const r = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ token: config.token, ...payload }),
      redirect: 'follow',
    });
    const text = await r.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* not JSON: the script isn't deployed for anyone to call, or errored */
    }
    if (!r.ok || !body?.ok) {
      return [502, { error: 'script', message: body?.message ?? 'The sheet’s script didn’t accept it.' }];
    }
    return [200, { ok: true }];
  } catch (err) {
    console.error('[sheet script]', err);
    return [502, { error: 'network', message: 'Couldn’t reach the sheet’s script.' }];
  }
}
