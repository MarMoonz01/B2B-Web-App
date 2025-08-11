const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('csv-parser');

// --- การตั้งค่า ---
const serviceAccount = require('./service-account-key.json');
const csvFilePath = './tyreplusratchapruek.csv';
const storeId = 'tyreplus_ratchapruek';
const storeName = 'Tyreplus สาขา Ratchapruek';
// --- สิ้นสุดการตั้งค่า ---

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function migrateData() {
  const allRows = [];
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (row) => allRows.push(row))
    .on('end', async () => {
      console.log(`🚀 เริ่มการนำเข้าข้อมูลสำหรับสาขา: ${storeName}...`);
      const batch = db.batch();

      const storeDocRef = db.collection('stores').doc(storeId);
      batch.set(storeDocRef, { branchName: storeName }, { merge: true });

      for (const row of allRows) {
        const brand = row['ยี่ห้อยาง'];
        const model = row['Model'];
        const size = row['Size'];
        const loadIndex = row['Load Index'] || '';

        if (!brand || !model || !size) continue;

        const brandId = brand.toUpperCase();
        const modelId = model.toUpperCase().replace(/[\s\/]/g, '_');
        const variantId = `${size}_${loadIndex}`.replace(/[\/\s]/g, '-');

        const brandDocRef = storeDocRef.collection('inventory').doc(brandId);
        const modelDocRef = brandDocRef.collection('models').doc(modelId);
        const variantDocRef = modelDocRef.collection('variants').doc(variantId);

        // --- ✨ บรรทัดที่เพิ่มเข้ามาเพื่อแก้ไขปัญหา ✨ ---
        // สร้างเอกสารของ Brand (ยี่ห้อ) ให้แน่ใจว่ามีอยู่จริง
        batch.set(brandDocRef, {}, { merge: true }); 
        // -----------------------------------------

        batch.set(modelDocRef, { modelName: model }, { merge: true });
        batch.set(variantDocRef, {
          size: size,
          loadIndex: loadIndex,
          basePrice: parseFloat(row.Price) || 0
        }, { merge: true });

        for (let i = 1; i <= 4; i++) {
          const dotCode = row[`DOT ${i}`];
          const quantity = parseInt(row[`จำนวน${i}`] || row[`จำนวน ${i}`] || '0', 10);

          if (dotCode && !isNaN(quantity) && quantity > 0) {
            const dotData = { qty: quantity };
            const promoPrice = parseFloat(row[`โปรโมชั่น${i}`]);
            if (promoPrice && promoPrice > 0) {
              dotData.promoPrice = promoPrice;
            }
            const dotDocRef = variantDocRef.collection('dots').doc(dotCode);
            batch.set(dotDocRef, dotData);
          }
        }
      }

      try {
        await batch.commit();
        console.log('--- 🎉 การนำเข้าข้อมูลเสร็จสมบูรณ์! ---');
      } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดระหว่างการนำเข้า:', error);
      }
    });
}

migrateData();