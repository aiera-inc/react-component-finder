let isActive = false;
let highlightedElement = null;
let overlay = null;
let componentInfoPanel = null;
let rootPath = "";

// Create and inject our React finder script
function injectReactFinder() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("inject-script.js");
    script.onload = function () {
        this.remove();
        console.log("React Component Finder: Script injected successfully");
    };
    script.onerror = function (error) {
        console.error("React Component Finder: Failed to load inject script", error);
    };
    (document.head || document.documentElement).appendChild(script);
}

// Create the overlay for highlighting components
function createOverlay() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.id = "react-finder-overlay";
    overlay.style.display = "none";
    document.body.appendChild(overlay);

    componentInfoPanel = document.createElement("div");
    componentInfoPanel.id = "react-finder-info";
    componentInfoPanel.style.display = "none";
    document.body.appendChild(componentInfoPanel);
}

// Handle mouseover events to highlight components
function handleMouseOver(event) {
    if (!isActive) return;

    const target = event.target;
    if (target === highlightedElement) return;

    highlightedElement = target;

    // Position the overlay
    const rect = target.getBoundingClientRect();
    overlay.style.top = `${rect.top + window.scrollY}px`;
    overlay.style.left = `${rect.left + window.scrollX}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.display = "block";

    // Generate a temporary unique ID to reference this element
    const tempId = "react-finder-hover-" + Date.now();

    // Store the original ID to restore it later
    const originalId = target.id;

    // Set the temporary ID on the element
    target.id = tempId;

    // Get component info
    window.postMessage({ type: "REACT_FINDER_GET_COMPONENT", tempId: tempId }, "*");

    // Restore the original ID after a short delay
    setTimeout(() => {
        if (originalId) {
            target.id = originalId;
        } else {
            target.removeAttribute("id");
        }
    }, 100);
}

// Handle click events to open component in VS Code
function handleClick(event) {
    if (!isActive) return;

    // Only proceed if Control/Command key is pressed
    if (!(event.ctrlKey || event.metaKey)) return;

    event.preventDefault();
    console.log("React Finder: Component clicked with Ctrl/Cmd key");

    // Get the target element (either highlighted or directly clicked)
    const targetElement = highlightedElement || event.target;

    // Log for debugging
    console.log("Target element:", targetElement);

    // Generate a temporary unique ID to reference this element
    const tempId = "react-finder-temp-" + Date.now();

    // Store the original ID to restore it later
    const originalId = targetElement.id;

    // Set the temporary ID on the element
    targetElement.id = tempId;

    // Get the component information and open in VS Code using the temp ID
    window.postMessage(
        {
            type: "REACT_FINDER_GET_COMPONENT_PATH",
            tempId: tempId,
        },
        "*"
    );

    // Restore the original ID after a short delay
    setTimeout(() => {
        if (originalId) {
            targetElement.id = originalId;
        } else {
            targetElement.removeAttribute("id");
        }
    }, 100);
}

// Message handler
function handleMessage(message) {
    if (message.action === "toggle") {
        isActive = !isActive;

        if (isActive) {
            document.addEventListener("mouseover", handleMouseOver);
            document.addEventListener("click", handleClick);
            overlay.style.display = "block";

            // Ask for the project root path
            const path = prompt(
                "Enter your project root path (absolute path to your React project):",
                localStorage.getItem("reactFinderRootPath") || ""
            );

            if (path) {
                rootPath = path;
                localStorage.setItem("reactFinderRootPath", path);
            } else {
                isActive = false;
                return;
            }

            // Notify that the finder is active
            const notification = document.createElement("div");
            notification.id = "react-finder-notification";
            notification.textContent =
                "React Component Finder is active. Ctrl+Click (or Cmd+Click) on a component to open it in VS Code.";
            document.body.appendChild(notification);
            setTimeout(() => {
                notification.style.opacity = "0";
                setTimeout(() => notification.remove(), 500);
            }, 3000);
        } else {
            document.removeEventListener("mouseover", handleMouseOver);
            document.removeEventListener("click", handleClick);
            overlay.style.display = "none";
            componentInfoPanel.style.display = "none";

            if (document.getElementById("react-finder-notification")) {
                document.getElementById("react-finder-notification").remove();
            }
        }
    }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(handleMessage);

// Listen for messages from the injected script
window.addEventListener("message", event => {
    if (event.source !== window) return;

    if (event.data.type === "REACT_FINDER_COMPONENT_INFO") {
        const info = event.data.info;

        if (info && componentInfoPanel) {
            componentInfoPanel.innerHTML = `
        <div class="component-name">${info.name || "Unknown"}</div>
        <div class="component-props">${JSON.stringify(info.props || {})}</div>
      `;
            componentInfoPanel.style.display = "block";

            // Position the info panel
            const rect = overlay.getBoundingClientRect();
            componentInfoPanel.style.top = `${rect.bottom + window.scrollY + 5}px`;
            componentInfoPanel.style.left = `${rect.left + window.scrollX}px`;
        }
    } else if (event.data.type === "REACT_FINDER_COMPONENT_PATH") {
        const componentInfo = event.data.info;
        console.log("Received component path info:", componentInfo);

        if (componentInfo && componentInfo.fileName) {
            // Construct the file path
            let filePath = componentInfo.fileName;

            // If it's a relative path and we have a root path, make it absolute
            if (!filePath.startsWith("/") && rootPath) {
                // Handle different path formats
                if (filePath.startsWith("./")) {
                    filePath = filePath.substring(2);
                }

                filePath = `${rootPath}/${filePath}`.replace(/\/\//g, "/");
            }

            console.log("Opening file in VS Code:", filePath);

            // Open in VS Code - use encodeURI for proper handling of spaces and special chars
            window.open(`vscode://file/${encodeURIComponent(filePath)}`);
        } else {
            console.warn("Could not determine component file path");
            alert(
                "Could not determine the file path for this component. Make sure React DevTools are installed and the component has source mapping."
            );
        }
    }
});

// Initialize
createOverlay();
injectReactFinder();
