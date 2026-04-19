let initialized = false;

export function initViewportHandling() {
    if (initialized) return;
    initialized = true;
    if (!window.visualViewport) return;
    const vv = window.visualViewport;

    function updateInputStripOffset() {
        const keyboardInset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        document.querySelectorAll('.screen.active .input-strip').forEach(strip => {
            if (keyboardInset > 0) {
                strip.style.transform = `translateY(-${keyboardInset}px)`;
                strip.classList.add('keyboard-open');
            } else {
                strip.style.transform = '';
                strip.classList.remove('keyboard-open');
            }
        });
    }

    vv.addEventListener('resize', updateInputStripOffset);
    vv.addEventListener('scroll', updateInputStripOffset);
    document.addEventListener('focusin', (e) => {
        if (e.target.matches('.input-strip input')) setTimeout(updateInputStripOffset, 50);
    });
    document.addEventListener('focusout', (e) => {
        if (e.target.matches('.input-strip input')) setTimeout(updateInputStripOffset, 50);
    });
}
