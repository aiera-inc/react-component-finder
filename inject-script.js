(function () {
    // Helper function to find React instance
    function findReact() {
        let reactInstance = null;

        // Look for React DevTools global hook
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            // Get the first React root
            const roots = Array.from(window.__REACT_DEVTOOLS_GLOBAL_HOOK__.getFiberRoots(1));
            if (roots.length > 0) {
                reactInstance = roots[0];
            }
        }

        return reactInstance;
    }

    // Find component info for a DOM element
    function getComponentForElement(element) {
        if (!element) return null;

        const reactRoot = findReact();
        if (!reactRoot) {
            console.warn("React Finder: Could not find React DevTools hook");
            return null;
        }

        // Walk the fiber tree to find the component
        let node = reactRoot.current;
        let found = false;

        function searchNode(fiber) {
            if (!fiber) return false;

            // Check if this fiber's DOM node matches our element
            if (fiber.stateNode === element) {
                found = true;
                node = fiber;
                return true;
            }

            // Search child
            if (fiber.child && searchNode(fiber.child)) return true;

            // Search sibling
            if (fiber.sibling && searchNode(fiber.sibling)) return true;

            return false;
        }

        searchNode(node);

        if (!found) {
            // Try alternative ways to find components
            // Check parents until we find a React component
            let currentElem = element;
            let attempts = 0;
            const MAX_ATTEMPTS = 10;

            while (currentElem && attempts < MAX_ATTEMPTS) {
                found = false;
                searchNode(node);
                if (found) break;

                currentElem = currentElem.parentElement;
                attempts++;
            }
        }

        if (!found) {
            console.warn("React Finder: Could not find component for element", element);
            return null;
        }

        // Get component info
        const componentName = node.type ? node.type.displayName || node.type.name || "Unknown" : "Unknown";

        // Sanitize props to avoid cloning errors
        const rawProps = node.memoizedProps || {};
        const sanitizedProps = {};

        // Only include serializable props
        Object.keys(rawProps).forEach(key => {
            try {
                // Skip React elements and functions
                const propValue = rawProps[key];
                const type = typeof propValue;

                if (type === "string" || type === "number" || type === "boolean") {
                    sanitizedProps[key] = propValue;
                } else if (type === "object" && propValue !== null && !React.isValidElement(propValue)) {
                    // Try to stringify and parse to check if serializable
                    sanitizedProps[key] = JSON.parse(JSON.stringify(propValue));
                }
            } catch (e) {
                // If it can't be stringified, skip it
            }
        });

        // Try to get source information
        let fileName = "";

        // Look for _source field which contains file information
        if (node.type && node._debugSource) {
            fileName = node._debugSource.fileName || "";
        } else if (node._debugOwner && node._debugOwner._debugSource) {
            fileName = node._debugOwner._debugSource.fileName || "";
        }

        console.log("React Finder: Found component", {
            name: componentName,
            props: sanitizedProps,
            fileName: fileName,
        });

        return {
            name: componentName,
            props: sanitizedProps,
            fileName: fileName,
        };
    }

    // Listen for messages from content script
    window.addEventListener("message", event => {
        if (event.source !== window) return;

        if (event.data.type === "REACT_FINDER_GET_COMPONENT") {
            const tempId = event.data.tempId;
            const element = document.getElementById(tempId);

            if (!element) {
                console.warn("React Finder: Could not find element with temp ID", tempId);
                return;
            }

            const componentInfo = getComponentForElement(element);

            window.postMessage(
                {
                    type: "REACT_FINDER_COMPONENT_INFO",
                    info: componentInfo,
                },
                "*"
            );
        } else if (event.data.type === "REACT_FINDER_GET_COMPONENT_PATH") {
            const tempId = event.data.tempId;
            const element = document.getElementById(tempId);

            if (!element) {
                console.warn("React Finder: Could not find element with temp ID", tempId);
                return;
            }

            console.log("React Finder: Looking for component path for element", element);
            const componentInfo = getComponentForElement(element);

            window.postMessage(
                {
                    type: "REACT_FINDER_COMPONENT_PATH",
                    info: componentInfo,
                },
                "*"
            );
        }
    });

    console.log("React Component Finder initialized");
})();
