// Injected collector script (Manifest V3): scrolls, discovers Drive file links, then reports them.
(function() {
  const MAX_DURATION_MS = 20000; // cap time
  const SCROLL_STEP_PX = 1200;
  const SCROLL_INTERVAL_MS = 400; // tighter loop for faster loading
  const STALL_THRESHOLD = 4; // number of successive stalls to assume bottom

  const hrefs = new Set();
  const titles = [];
  const domRefs = [];
  let lastScrollHeight = 0;
  let stallCount = 0;
  let done = false;

  function harvest() {
    // Look for all Google Drive and Docs links
    const anchors = document.querySelectorAll('a[href*="drive.google.com"], a[href*="docs.google.com"]');
    anchors.forEach(a => {
      const href = a.href;
      if (!href) return;
      
      // Skip folders and certain Google service URLs
      if (href.includes('/drive/folders/') || 
          href.includes('/drive/u/') || 
          href.includes('accounts.google.com') ||
          href.includes('/drive/recent') ||
          href.includes('/drive/starred')) return;
      
      // Accept files, documents, spreadsheets, presentations, drawings, forms
      if (href.includes('/file/d/') || 
          href.includes('/document/d/') || 
          href.includes('/spreadsheets/d/') || 
          href.includes('/presentation/d/') ||
          href.includes('/drawings/d/') ||
          href.includes('/forms/d/') ||
          href.includes('drive.google.com/open?id=')) {
        
        if (!hrefs.has(href)) {
          hrefs.add(href);
          const title = (a.textContent || a.title || a.getAttribute('aria-label') || '').trim() || 'Untitled file';
          titles.push(title);
          domRefs.push(a);
        }
      }
    });
  }

  function scrollStep() {
    if (done) return;
    harvest();
    window.scrollBy(0, SCROLL_STEP_PX);
    const currentHeight = document.documentElement.scrollHeight;
    if (currentHeight === lastScrollHeight) {
      stallCount++;
    } else {
      stallCount = 0;
      lastScrollHeight = currentHeight;
    }
    if (stallCount >= STALL_THRESHOLD) {
      finish();
    }
  }

  function finish() {
    if (done) return;
    done = true;
    harvest();
    chrome.runtime.sendMessage({ type: 'HARVEST_COMPLETE', hrefList: Array.from(hrefs), titleList: titles });
    clearInterval(scrollTimer);
  }

  const start = Date.now();
  const scrollTimer = setInterval(() => {
    if (Date.now() - start > MAX_DURATION_MS) {
      finish();
    } else {
      scrollStep();
    }
  }, SCROLL_INTERVAL_MS);

  // Listener: scroll target element into view on request
  chrome.runtime.onMessage.addListener((msg) => {
    if (typeof msg === 'string') {
      const idx = titles.indexOf(msg);
      if (idx > -1 && domRefs[idx]) {
        domRefs[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });
})();
