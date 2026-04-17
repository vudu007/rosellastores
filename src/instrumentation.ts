/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts.
 *
 * On Vercel: cron jobs are handled via vercel.json + /api/cron/* routes.
 *            node-cron is skipped because Vercel functions are stateless.
 * Locally:   node-cron runs normally so EOD emails still fire in dev.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const isVercel = !!process.env.VERCEL;

    if (isVercel) {
      console.log('[Instrumentation] Running on Vercel — cron handled by vercel.json, skipping node-cron.');
    } else {
      // Local dev: start node-cron scheduler
      const { startCronJobs } = await import('./lib/cron');
      await startCronJobs();
      console.log('[Instrumentation] Local dev — cron jobs started via node-cron.');
    }
  }
}
