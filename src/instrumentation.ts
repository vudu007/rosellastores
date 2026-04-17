/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts. Used to initialise the EOD cron scheduler.
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run in the Node.js runtime (not Edge), and only on the server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startCronJobs } = await import('./lib/cron');
    await startCronJobs();
    console.log('[Instrumentation] Cron jobs started');
  }
}
