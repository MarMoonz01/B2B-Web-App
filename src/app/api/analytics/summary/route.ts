// src/app/api/analytics/summary/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";
import { getServerSession } from "@/src/lib/session";
import type { Me } from "@/src/lib/session";

// ----------------------------------------------
// Types for response (REAL data only — no mocks)
// ----------------------------------------------
interface SummaryData {
  totalInventoryValue: number;
  pendingTransfers: number;
  branchCount: number;
  totalUsers: number;
}

interface ChartDatum { name: string; value: number }
interface TransfersDatum { name: string; inbound?: number; outbound?: number }

interface SummaryResponse {
  ok: boolean;
  summaryData: SummaryData;
  inventoryByBranchData: ChartDatum[];
  transfersOverTimeData: TransfersDatum[];
  productCategoriesData: ChartDatum[]; // grouped by brand (change to real category if available)
}

// ----------------------------------------------
// Helpers
// ----------------------------------------------
function parseRangeParam(range: string | null): { start: Date; end: Date } {
  const now = new Date();
  const r = (range || "30d").toLowerCase();
  const start = new Date(now);
  if (r === "7d") start.setDate(now.getDate() - 7);
  else if (r === "90d") start.setDate(now.getDate() - 90);
  else if (r === "ytd") start.setMonth(0, 1), start.setHours(0, 0, 0, 0);
  else start.setDate(now.getDate() - 30); // default 30d
  return { start, end: now };
}

function dkey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

async function getVisibleStoreIds(me: Me): Promise<string[]> {
  if (me.moderator) {
    const snap = await db.collection("stores").select().get();
    return snap.docs.map((d) => d.id);
  }
  const ids = (me.branches ?? []).map((b) => b.id).filter(Boolean);
  if (!ids.length) return [];
  // Validate existence & visibility (batch 'in' of 10)
  const out: string[] = [];
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const snap = await db.collection("stores").where("__name__", "in", batch).select().get();
    out.push(...snap.docs.map((d) => d.id));
  }
  return out;
}

// Price: dot.promoPrice ?? variant.basePrice ?? 0
function resolveDotPrice(dot: any, variant: any): number {
  const promo = dot?.promoPrice;
  const base = variant?.basePrice;
  if (promo === 0 || typeof promo === "number") return Number(promo) || 0;
  return Number(base) || 0;
}

// Small util: run array tasks in parallel (with simple throttling)
async function runAll<T>(arr: T[], fn: (x: T) => Promise<any>, chunk = 10) {
  for (let i = 0; i < arr.length; i += chunk) {
    const part = arr.slice(i, i + chunk);
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(part.map(fn));
  }
}

// ----------------------------------------------
// GET handler (REAL data)
// ----------------------------------------------
export async function GET(req: Request) {
  const me = await getServerSession();
  if (!me) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const rangeParam = searchParams.get("range");
    const { start, end } = parseRangeParam(rangeParam);

    const storeIds = await getVisibleStoreIds(me);

    // ---------- 1) Users count ----------
    const usersSnap = await db.collection("users").select().get();
    const totalUsers = usersSnap.size;

    // ---------- 2) Inventory aggregations ----------
    const byBranch: Record<string, number> = {}; // storeId -> value
    const byBrand: Record<string, number> = {};  // brandName -> value
    let totalInventoryValue = 0;

    await runAll(storeIds, async (storeId) => {
      let storeTotal = 0;

      const brandsSnap = await db.collection("stores").doc(storeId).collection("inventory").get();
      // Brands in parallel (limit concurrency)
      await runAll(brandsSnap.docs, async (brandDoc) => {
        const brandName = (brandDoc.get("brandName") as string) || brandDoc.id;

        const modelsSnap = await brandDoc.ref.collection("models").get();
        await runAll(modelsSnap.docs, async (modelDoc) => {
          const variantsSnap = await modelDoc.ref.collection("variants").get();
          await runAll(variantsSnap.docs, async (variantDoc) => {
            const variantData = variantDoc.data();
            const dotsSnap = await variantDoc.ref.collection("dots").get();

            for (const dotDoc of dotsSnap.docs) {
              const dd = dotDoc.data();
              const qty = Number(dd?.qty ?? 0);
              if (!qty) continue;
              const price = resolveDotPrice(dd, variantData);
              const val = qty * price;
              storeTotal += val;
              totalInventoryValue += val;
              byBrand[brandName] = (byBrand[brandName] || 0) + val;
            }
          }, 10);
        }, 10);
      }, 6); // a bit lower to avoid overwhelming Firestore

      byBranch[storeId] = (byBranch[storeId] || 0) + storeTotal;
    }, 4);

    // Fetch branch names in batches of 10 (Firestore 'in' limit)
    const nameMap: Record<string, string> = {};
    for (let i = 0; i < storeIds.length; i += 10) {
      const batch = storeIds.slice(i, i + 10);
      const snap = await db.collection("stores").where("__name__", "in", batch).get();
      for (const d of snap.docs) {
        nameMap[d.id] =
          (d.get("branchName") as string) ||
          (d.get("name") as string) ||
          d.id;
      }
    }

    const inventoryByBranchData: ChartDatum[] = Object.entries(byBranch)
      .map(([id, v]) => ({ name: nameMap[id] || id, value: Math.round(v) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 30);

    const productCategoriesData: ChartDatum[] = Object.entries(byBrand)
      .map(([k, v]) => ({ name: k, value: Math.round(v) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    // ---------- 3) Transfers over time + pending ----------
    // Firestore: ใช้ < endPlusOneDay แทน <= end เพื่อชัดเจนว่า "ภายในวัน"
    const endPlusOne = new Date(end);
    endPlusOne.setDate(endPlusOne.getDate() + 1);
    endPlusOne.setHours(0, 0, 0, 0);

    let transfersOverTimeData: TransfersDatum[] = [];
    let pendingTransfers = 0;

    try {
      const transfersSnap = await db
        .collection("transfer_requests")
        .where("createdAt", ">=", start)
        .where("createdAt", "<", endPlusOne)
        .get();

      const inboundByDay: Record<string, number> = {};
      const outboundByDay: Record<string, number> = {};
      const pendingStatuses = new Set(["requested", "approved", "shipped"]);
      const vis = new Set(storeIds);

      for (const d of transfersSnap.docs) {
        const data = d.data() as any;
        const ts: any = data.createdAt;
        const created = ts?.toDate ? ts.toDate() : (ts?.seconds ? new Date(ts.seconds * 1000) : new Date());
        const day = dkey(created);
        const buyer = data.buyerBranchId as string | undefined;
        const seller = data.sellerBranchId as string | undefined;
        const status = String(data.status || "");

        if (buyer && vis.has(buyer)) inboundByDay[day] = (inboundByDay[day] || 0) + 1;
        if (seller && vis.has(seller)) outboundByDay[day] = (outboundByDay[day] || 0) + 1;
        if (pendingStatuses.has(status)) pendingTransfers++;
      }

      const dayKeys = Array.from(new Set([...Object.keys(inboundByDay), ...Object.keys(outboundByDay)])).sort();
      transfersOverTimeData = dayKeys.map((k) => ({
        name: k,
        inbound: inboundByDay[k] || 0,
        outbound: outboundByDay[k] || 0,
      }));
    } catch (err: any) {
      // กันเคส index ยังไม่พร้อม (FAILED_PRECONDITION = code 9) หรือ project ใหม่
      if (Number(err?.code) === 9) {
        // ส่งข้อมูลว่าง แต่ยัง ok:true เพื่อให้หน้า UI แสดงส่วนอื่นได้
        transfersOverTimeData = [];
        pendingTransfers = 0;
      } else {
        throw err;
      }
    }

    const summaryData: SummaryData = {
      totalInventoryValue: Math.round(totalInventoryValue),
      pendingTransfers,
      branchCount: storeIds.length,
      totalUsers,
    };

    return NextResponse.json({
      ok: true,
      summaryData,
      inventoryByBranchData,
      transfersOverTimeData,
      productCategoriesData,
    } satisfies SummaryResponse);
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    return NextResponse.json({ ok: false, error: "internal_server_error" }, { status: 500 });
  }
}
