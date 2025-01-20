// popup.js
// popup.js
document.addEventListener('DOMContentLoaded', function() {
    const convertButton = document.getElementById('convertBtn');
    
    convertButton.addEventListener('click', async function() {
        try {
            // Disable button and show loading state
            convertButton.disabled = true;
            convertButton.textContent = 'Converting...';
            
            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Send message to background script
            const response = await chrome.runtime.sendMessage({
                action: 'start_conversion',
                tab: tab
            });
            
            if (response.status === 'complete') {
                convertButton.textContent = 'Conversion Complete';
                setTimeout(() => {
                    window.close();
                }, 1000);
            } else {
                throw new Error(response.error || 'Conversion failed');
            }
            
        } catch (error) {
            console.error('Error:', error);
            convertButton.textContent = 'Error! Try again';
            convertButton.disabled = false;
        }
    });
});