'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Timer,
  ArrowLeftRight,
  BarChart3,
  Shield,
  Bell,
  Smartphone,
  Network,
} from 'lucide-react';

type Feature = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  desc: string;
  chips?: string[];
};

const FEATURES: Feature[] = [
  {
    icon: Timer,
    title: 'ติดตั้งเร็ว ใช้ได้ทันที',
    desc: 'เชื่อมต่อ Firebase/Firestore แล้วใช้งานได้ในไม่กี่นาที ไม่ต้องลงโปรแกรม',
    chips: ['ไม่ต้องลงเครื่อง', 'รองรับมือถือ'],
  },
  {
    icon: ArrowLeftRight,
    title: 'แชร์สต็อกข้ามสาขา',
    desc: 'เห็นสต็อกร่วมแบบเรียลไทม์ โอนด้วยคลิกเดียว พร้อมสถานะติดตาม',
    chips: ['Track status', 'แจ้งเตือนออโต้'],
  },
  {
    icon: BarChart3,
    title: 'ลดของค้าง เพิ่มยอดขาย',
    desc: 'กระจายของไปสาขาที่มีดีมานด์สูงขึ้น Fill rate ดีขึ้น Dead stock ลดลง',
    chips: ['Fill rate ↑', 'Dead stock ↓'],
  },
  {
    icon: Shield,
    title: 'ปลอดภัย มาตรฐานองค์กร',
    desc: 'สิทธิ์ตามบทบาท (RBAC) + Audit log ครบ ตรวจสอบย้อนหลังได้',
    chips: ['RBAC', 'Audit log'],
  },
];

const container = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.06, duration: 0.25 },
  },
};

const item = {
  hidden: { opacity: 0, y: 6, scale: 0.99 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25 } },
};

export default function FeatureHighlights({ className = '' }: { className?: string }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      className={`mx-auto mt-10 grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}
    >
      {FEATURES.map((f) => {
        const Icon = f.icon;
        return (
          <motion.div key={f.title} variants={item}>
            <Card
              className="group h-full overflow-hidden border-border/60 bg-card/80 shadow-sm transition-colors"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg border border-border/60 bg-background p-2">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="min-h-[56px] text-sm text-muted-foreground">
                  {f.desc}
                </p>

                {f.chips && f.chips.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {f.chips.map((c) => (
                      <Badge
                        key={c}
                        variant="secondary"
                        className="bg-secondary/70 text-[11px]"
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* hover glow/float */}
                <motion.div
                  className="pointer-events-none mt-4 h-1 rounded-full bg-gradient-to-r from-primary/40 via-primary/20 to-primary/40 opacity-0"
                  initial={false}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                />
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
