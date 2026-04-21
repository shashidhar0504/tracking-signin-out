import './style.css';
import {
    supabase, hasSupabaseConfig, saveSupabaseConfig, getSupabaseConfig, initSupabase,
    loadCurrentUser, setCurrentUser, hashPassword
} from './db.js';

const app = document.getElementById('app');
let activeTimerInterval = null;
let currentView = 'tasks'; // tasks, activity, history, team

// --- INIT & ROUTER ---
const renderApp = async () => {
    if (!hasSupabaseConfig()) {
        renderSetup();
        return;
    }
    
    // Init supabase
    const config = getSupabaseConfig();
    try {
        if (!supabase) initSupabase(config.url, config.key);
    } catch(e) {
        renderSetup(true);
        return;
    }

    const user = loadCurrentUser();
    if (!user) {
        await renderLogin();
        return;
    }

    renderMainApp(user);
};

// --- SETUP VIEW ---
const renderSetup = (hasError = false) => {
    app.innerHTML = `
        <div class="fullscreen-view">
            <div class="setup-card">
                <h1>Initial Setup</h1>
                <p>Welcome! Please connect your Supabase database to continue. This application requires a fully functional database backend.</p>
                ${hasError ? `<p style="color:red; margin-bottom: 1rem;">Failed to initialize. Check your URL/Key.</p>` : ''}
                <div class="input-group">
                    <label>Supabase Project URL</label>
                    <input type="text" id="sb-url" placeholder="https://xyzcompany.supabase.co" />
                </div>
                <div class="input-group">
                    <label>Supabase Anon Key</label>
                    <input type="password" id="sb-key" placeholder="eyJhbG..." />
                </div>
                <button class="primary-btn" id="save-setup">Connect Database</button>
            </div>
        </div>
    `;

    document.getElementById('save-setup').addEventListener('click', () => {
        const url = document.getElementById('sb-url').value.trim();
        const key = document.getElementById('sb-key').value.trim();
        if (url && key) {
            saveSupabaseConfig(url, key);
            renderApp();
        } else {
            alert('Both fields are required');
        }
    });
};

// --- LOGIN VIEW ---
const renderLogin = async () => {
    app.innerHTML = `
        <div class="fullscreen-view">
            <div style="text-align:center; margin-bottom:2.5rem;">
                <div style="display:inline-flex; align-items:center; gap:0.75rem; margin-bottom:0.75rem;">
                    <div style="width:36px;height:36px;border-radius:8px;background:var(--smart-blue);display:flex;align-items:center;justify-content:center;">
                        <svg width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
                    </div>
                    <span style="font-size:1.1rem;font-weight:700;color:var(--prussian-blue-2);letter-spacing:-0.3px;">Time Tracker</span>
                </div>
                <h2 style="color:var(--prussian-blue-2); font-size:1.75rem; font-weight:700;">Select Your Profile</h2>
                <p style="color:var(--text-muted); margin-top:0.5rem; font-size:0.9rem;">Click your name to sign in and start tracking</p>
            </div>
            <div class="profiles-grid" id="profiles-container">
                <div style="grid-column:span 2; text-align:center; padding:2rem; color:var(--text-muted);">
                    <div style="width:36px;height:36px;border:3px solid var(--smart-blue);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 1rem;"></div>
                    Loading profiles...
                </div>
            </div>
        </div>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;

    try {
        const { data: users, error } = await supabase.from('users').select('*').order('name');
        if (error) throw error;

        const container = document.getElementById('profiles-container');

        if (!users || users.length === 0) {
            container.innerHTML = `
                <div style="grid-column:span 2; text-align:center; padding:2rem;">
                    <div style="font-size:2.5rem; margin-bottom:1rem;">⚠️</div>
                    <h3 style="color:var(--prussian-blue-2); margin-bottom:0.5rem;">No Profiles Found</h3>
                    <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1.5rem;">
                        Your database is connected but has no users yet.<br/>
                        Please run the <strong>schema.sql</strong> file in your Supabase SQL Editor.
                    </p>
                    <a href="https://supabase.com/dashboard" target="_blank" 
                       style="display:inline-block; background:var(--smart-blue); color:white; padding:0.75rem 1.5rem; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.9rem;">
                        Open Supabase Dashboard →
                    </a>
                </div>
            `;
            return;
        }

        container.innerHTML = users.map(u => `
            <div class="profile-card ${u.role === 'Client' ? 'client' : 'developer'}" data-id="${u.id}">
                <div class="profile-avatar">${u.name.charAt(0)}</div>
                <h3>${u.name}</h3>
                <p>${u.title || u.role}</p>
            </div>
        `).join('');

        container.querySelectorAll('.profile-card').forEach(card => {
            card.addEventListener('click', async () => {
                const userId = card.getAttribute('data-id');
                const user = users.find(u => u.id === userId);
                await handleProfileClick(user);
            });
        });
    } catch (err) {
        document.getElementById('profiles-container').innerHTML = `
            <div style="grid-column:span 2; text-align:center; padding:2rem;">
                <div style="font-size:2.5rem; margin-bottom:1rem;">❌</div>
                <h3 style="color:#c53030; margin-bottom:0.5rem;">Database Connection Error</h3>
                <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1.5rem;">
                    Could not load profiles. Check your Supabase URL and key, and ensure schema.sql has been run.
                </p>
                <button class="primary-btn" style="width:auto;" onclick="localStorage.clear(); location.reload()">
                    Reset & Reconnect
                </button>
            </div>
        `;
    }
};

const handleProfileClick = async (user) => {
    // Check if user has a password
    const pwd = prompt(`Enter password for ${user.name} (min 4 chars)${user.password_hash ? '' : ' - First time setup'}`);
    if (!pwd) return;

    const hash = await hashPassword(pwd);

    if (!user.password_hash) {
        if (pwd.length < 4) { alert('Password must be at least 4 characters'); return; }
        const confirmPwd = prompt('Confirm password:');
        if (pwd !== confirmPwd) { alert('Passwords do not match'); return; }
        
        const { error } = await supabase.from('users').update({ password_hash: hash }).eq('id', user.id);
        if (error) { alert('Error updating password'); return; }
        user.password_hash = hash;
    } else {
        if (user.password_hash !== hash) { alert('Incorrect password'); return; }
    }

    setCurrentUser(user);
    renderMainApp(user);
};

// --- MAIN APP LAYOUT ---
const renderMainApp = (user) => {
    app.innerHTML = `
        <div class="app-layout">
            <header class="app-header">
                <div class="user-info">
                    <div class="profile-avatar" style="width: 40px; height: 40px; font-size: 1rem; margin:0; background: ${user.role === 'Client' ? 'var(--slate-grey)' : 'var(--sapphire)'}">
                        ${user.name.charAt(0)}
                    </div>
                    <div class="user-info-text">
                        <h4>${user.name}</h4>
                        <span>${user.role}</span>
                    </div>
                </div>
                <div class="timer-controls">
                    <div class="timer-display" id="timer-display">00:00:00</div>
                    <button class="toggle-btn" id="timer-toggle">Sign In</button>
                    <button class="toggle-btn" style="border:none; padding:0 0.5rem;" id="logout-btn" title="Log Out">⎋</button>
                </div>
            </header>
            <nav class="app-nav">
                <a href="#tasks" class="nav-link ${currentView === 'tasks' ? 'active' : ''}" data-view="tasks">Tasks</a>
                <a href="#activity" class="nav-link ${currentView === 'activity' ? 'active' : ''}" data-view="activity">Activity Log</a>
                <a href="#history" class="nav-link ${currentView === 'history' ? 'active' : ''}" data-view="history">My Sessions</a>
                <a href="#team" class="nav-link ${currentView === 'team' ? 'active' : ''}" data-view="team">Team Status</a>
            </nav>
            <main class="main-content" id="main-view"></main>
        </div>
    `;

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
            currentView = e.target.getAttribute('data-view');
            renderCurrentView();
        });
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        setCurrentUser(null);
        if (activeTimerInterval) clearInterval(activeTimerInterval);
        renderApp();
    });

    setupTimer(user);
    renderCurrentView();
};

const setupTimer = async (user) => {
    const toggleBtn = document.getElementById('timer-toggle');
    const display = document.getElementById('timer-display');
    
    // Check local storage for active session fallback or fetch from DB
    let activeSessionId = localStorage.getItem('active_session_id');
    let sessionStart = localStorage.getItem('active_session_start');

    const updateDisplay = () => {
        if (!sessionStart) return;
        const diffInSeconds = Math.floor((Date.now() - parseInt(sessionStart)) / 1000);
        const format = val => val.toString().padStart(2, '0');
        const h = format(Math.floor(diffInSeconds / 3600));
        const m = format(Math.floor((diffInSeconds % 3600) / 60));
        const s = format(diffInSeconds % 60);
        display.textContent = `${h}:${m}:${s}`;
    };

    if (activeSessionId && sessionStart) {
        toggleBtn.textContent = 'Sign Out';
        toggleBtn.classList.add('active');
        activeTimerInterval = setInterval(updateDisplay, 1000);
        updateDisplay();
    }

    toggleBtn.addEventListener('click', async () => {
        if (toggleBtn.classList.contains('active')) {
            // Sign Out
            clearInterval(activeTimerInterval);
            const endTime = new Date().toISOString();
            const start = new Date(parseInt(sessionStart));
            const duration = Math.floor((Date.now() - parseInt(sessionStart)) / 1000);
            
            // Save to Supabase
            if (activeSessionId) {
                await supabase.from('sessions').update({
                    end_time: endTime,
                    duration_seconds: duration
                }).eq('id', activeSessionId);
            }
            
            localStorage.removeItem('active_session_id');
            localStorage.removeItem('active_session_start');
            toggleBtn.textContent = 'Sign In';
            toggleBtn.classList.remove('active');
            display.textContent = '00:00:00';
            sessionStart = null;
            activeSessionId = null;
            if(currentView === 'history' || currentView === 'team') renderCurrentView();
        } else {
            // Sign In
            const startTime = new Date().toISOString();
            // Create session in Supabase immediately
            const { data, error } = await supabase.from('sessions').insert([{
                user_id: user.id,
                start_time: startTime
            }]).select();

            if (data && data[0]) {
                activeSessionId = data[0].id;
                sessionStart = Date.now().toString();
                localStorage.setItem('active_session_id', activeSessionId);
                localStorage.setItem('active_session_start', sessionStart);
                
                toggleBtn.textContent = 'Sign Out';
                toggleBtn.classList.add('active');
                activeTimerInterval = setInterval(updateDisplay, 1000);
                updateDisplay();
                if(currentView === 'team') renderCurrentView();
            }
        }
    });
};

// --- VIEWS ROUTING ---
const renderCurrentView = () => {
    const main = document.getElementById('main-view');
    main.innerHTML = '<p>Loading...</p>';
    switch (currentView) {
        case 'tasks': import('./views/tasks.js').then(m => m.render(main)); break;
        case 'activity': import('./views/activity.js').then(m => m.render(main)); break;
        case 'history': import('./views/history.js').then(m => m.render(main)); break;
        case 'team': import('./views/team.js').then(m => m.render(main)); break;
    }
};

// Bootstrap
renderApp();
