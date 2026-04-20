// Renders hearts for the header. Red filled = life remaining, hollow = lost.

const HEART_FILLED = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.5-9.5-9.5C1 7.5 4 4 7.5 4c2 0 3.5 1 4.5 2.5C13 5 14.5 4 16.5 4 20 4 23 7.5 21.5 11.5 19.5 16.5 12 21 12 21z"/></svg>';
const HEART_HOLLOW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.5-9.5-9.5C1 7.5 4 4 7.5 4c2 0 3.5 1 4.5 2.5C13 5 14.5 4 16.5 4 20 4 23 7.5 21.5 11.5 19.5 16.5 12 21 12 21z"/></svg>';

export function renderHearts(container, total, lostCount, animateLatest = false) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < total; i++) {
        const heart = document.createElement('span');
        heart.className = 'heart';
        const isLost = i >= (total - lostCount);
        if (isLost) {
            heart.classList.add('lost');
            heart.innerHTML = HEART_HOLLOW;
            if (animateLatest && i === (total - lostCount)) {
                heart.classList.add('just-lost');
            }
        } else {
            heart.innerHTML = HEART_FILLED;
        }
        container.appendChild(heart);
    }
}
