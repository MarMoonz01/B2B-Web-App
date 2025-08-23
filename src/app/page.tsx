'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

// shadcn/ui
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// icons
import {
  Timer,
  ArrowLeftRight,
  BarChart3,
  Shield,
  ArrowRight,
} from 'lucide-react';

/** ====== QUICK PATHS (แก้ตรงนี้ให้ตรงกับโปรเจกต์คุณ) ====== */
const PATHS = {
  login: '/login',
  register: '/join',
};

/** ====== Mini Feature Cards ====== */
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
    desc: 'เชื่อม Firebase/Firestore แล้วพร้อมใช้งานภายในไม่กี่นาที ไม่ต้องลงโปรแกรม',
    chips: ['ไม่ต้องลงเครื่อง', 'รองรับมือถือ'],
  },
  {
    icon: ArrowLeftRight,
    title: 'แชร์สต็อกข้ามสาขา',
    desc: 'เห็นสต็อกและโอนระหว่างสาขาแบบเรียลไทม์ พร้อมสถานะติดตามครบ',
    chips: ['Track status', 'แจ้งเตือนอัตโนมัติ'],
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
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.06, duration: 0.25 } },
};

const item = {
  hidden: { opacity: 0, y: 6, scale: 0.99 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25 } },
};

function FeatureHighlights() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      className="mx-auto mt-10 grid w-full max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {FEATURES.map((f) => {
        const Icon = f.icon;
        return (
          <motion.div key={f.title} variants={item}>
            <Card className="group h-full overflow-hidden border-border/60 bg-card/80 shadow-sm transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg border border-border/60 bg-background p-2">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="min-h-[56px] text-sm text-muted-foreground">{f.desc}</p>
                {f.chips?.length ? (
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
                ) : null}
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

/** ====== Landing Page ====== */
export default function Page() {
  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{
        // พื้นหลังไล่เฉดนุ่ม ๆ (ไม่ใช้รูป)
        backgroundImage:
          'radial-gradient(1200px 600px at 50% -10%, color-mix(in oklab, var(--primary) 6%, transparent), transparent), radial-gradient(900px 500px at 90% 0%, color-mix(in oklab, var(--primary) 4%, transparent), transparent)',
      }}
    >
      {/* Top Nav */}
      <header className="sticky top-0 z-30 w-full border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4">
          <div className="text-sm font-semibold tracking-tight">Tire Network</div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href={PATHS.login}>เข้าสู่ระบบ</Link>
            </Button>
            <Button asChild size="sm" className="shadow-sm">
              <Link href={PATHS.register}>ลงทะเบียนเข้าร่วม</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="relative mx-auto w-full max-w-7xl px-4 pb-20 pt-16 sm:pt-24">
        <section className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mx-auto max-w-4xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
          >
            เชื่อมต่อทุกสาขา <br className="hidden sm:block" />
            <span className="text-muted-foreground">ในที่เดียว</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground sm:text-lg"
          >
            แพลตฟอร์มโอนย้ายสต็อกข้ามสาขาแบบเรียลไทม์ — ใช้งานง่าย ปลอดภัย และขยายได้
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="mt-6 flex items-center justify-center gap-3"
          >
            <Button asChild className="px-5">
              <Link href={PATHS.register}>
                ลงทะเบียนเข้าร่วม
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="px-5">
              <Link href={PATHS.login}>เข้าสู่ระบบ</Link>
            </Button>
          </motion.div>
        </section>

        {/* Feature mini-cards */}
        <FeatureHighlights />

        {/* bottom bullets (optional) */}
        <div className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
            ✅ ตั้งค่าเร็ว ไม่ต้องลงเครื่อง
          </div>
          <div className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
            ✅ รองรับหลายสาขาและสิทธิ์การใช้งาน
          </div>
          <div className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
            ✅ ข้อมูลปลอดภัย มาตรฐานองค์กร
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Tire Network — All rights reserved.
      </footer>
    </div>
  );
}
