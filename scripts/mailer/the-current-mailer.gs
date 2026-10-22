/**
 * The Current's mailer: sends the emails The Current queues up.
 *
 * This runs as a Google Apps Script in the admin@palmriveracademy.edu.vn account,
 * every five minutes. Each time it asks The Current's database what is due
 * (adm_mailer_due), sends each email from admin@ with Gmail, and says how it went.
 * What it sends:
 *   - the thank-you to a family that sent the enrollment form or the contact /
 *     book-a-tour form on pra.edu.vn, and the alert to Yvonne and admin@;
 *   - a newsletter Seth or Bowen approved, at its time, to the parent group and
 *     allstaff@ (ten minutes before, the database puts its page on the website
 *     and this script starts a website build, then waits for the page);
 *   - "newsletter to approve" and "newsletter not sent" notes to Seth and Bowen.
 *
 * The database decides everything (who, what, when). This script only carries
 * the emails, so it rarely needs changing. The copy that runs is the one pasted
 * into Apps Script; this file in BowenPRA/admin is the record of it. Setup:
 * scripts/mailer/README.md.
 *
 * Script properties (Project Settings > Script Properties):
 *   SUPABASE_URL   https://gpfycuxltrjeeyxnnktu.supabase.co
 *   SUPABASE_KEY   the publishable key (sb_publishable_..., public: the website has it too)
 *   MAILER_KEY     the key the SQL file printed (private: never in email or chat)
 *   FROM           optional: a send-as address set up in admin@'s Gmail, such as admin@pra.edu.vn
 *   PAUSED         optional: "yes" stops all sending until it is removed
 */

var FROM_NAME = 'Palm River Academy';
var PAGE_WAIT_MINUTES = 15; // how long a newsletter waits past its time for its page to be live

/** Every five minutes (the trigger made by install). */
function run() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // the last run is still going
  try {
    var cfg = config_();
    if (cfg.paused) return;
    var due = rpc_(cfg, 'adm_mailer_due', {});
    // A newsletter put on the website just now: its page needs the build started here.
    var building = due.build ? startBuild_(cfg) : false;
    (due.jobs || []).forEach(function (job) {
      try {
        if (building && job.kind === 'newsletter') job.build_ok = true;
        if (waitForPage_(job)) return;
        if (rpc_(cfg, 'adm_mailer_claim', { p_id: job.id }) !== true) return;
        var id;
        try {
          id = send_(cfg, job);
        } catch (e) {
          rpc_(cfg, 'adm_mailer_done', { p_id: job.id, p_ok: false, p_error: String((e && e.message) || e) });
          return;
        }
        rpc_(cfg, 'adm_mailer_done', { p_id: job.id, p_ok: true, p_message_id: id });
      } catch (e) {
        // A problem reaching the database: the email stays where it is. If it was sent,
        // The Current shows "Sending did not finish" after 20 minutes; it is never sent twice by itself.
        console.error('Email ' + job.id + ': ' + ((e && e.message) || e));
      }
    });
  } finally {
    lock.releaseLock();
  }
}

/** Run once, after the first check: makes the five-minute trigger (and removes an old one). */
function install() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'run') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('run').timeBased().everyMinutes(5).create();
  console.log('Installed: run() every five minutes.');
}

/** Run by hand: checks the settings and the key, and sends one test email to the account itself. Sends nothing else. */
function check() {
  var cfg = config_();
  var ok = rpc_(cfg, 'adm_mailer_ok', {});
  if (ok !== true) throw new Error('The database does not know this MAILER_KEY. Copy it again from the SQL Editor (README step 3).');
  var me = Session.getEffectiveUser().getEmail();
  var how = typeof Gmail !== 'undefined' ? 'the Gmail API (emoji arrive as typed)' : 'GmailApp (the Gmail service is off: README step 2)';
  send_(cfg, {
    to: me,
    subject: 'The Current mailer: test 🎃',
    text: 'The Current\'s mailer can reach the database and send from this account, through ' + how + '.\nEmoji: 🎃 🇻🇳 · Tiếng Việt',
    html: '<p>The Current\'s mailer can reach the database and send from this account, through ' + how + '.</p><p>Emoji: 🎃 🇻🇳 · Tiếng Việt</p>',
    attachments: [],
  });
  console.log('Key accepted. A test email went to ' + me + ' through ' + how + (cfg.from ? ', from ' + cfg.from : '') + '. Its emoji should show as a pumpkin and a flag. Next: run install.');
}

// ---------------- the parts ----------------

function config_() {
  var p = PropertiesService.getScriptProperties();
  var cfg = {
    url: String(p.getProperty('SUPABASE_URL') || '').trim().replace(/\/+$/, ''),
    key: String(p.getProperty('SUPABASE_KEY') || '').trim(),
    mailer: String(p.getProperty('MAILER_KEY') || '').trim(),
    from: String(p.getProperty('FROM') || '').trim(),
    paused: /^(yes|true|1)$/i.test(String(p.getProperty('PAUSED') || '').trim()),
  };
  if (!cfg.url || !cfg.key || !cfg.mailer) throw new Error('Set SUPABASE_URL, SUPABASE_KEY and MAILER_KEY under Project Settings > Script Properties (README step 3).');
  return cfg;
}

/** Calls one of the mailer's database functions with the key. */
function rpc_(cfg, fn, args) {
  var body = { p_key: cfg.mailer };
  Object.keys(args || {}).forEach(function (k) { body[k] = args[k]; });
  var res = UrlFetchApp.fetch(cfg.url + '/rest/v1/rpc/' + fn, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: cfg.key },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code >= 300) throw new Error(fn + ' answered ' + code + ': ' + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

/** Asks the newsletter-build function to build pra.edu.vn, tells the database whether it started, and returns that. */
function startBuild_(cfg) {
  var ok = false;
  var error = '';
  try {
    var res = UrlFetchApp.fetch(cfg.url + '/functions/v1/newsletter-build', {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: cfg.key, 'x-mailer-key': cfg.mailer },
      payload: JSON.stringify({ action: 'build' }),
      muteHttpExceptions: true,
    });
    ok = res.getResponseCode() < 300;
    if (!ok) error = res.getResponseCode() + ' ' + res.getContentText().slice(0, 200);
  } catch (e) {
    error = String((e && e.message) || e);
  }
  rpc_(cfg, 'adm_mailer_build', { p_ok: ok, p_error: error || null });
  return ok;
}

/** True while a newsletter's page is still being built (up to PAGE_WAIT_MINUTES past its time). */
function waitForPage_(job) {
  if (job.kind !== 'newsletter' || !job.page || !job.build_ok) return false;
  var late = (Date.now() - new Date(job.send_at).getTime()) / 60000;
  if (late > PAGE_WAIT_MINUTES) return false;
  try {
    var res = UrlFetchApp.fetch(job.page + '?check=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
    return res.getResponseCode() !== 200;
  } catch (e) {
    return true;
  }
}

/** Sends one email from admin@ and returns its Gmail id. */
function send_(cfg, job) {
  var files = (job.attachments || []).map(function (a) {
    var res = UrlFetchApp.fetch(a.url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('The attachment ' + a.name + ' could not be fetched (' + res.getResponseCode() + ').');
    return res.getBlob().setName(a.name);
  });
  // An email with only Bcc (a newsletter) is addressed to the account itself, as the office did by hand.
  var me = Session.getEffectiveUser().getEmail();
  var to = job.to || me;
  var id;
  if (typeof Gmail !== 'undefined') {
    // The Gmail API, with the message written out here: every character arrives as it was
    // typed, emoji included. (GmailApp turns emoji into rows of question marks.)
    var sent = Gmail.Users.Messages.send({ raw: mime_(cfg.from || me, to, job, files) }, 'me');
    id = sent.id;
  } else {
    // The Gmail service is not switched on in this project (README step 2): GmailApp, with
    // each emoji in the HTML written as an HTML code it cannot spoil, and none in the subject.
    var opts = { htmlBody: emojiCodes_(job.html), name: FROM_NAME };
    if (job.cc) opts.cc = job.cc;
    if (job.bcc) opts.bcc = job.bcc;
    if (cfg.from) opts.from = cfg.from;
    if (files.length) opts.attachments = files;
    id = GmailApp.createDraft(to, noEmoji_(job.subject), noEmoji_(job.text || ''), opts).send().getId();
  }
  // ...and kept out of admin@'s inbox: it is in Sent. Replies still arrive in the inbox.
  if (!job.to) GmailApp.getMessageById(id).getThread().moveToArchive();
  return id;
}

/** The whole email as one MIME message, base64url, for the Gmail API: text and HTML, then the files. */
function mime_(from, to, job, files) {
  var crlf = '\r\n';
  var mixed = 'pra-mixed-' + Utilities.getUuid();
  var alt = 'pra-alt-' + Utilities.getUuid();
  var word = function (s) { return '=?UTF-8?B?' + Utilities.base64Encode(String(s), Utilities.Charset.UTF_8) + '?='; };
  var lines = function (b64) { return b64.replace(/(.{76})/g, '$1' + crlf); };
  var head = [
    'From: ' + word(FROM_NAME) + ' <' + from + '>',
    'To: ' + to,
    job.cc ? 'Cc: ' + job.cc : null,
    job.bcc ? 'Bcc: ' + job.bcc : null,
    'Subject: ' + word(job.subject),
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="' + mixed + '"',
  ].filter(function (x) { return x; });
  var out = head.concat([
    '',
    '--' + mixed,
    'Content-Type: multipart/alternative; boundary="' + alt + '"',
    '',
    '--' + alt,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    lines(Utilities.base64Encode(job.text || '', Utilities.Charset.UTF_8)),
    '--' + alt,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    lines(Utilities.base64Encode(job.html || '', Utilities.Charset.UTF_8)),
    '--' + alt + '--',
  ]);
  files.forEach(function (f) {
    var name = f.getName();
    var plain = name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    out.push('--' + mixed,
      'Content-Type: ' + (f.getContentType() || 'application/octet-stream') + '; name="' + plain + '"',
      'Content-Disposition: attachment; filename="' + plain + '"; filename*=UTF-8\'\'' + encodeURIComponent(name),
      'Content-Transfer-Encoding: base64',
      '',
      lines(Utilities.base64Encode(f.getBytes())));
  });
  out.push('--' + mixed + '--', '');
  // Everything above is plain ASCII by now.
  return Utilities.base64EncodeWebSafe(out.join(crlf));
}

/** Each character outside the basic set (emoji) as an HTML code: "&#x1F383;". */
function emojiCodes_(html) {
  return String(html || '').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function (pair) {
    return '&#x' + pair.codePointAt(0).toString(16).toUpperCase() + ';';
  });
}

/** Text with no emoji, for where GmailApp would spoil them (a subject, the plain-text part). */
function noEmoji_(s) {
  return String(s || '').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').replace(/[️‍]/g, '').replace(/ {2,}/g, ' ').trim();
}
