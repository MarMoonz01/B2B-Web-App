import React, { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, getFirestore } from "firebase/firestore";
import { db } from '@/lib/firebase';

export function FirebaseTest() {
  const [status, setStatus] = useState('Testing...');
  const [stores, setStores] = useState([]);

  useEffect(() => {
    testFirebase();
  }, []);

  const testFirebase = async () => {
    try {
      console.log('🧪 Starting Firebase test...');
      
      // Test 1: อ่านข้อมูลจาก collection 'stores'
      console.log('🧪 Test 1: Reading stores collection...');
      const storesSnap = await getDocs(collection(db, 'stores'));
      const storesData = storesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('📋 Stores data:', storesData);
      setStores(storesData);
      
      // Test 2: เขียนข้อมูลทดสอบ
      console.log('🧪 Test 2: Writing test document...');
      const testRef = doc(db, 'test', 'connection-test');
      await setDoc(testRef, {
        message: 'Hello from Firebase!',
        timestamp: new Date(),
        browser: navigator.userAgent
      });
      
      // Test 3: อ่านข้อมูลที่เพิ่งเขียน
      console.log('🧪 Test 3: Reading test document...');
      const testSnap = await getDocs(collection(db, 'test'));
      console.log('📋 Test documents:', testSnap.docs.map(d => d.data()));
      
      // Test 4: ลบข้อมูลทดสอบ
      console.log('🧪 Test 4: Cleaning up test document...');
      await deleteDoc(testRef);
      
      setStatus('✅ Firebase connection successful!');
      console.log('✅ All Firebase tests passed!');
      
    } catch (error) {
      console.error('❌ Firebase test failed:', error);
      setStatus(`❌ Error: ${error.message}`);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">🔥 Firebase Connection Test</h3>
      <p className="mb-2"><strong>Status:</strong> {status}</p>
      
      {stores.length > 0 && (
        <div>
          <h4 className="font-medium mb-1">📋 Stores Found ({stores.length}):</h4>
          <ul className="text-sm space-y-1">
            {stores.map((store, i) => (
              <li key={i} className="bg-gray-100 p-1 rounded">
                <strong>{store.id}:</strong> {JSON.stringify(store)}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <button 
        onClick={testFirebase}
        className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm"
      >
        🔄 Run Test Again
      </button>
    </div>
  );
}