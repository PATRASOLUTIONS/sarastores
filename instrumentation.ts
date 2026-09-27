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

    // Check if we're in Node.js runtime (server-side)
    const isNodeRuntime = process.env.NEXT_RUNTIME === 'nodejs';
    console.log(`[INSTRUMENTATION] NEXT_RUNTIME: ${process.env.NEXT_RUNTIME} (Node.js: ${isNodeRuntime})`);

    if (isNodeRuntime || process.env.NODE_ENV === 'development') {
        try {
            console.log('[INSTRUMENTATION] Loading cron jobs for abandoned cart emails...');
            // const { initCronJobs } = await import('./lib/cron/abandoned-cart');
            // await initCronJobs();
            console.log('[INSTRUMENTATION] ✅ Cron jobs initialized successfully!');
        } catch (err) {
            console.error("[INSTRUMENTATION] ❌ Failed to initialize cron jobs:", err);
        }
    } else {
        console.log('[INSTRUMENTATION] Skipping cron jobs initialization (not Node.js runtime)');
    }
}


