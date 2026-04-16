// iOS Safari keyboard handling via visualViewport API.
// When the software keyboard appears, Safari shrinks the visual viewport
// (but not the layout viewport). This module offsets the fixed input-strip
// so it sits above the keyboard instead of behind it.
//
// This works identically in standalone PWA mode and regular Safari.

let initialized = false;

export function initViewportHandling() {
    if (initialized) return;
    initialized = true;

    // Feature detect — older browsers fall back to default behavior
    if (!window.visualViewport) return;

    const vv = window.visualViewport;

    function updateInputStripOffset() {
        // The keyboard-inset distance = layout height - visual height - visual offsetTop
        const keyboardInset = Math.max(
            0,
            window.innerHeight - vv.height - vv.offsetTop
        );

        // Apply only to the currently active game screen's input-strip
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

    // Also trigger when input gets focused — gives the viewport event a head-start
    document.addEventListener('focusin', (e) => {
        if (e.target.matches('.input-strip input')) {
            // Small delay for iOS to settle after keyboard animation
            setTimeout(updateInputStripOffset, 50);
        }
    });

    document.addEventListener('focusout', (e) => {
        if (e.target.matches('.input-strip input')) {
            setTimeout(updateInputStripOffset, 50);
        }
    });
}
