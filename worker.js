// Background service worker: manages queued downloads so they continue after popup closes.
// Queue architecture: popup sends DOWNLOAD_BATCH with array of {originalLink, exportLink, filename}.
// We open tabs one-at-a-time (or limited concurrency) to avoid overwhelming Drive; rely on downloads API events.

const STATE = {
  queue: [],            // pending jobs {originalLink, exportLink, filename, fileId}
  active: null,         // Set of active jobs (max 1 now)
  concurrency: 1,
  running: false,
  completed: 0,
  total: 0,
  stopped: false,
  activeDownloadIds: new Set(),
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'DOWNLOAD_BATCH') {
    // If a previous run was stopped, reset counters (but keep completed history until UI resets)
    if (STATE.stopped) {
      // fresh start
      STATE.stopped = false;
      STATE.queue = [];
      STATE.active = null;
      STATE.completed = 0;
      STATE.total = 0;
      STATE.activeDownloadIds.clear();
    }
    enqueueBatch(msg.items || []);
    sendResponse({ ok: true });
    return true; // async
  }
  if (msg && msg.type === 'DOWNLOAD_STATUS') {
    sendResponse({
      active: !!STATE.active,
      queue: STATE.queue.length,
      completed: STATE.completed,
      total: STATE.total,
      running: STATE.running && !STATE.stopped,
      stopped: STATE.stopped
    });
    return true;
  }
  if (msg && msg.type === 'STOP_DOWNLOADS') {
    stopAll();
    sendResponse({ ok: true });
    return true;
  }
});

function enqueueBatch(items) {
  if (!items.length) return;
  items.forEach(it => STATE.queue.push(it));
  STATE.total += items.length;
  maybeStart();
}

function maybeStart() {
  if (STATE.running || STATE.stopped) return;
  STATE.running = true;
  pump();
}

function pump() {
  if (STATE.stopped) return; // do nothing while stopped
  if (!STATE.queue.length && !STATE.active) {
    STATE.running = false;
    // leave totals & completed as-is for UI
    return;
  }
  while (STATE.queue.length && countActives() < STATE.concurrency && !STATE.stopped) {
    const job = STATE.queue.shift();
    startJob(job);
  }
}

function countActives() { return STATE.active ? STATE.active.size : 0; }

function startJob(job) {
  if (!STATE.active) STATE.active = new Set();
  STATE.active.add(job);

  // Decide final URL: prefer exportLink if it looks like an export, else originalLink
  let url = job.exportLink || job.originalLink;
  if (!url) { finishJob(job); return; }

  // Skip obvious non-downloadable pages (still an HTML view without export pattern)
  if (!/\/export\?|uc\?export=download/.test(url) && /docs\.google\.com|drive\.google\.com/.test(url)) {
    // Not an export style link -> skip
    finishJob(job);
    return;
  }

  const options = { url };
  if (job.filename) options.filename = job.filename; // user may still get Save As prompt depending on settings
  try {
    chrome.downloads.download(options, (downloadId) => {
      if (chrome.runtime.lastError || downloadId === undefined) {
        // failed -> skip
        finishJob(job);
        return;
      }
      STATE.activeDownloadIds.add(downloadId);
      // Listen for completion to finish job earlier (optional)
      const onChanged = delta => {
        if (delta && delta.id === downloadId && delta.state && delta.state.current === 'complete') {
          try { chrome.downloads.onChanged.removeListener(onChanged); } catch (e) {}
          STATE.activeDownloadIds.delete(downloadId);
          finishJob(job);
        } else if (delta && delta.id === downloadId && delta.state && delta.state.current === 'interrupted') {
          try { chrome.downloads.onChanged.removeListener(onChanged); } catch (e) {}
          STATE.activeDownloadIds.delete(downloadId);
          finishJob(job);
        }
      };
      chrome.downloads.onChanged.addListener(onChanged);
      // Safety timeout in case no onChanged comes (e.g., user cancels prompt or Save As dialog). If user cancels, the state may remain.
      job._timeoutId = setTimeout(() => {
        try { chrome.downloads.onChanged.removeListener(onChanged); } catch (e) {}
        STATE.activeDownloadIds.delete(downloadId);
        finishJob(job);
      }, 45000);
    });
  } catch (e) {
    finishJob(job);
  }
}

function finishJob(job) {
  if (job && job._timeoutId) clearTimeout(job._timeoutId);
  if (STATE.active) STATE.active.delete(job);
  if (!STATE.stopped) STATE.completed += 1; // don't increment if cancelled mid-flight
  pump();
}

function stopAll() {
  STATE.stopped = true;
  STATE.running = false;
  // Clear pending queue
  STATE.queue = [];
  // Cancel active downloads (best-effort)
  for (const id of Array.from(STATE.activeDownloadIds)) {
    try { chrome.downloads.cancel(id, () => { void chrome.runtime?.lastError; }); } catch (e) { /* ignore */ }
  }
  STATE.activeDownloadIds.clear();
  // Active jobs won't increment completed further
  if (STATE.active) {
    for (const job of Array.from(STATE.active)) {
      if (job._timeoutId) clearTimeout(job._timeoutId);
      STATE.active.delete(job);
    }
  }
}
