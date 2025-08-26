// IMPORTANT: This code goes into the file:
// src/app/api/admin/applications/approve/route.ts

import { NextResponse } from 'next/server';
import { db } from '@/src/lib/firebaseAdmin'; // Use the ADMIN instance for backend operations
import { getServerSession } from '@/src/lib/session';
import { InventoryService, StoreService, slugifyId } from '@/lib/services/InventoryService';

// We are using the POST method to handle the approval request
export async function POST(req: Request) {
  // 1. Authenticate and authorize the user (must be a moderator)
  const me = await getServerSession();
  if (!me?.moderator) {
    return NextResponse.json({ ok: false, error: 'Forbidden: User is not a moderator.' }, { status: 403 });
  }

  try {
    const { applicationId } = await req.json();
    if (!applicationId || typeof applicationId !== 'string') {
      return NextResponse.json({ ok: false, error: 'Application ID is required and must be a string.' }, { status: 400 });
    }

    // 2. Fetch the application document from Firestore
    const appRef = db.collection('branchApplications').doc(applicationId);
    const appSnap = await appRef.get();

    if (!appSnap.exists || appSnap.data()?.status !== 'pending') {
      return NextResponse.json({ ok: false, error: 'Invalid or already processed application.' }, { status: 404 });
    }
    
    const appData = appSnap.data()!;
    const storeId = slugifyId(appData.branchName);

    // 3. Check if the generated store ID (slug) is already in use
    const isAvailable = await StoreService.isStoreIdAvailable(storeId);
    if (!isAvailable) {
        // If taken, reject the application automatically
        await appRef.update({ status: 'rejected', reason: 'Branch name is already taken.' });
        return NextResponse.json({ ok: false, error: 'Branch name is already taken.' }, { status: 409 });
    }
    
    // 4. Create the actual store/branch in the 'stores' collection
    await StoreService.createStore(storeId, {
      branchName: appData.branchName,
      phone: appData.phone,
      email: appData.email,
      address: appData.address,
      notes: appData.notes,
      isActive: true, // Activate the branch upon creation
    });

    // 5. [Optional] If inventory data was submitted, process it here
    if (appData.inventoryData && appData.inventoryData.rows) {
        // NOTE: This is a placeholder for the logic to import inventory.
        // You would need to loop through `appData.inventoryData.rows`
        // and use `InventoryService` to create each product, similar to the logic
        // that was originally in the AddBranchWizard.
    }

    // 6. Update the application status to 'approved'
    await appRef.update({ 
        status: 'approved', 
        approvedAt: new Date(), 
        approvedBy: me.uid 
    });

    // 7. Return a success response
    return NextResponse.json({ ok: true, storeId: storeId });

  } catch (error: any) {
    console.error("Error in approval API: ", error);
    return NextResponse.json({ ok: false, error: error.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}
