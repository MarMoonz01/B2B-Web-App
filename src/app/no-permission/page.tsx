import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import Link from 'next/link';

export default function NoPermissionPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto bg-destructive/10 text-destructive p-3 rounded-full w-fit">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <CardTitle className="mt-4 text-2xl">ไม่มีสิทธิ์เข้าใช้งาน</CardTitle>
          <CardDescription>
            กรุณาเข้าสู่ระบบก่อนเพื่อใช้งานส่วนนี้ของแอปพลิเคชัน
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/login">ไปที่หน้าล็อกอิน</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}