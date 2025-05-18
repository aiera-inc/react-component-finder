// background.js
chrome.action.onClicked.addListener(tab => {
    // Toggle the active state of the extension
    chrome.tabs.sendMessage(tab.id, { action: "toggle" });
});
