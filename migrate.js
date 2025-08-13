/* eslint-disable no-console */
const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('csv-parser');

// ====== CONFIG ======
const serviceAccount = require('./service-account-key.json'); // อย่า commit ไฟล์นี้ขึ้น git
const csvFilePath = './tyreplusratchapruek.csv';

const storeId = 'tyreplus_ratchapruek';
const storeName = 'Tyreplus สาขา Ratchapruek';

const BATCH_HARD_LIMIT = 500;
const BATCH_SAFE_CHUNK = 450;
// =====================

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ------- Helpers -------
const toId = (s) =>
  String(s || '')
    .trim()
    .toUpperCase()
    .replace(/[\/\\\s]+/g, '-') // แทน / \ และช่องว่างด้วย '-'
    .replace(/[^A-Z0-9\-\._]/g, ''); // ตัดตัวอักษรพิเศษอื่นๆ

const variantIdFrom = (size, loadIndex = '') =>
  toId(loadIndex ? `${size} ${loadIndex}` : size);

// parse number (รองรับ , และเว้นวรรค)
const toNum = (v, def = 0) => {
  if (v === null || v === undefined) return def;
  const n = parseFloat(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : def;
};

const toInt = (v, def = 0) => {
  if (v === null || v === undefined) return def;
  const n = parseInt(String(v).replace(/[^\d\-]/g, ''), 10);
  return Number.isFinite(n) ? n : def;
};

// หา field แบบมีดัชนี โดยรองรับรูปแบบคั่น: ช่องว่าง/_/-
const findIndexed = (row, bases, idx) => {
  const keys = Object.keys(row);
  for (const base of bases) {
    const re = new RegExp(`^${base}[\\s_-]*${idx}$`, 'i');
    const k = keys.find((kk) => re.test(kk));
    if (k) return row[k];
  }
  return undefined;
};

const qtyField = (row, i) => findIndexed(row, ['จำนวน', 'Qty', 'QTY'], i);
const promoField = (row, i) => findIndexed(row, ['โปรโมชั่น', 'Promo', 'PROMO', 'โปร'], i);

// แตก batch เป็นชุด ๆ
async function commitInChunks(writes) {
  let committed = 0;
  for (let i = 0; i < writes.length; i += BATCH_SAFE_CHUNK) {
    const chunk = writes.slice(i, i + BATCH_SAFE_CHUNK);
    const batch = db.batch();
    for (const w of chunk) {
      if (w.op === 'set') batch.set(w.ref, w.data, w.options || undefined);
      else if (w.op === 'update') batch.update(w.ref, w.data);
      else if (w.op === 'delete') batch.delete(w.ref);
    }
    await batch.commit();
    committed += chunk.length;
    console.log(`✅ committed ${committed}/${writes.length}`);
  }
}

async function migrateData() {
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (r) => rows.push(r))
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`🚀 Start import for store: ${storeName} (${storeId}), rows=${rows.length}`);

  const writes = [];

  // ensure store doc
  const storeDocRef = db.collection('stores').doc(storeId);
  writes.push({
    op: 'set',
    ref: storeDocRef,
    data: { branchName: storeName, isActive: true },
    options: { merge: true },
  });

  let productCount = 0;
  let dotCount = 0;

  for (const row of rows) {
    const brand = row['ยี่ห้อยาง'] || row['Brand'] || row['BRAND'];
    const model = row['Model'] || row['MODEL'];
    const size = row['Size'] || row['SIZE'];
    const loadIndex = row['Load Index'] || row['LOAD INDEX'] || row['LI'] || '';
    const basePrice = toNum(row['Price'] ?? row['PRICE'] ?? row['Base Price']);

    if (!brand || !model || !size) continue;

    const brandId = toId(brand);
    const modelId = toId(model);
    const variantId = variantIdFrom(size, loadIndex);

    const brandDocRef = storeDocRef.collection('inventory').doc(brandId);
    const modelDocRef = brandDocRef.collection('models').doc(modelId);
    const variantDocRef = modelDocRef.collection('variants').doc(variantId);

    // upsert brand/model/variant
    writes.push({ op: 'set', ref: brandDocRef, data: { brandName: brand }, options: { merge: true } });
    writes.push({ op: 'set', ref: modelDocRef, data: { modelName: model }, options: { merge: true } });
    writes.push({
      op: 'set',
      ref: variantDocRef,
      data: {
        size: String(size).trim(),
        loadIndex: String(loadIndex || '').trim(),
        basePrice,
        variantId, // เก็บไว้เผื่อใช้ค้นภายหลัง
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      options: { merge: true },
    });

    // --- สแกนคอลัมน์ DOT ทั้งหมดแบบไดนามิก ---
    const dotKeys = Object.keys(row)
      .filter((k) => /^dot[\s_-]*\d+$/i.test(k)) // รองรับ DOT 1, DOT_1, DOT-1, dot1
      .map((k) => ({ key: k, idx: parseInt(String(k).match(/\d+/)[0], 10) }))
      .sort((a, b) => a.idx - b.idx);

    let hasAnyDot = false;

    for (const { key, idx } of dotKeys) {
      const dotCodeRaw = row[key];
      const qtyRaw = qtyField(row, idx);
      const promoRaw = promoField(row, idx);

      const dotCode = String(dotCodeRaw || '').trim();
      const qty = toInt(qtyRaw);
      const promo = promoRaw === undefined ? undefined : toNum(promoRaw, null);

      if (!dotCode || qty <= 0) continue;

      const dotRef = variantDocRef.collection('dots').doc(dotCode);
      const dotData = {
        qty,
        ...(promo ? { promoPrice: promo } : {}),
      };

      writes.push({ op: 'set', ref: dotRef, data: dotData, options: { merge: true } });
      hasAnyDot = true;
      dotCount++;
    }

    if (hasAnyDot) productCount++;
  }

  console.log(`🧾 prepared writes (brand/model/variant/dots): ~${writes.length}`);
  await commitInChunks(writes);

  console.log(`🎉 Done. products=${productCount}, dots=${dotCount}`);
}

migrateData()
  .catch((e) => {
    console.error('❌ Import failed', e);
    process.exit(1);
  });
