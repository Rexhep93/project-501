// Renders attempt dots for the header.

export function renderHearts(container, total, lostCount, animateLatest = false) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < total; i++) {
        const dot = document.createElement('span');
        dot.className = 'attempt-dot';
        const isUsed = i >= (total - lostCount);
        if (isUsed) {
            dot.classList.add('used');
            if (animateLatest && i === (total - lostCount)) {
                dot.classList.add('just-used');
            }
        }
        container.appendChild(dot);
    }
}
