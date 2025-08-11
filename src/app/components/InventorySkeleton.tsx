import { Card, CardHeader, CardContent } from "@/components/ui/card";

// Component ย่อยสำหรับสร้างการ์ดโครงร่าง 1 ใบ
const SkeletonCard = () => (
  <Card className="overflow-hidden">
    <CardHeader className="p-4 flex flex-row items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Placeholder for expand icon */}
        <div className="h-5 w-5 rounded-full bg-slate-200" />
        <div className="space-y-2">
          {/* Placeholder for product name */}
          <div className="h-4 w-48 rounded-md bg-slate-200" />
          {/* Placeholder for subtitle */}
          <div className="h-3 w-32 rounded-md bg-slate-200" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Placeholder for buttons */}
        <div className="h-8 w-20 rounded-md bg-slate-200" />
        <div className="h-8 w-20 rounded-md bg-slate-200" />
      </div>
    </CardHeader>
  </Card>
);

// Component หลักที่จะแสดง Skeleton Card หลายๆ ใบ
export default function InventorySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* สร้าง Card ปลอมๆ ขึ้นมา 5 ใบเพื่อเป็นตัวอย่าง */}
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}