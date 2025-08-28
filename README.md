# Classroom Bulk Downloader <img src="assets/icon128.png" alt="Extension icon" width="130" align="right" />

![Forks badge](https://img.shields.io/github/forks/SamMed05/Classroom-Bulk-Downloader?color=green&style=for-the-badge)
![Stars badge](https://img.shields.io/github/stars/SamMed05/Classroom-Bulk-Downloader?color=blueviolet&style=for-the-badge)
![License badge](https://img.shields.io/github/license/SamMed05/Classroom-Bulk-Downloader?color=blue&style=for-the-badge)
![Version badge](https://img.shields.io/badge/version-1.5.0-pink.svg?style=for-the-badge)

> Fork notice: this project is a Manifest V3 fork of [StudEaz for Google Classroom](https://github.com/MLSA-SRM/GCR-Extension). All credit for the original concept and implementation goes to the original authors.

Classroom Bulk Downloader lets you download multiple documents from Google Classroom in a few clicks.

## How it works

High‑level flow inside the extension:

1. Link harvesting: When you click Extract Links the popup injects a lightweight in‑page collector (`background.js` – runs in the page context, not the service worker). It auto‑scrolls the Classroom / Drive page for up to ~20s, capturing unique links that look like Google Drive / Docs / Sheets / Slides / Drawings / Forms file URLs, skipping folders and irrelevant pages.
2. Building the list: The harvested titles + hrefs are sent back to the popup script (`content.js`) which builds a selectable checklist. Each row now shows an icon chosen from `assets/` based on an inferred file extension. If a Google file has no visible extension in its title, the script infers and appends the correct one (e.g. `.docx`, `.xlsx`, `.pptx`, `.png`, `.pdf`).
3. Export link generation: For Docs / Sheets / Slides / Drawings / Forms the code converts the viewing URL to an explicit export endpoint (`/export?format=docx|xlsx|pptx|png|pdf`). Generic Drive files use the direct download (`uc?export=download&id=...`).
4. Queued downloads: The popup sends a batch of items to the Manifest V3 service worker (`worker.js`). The worker serially (1 at a time) calls `chrome.downloads.download` with the prepared URL + sanitized filename. Progress / status is polled by the popup while it is open; downloads continue even if the popup is closed.
5. Stop control: A Stop button can clear the remaining queue and attempt to cancel any active download.

No external servers, background pages, or persistent DOM pages are used.

## Current limitations & practical workarounds

### 1. “Save As” / confirmation prompts for every file

If Chrome (or Edge) is set to “Ask where to save each file before downloading,” you will still be prompted for every file, which is cumbersome but I couldn't find a way to turn off it.

One option is temporarily disable that setting: Chrome: Settings > Downloads > disable “Ask where to save each file before downloading”.

#### (Optional hack) Auto‑press Enter to confirm each dialog

If you cannot or do not wish to change the browser setting and are on a system where an automation script is acceptable, you can use a tiny Python utility to press Enter periodically (accepting each Save dialog). Stop it with Ctrl+C.

Steps:

1. Install Python if needed.
2. Install dependency:

    ```bash
    pip install pyautogui
    ```

3. Run (e.g. `python auto_enter.py`) with the following content:

    ```python
    import pyautogui, time

    print("Auto-Enter helper running. Press Ctrl+C to stop.")
    try:
        while True:
            pyautogui.press("enter")
            print("Pressed Enter")
            time.sleep(10)  # adjust interval (seconds)
    except KeyboardInterrupt:
        print("Stopped.")
    ```

### 2. Automatic zipping of all selected files

“Just give me a single ZIP” feature is not feasible purely client‑side because:

* Google export endpoints stream the file data; bundling them requires collecting all bytes locally, then constructing a ZIP blob (possible) BUT large classroom batches can exceed memory and still require each file to finish before delivering the ZIP—negating the incremental nature of the current approach.
* Creating a seamless multi‑file -> single ZIP without saving intermediary files would still need to fetch every file via `fetch()` (CORS / auth restricted) or use the Drive REST API (needs OAuth consent) and then assemble a ZIP. This adds significant complexity (tokens, refresh handling, API quotas).

If you know a solution, contributions are welcome, of course!

### 3. Only grabs links visible on the main course stream

This extension does not open assignment detail pages or traverse folders: only file links already rendered in the scrolled stream are collected. Folder links are captured, not their contents. If you also need to download hidden filesm open the assignment or folder first so the links appear, then run Extract Links again.

---

## Usage

1. In a Google Classroom, click the extension icon in the browser toolbar.
2. Click Extract Links.
3. Select the files you want using the checkboxes (use Select All if needed).
4. Click Download Files. The selected files will download to your default downloads folder.

Screenshots (legacy):

![Extract links screenshot](https://i.ibb.co/8jzZWSX/1.png)
![Download files screenshot](https://i.ibb.co/vvzySYJ/3.png)

## Installation (from source code)

1. Clone this repository:

    ```bash
        git clone https://github.com/SamMed05/Classroom-Bulk-Downloader
    ```

2. Enable Developer Mode in your browser:

    * Chrome: chrome://extensions
    * Edge: edge://extensions
    * Firefox: about:addons (use a MV2-compatible fork or Firefox-specific adaptation; MV3 support still evolving)
3. Click Load Unpacked (Chrome/Edge) and select the project folder.
4. The extension should appear in your toolbar.

## Fork Maintenance

This fork updates the codebase to Manifest V3 (Chrome requirement) and simplifies script injection using the `chrome.scripting` API. Further enhancements welcome via pull requests.

See the Limitations section above before opening feature requests about zipping or skipping Save dialogs—context there may answer your question.
