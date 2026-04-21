import { supabase, currentUser } from '../db.js';

let chartMode = '7days'; // '7days' or '30days'

export const render = async (container) => {
    container.innerHTML = `
        <div class="view-container">
            <div class="view-header">
                <h2>Session History & Summaries</h2>
                <div class="export-actions">
                    <button class="toggle-btn" id="btn-export-csv">Export CSV</button>
                    <button class="toggle-btn" id="btn-email-summary">Email Summary</button>
                </div>
            </div>
            
            <div class="metrics-row">
                <div class="metric-card highlight">
                    <h3 id="metric-today">0h</h3>
                    <p>Today's Hours</p>
                </div>
                <div class="metric-card">
                    <h3 id="metric-total">0h</h3>
                    <p>Total Logged</p>
                </div>
                <div class="metric-card">
                    <h3 id="metric-avg">0h</h3>
                    <p>Daily Average (Active Days)</p>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                <h3 style="color:var(--prussian-blue-2)">Hours Worked</h3>
                <div>
                    <button class="toggle-btn active" id="btn-7days">This Week</button>
                    <button class="toggle-btn" id="btn-30days">This Month</button>
                </div>
            </div>
            
            <div class="chart-container" id="chart-container">
                <p>Loading chart data...</p>
            </div>

            <h3 style="color:var(--prussian-blue-2); margin-top:2rem; margin-bottom:1rem;">All Sessions</h3>
            <div class="table-container">
                <table id="sessions-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Start Time</th>
                            <th>End Time</th>
                            <th>Duration</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('btn-7days').addEventListener('click', (e) => {
        chartMode = '7days';
        e.target.classList.add('active');
        document.getElementById('btn-30days').classList.remove('active');
        loadData();
    });
    document.getElementById('btn-30days').addEventListener('click', (e) => {
        chartMode = '30days';
        e.target.classList.add('active');
        document.getElementById('btn-7days').classList.remove('active');
        loadData();
    });
    
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('btn-email-summary').addEventListener('click', emailSummary);

    await loadData();
};

let allSessions = [];

const loadData = async () => {
    const { data: sessions, error } = await supabase.from('sessions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('start_time', { ascending: false });
        
    if (error || !sessions) return;
    allSessions = sessions;

    // Process Metrics
    let todaySecs = 0, totalSecs = 0;
    const activeDays = new Set();
    const todayStr = new Date().toLocaleDateString();

    sessions.forEach(s => {
        const dStr = new Date(s.start_time).toLocaleDateString();
        activeDays.add(dStr);
        let sec = s.duration_seconds || 0;
        if (!s.end_time) {
            // Live falling back to current time delta if no end time
            sec = Math.floor((Date.now() - new Date(s.start_time).getTime())/1000);
        }
        totalSecs += sec;
        if (dStr === todayStr) todaySecs += sec;
    });

    const formatH = (s) => (s/3600).toFixed(1) + 'h';
    document.getElementById('metric-today').textContent = (todaySecs/3600).toFixed(1) + 'h';
    document.getElementById('metric-total').textContent = (totalSecs/3600).toFixed(1) + 'h';
    document.getElementById('metric-avg').textContent = activeDays.size ? formatH(totalSecs/activeDays.size) : '0h';

    // Build Chart
    const daysArray = [];
    const numDays = chartMode === '7days' ? 7 : 30;
    for(let i = numDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        daysArray.push({
            dateStr: d.toLocaleDateString(),
            displayStr: d.toLocaleDateString('en-US', {month:'short', day:'numeric'}),
            secs: 0
        });
    }

    sessions.forEach(s => {
        const dStr = new Date(s.start_time).toLocaleDateString();
        const arrDay = daysArray.find(d => d.dateStr === dStr);
        if (arrDay) {
            let sec = s.duration_seconds || 0;
            if(!s.end_time) sec = Math.floor((Date.now() - new Date(s.start_time).getTime())/1000);
            arrDay.secs += sec;
        }
    });

    const maxSecs = Math.max(...daysArray.map(d => d.secs), 3600); // minimum 1h scale
    
    document.getElementById('chart-container').innerHTML = daysArray.map((day, idx) => {
        const h = (day.secs/3600).toFixed(1);
        const percent = Math.min((day.secs / maxSecs) * 100, 100);
        const isToday = day.dateStr === todayStr;
        return `
            <div class="chart-bar-wrapper">
                <div class="chart-bar ${isToday?'today':''}" style="height: ${percent}%" data-hours="${h}"></div>
                <div class="chart-label">${chartMode === '7days' ? day.displayStr : (idx%7===0?day.displayStr:'')}</div>
            </div>
        `;
    }).join('');

    // Table
    const tbody = document.querySelector('#sessions-table tbody');
    tbody.innerHTML = sessions.map(s => {
        const start = new Date(s.start_time);
        const end = s.end_time ? new Date(s.end_time) : null;
        const durSec = s.end_time ? s.duration_seconds : Math.floor((Date.now() - start)/1000);
        return `
            <tr>
                <td>${start.toLocaleDateString()}</td>
                <td>${start.toLocaleTimeString()}</td>
                <td>${end ? end.toLocaleTimeString() : '<span style="color:var(--smart-blue);font-weight:600">Active Now</span>'}</td>
                <td>${(durSec/3600).toFixed(2)}h</td>
            </tr>
        `;
    }).join('');
};

const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Start Time,End Time,Duration (Hours)\n";
    allSessions.forEach(s => {
        const start = new Date(s.start_time);
        const end = s.end_time ? new Date(s.end_time) : null;
        let durSec = s.end_time ? s.duration_seconds : Math.floor((Date.now() - start)/1000);
        csvContent += `${start.toLocaleDateString()},${start.toLocaleTimeString()},${end?end.toLocaleTimeString():'Active'},${(durSec/3600).toFixed(2)}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sessions_${currentUser.name.replace(/\s+/g,'_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const emailSummary = async () => {
    // Collect Activities
    const { data: acts } = await supabase.from('activities').select('*').eq('user_id', currentUser.id);
    const todayStr = new Date().toLocaleDateString();
    
    let hoursStr = document.getElementById('metric-today').textContent;
    let actList = acts.filter(a => new Date(a.created_at).toLocaleDateString() === todayStr)
                     .map(a => '- ' + a.content).join('%0A');
    
    if(!actList) actList = "No activities logged today.";

    const subject = `Daily Summary: ${currentUser.name} - ${todayStr}`;
    const body = `Hours Logged Today: ${hoursStr}%0A%0AActivities:%0A${actList}%0A%0A-- Sent from Tracking System`;
    
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
};
