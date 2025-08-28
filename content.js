// Waits for receiving the list of extracted links from background.js
chrome.runtime.onMessage.addListener(function (response, sender, sendResponse) {
    if (response && response.type === 'HARVEST_COMPLETE') {
        buildList(response);
    } else if (response && response.titleList) {
        // Backward compatibility
        buildList(response);
    }
});

function buildList(response) {
    // Toggling visibility state of various HTML elements ONLY when they are loaded

    var loadingAnimation = document.querySelector(".loadingAni");
    if (loadingAnimation) {
        document.querySelector(".loadingAni").style.display = "none";
    }
    document.querySelector("h1").style.display = "none";

    var titlesmall = document.querySelector("#titleSmall");
    if (titlesmall) {
        document.querySelector("#titleSmall").style.display = "block";
    }

    var downloadButton = document.querySelector("#dwnbtn");
    if (downloadButton) {
        document.querySelector("#dwnbtn").classList.add('visible');
    }

    var titlebox = document.querySelector(".titleBox");
    if (titlebox) {
        document.querySelector(".titleBox").style.display = "block";
    }

    // Remove/Hide old cancel area (not useful once Stop exists)
    var cancelbox = document.querySelector(".cancelBox");
    if (cancelbox) {
        cancelbox.style.display = 'none';
    }

    // Keep subheading styling purely in CSS for consistent alignment in both views.

    var ul = document.getElementById("titleList");
    if (response["titleList"]) {
        for (var i = 0; i < response["titleList"].length; i++) {
            console.log(response);
            // Create a new list item for every document extracted from page
            var li = document.createElement("li");
            li.setAttribute("class", "titleItems");

            var checkBox = document.createElement("INPUT");
            checkBox.setAttribute("type", "checkbox");
            checkBox.setAttribute("value", i);
            checkBox.className = "check";

            // Determine / ensure extension based on link when missing so user gets proper file & icon
            const originalLink = response.hrefList && response.hrefList[i];
            const rawTitle = response["titleList"][i];
            const inferredExt = determineExtensionFromLink(originalLink, rawTitle);
            const displayTitle = appendMissingExtension(rawTitle, inferredExt);

            const extLower = (displayTitle.split('.').pop() || '').toLowerCase();
            let iconImg = 'assets/file.png';
            if (['xlsx','xls'].includes(extLower)) iconImg = 'assets/excelFile.png';
            else if (['docx','doc'].includes(extLower)) iconImg = 'assets/wordFile.png';
            else if (['pptx','ppt'].includes(extLower)) iconImg = 'assets/powerpointFile.png';
            else if (extLower === 'pdf') iconImg = 'assets/pdfFile.png';

            // Explicit icon element (list-style-image fails with display:flex)
            const iconSpan = document.createElement('span');
            iconSpan.className = 'fileIcon';
            iconSpan.style.backgroundImage = `url(${iconImg})`;
            iconSpan.setAttribute('aria-hidden','true');

            var titleSpan = document.createElement('span');
            titleSpan.className = 'titleText';
            titleSpan.textContent = displayTitle;

            li.appendChild(iconSpan);
            li.appendChild(checkBox);
            li.appendChild(titleSpan);
            ul.appendChild(li);
            document.querySelector("h2").innerHTML = (i + 1) + " files found!";
        }
    document.querySelector("#dwnbtn").classList.add('visible');
        document.querySelector("#selAllCheck").style.display = "block";
        document.querySelector("#SAText").style.display = "block";

        document.getElementById("selAllCheck").addEventListener("click", selectAllFunc);

    bindStopButton();


        // Function to select all/deselect all checkboxes 
        function selectAllFunc() {
            if (this.checked == true) {
                for (var i = 0; i < response["titleList"].length; i++) {
                    document.querySelectorAll(".check")[i].checked = true;
                    document.getElementById("selectedCount").innerHTML = response["titleList"].length + " / " + response["titleList"].length + " selected";

                }
            }
            else if (this.checked == false) {
                for (var i = 0; i < response["titleList"].length; i++) {
                    document.querySelectorAll(".check")[i].checked = false;
                    document.getElementById("selectedCount").innerHTML = "0" + " / " + response["titleList"].length + " selected";

                }
            }
        }


        var numberOfCheckedItems = 0;
        for (var j = 0; j < response["titleList"].length; j++) {
            document.querySelectorAll(".check")[j].addEventListener("click", checkedCount);
        }

        // Counter for number of items that are selected
        function checkedCount() {
            if (this.checked == true) {
                ++numberOfCheckedItems;
            }
            else if (this.checked == false) {
                --numberOfCheckedItems;
            }
            document.getElementById("selectedCount").innerHTML = numberOfCheckedItems + " / " + response["titleList"].length + " selected";
        }

        // Function triggered when "Download Files" button is clicked
        document.getElementById("dwnbtn").addEventListener("click", function () {
            const checkboxes = document.getElementsByClassName("check");
            const items = [];
            for (let i = 0; i < checkboxes.length; i++) {
                if (checkboxes[i].checked) {
                    const idx = parseInt(checkboxes[i].value);
                    const originalLink = response.hrefList[idx];
                    const title = response.titleList[idx];
                    const extFromLink = determineExtensionFromLink(originalLink, title);
                    const finalTitle = appendMissingExtension(title, extFromLink);
                    const exportLink = convertDriveLinkToDirect(originalLink, extFromLink);
                    const fileId = extractDriveFileId(originalLink) || extractDriveFileId(exportLink) || String(idx);
                    items.push({ originalLink, exportLink, filename: sanitizeFileName(finalTitle, extFromLink), fileId });
                }
            }
            if (!items.length) {
                alert('Select at least one file.');
                return;
            }
                document.getElementById("selectedCount").innerHTML = "0 / " + response["titleList"].length + " selected";
        
            document.querySelector("h2").innerHTML = `Queued ${items.length} downloads…`;
            const stopBtn = document.getElementById('stopDownloads');
            if (stopBtn) stopBtn.style.display = 'flex';
            const cancelbox2 = document.querySelector('.cancelBox'); if (cancelbox2) cancelbox2.style.display = 'none';
            chrome.runtime.sendMessage({ type: 'DOWNLOAD_BATCH', items }, (res) => {
                if (!res || !res.ok) {
                    document.querySelector("h2").innerHTML = 'Failed to queue downloads.';
                } else {
                    // Periodically poll status while popup open
                    let poll = 0;
                    const poller = setInterval(() => {
                        chrome.runtime.sendMessage({ type: 'DOWNLOAD_STATUS' }, (stat) => {
                            if (!stat) return;
                            if (stat.stopped) {
                                document.querySelector("h2").innerHTML = `Stopped at ${stat.completed}/${stat.total}`;
                                clearInterval(poller);
                                if (stopBtn) stopBtn.style.display = 'none';
                            } else {
                                document.querySelector("h2").innerHTML = `Downloading ${stat.completed}/${stat.total}`;
                                if (stat.total && stat.completed >= stat.total) {
                                    document.querySelector("h2").innerHTML = 'All downloads started.';
                                    clearInterval(poller);
                                    if (stopBtn) stopBtn.style.display = 'none';
                                }
                            }
                        });
                        if (++poll > 120) clearInterval(poller); // stop after ~2 min
                    }, 1000);
                }
            });
        });

        // Function to scrollIntoView the document name that is clicked
        for (var j = 0; j < response["titleList"].length; j++) {
            document.querySelectorAll(".titleItems")[j].addEventListener("click", sendFileName);
        }
        function sendFileName() {
            var fileClicked = this.querySelector('.titleText') ? this.querySelector('.titleText').textContent : this.innerHTML;
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                chrome.tabs.sendMessage(tabs[0].id, fileClicked)
            });
        }
    }
}

// Utilities
function sanitizeFileName(name, forcedExt) {
    if (!name) name = 'file';
    // Remove dangerous characters
    let clean = name.replace(/[/\\?%*:|"<>]/g, '_').trim();
    // Ensure extension (prefer forcedExt)
    const hasExt = /\.[a-z0-9]{1,6}$/i.test(clean);
    if (!hasExt) {
        if (forcedExt) clean += '.' + forcedExt.toLowerCase();
    } else if (forcedExt) {
        // If existing different extension but we know better (e.g. Google Doc labeled without ext), append correct one
        // Only add if not already matching one of allowed list
        const ext = clean.split('.').pop().toLowerCase();
        if (ext !== forcedExt.toLowerCase()) clean += '.' + forcedExt.toLowerCase();
    }
    return clean.substring(0, 180) || 'file';
}

// Determine canonical extension from Drive / Docs URL
function determineExtensionFromLink(link, title) {
    if (!link) return inferExtensionFromTitle(title) || null;
    if (/docs\.google\.com\/document\//.test(link)) return 'docx';
    if (/docs\.google\.com\/spreadsheets\//.test(link)) return 'xlsx';
    if (/docs\.google\.com\/presentation\//.test(link)) return 'pptx';
    if (/docs\.google\.com\/drawings\//.test(link)) return 'png';
    if (/docs\.google\.com\/forms\//.test(link)) return 'pdf';
    // For generic drive file we can't know; fallback to title
    return inferExtensionFromTitle(title) || null;
}

// Append inferred extension if missing
function appendMissingExtension(title, ext) {
    if (!title) return ext ? 'file.' + ext : 'file';
    if (!ext) return title; // nothing to add
    if (/\.[a-z0-9]{1,6}$/i.test(title)) return title; // already has one
    return title + '.' + ext;
}

function inferExtensionFromTitle(title) {
    const m = /\.([a-zA-Z0-9]{1,6})(?:$|\s)/.exec(title || '');
    return m ? m[1].toLowerCase() : null;
}

function extractDriveFileId(link) {
    // Handle various Google Drive URL formats
    let m = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/); if (m) return m[1];
    m = link.match(/[?&]id=([a-zA-Z0-9_-]+)/); if (m) return m[1];
    m = link.match(/document\/d\/([a-zA-Z0-9_-]+)/); if (m) return m[1];
    m = link.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/); if (m) return m[1];
    m = link.match(/presentation\/d\/([a-zA-Z0-9_-]+)/); if (m) return m[1];
    m = link.match(/drawings\/d\/([a-zA-Z0-9_-]+)/); if (m) return m[1];
    m = link.match(/forms\/d\/([a-zA-Z0-9_-]+)/); if (m) return m[1];
    return null;
}

function convertDriveLinkToDirect(link, extGuess) {
    const id = extractDriveFileId(link);
    if (!id) return link;
    // extract authuser if present so we keep same account
    const mAuth = link.match(/[?&]authuser=(\d+)/);
    const authuser = mAuth ? mAuth[1] : null;
    const authParam = authuser ? `&authuser=${authuser}` : '';

    // If link already points to drive.usercontent (direct download), return it unchanged
    if (/drive\.usercontent\.google\.com/.test(link)) return link;

    // Handle different Google file types with proper export formats
    if (/docs\.google\.com\/document\//.test(link)) {
        return `https://docs.google.com/document/d/${id}/export?format=docx${authParam}`;
    }
    if (/docs\.google\.com\/spreadsheets\//.test(link)) {
        return `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx${authParam}`;
    }
    if (/docs\.google\.com\/presentation\//.test(link)) {
        return `https://docs.google.com/presentation/d/${id}/export?format=pptx${authParam}`;
    }
    if (/docs\.google\.com\/drawings\//.test(link)) {
        return `https://docs.google.com/drawings/d/${id}/export?format=png${authParam}`;
    }
    if (/docs\.google\.com\/forms\//.test(link)) {
        return `https://docs.google.com/forms/d/${id}/export?format=pdf${authParam}`;
    }

    // For generic Drive files, use the proper download endpoint and preserve authuser
    return `https://drive.google.com/uc?export=download&id=${id}&confirm=t${authParam}`;
}

// Old cancel button logic removed (superseded by Stop Downloads)

document.addEventListener("DOMContentLoaded", () => { 
    const runBtn = document.getElementById("runScript");
    if (runBtn) runBtn.addEventListener("click", getLinks);
    // Always try to bind Stop button (idempotente)
    bindStopButton();
    // If background queue already running, reflect its status so user can stop.
    try {
        chrome.runtime.sendMessage({ type: 'DOWNLOAD_STATUS' }, (stat) => {
            if (!stat) return;
            if (stat.total > 0) {
                const h2 = document.querySelector('h2');
                const stopBtn = document.getElementById('stopDownloads');
                if (stat.stopped) {
                    if (h2) h2.innerHTML = `Stopped at ${stat.completed}/${stat.total}`;
                } else if (stat.completed >= stat.total) {
                    if (h2) h2.innerHTML = 'All downloads started.';
                } else {
                    if (h2) h2.innerHTML = `Downloading ${stat.completed}/${stat.total}`;
                }
                if (stopBtn && !stat.stopped && stat.completed < stat.total) stopBtn.style.display = 'flex';
                // Poll only if still in progress
                if (!stat.stopped && stat.completed < stat.total) {
                    let poll = 0;
                    const poller = setInterval(() => {
                        chrome.runtime.sendMessage({ type: 'DOWNLOAD_STATUS' }, (s2) => {
                            if (!s2) return;
                            if (s2.stopped) {
                                if (h2) h2.innerHTML = `Stopped at ${s2.completed}/${s2.total}`;
                                if (stopBtn) stopBtn.style.display = 'none';
                                clearInterval(poller);
                            } else if (s2.completed >= s2.total) {
                                if (h2) h2.innerHTML = 'All downloads started.';
                                if (stopBtn) stopBtn.style.display = 'none';
                                clearInterval(poller);
                            } else {
                                if (h2) h2.innerHTML = `Downloading ${s2.completed}/${s2.total}`;
                            }
                        });
                        if (++poll > 120) clearInterval(poller);
                    }, 1000);
                }
            }
        });
    } catch (e) { /* ignore */ }
    // Reveal UI after initial status fetch attempt to reduce flicker
    requestAnimationFrame(()=>{ document.body.style.opacity = '1'; });
});

// Idempotent binding of Stop Downloads button (works even if popup reopened mid-download)
function bindStopButton() {
    const stopBtn = document.getElementById('stopDownloads');
    if (!stopBtn) return;
    if (stopBtn.dataset.bound === '1') return; // already bound
    stopBtn.dataset.bound = '1';
    stopBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'STOP_DOWNLOADS' }, () => {
            const h2 = document.querySelector('h2');
            if (h2) h2.innerHTML = 'Downloads stopped.';
            stopBtn.style.display = 'none';
        });
    });
}

// Function executed to run background scripts
function getLinks() {
    // Guard against system pages
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const tab = tabs[0];
        if (!tab) return;
        if (tab.url && tab.url.startsWith('chrome://')) {
            document.querySelector("h2").innerHTML = "This extension can't run on internal browser pages.";
            return;
        }
        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["background.js"] });
    });
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        // already handled above
    });
    document.querySelector("h2").innerHTML = "Please wait while we scroll through the page and extract links!";
    document.getElementById("runScript").style.display = "none";
    document.querySelector(".loadingAni").style.display = "block";
    // Keep cancel hidden with new Stop button approach
    const cancelbox3 = document.querySelector('.cancelBox'); if (cancelbox3) cancelbox3.style.display = 'none';
}

// Open a background tab, inject a script that runs in page context to trigger download, then close
function openTabAndTriggerDownload(originalLink, exportLink, filename) {
    chrome.tabs.create({ url: originalLink, active: false }, function (tab) {
        if (!tab || !tab.id) { console.error('Failed to create tab for', originalLink); return; }
        const tabId = tab.id;
        let downloadStarted = false;

        const closeTab = () => { try { chrome.tabs.remove(tabId); } catch (e) { } };

        const onCreated = (downloadItem) => {
            if (downloadItem && downloadItem.finalUrl) {
                downloadStarted = true;
                try { chrome.downloads.onCreated.removeListener(onCreated); } catch (e) { }
                setTimeout(closeTab, 1200);
            }
        };
        chrome.downloads.onCreated.addListener(onCreated);

        // Wait for tab to finish loading before attempting DOM extraction / clicks
        const onUpdated = function (updatedTabId, changeInfo, t) {
            if (updatedTabId !== tabId) return;
            if (changeInfo.status === 'complete' || (t && t.status === 'complete')) {
                chrome.tabs.onUpdated.removeListener(onUpdated);

                // after load, run extraction & click sequence
                (async () => {
                    try {
                        // attempt to find a direct link in page
                        const directHref = await (async () => {
                            const fn = (exportUrl) => {
                                try {
                                    const selectors = ['a[aria-label*="Download"]','a[data-tooltip*="Download"]','a[href*="drive.google.com/uc"]','a[href*="drive.google.com/file/d/"]','a[download]'];
                                    for (const sel of selectors) { const el = document.querySelector(sel); if (el && el.href) return el.href; }
                                    const link = document.querySelector('link[rel="canonical"]'); if (link && link.href) return link.href;
                                    return exportUrl || null;
                                } catch (e) { return null; }
                            };
                            try {
                                const res = await new Promise(r => chrome.scripting.executeScript({ target: { tabId }, func: fn, args: [exportLink] }, r));
                                return res && res[0] && res[0].result ? res[0].result : null;
                            } catch (e) { return null; }
                        })();

                        if (directHref) {
                            // navigate the tab to directHref so download happens in page context
                            try {
                                chrome.tabs.update(tabId, { url: directHref }, function () { /* navigation started */ });
                                // wait up to 6s for download to start
                                const s = Date.now();
                                while (!downloadStarted && Date.now() - s < 6000) await new Promise(r => setTimeout(r, 300));
                                if (downloadStarted) return closeTab();
                            } catch (e) { /* continue */ }
                        }

                        // try clicking download button
                        const clicked = await new Promise((resolve) => {
                            const fnClick = () => {
                                try {
                                    const btn = document.querySelector('[aria-label*="Download"]') || document.querySelector('[data-tooltip*="Download"]') || document.querySelector('button[aria-label="Download"]');
                                    if (btn) { btn.click(); return true; }
                                    const a = document.querySelector('a[download]'); if (a) { a.click(); return true; }
                                    return false;
                                } catch (e) { return false; }
                            };
                            chrome.scripting.executeScript({ target: { tabId }, func: fnClick }, (res) => { resolve(res && res[0] && res[0].result); });
                        });
                        if (clicked) {
                            const s2 = Date.now();
                            while (!downloadStarted && Date.now() - s2 < 8000) await new Promise(r => setTimeout(r, 300));
                            if (downloadStarted) return closeTab();
                        }

                        // fallback: navigate to exportLink
                        if (exportLink) {
                            chrome.tabs.update(tabId, { url: exportLink }, function () { });
                            const s3 = Date.now();
                            while (!downloadStarted && Date.now() - s3 < 8000) await new Promise(r => setTimeout(r, 300));
                            if (downloadStarted) return closeTab();
                        }

                        // final: make active to prompt any UI and try click again
                        try {
                            chrome.tabs.update(tabId, { active: true }, function () {
                                const fnFinal = () => { try { const b = document.querySelector('[aria-label*="Download"]'); if (b) { b.click(); return true; } return false; } catch (e) { return false; } };
                                chrome.scripting.executeScript({ target: { tabId }, func: fnFinal }, () => setTimeout(() => closeTab(), 5000));
                            });
                        } catch (e) { closeTab(); }
                    } catch (e) { console.error('openTab error', e); closeTab(); }
                    try { chrome.downloads.onCreated.removeListener(onCreated); } catch (e) { }
                })();
            }
        };
        chrome.tabs.onUpdated.addListener(onUpdated);
        // also set a safety timeout
        setTimeout(() => { try { chrome.tabs.onUpdated.removeListener(onUpdated); } catch (e) { } }, 30000);
    });
}



