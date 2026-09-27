export async function register() {
    console.log('[INSTRUMENTATION] Registering hooks...');

    // Polyfill localStorage for server-side if it's missing or broken (e.g. implicitly set to {})
    if (typeof global.localStorage === 'undefined' || typeof global.localStorage.getItem !== 'function') {
        console.log('[INSTRUMENTATION] Polyfilling localStorage for server runtime...');
        const store: Record<string, string> = {};
        const localStoragePolyfill = {
            getItem: (key: string) => store[key] || null,
            setItem: (key: string, value: string) => { store[key] = String(value); },
            removeItem: (key: string) => { delete store[key]; },
            clear: () => { for (const k in store) delete store[k]; },
            key: (index: number) => Object.keys(store)[index] || null,
            get length() { return Object.keys(store).length; },
        };

        // Use defineProperty to handle cases where it might be non-writable
        try {
            Object.defineProperty(global, 'localStorage', {
                value: localStoragePolyfill,
                writable: true,
                configurable: true
            });
        } catch (e) {
            console.warn('[INSTRUMENTATION] Failed to polyfill localStorage:', e);
        }
    }

    // Scheduled work runs via the `crons` block in vercel.json, which calls the
    // guarded /api/cron/* routes. node-cron cannot work on serverless — each
    // invocation is a fresh, short-lived process with no timer to fire.
    //
    // This block used to log "Cron jobs initialized successfully" while the
    // import beneath it was commented out, so the platform reported healthy
    // scheduling for months while nothing ran.
}


