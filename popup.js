// API configuration
const API_BASE_URL = chrome.runtime.getURL('');

// Timer state
let timeLeft;
let timerInterval;
let currentPhase = 'focus';
let cyclesCompleted = 0;
let totalCycles = 4;
let isPaused = true;

// Timer settings (in minutes)
const settings = {
    focus: 25,
    break: 5
};

// Timer circle animation
const FULL_DASH_ARRAY = 283;
let timePassed = 0;
let timeLimit = settings.focus * 60;

// API functions
async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Timer circle functions
function setCircleDasharray() {
    const circleDasharray = `${(
        ((timeLimit - timePassed) / timeLimit) * FULL_DASH_ARRAY
    ).toFixed(0)} 283`;
    document.querySelector(".timer-path-remaining").setAttribute("stroke-dasharray", circleDasharray);
}

function initializeTimerCircle() {
    const pathRemaining = document.querySelector(".timer-path-remaining");
    pathRemaining.setAttribute("stroke-dasharray", "283");
    pathRemaining.setAttribute("stroke-dashoffset", "0");
}

// Load saved tasks and initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Request notification permission
        if (Notification.permission !== 'granted') {
            await Notification.requestPermission();
        }
        
        // Load tasks
        const tasks = await fetchAPI('/tasks');
        renderTasks(tasks);
        
        // Load settings
        const savedSettings = await fetchAPI('/settings');
        if (savedSettings) {
            settings.focus = savedSettings.focus;
            settings.break = savedSettings.break;
            totalCycles = savedSettings.cycles;
            
            document.getElementById('focusTime').value = settings.focus;
            document.getElementById('breakTime').value = settings.break;
            document.getElementById('cycleCount').value = totalCycles;
        }
        
        // Initialize timer
        timeLeft = settings.focus * 60;
        timeLimit = timeLeft;
        updateTimerDisplay();
        initializeTimerCircle();
        
        // Initialize phase buttons
        document.querySelectorAll('.phase-btn').forEach(btn => {
            btn.addEventListener('click', () => switchPhase(btn.dataset.phase));
        });
    } catch (error) {
        console.error('Error initializing app:', error);
    }
});

// Timer functions
const startTimer = () => {
    if (isPaused) {
        isPaused = false;
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('pauseBtn').style.display = 'inline-block';
        
        timerInterval = setInterval(() => {
            timeLeft--;
            timePassed = timeLimit - timeLeft;
            updateTimerDisplay();
            setCircleDasharray();
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                handlePhaseComplete();
            }
        }, 1000);
    }
};

const pauseTimer = () => {
    if (!isPaused) {
        isPaused = true;
        clearInterval(timerInterval);
        timerInterval = null;
        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('pauseBtn').style.display = 'none';
    }
};

const resetTimer = () => {
    clearInterval(timerInterval);
    timerInterval = null;
    isPaused = true;
    document.getElementById('startBtn').style.display = 'inline-block';
    document.getElementById('pauseBtn').style.display = 'none';
    timeLeft = settings[currentPhase] * 60;
    timeLimit = timeLeft;
    timePassed = 0;
    updateTimerDisplay();
    initializeTimerCircle();
};

const updateTimerDisplay = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('timer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const switchPhase = (phase) => {
    currentPhase = phase;
    timeLeft = settings[phase] * 60;
    timeLimit = timeLeft;
    timePassed = 0;
    updateTimerDisplay();
    initializeTimerCircle();
    
    // Update active button
    document.querySelectorAll('.phase-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.phase === phase);
    });
    
    // Reset timer state
    clearInterval(timerInterval);
    timerInterval = null;
    isPaused = true;
    document.getElementById('startBtn').style.display = 'inline-block';
    document.getElementById('pauseBtn').style.display = 'none';
};

const handlePhaseComplete = async () => {
    // Play notification sound
    document.getElementById('notificationSound').play().catch(console.error);
    
    // Show notification
    if (Notification.permission === 'granted') {
        new Notification('Pomodoro Timer', {
            body: `${currentPhase.charAt(0).toUpperCase() + currentPhase.slice(1)} phase completed!`,
            icon: 'icons/icon128.png'
        });
    }
    
    // Record completed session
    try {
        await fetchAPI('/sessions', {
            method: 'POST',
            body: JSON.stringify({
                type: currentPhase,
                duration: settings[currentPhase]
            })
        });
    } catch (error) {
        console.error('Error saving session:', error);
    }
    
    if (currentPhase === 'focus') {
        cyclesCompleted++;
        if (cyclesCompleted >= totalCycles) {
            cyclesCompleted = 0;
            alert('All cycles completed! Take a longer break.');
            switchPhase('focus');
        } else {
            switchPhase('break');
        }
    } else {
        switchPhase('focus');
    }
};

// Settings management
const saveSettings = async () => {
    const focusTime = parseInt(document.getElementById('focusTime').value);
    const breakTime = parseInt(document.getElementById('breakTime').value);
    const cycles = parseInt(document.getElementById('cycleCount').value);
    
    if (focusTime && breakTime && cycles) {
        try {
            await fetchAPI('/settings', {
                method: 'POST',
                body: JSON.stringify({
                    focus: focusTime,
                    break: breakTime,
                    cycles: cycles
                })
            });
            
            settings.focus = focusTime;
            settings.break = breakTime;
            totalCycles = cycles;
            
            // Reset timer with new settings
            cyclesCompleted = 0;
            timeLeft = settings[currentPhase] * 60;
            timeLimit = timeLeft;
            timePassed = 0;
            updateTimerDisplay();
            initializeTimerCircle();
            
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error saving settings. Please try again.');
        }
    } else {
        alert('Please enter valid numbers for all settings.');
    }
};

// Task management
const addTask = async () => {
    const input = document.getElementById('taskInput');
    const taskText = input.value.trim();
    
    if (taskText) {
        try {
            await fetchAPI('/tasks', {
                method: 'POST',
                body: JSON.stringify({ text: taskText })
            });
            const tasks = await fetchAPI('/tasks');
            renderTasks(tasks);
            input.value = '';
        } catch (error) {
            console.error('Error adding task:', error);
            alert('Error adding task. Please try again.');
        }
    }
};

const toggleTask = async (id) => {
    try {
        const tasks = await fetchAPI('/tasks');
        const task = tasks.find(t => t.id === id);
        await fetchAPI(`/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ completed: !task.completed })
        });
        const updatedTasks = await fetchAPI('/tasks');
        renderTasks(updatedTasks);
    } catch (error) {
        console.error('Error toggling task:', error);
    }
};

const deleteTask = async (id) => {
    try {
        await fetchAPI(`/tasks/${id}`, { method: 'DELETE' });
        const tasks = await fetchAPI('/tasks');
        renderTasks(tasks);
    } catch (error) {
        console.error('Error deleting task:', error);
    }
};

const renderTasks = (tasks) => {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    
    tasks.forEach((task) => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.onclick = () => toggleTask(task.id);
        
        const span = document.createElement('span');
        span.textContent = task.text;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => deleteTask(task.id);
        
        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(deleteBtn);
        taskList.appendChild(li);
    });
};

// Event listeners
document.getElementById('startBtn').addEventListener('click', startTimer);
document.getElementById('pauseBtn').addEventListener('click', pauseTimer);
document.getElementById('resetBtn').addEventListener('click', resetTimer);
document.getElementById('addTask').addEventListener('click', addTask);
document.getElementById('saveSettings').addEventListener('click', saveSettings);

// Allow Enter key to add tasks
document.getElementById('taskInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTask();
    }
});
