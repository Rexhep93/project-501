// Renders SVG hearts for lives display
const HEART_SVG = `<svg viewBox="0 0 24 24"><use href="#i-heart"/></svg>`;

/**
 * Renders N hearts in container, with `lostCount` shown as broken
 */
export function renderHearts(container, total, lostCount, animateLatest = false) {
    container.innerHTML = '';
    for (let i = 0; i < total; i++) {
        const wrap = document.createElement('span');
        wrap.className = 'life-heart';
        const isLost = i >= (total - lostCount);
        if (isLost) {
            wrap.classList.add('lost');
            if (animateLatest && i === (total - lostCount)) {
                wrap.classList.add('just-lost');
            }
        }
        wrap.innerHTML = HEART_SVG;
        container.appendChild(wrap);
    }
}
