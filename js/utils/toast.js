const ICONS = {
    success: '<svg viewBox="0 0 24 24"><use href="#i-check"/></svg>',
    error:   '<svg viewBox="0 0 24 24"><use href="#i-cross"/></svg>',
    warn:    '<svg viewBox="0 0 24 24"><use href="#i-info"/></svg>'
};

const DURATION = 1600;
const MAX_VISIBLE = 2;

export function toast(message, type = 'success') {
    const stack = document.getElementById('toast-stack');
    if (!stack) return;
    while (stack.children.length >= MAX_VISIBLE) {
        stack.children[0].remove();
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
        <span class="toast-icon">${ICONS[type] || ICONS.success}</span>
        <span class="toast-text">${escapeHtml(message)}</span>
    `;
    stack.appendChild(el);
    setTimeout(() => {
        el.classList.add('toast-out');
        setTimeout(() => el.remove(), 300);
    }, DURATION);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
