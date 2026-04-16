import cron from 'node-cron';
import { prisma } from './prisma';
import { sendEODReport } from './eod';
import { startOfDay, startOfDay as startOfDayFn } from 'date-fns';

let cronJobs: cron.ScheduledTask[] = [];

function parseTime(timeStr: string): { hour: number; minute: number } {
  const [hour, minute] = timeStr.split(':').map(Number);
  return { hour, minute };
}

function getCronExpression(hour: number, minute: number): string {
  return `${minute} ${hour} * * *`;
}

async function performLowStockCheck() {
  console.log('[CRON] Running low stock check...');
  try {
    const lowStockItems = await prisma.product.findMany({
      where: {
        stockQty: {
          lte: prisma.product.fields.lowStockThreshold,
        },
        isActive: true,
      },
      include: {
        category: true,
      },
    });

    console.log(`[CRON] Found ${lowStockItems.length} low stock items`);
  } catch (error) {
    console.error('[CRON] Error during low stock check:', error);
  }
}

async function performEODTasks() {
  console.log('[CRON] Running EOD tasks...');
  try {
    const businessNameSetting = await prisma.setting.findUnique({
      where: { key: 'businessName' },
    });
    const ownerEmailSetting = await prisma.setting.findUnique({
      where: { key: 'ownerEmail' },
    });

    if (!businessNameSetting || !ownerEmailSetting) {
      console.error('[CRON] Missing business settings');
      return;
    }

    const success = await sendEODReport(
      businessNameSetting.value,
      ownerEmailSetting.value
    );

    if (success) {
      console.log('[CRON] EOD report sent successfully');
    } else {
      console.error('[CRON] Failed to send EOD report');
    }
  } catch (error) {
    console.error('[CRON] Error during EOD tasks:', error);
  }
}

export async function startCronJobs() {
  console.log('[CRON] Starting cron jobs...');

  try {
    const eodTimeSetting = await prisma.setting.findUnique({
      where: { key: 'eodTime' },
    });

    if (!eodTimeSetting) {
      console.warn('[CRON] EOD time not configured in settings');
      return;
    }

    const { hour, minute } = parseTime(eodTimeSetting.value);
    const eodCron = getCronExpression(hour, minute);

    const eodJob = cron.schedule(eodCron, async () => {
      await performEODTasks();
    });

    cronJobs.push(eodJob);
    console.log(`[CRON] EOD task scheduled for ${eodTimeSetting.value} (${eodCron})`);

    const lowStockJob = cron.schedule('0 8 * * *', async () => {
      await performLowStockCheck();
    });

    cronJobs.push(lowStockJob);
    console.log('[CRON] Low stock check scheduled for 08:00 daily');

    console.log('[CRON] All cron jobs started successfully');
  } catch (error) {
    console.error('[CRON] Error starting cron jobs:', error);
  }
}

export async function stopCronJobs() {
  console.log('[CRON] Stopping cron jobs...');
  for (const job of cronJobs) {
    job.stop();
  }
  cronJobs = [];
  console.log('[CRON] All cron jobs stopped');
}

export { cron };
