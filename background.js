// Initialize storage with default settings if not present
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['settings', 'tasks'], (result) => {
        if (!result.settings) {
            chrome.storage.local.set({
                settings: {
                    focus: 25,
                    break: 5,
                    cycles: 4
                }
            });
        }
        if (!result.tasks) {
            chrome.storage.local.set({
                tasks: []
            });
        }
    });
});

// Handle alarms for timer completion
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'pomodoroTimer') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Pomodoro Timer',
            message: 'Time is up! Take a break.',
            priority: 2
        });
    }
});
