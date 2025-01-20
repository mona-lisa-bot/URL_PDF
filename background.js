chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'start_conversion') {
        const tab = message.tab;
        main(tab).then(() => {
            sendResponse({status: 'complete'});
        }).catch(error => {
            sendResponse({status: 'error', error: error.message});
        });
        return true; // Will respond asynchronously
    }
});

// Constants
const marginTop = 150;
const marginBottom = 50;

// Main process handler
chrome.action.onClicked.addListener(async (tab) => {
    try {
        await main(tab);
    } catch (error) {
        console.error('Error in main process:', error);
    }
});

async function main(tab) {
    // Get initial measurements
    const initialScrollPosition = await sendToContentJS('initial_scroll_position');
    const vh = await sendToContentJS('viewport_height');
    const pageHeight = await sendToContentJS('page_height');
    const devicePixelRatio = await sendToContentJS('device_pixel_ratio');
    const scrollAmount = vh - marginTop - marginBottom;

    // Hide scrollbar
    await sendToContentJS('hide_scrollbar');

    // Screenshot array
    const screenshots = [];

    // Screenshot loop function
    const screenshotLoop = async (response) => {
        if (response === 'scrolled') {
            await new Promise(resolve => setTimeout(resolve, 40)); // Modern sleep
            const imgData = await takeScreenshot();
            screenshots.push(imgData);
            const scrollResponse = await sendToContentJS('scroll_down', scrollAmount);
            return screenshotLoop(scrollResponse);
        } else if (response === 'at_bottom') {
            await sendToContentJS('unhide_scrollbar');
            await sendToContentJS('scroll_to_position', initialScrollPosition);
            return screenshots;
        }
    };

    // Execute screenshot process
    await sendToContentJS('scroll_to_top')
        .then(screenshotLoop)
        .then(imgDatas => trimImgs(imgDatas, pageHeight, vh))
        .then(sliceImgs)
        .then(concatImgs)
        .then(printHtml);
}

// Helper functions
async function sendToContentJS(message, data = '') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return chrome.tabs.sendMessage(tab.id, { message, data });
}

async function takeScreenshot() {
    return chrome.tabs.captureVisibleTab();
}

// Image processing functions
async function concatImgs(imgs = []) {
    return imgs
        .map(dataURI => `<img src="${dataURI}" width="100%">`)
        .join('\n');
}

async function sliceImgs(imgs = []) {
    const promisedSlices = imgs.map(img => slice(img));
    const slicedImgs = (await Promise.all(promisedSlices))
        .flat()
        .map(obj => obj.dataURI);
    return slicedImgs;
}

async function slice(imgDataURI) {
    return new Promise((resolve, reject) => {
        const imgObj = new Image();
        imgObj.src = imgDataURI;
        imgObj.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const halfHeight = imgObj.height / 2;
            
            // Create two slices
            const slices = [];
            for (let i = 0; i < 2; i++) {
                canvas.height = halfHeight;
                canvas.width = imgObj.width;
                ctx.drawImage(
                    imgObj,
                    0, i * halfHeight, imgObj.width, halfHeight,
                    0, 0, imgObj.width, halfHeight
                );
                slices.push({ dataURI: canvas.toDataURL() });
            }
            resolve(slices);
        };
    });
}

async function trimImgs(imgs = [], pageHeight, viewportHeight) {
    const devicePixelRatio = window.devicePixelRatio;

    if (imgs.length <= 1) return imgs;

    const promisedTrims = [];

    // Middle images
    imgs.slice(1, -1).forEach(img => {
        promisedTrims.push(trim(img, { top: marginTop, bottom: marginBottom }, devicePixelRatio));
    });

    // First image (don't trim top)
    promisedTrims.unshift(trim(imgs[0], { bottom: marginBottom }, devicePixelRatio));

    // Last image (special handling)
    const trimmedPageHeight = pageHeight - marginTop - marginBottom;
    const trimmedViewportHeight = viewportHeight - marginTop - marginBottom;
    const lastImgOverlap = trimmedViewportHeight - (trimmedPageHeight % trimmedViewportHeight);
    promisedTrims.push(trim(imgs[imgs.length - 1], { top: marginTop + lastImgOverlap }, devicePixelRatio));

    return Promise.all(promisedTrims);
}

async function trim(dataURI, { top = 0, bottom = 0, left = 0, right = 0 } = {}, devicePixelRatio = 1) {
    top *= devicePixelRatio;
    bottom *= devicePixelRatio;
    left *= devicePixelRatio;
    right *= devicePixelRatio;

    return new Promise((resolve, reject) => {
        const inputImage = new Image();
        const canvas = document.createElement('canvas');
        inputImage.src = dataURI;

        inputImage.onload = () => {
            canvas.height = inputImage.height - top - bottom;
            canvas.width = inputImage.width - left - right;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(inputImage, -left, -top);
            resolve(canvas.toDataURL());
        };
    });
}

function printHtml(imgsHtml) {
    const w = window.open('', 'imgWindow', 'width=580,height=460');
    w.document.write(imgsHtml);
    w.document.write('<style>body { margin: 0; }</style>');
    w.focus();
    setTimeout(() => {
        w.print();
        w.close();
    }, 100);
}