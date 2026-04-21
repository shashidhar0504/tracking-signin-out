import { supabase } from '../db.js';

export const render = async (container) => {
    container.innerHTML = `
        <div class="view-container">
            <div class="view-header">
                <h2>Team Overview</h2>
                <button class="toggle-btn" id="btn-refresh-team">Refresh ⟳</button>
            </div>
            <div class="team-grid" id="team-grid">
                <p>Loading team status...</p>
            </div>
        </div>
    `;

    document.getElementById('btn-refresh-team').addEventListener('click', loadTeam);
    await loadTeam();
};

const loadTeam = async () => {
    // Fetch users
    const { data: users, error: uErr } = await supabase.from('users').select('*').order('name');
    if (uErr) return;

    // Fetch today's sessions for all users to calculate hours and online status
    const today = new Date();
    today.setHours(0,0,0,0);
    const { data: sessions, error: sErr } = await supabase.from('sessions')
        .select('*')
        .gte('start_time', today.toISOString());
        
    if (sErr) return;

    const grid = document.getElementById('team-grid');
    grid.innerHTML = users.map(user => {
        const userSessions = sessions.filter(s => s.user_id === user.id);
        const isActive = userSessions.some(s => !s.end_time);
        
        let totalSecs = 0;
        userSessions.forEach(s => {
            if (s.end_time) {
                totalSecs += s.duration_seconds || 0;
            } else {
                totalSecs += Math.floor((Date.now() - new Date(s.start_time).getTime())/1000);
            }
        });

        const hrs = (totalSecs/3600).toFixed(1);

        return `
            <div class="team-member">
                <div class="profile-avatar" style="background: ${user.role==='Client'?'var(--slate-grey)':'var(--sapphire)'}; margin-bottom: 1rem;">
                    ${user.name.charAt(0)}
                </div>
                <h3 style="color:var(--prussian-blue-2); margin-bottom:0.25rem;">${user.name}</h3>
                <p style="color:var(--text-muted); font-size:0.85rem;">${user.title || user.role}</p>
                
                <div style="margin-top: 1.5rem;">
                    <h4 style="font-size: 1.5rem; color:var(--prussian-blue);">${hrs}h</h4>
                    <p style="font-size: 0.75rem; color:var(--text-muted);">Today</p>
                </div>

                <span class="status-badge ${isActive ? 'online' : 'offline'}">
                    ${isActive ? '● Online (Tracking)' : '○ Offline'}
                </span>
            </div>
        `;
    }).join('');
};
