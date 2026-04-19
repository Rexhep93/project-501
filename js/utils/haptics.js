let haptics = null;
try {
    if (window.Capacitor?.Plugins?.Haptics) {
        haptics = window.Capacitor.Plugins.Haptics;
    }
} catch (e) { /* ignore */ }

export async function hapticLight() {
    if (haptics) { try { await haptics.impact({ style: 'LIGHT' }); } catch (e) {} }
    else if (navigator.vibrate) navigator.vibrate(10);
}
export async function hapticSuccess() {
    if (haptics) { try { await haptics.notification({ type: 'SUCCESS' }); } catch (e) {} }
    else if (navigator.vibrate) navigator.vibrate([15, 50, 15]);
}
export async function hapticError() {
    if (haptics) { try { await haptics.notification({ type: 'ERROR' }); } catch (e) {} }
    else if (navigator.vibrate) navigator.vibrate([30, 30, 30]);
}
export async function hapticMedium() {
    if (haptics) { try { await haptics.impact({ style: 'MEDIUM' }); } catch (e) {} }
    else if (navigator.vibrate) navigator.vibrate(20);
}
