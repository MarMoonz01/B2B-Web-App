// src/app/(marketing)/join/page.tsx
'use client';

import { useRouter } from 'next/navigation';
// ปรับ path ให้ตรงโปรเจกต์คุณ (ตัวอย่างนี้ alias '@' = รากโปรเจกต์)
import AddBranchWizard from '@/src/app/components/AddBranchWizard';

export default function JoinPage() {
  const r = useRouter();
  return (
    <main className="min-h-dvh p-6">
      <AddBranchWizard onDone={() => r.push('/login')} />
    </main>
  );
}
