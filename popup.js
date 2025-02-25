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
        
        // Load settings
        chrome.storage.local.get(['settings'], (result) => {
            if (result.settings) {
                settings.focus = result.settings.focus;
                settings.break = result.settings.break;
                totalCycles = result.settings.cycles;
                
                document.getElementById('focusTime').value = settings.focus;
                document.getElementById('breakTime').value = settings.break;
                document.getElementById('cycleCount').value = totalCycles;
                
                // Initialize timer with loaded settings
                timeLeft = settings.focus * 60;
                timeLimit = timeLeft;
                updateTimerDisplay();
            }
        });

        // Load tasks
        chrome.storage.local.get(['tasks'], (result) => {
            if (result.tasks) {
                renderTasks(result.tasks);
            }
        });
        
        // Initialize timer circle
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

const handlePhaseComplete = () => {
    // Play notification sound
    document.getElementById('notificationSound').play().catch(console.error);
    
    // Show notification
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Pomodoro Timer',
        message: `${currentPhase.charAt(0).toUpperCase() + currentPhase.slice(1)} phase completed!`
    });
    
    // Record completed session in storage
    const now = new Date();
    chrome.storage.local.get(['sessions'], (result) => {
        const sessions = result.sessions || [];
        sessions.push({
            type: currentPhase,
            duration: settings[currentPhase],
            completedAt: now.toISOString(),
            date: now.toISOString().split('T')[0]
        });
        chrome.storage.local.set({ sessions });
    });
    
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
const saveSettings = () => {
    const focusTime = parseInt(document.getElementById('focusTime').value);
    const breakTime = parseInt(document.getElementById('breakTime').value);
    const cycles = parseInt(document.getElementById('cycleCount').value);
    
    if (focusTime && breakTime && cycles) {
        const newSettings = {
            focus: focusTime,
            break: breakTime,
            cycles: cycles
        };
        
        chrome.storage.local.set({ settings: newSettings }, () => {
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
        });
    } else {
        alert('Please enter valid numbers for all settings.');
    }
};

// Task management
const addTask = () => {
    const input = document.getElementById('taskInput');
    const taskText = input.value.trim();
    
    if (taskText) {
        chrome.storage.local.get(['tasks'], (result) => {
            const tasks = result.tasks || [];
            const newTask = {
                id: Date.now(),
                text: taskText,
                completed: false,
                createdAt: new Date().toISOString()
            };
            tasks.push(newTask);
            
            chrome.storage.local.set({ tasks }, () => {
                renderTasks(tasks);
                input.value = '';
            });
        });
    }
};

const toggleTask = (id) => {
    chrome.storage.local.get(['tasks'], (result) => {
        const tasks = result.tasks || [];
        const taskIndex = tasks.findIndex(t => t.id === id);
        if (taskIndex !== -1) {
            tasks[taskIndex].completed = !tasks[taskIndex].completed;
            chrome.storage.local.set({ tasks }, () => {
                renderTasks(tasks);
            });
        }
    });
};

const deleteTask = (id) => {
    chrome.storage.local.get(['tasks'], (result) => {
        const tasks = result.tasks || [];
        const filteredTasks = tasks.filter(t => t.id !== id);
        chrome.storage.local.set({ tasks: filteredTasks }, () => {
            renderTasks(filteredTasks);
        });
    });
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
