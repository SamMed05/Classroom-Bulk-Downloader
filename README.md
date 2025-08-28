# Classroom Bulk Downloader <img src="assets/icon48.png" alt="Extension icon" width="130" align="right" />

![Forks badge](https://img.shields.io/github/forks/SamMed05/Classroom-Bulk-Downloader?color=green&style=for-the-badge)
![Stars badge](https://img.shields.io/github/stars/SamMed05/Classroom-Bulk-Downloader?color=blueviolet&style=for-the-badge)
![License badge](https://img.shields.io/github/license/SamMed05/Classroom-Bulk-Downloader?color=blue&style=for-the-badge)
![Version badge](https://img.shields.io/badge/version-1.4.0-pink.svg?style=for-the-badge)

> Fork notice: this project is a Manifest V3 fork of [StudEaz for Google Classroom](https://github.com/MLSA-SRM/GCR-Extension). All credit for the original concept and implementation goes to the original authors.

Classroom Bulk Downloader lets you download multiple documents from Google Classroom in a few clicks.

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
