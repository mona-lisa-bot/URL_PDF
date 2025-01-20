// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.message) {
        // Get values
        case 'viewport_width':
            sendResponse(getViewportWidth());
            break;
        case 'viewport_height':
            sendResponse(getViewportHeight());
            break;
        case 'page_height':
            sendResponse(getPageHeight());
            break;
        case 'device_pixel_ratio':
            sendResponse(window.devicePixelRatio);
            break;
        case 'initial_scroll_position':
            sendResponse([window.scrollX, window.scrollY]);
            break;
        // Actions
        case 'scroll_to_position': {
            const [x, y] = request.data;
            window.scrollTo(x, y);
            sendResponse('scrolled');
            break;
        }
        case 'scroll_to_top':
            window.scrollTo(0, 0);
            sendResponse('scrolled');
            break;
        case 'scroll_down':
            if (isAtBottom()) {
                sendResponse('at_bottom');
                break;
            }
            if (request.data === 'viewport') {
                window.scrollBy(0, getViewportHeight());
            } else {
                window.scrollBy(0, request.data);
            }
            sendResponse('scrolled');
            break;
        case 'hide_scrollbar': {
            const styleElement = document.createElement('style');
            styleElement.id = 'hide_scrollbar';
            styleElement.innerHTML = 'body::-webkit-scrollbar {display: none;}';
            document.body.appendChild(styleElement);
            sendResponse('style_added');
            break;
        }
        case 'unhide_scrollbar':
            document.querySelector('style#hide_scrollbar')?.remove();
            sendResponse('style_removed');
            break;
        default:
            sendResponse('unknown message');
    }
    return true; // Required for async response
});

function isAtBottom() {
    const vh = getViewportHeight();
    const pageHeight = getPageHeight();
    return vh + window.scrollY >= pageHeight;
}

function getViewportHeight() {
    return window.innerHeight;
}

function getViewportWidth() {
    return window.innerWidth;
}

function getPageWidth() {
    return Math.max(
        document.body.scrollWidth,
        document.documentElement.scrollWidth,
        document.body.offsetWidth,
        document.documentElement.offsetWidth,
        document.documentElement.clientWidth
    );
}

function getPageHeight() {
    return Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.documentElement.clientHeight
    );
}