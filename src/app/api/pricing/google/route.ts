export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { authWithSession } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const bodySchema = z.object({
  limit: z.number().int().positive().max(100).optional().default(25),
  dryRun: z.boolean().optional().default(true),
  overwriteExisting: z.boolean().optional().default(false),
});

type SerpShoppingResult = {
  title?: string;
  product_link?: string;
  link?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
};

const parseTaxRate = (value: string | undefined) => {
  const raw = Number(value);
  if (Number.isFinite(raw) && raw > 0) return raw > 1 ? raw / 100 : raw;
  return 0.075;
};

const parseMarkupPercent = (value: string | undefined) => {
  const raw = Number(value);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return 5;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
};

const pickMarketPrice = (results: SerpShoppingResult[]) => {
  const candidates = results
    .slice(0, 5)
    .map((r) => ({ extracted: Number(r.extracted_price) || 0, priceStr: String(r.price || '') }))
    .filter((x) => x.extracted > 0);

  if (candidates.length === 0) return null;

  const ngnFirst = candidates.filter((c) => c.priceStr.includes('₦') || /NGN/i.test(c.priceStr));
  const pool = ngnFirst.length > 0 ? ngnFirst : candidates;

  const top = pool.slice(0, 3).map((x) => x.extracted);
  return median(top);
};

const computeRetailPrice = (marketPrice: number, isTaxable: boolean, markupPercent: number, vatMode: 'INCLUSIVE' | 'EXCLUSIVE', taxRate: number) => {
  const marked = marketPrice * (1 + markupPercent / 100);
  if (!isTaxable) return marked;
  if (vatMode === 'INCLUSIVE') return marked * (1 + taxRate);
  return marked;
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mapLimit<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(req: NextRequest) {
  try {
    const session = await authWithSession();
    if (!session || !['ADMIN', 'OWNER'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const branchId = session.user.branchId;
    if (!branchId) return NextResponse.json({ error: 'Missing branch' }, { status: 400 });

    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing SERPAPI_API_KEY in environment. Add it on Vercel and redeploy.' },
        { status: 400 }
      );
    }

    const body = bodySchema.parse(await req.json().catch(() => ({})));

    const settings = await prisma.setting.findMany({
      where: { key: { in: ['taxRate', 'vatMode', 'markupPercent'] } },
    });
    const settingsMap = settings.reduce((acc, cur) => {
      acc[cur.key] = cur.value;
      return acc;
    }, {} as Record<string, string>);

    const vatMode: 'INCLUSIVE' | 'EXCLUSIVE' = settingsMap.vatMode === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'INCLUSIVE';
    const taxRate = parseTaxRate(settingsMap.taxRate);
    const markupPercent = parseMarkupPercent(settingsMap.markupPercent);

    const products = await prisma.product.findMany({
      where: { branchId, isActive: true },
      select: { id: true, name: true, sku: true, costPrice: true, retailPrice: true, isTaxable: true },
      orderBy: { name: 'asc' },
      take: body.limit,
    });

    const results = await mapLimit(products, 2, async (p) => {
      if (!body.overwriteExisting && Number(p.costPrice) > 0) {
        return {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          status: 'SKIPPED' as const,
          reason: 'Already has costPrice',
        };
      }

      const query = `${p.name} price Nigeria`;
      const url = new URL('https://serpapi.com/search.json');
      url.searchParams.set('engine', 'google_shopping');
      url.searchParams.set('q', query);
      url.searchParams.set('hl', 'en');
      url.searchParams.set('gl', 'ng');
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('no_cache', 'true');

      const res = await fetch(url.toString(), { method: 'GET' });
      if (!res.ok) {
        return {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          status: 'ERROR' as const,
          reason: `SerpAPI HTTP ${res.status}`,
        };
      }

      const json: any = await res.json().catch(() => ({}));
      const shoppingResults: SerpShoppingResult[] = Array.isArray(json?.shopping_results) ? json.shopping_results : [];
      const marketPrice = pickMarketPrice(shoppingResults);
      if (!marketPrice) {
        return {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          status: 'NOT_FOUND' as const,
          reason: 'No price found',
        };
      }

      const suggestedMarketPrice = Math.round(marketPrice);
      const suggestedRetailPrice = Math.round(
        computeRetailPrice(suggestedMarketPrice, Boolean(p.isTaxable), markupPercent, vatMode, taxRate)
      );

      const top = shoppingResults.find((r) => Number(r.extracted_price) > 0) ?? null;

      if (body.dryRun) {
        return {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          status: 'DRY_RUN' as const,
          oldCostPrice: Number(p.costPrice) || 0,
          oldRetailPrice: Number(p.retailPrice) || 0,
          suggestedMarketPrice,
          suggestedRetailPrice,
          source: top?.source ?? null,
          link: top?.product_link ?? top?.link ?? null,
        };
      }

      const priceChanged = suggestedRetailPrice !== Math.round(Number(p.retailPrice) || 0);

      await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: p.id },
          data: {
            costPrice: suggestedMarketPrice,
            retailPrice: suggestedRetailPrice,
            taxInclusive: p.isTaxable ? vatMode === 'INCLUSIVE' : false,
          },
        });

        if (priceChanged) {
          await tx.priceTag.create({
            data: {
              productId: p.id,
              branchId,
              oldPrice: Number(p.retailPrice) || 0,
              newPrice: suggestedRetailPrice,
            },
          });
        }
      });

      await delay(200);

      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        status: 'UPDATED' as const,
        oldCostPrice: Number(p.costPrice) || 0,
        oldRetailPrice: Number(p.retailPrice) || 0,
        suggestedMarketPrice,
        suggestedRetailPrice,
        source: top?.source ?? null,
        link: top?.product_link ?? top?.link ?? null,
      };
    });

    const summary = results.reduce(
      (acc, r: any) => {
        acc.total += 1;
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      },
      { total: 0 } as Record<string, number>
    );

    return NextResponse.json({
      ok: true,
      dryRun: body.dryRun,
      vatMode,
      taxRate,
      markupPercent,
      summary,
      results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors.map((e) => e.message).join(', ') }, { status: 400 });
    }
    console.error('Error auto-pricing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

