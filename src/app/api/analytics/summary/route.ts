// /api/analytics/summary/route.ts — Branch-only API for Overview
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebaseAdmin";
import { getServerSession } from "@/src/lib/session";

function parseDateOnlyISO(s?: string): Date | null {
  if (!s) return null;
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(s);
  return ok ? new Date(`${s}T00:00:00.000Z`) : null;
}

export async function GET(req: Request) {
  try {
    const me = await getServerSession();
    if (!me) return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    const fromISO = searchParams.get("from");
    const toISO = searchParams.get("to");

    if (!branchId) return NextResponse.json({ ok: false, error: "branchId_required" }, { status: 400 });

    const from = parseDateOnlyISO(fromISO);
    const to = parseDateOnlyISO(toISO);

    // 1) INVENTORY SNAPSHOT — stores/{branchId}/inventory/*/models/*/variants/*
    const storeRef = db.collection("stores").doc(branchId);
    const invRef = storeRef.collection("inventory");

    const invSnap = await invRef.get();
    let totalInventoryValue = 0;
    let skuCount = 0;
    let outOfStockCount = 0;
    const categoryCounter: Record<string, number> = {};

    for (const brandDoc of invSnap.docs) {
      const modelsSnap = await brandDoc.ref.collection("models").get();
      for (const modelDoc of modelsSnap.docs) {
        const variantsSnap = await modelDoc.ref.collection("variants").get();
        for (const v of variantsSnap.docs) {
          const d: any = v.data();
          const qty = Number(d.quantity ?? 0);
          const unit = Number(d.price ?? d.base ?? d.unitPrice ?? 0);
          totalInventoryValue += qty * unit;
          skuCount += 1;
          if (qty <= 0) outOfStockCount += 1;
          const cat = (d.category || d.brandName || brandDoc.id || "Other").toString();
          categoryCounter[cat] = (categoryCounter[cat] || 0) + qty;
        }
      }
    }

    // 2) TRANSFERS — ใช้คอลเลกชัน transfer_requests (ถ้าโปรดักชันคุณใช้ชื่อ "transfers" ให้เปลี่ยนตรงนี้)
    const trCol = db.collection("transfer_requests");

    const inclusiveEnd = (d: Date) => new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1);
    const inWindow = (ts: any) => {
      if (!from || !to) return true;
      const val = ts?.toDate ? ts.toDate() : new Date(ts);
      if (!val || Number.isNaN(val.getTime())) return false;
      return val >= from && val <= inclusiveEnd(to);
    };

    // ทำสอง query แล้ว merge (เพราะ OR คนละฟิลด์ทำตรง ๆ ไม่ได้)
    const qOut = await trCol.where("fromBranchId", "==", branchId).orderBy("createdAt", "desc").limit(60).get();
    const qIn  = await trCol.where("toBranchId", "==", branchId).orderBy("createdAt", "desc").limit(60).get();

    let pendingTransfers = 0;
    let inboundToday = 0;
    let outboundToday = 0;

    const todayKey = new Date().toISOString().slice(0, 10);
    const transfersByMonth: Record<string, number> = {};
    const productMoveCounter: Record<string, number> = {};

    function bumpMonth(d: Date) {
      const key = d.toLocaleString("default", { month: "short" });
      transfersByMonth[key] = (transfersByMonth[key] || 0) + 1;
    }

    const allTr = [...qOut.docs, ...qIn.docs];
    for (const doc of allTr) {
      const t: any = doc.data();
      const created = t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
      if (!created || Number.isNaN(created.getTime())) continue;
      if (!inWindow(t.createdAt)) continue;

      if ((t.status || "").toString().toLowerCase() === "pending") pendingTransfers += 1;
      bumpMonth(created);

      const key = created.toISOString().slice(0, 10);
      if (key === todayKey) {
        if (t.toBranchId === branchId) inboundToday += 1;
        if (t.fromBranchId === branchId) outboundToday += 1;
      }

      // top movers: รวมจำนวนตามชื่อสินค้า
      const items: any[] = Array.isArray(t.items) ? t.items : [];
      for (const it of items) {
        const name = (it.productName || it.name || it.sku || it.variantId || "Item").toString();
        const q = Number(it.quantity ?? 0);
        if (q > 0) productMoveCounter[name] = (productMoveCounter[name] || 0) + q;
      }
    }

    // shape outputs
    const productCategoriesData = Object.entries(categoryCounter)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const transfersOverTimeData = Object.entries(transfersByMonth)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const topMovingProductsData = Object.entries(productMoveCounter)
      .map(([name, moved]) => ({ name, moved }))
      .sort((a, b) => (b.moved as number) - (a.moved as number))
      .slice(0, 15);

    const summaryData = {
      totalInventoryValue,
      skuCount,
      outOfStockCount,
      pendingTransfers,
      inboundToday,
      outboundToday,
    };

    return NextResponse.json({
      ok: true,
      summaryData,
      transfersOverTimeData,
      productCategoriesData,
      topMovingProductsData,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "internal_server_error" }, { status: 500 });
  }
}
