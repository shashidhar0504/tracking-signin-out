import { supabase, currentUser } from '../db.js';

export const render = async (container) => {
    container.innerHTML = `
        <div class="view-container">
            <div class="view-header">
                <h2>Shared Task Board</h2>
                ${currentUser.role === 'Developer' ? '<button class="primary-btn" style="width:auto" id="btn-add-task">+ New Task</button>' : ''}
            </div>
            <div class="kanban-board" id="kanban-container">
                <div class="kanban-col" id="col-todo"><h3>To Do</h3><div class="task-list" data-status="To Do"></div></div>
                <div class="kanban-col" id="col-progress"><h3>In Progress</h3><div class="task-list" data-status="In Progress"></div></div>
                <div class="kanban-col" id="col-done"><h3>Done</h3><div class="task-list" data-status="Done"></div></div>
            </div>
        </div>
    `;

    if (currentUser.role === 'Developer') {
        document.getElementById('btn-add-task').addEventListener('click', async () => {
            const title = prompt('Enter task details:');
            if (!title) return;
            const { error } = await supabase.from('tasks').insert([{
                title, status: 'To Do', created_by: currentUser.id
            }]);
            if (error) alert('Error creating task');
            loadTasks();
        });
    }

    await loadTasks();
};

const loadTasks = async () => {
    const { data: tasks, error } = await supabase.from('tasks').select('*, comments(*)').order('created_at', { ascending: false });
    if (error) return;

    ['To Do', 'In Progress', 'Done'].forEach(status => {
        const list = document.querySelector(`.task-list[data-status="${status}"]`);
        if (!list) return;
        const colTasks = tasks.filter(t => t.status === status);
        list.innerHTML = colTasks.map(t => `
            <div class="task-card" data-id="${t.id}">
                <h4>${t.title}</h4>
                <div class="task-actions">
                    ${currentUser.role === 'Developer' ? `
                    <select class="status-select" data-id="${t.id}">
                        <option value="To Do" ${t.status==='To Do'?'selected':''}>To Do</option>
                        <option value="In Progress" ${t.status==='In Progress'?'selected':''}>In Progress</option>
                        <option value="Done" ${t.status==='Done'?'selected':''}>Done</option>
                    </select>
                    ` : `<span>Status: ${t.status}</span>`}
                    <button class="comments-toggle" data-id="${t.id}">Comments (${t.comments ? t.comments.length : 0}) ▾</button>
                </div>
                <div class="comments-section hidden" id="comments-${t.id}">
                    ${(t.comments || []).map(c => `<div class="comment"><span>User:</span> ${c.content} <span style="color:#aaa;font-weight:400">[${new Date(c.created_at).toLocaleDateString()}]</span></div>`).join('')}
                    <div class="add-comment">
                        <input type="text" placeholder="Add a comment..." id="input-comment-${t.id}" />
                        <button class="btn-send-comment" data-id="${t.id}">Send</button>
                    </div>
                </div>
            </div>
        `).join('');
    });

    attachTaskEvents();
};

const attachTaskEvents = () => {
    document.querySelectorAll('.status-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
            const id = e.target.getAttribute('data-id');
            const newStatus = e.target.value;
            await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
            loadTasks();
        });
    });

    document.querySelectorAll('.comments-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            document.getElementById(`comments-${id}`).classList.toggle('hidden');
        });
    });

    document.querySelectorAll('.btn-send-comment').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            const input = document.getElementById(`input-comment-${id}`);
            const content = input.value.trim();
            if (!content) return;
            
            await supabase.from('comments').insert([{
                task_id: id, author_id: currentUser.id, content
            }]);
            loadTasks();
        });
    });
};
