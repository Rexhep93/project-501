// Renders attempt dots for the header.
// Kept the name `renderHearts` for backward compatibility with game files.
// Filled dot = attempt remaining. Hollow = used.

export function renderHearts(container, total, lostCount, animateLatest = false) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < total; i++) {
        const dot = document.createElement('span');
        dot.className = 'attempt-dot';
        // Fill from left: dots 0..(total-lost-1) are filled, rest are used
        const isUsed = i >= (total - lostCount);
        if (isUsed) {
            dot.classList.add('used');
            // Animate the one that was just flipped to used
            if (animateLatest && i === (total - lostCount)) {
                dot.classList.add('just-used');
            }
        }
        container.appendChild(dot);
    }
}
