import { supabase, currentUser } from '../db.js';

export const render = async (container) => {
    container.innerHTML = `
        <div class="view-container">
            <div class="view-header">
                <h2>Personal Activity Log</h2>
            </div>
            <div class="activity-box">
                <div class="activity-input">
                    <textarea id="activity-text" placeholder="What did you accomplish today?"></textarea>
                    <button class="primary-btn" id="btn-save-activity">Save Entry</button>
                </div>
                <div class="activity-list" id="activity-list">
                    <p>Loading past activities...</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-save-activity').addEventListener('click', async () => {
        const text = document.getElementById('activity-text').value;
        if (!text.trim()) return;
        
        const { error } = await supabase.from('activities').insert([
            { user_id: currentUser.id, content: text }
        ]);
        if (error) { alert('Error saving activity'); return; }
        document.getElementById('activity-text').value = '';
        loadActivities();
    });

    await loadActivities();
};

const loadActivities = async () => {
    const { data: acts, error } = await supabase.from('activities')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
        
    const list = document.getElementById('activity-list');
    if (error || !acts || acts.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted)">No activities logged yet.</p>';
        return;
    }

    list.innerHTML = acts.map(a => `
        <div class="activity-item">
            <div style="margin-bottom: 0.5rem">${a.content}</div>
            <div class="time">${new Date(a.created_at).toLocaleString()}</div>
        </div>
    `).join('');
};
