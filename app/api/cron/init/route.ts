import { NextResponse } from 'next/server';

/**
 * Deprecated. Scheduling now lives in `vercel.json` crons hitting the guarded
 * `/api/cron/*` routes, which work on serverless — node-cron never could.
 *
 * This deliberately no longer starts the legacy abandoned-cart job: it had no
 * working send cap and would have emailed the same shopper every hour.
 * Use `/api/cron/cart-recovery` instead.
 */
export async function GET() {
    return NextResponse.json(
        {
            error: 'Deprecated. Scheduled jobs run via vercel.json crons.',
            replacement: '/api/cron/cart-recovery',
        },
        { status: 410 },
    );
}
