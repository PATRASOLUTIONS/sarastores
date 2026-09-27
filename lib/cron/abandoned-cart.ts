// DEPRECATED — superseded by lib/retention/cart-recovery.ts + /api/cron/cart-recovery.
//
// Do not re-enable this file. It cannot work on serverless (node-cron needs a
// long-lived process), its rate limit lived in an in-memory Map that resets on every
// invocation, and its hourly follow-up query had no send cap — it would have emailed
// the same shopper every hour indefinitely. It also ignored marketing consent and
// sent no unsubscribe link.
//
// import { getCollection } from '../db-service';
// import { ObjectId } from 'mongodb';
import { sendEmail } from '../email';
import { emailTemplates } from '../emailTemplates';

// Webpack injects this at runtime; it has no ambient type declaration.
declare const __non_webpack_require__: ((id: string) => any) | undefined;

// Configurable cron schedules for different triggers
const CRON_SCHEDULE_2_MIN = '*/2 * * * *'; // Runs every 2 minutes
const CRON_SCHEDULE_HOURLY = '0 * * * *'; // Runs every hour (for follow-ups)

// Track last email sent time per cart to allow multiple notifications
interface CartEmailTracker {
    cartId: string;
    lastEmailTime: Date;
    emailCount: number;
}

const cartEmailTracker = new Map<string, CartEmailTracker>();

export async function initCronJobs() {
    console.log('Initializing Cron Jobs...');

    if (process.env.NEXT_RUNTIME !== 'nodejs') {
        console.log('[DEV MODE] Not in Node.js runtime. Cron jobs disabled.');
        return;
    }

    try {
        // HACK: Use eval('require') to completely hide the module from Webpack's static analysis
        // This forces it to be a pure runtime requirement
        const requireFunc = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : eval('require');
        const cron = requireFunc('node-cron');

        console.log('[CRON] Setting up abandoned cart checks...');

        // Schedule first check every 2 minutes (for carts abandoned 20+ minutes)
        cron.schedule(CRON_SCHEDULE_2_MIN, async () => {
            console.log('🔄 [2-MIN CHECK] Running Abandoned Cart Check...');
            await checkAbandonedCarts('2-minute-check');
        });

        // Schedule second check every hour (for carts abandoned 1+ hour - follow up)
        cron.schedule(CRON_SCHEDULE_HOURLY, async () => {
            console.log('🔄 [HOURLY CHECK] Running Abandoned Cart Follow-up...');
            await checkAbandonedCarts('hourly-follow-up');
        });

        console.log('[CRON] Abandoned cart cron jobs initialized!');
    } catch (error) {
        console.error('Failed to load node-cron:', error);
    }
}

async function checkAbandonedCarts(checkType: '2-minute-check' | 'hourly-follow-up' = '2-minute-check') {
    try {
        const { getCollection } = await import('../db-service');
        const { ObjectId } = await import('mongodb');

        const cartsCollection = await getCollection('carts');
        const usersCollection = await getCollection('users');

        let query: any;
        const currentTime = new Date();

        if (checkType === '2-minute-check') {
            // First notification: carts abandoned for 20+ minutes
            const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
            query = {
                updatedAt: { $lt: twentyMinutesAgo },
                items: { $not: { $size: 0 } }, // Ensure cart is not empty
                $or: [
                    { lastAbandonmentEmailSent: { $exists: false } },
                    { lastAbandonmentEmailSent: null }
                ]
            };
            console.log(`[2-MIN] Looking for carts not updated since ${twentyMinutesAgo.toISOString()}`);
        } else {
            // Follow-up: carts abandoned for 1+ hour, send another reminder
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            query = {
                updatedAt: { $lt: oneHourAgo },
                items: { $not: { $size: 0 } },
                lastAbandonmentEmailSent: { $exists: true, $ne: null }
                // Allow follow-up emails
            };
            console.log(`[HOURLY] Looking for carts not updated since ${oneHourAgo.toISOString()}`);
        }

        const staleCarts = await cartsCollection.find(query).toArray();

        console.log(`[${checkType}] Found ${staleCarts.length} potential abandoned carts.`);

        for (const cart of staleCarts) {
            const cartId = cart._id.toString();
            console.log(`[${checkType}] Processing cart ${cartId}...`);

            if (!cart.userId) {
                console.log(`[${checkType}] Skipping cart ${cartId}: No userId (Guest cart)`);
                continue;
            }

            // Rate limiting: Don't send emails more frequently than every 2 minutes per cart
            const tracker = cartEmailTracker.get(cartId);
            if (tracker && (currentTime.getTime() - tracker.lastEmailTime.getTime()) < 2 * 60 * 1000) {
                console.log(`[${checkType}] Skipping cart ${cartId}: Email sent less than 2 minutes ago`);
                continue;
            }

            const user = await usersCollection.findOne({ _id: new ObjectId(cart.userId) });
            if (!user) {
                console.log(`[${checkType}] Skipping cart ${cartId}: User ${cart.userId} not found`);
                continue;
            }
            if (!user.email) {
                console.log(`[${checkType}] Skipping cart ${cartId}: User ${user.firstName} has no email`);
                continue;
            }

            console.log(`[${checkType}] 📧 Sending email to ${user.email} for cart ${cartId}`);

            // Prepare email data
            // For simplicity, showing first 3 items
            const itemsToShow = cart.items.slice(0, 3).map((item: any) => ({
                name: item.name,
                price: item.price,
                image: item.image,
                quantity: item.quantity
            }));

            const emailHtml = emailTemplates.CART_ABANDONMENT.html({
                customerName: user.firstName || 'Shopper',
                cartUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/cart`,
                items: itemsToShow
            });

            // Send Email
            try {
                const result = await sendEmail({
                    to: user.email,
                    subject: emailTemplates.CART_ABANDONMENT.subject,
                    html: emailHtml
                });

                if (result.success) {
                    console.log(`[${checkType}] ✅ Abandoned cart email sent to ${user.email}`);

                    // Update tracking
                    const emailCount = (tracker?.emailCount || 0) + 1;
                    cartEmailTracker.set(cartId, {
                        cartId,
                        lastEmailTime: currentTime,
                        emailCount
                    });

                    // Update database
                    await cartsCollection.updateOne(
                        { _id: cart._id },
                        {
                            $set: {
                                lastAbandonmentEmailSent: currentTime,
                                abandonmentEmailCount: emailCount
                            }
                        }
                    );

                    console.log(`[${checkType}] Updated cart ${cartId}: emailCount=${emailCount}`);
                } else {
                    console.error(`[${checkType}] ❌ Failed to send email to ${user.email}`);
                }
            } catch (emailError) {
                console.error(`[${checkType}] ❌ Error sending email to ${user.email}:`, emailError);
            }
        }

        console.log(`[${checkType}] Abandoned cart check completed.`);
    } catch (error) {
        console.error(`Error in Abandoned Cart Cron (${checkType}):`, error);
    }
}
