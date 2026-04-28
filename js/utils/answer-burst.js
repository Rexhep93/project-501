/**
 * Center-screen Correct / Wrong burst — square card with check or cross,
 * spring-pop in, soft fade out. Auto-dismissable; returns a promise that
 * resolves once the burst is gone.
 */

let activeTimer = null;
let dismissTimer = null;

const CHECK_PATH  = `<path d="m5 12 5 5L20 7" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
const CROSS_PATH  = `<path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;

export function showAnswerBurst({ correct, title, sub = '', duration = 1500 }) {
    const burst = document.getElementById('answer-burst');
    if (!burst) return Promise.resolve();
    const card    = burst.querySelector('.answer-burst-card');
    const iconEl  = burst.querySelector('.answer-burst-icon');
    const titleEl = burst.querySelector('.answer-burst-title');
    const subEl   = burst.querySelector('.answer-burst-sub');

    // Cancel any in-flight burst so a fast tap pattern still shows fresh state.
    clearTimeout(activeTimer);
    clearTimeout(dismissTimer);
    burst.classList.remove('active', 'dismissing', 'correct', 'wrong');
    void card.offsetWidth; // restart animations

    burst.classList.add(correct ? 'correct' : 'wrong');
    iconEl.innerHTML = correct ? CHECK_PATH : CROSS_PATH;
    titleEl.textContent = title || (correct ? 'Correct!' : 'Wrong');
    subEl.textContent = sub || '';
    burst.setAttribute('aria-hidden', 'false');
    burst.classList.add('active');

    return new Promise(resolve => {
        activeTimer = setTimeout(() => {
            burst.classList.add('dismissing');
            dismissTimer = setTimeout(() => {
                burst.classList.remove('active', 'dismissing', 'correct', 'wrong');
                burst.setAttribute('aria-hidden', 'true');
                resolve();
            }, 220);
        }, duration);
    });
}
