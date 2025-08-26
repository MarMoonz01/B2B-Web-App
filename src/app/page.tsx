'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform, type Variants } from 'framer-motion';

// shadcn/ui
import { Button } from 'components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card';
import { Badge } from 'components/ui/badge';

// icons
import type { LucideIcon } from 'lucide-react';
import {
  Timer,
  ArrowLeftRight,
  BarChart3,
  Shield,
  ArrowRight,
  Sparkles,
  ChevronDown,
  Star,
  Users,
  TrendingUp,
  Zap,
  Lock,
  Smartphone,
  Cloud,
  Play,
  Quote,
} from 'lucide-react';

/** ====== QUICK PATHS ====== */
const PATHS = {
  login: '/login',
  register: '/join',
};

/** ====== Variants (Framer Motion) ====== */
const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] },
  },
};

const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -100 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] },
  },
};

const slideInRight: Variants = {
  hidden: { opacity: 0, x: 100 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.8, ease: [0.25, 0.1, 0.25, 1] },
  },
};

/** ====== Premium Background ====== */
const PremiumBackground = () => {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, -200]);
  const y2 = useTransform(scrollY, [0, 1000], [0, -400]);
  const opacity = useTransform(scrollY, [0, 500], [1, 0.3]);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Main gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(2000px 1200px at 50% -30%, rgba(79, 70, 229, 0.03), transparent), radial-gradient(1500px 800px at 80% 20%, rgba(236, 72, 153, 0.02), transparent), radial-gradient(1200px 600px at 20% 70%, rgba(168, 85, 247, 0.02), transparent), linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
        }}
      />

      {/* Animated orbs */}
      <motion.div
        style={{ y: y1, opacity }}
        className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-br from-blue-100/30 to-indigo-100/20 rounded-full blur-3xl"
        animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />

      <motion.div
        style={{ y: y2, opacity }}
        className="absolute top-1/3 right-20 w-64 h-64 bg-gradient-to-br from-purple-100/40 to-pink-100/30 rounded-full blur-2xl"
        animate={{ scale: [1.2, 0.8, 1.2], rotate: [360, 180, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
      />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)',
          backgroundSize: '100px 100px',
        }}
      />
    </div>
  );
};

/** ====== Types ====== */
type Feature = {
  icon: LucideIcon;
  title: string;
  desc: string;
  chips?: string[];
  gradient: string;
};

/** ====== Feature Data ====== */
const FEATURES: Feature[] = [
  {
    icon: Timer,
    title: 'ติดตั้งเร็ว ใช้ได้ทันที',
    desc: 'เชื่อม Firebase/Firestore แล้วพร้อมใช้งานภายในไม่กี่นาที ไม่ต้องลงโปรแกรม',
    chips: ['ไม่ต้องลงเครื่อง', 'รองรับมือถือ'],
    gradient: 'from-blue-600 to-cyan-600',
  },
  {
    icon: ArrowLeftRight,
    title: 'แชร์สต็อกข้ามสาขา',
    desc: 'เห็นสต็อกและโอนระหว่างสาขาแบบเรียลไทม์ พร้อมสถานะติดตามครบ',
    chips: ['Track status', 'แจ้งเตือนอัตโนมัติ'],
    gradient: 'from-emerald-600 to-teal-600',
  },
  {
    icon: BarChart3,
    title: 'ลดของค้าง เพิ่มยอดขาย',
    desc: 'กระจายของไปสาขาที่มีดีมานด์สูงขึ้น Fill rate ดีขึ้น Dead stock ลดลง',
    chips: ['Fill rate ↑', 'Dead stock ↓'],
    gradient: 'from-violet-600 to-purple-600',
  },
  {
    icon: Shield,
    title: 'ปลอดภัย มาตรฐานองค์กร',
    desc: 'สิทธิ์ตามบทบาท (RBAC) + Audit log ครบ ตรวจสอบย้อนหลังได้',
    chips: ['RBAC', 'Audit log'],
    gradient: 'from-orange-600 to-red-600',
  },
];

/** ====== Feature Card ====== */
const FeatureCard = ({ feature, index }: { feature: Feature; index: number }) => {
  const Icon = feature.icon;

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      variants={{
        hidden: { opacity: 0, y: 60, scale: 0.95 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            duration: 0.7,
            delay: index * 0.1,
            ease: [0.25, 0.1, 0.25, 1],
          },
        },
      }}
      whileHover={{ y: -8, transition: { duration: 0.3 } }}
      className="group relative"
    >
      <Card className="relative h-full overflow-hidden border-0 bg-white/60 backdrop-blur-xl shadow-lg hover:shadow-2xl transition-all duration-500">
        {/* Gradient background */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}
        />

        {/* Icon with gradient background */}
        <CardHeader className="relative pb-6">
          <div className="flex items-start justify-between">
            <motion.div
              className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} p-3 shadow-lg`}
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ duration: 0.2 }}
            >
              <Icon className="h-8 w-8 text-white" />
            </motion.div>
          </div>
          <CardTitle className="text-xl font-semibold text-gray-900 leading-tight mt-4">
            {feature.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="relative space-y-6">
          <p className="text-gray-600 leading-relaxed text-base">{feature.desc}</p>

          {!!feature.chips?.length && (
            <div className="flex flex-wrap gap-2">
              {feature.chips.map((chip, chipIndex) => (
                <motion.div
                  key={chip}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 + chipIndex * 0.05 }}
                >
                  <Badge
                    variant="secondary"
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium px-3 py-1 rounded-full border-0"
                  >
                    {chip}
                  </Badge>
                </motion.div>
              ))}
            </div>
          )}

          {/* Subtle bottom accent */}
          <motion.div
            className={`h-1 rounded-full bg-gradient-to-r ${feature.gradient} opacity-20`}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: index * 0.1 }}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
};

/** ====== Stats Section ====== */
const StatsSection = () => {
  const stats = [
    { number: '10,000+', label: 'บริษัทใช้งาน' },
    { number: '50M+', label: 'รายการสินค้า' },
    { number: '99.9%', label: 'Uptime' },
    { number: '24/7', label: 'การสนับสนุน' },
  ];

  return (
    <section className="py-32 relative">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={staggerContainer}
          className="grid grid-cols-2 md:grid-cols-4 gap-8"
        >
          {stats.map((stat, index) => (
            <motion.div key={index} variants={fadeInUp} className="text-center group">
              <motion.div
                className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-2"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                {stat.number}
              </motion.div>
              <div className="text-gray-600 text-sm font-medium uppercase tracking-wider">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

/** ====== Product Showcase ====== */
const HERO_IMG =
  'https://images.unsplash.com/photo-1748609160056-7b95f30041f0?auto=format&fit=crop&q=80&w=1400';

const ProductShowcase = () => {
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={staggerContainer}
          className="grid lg:grid-cols-2 gap-20 items-center"
        >
          <motion.div variants={slideInLeft} className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-full text-sm text-blue-700 font-medium">
              <Sparkles className="h-4 w-4" />
              <span>Dashboard ที่ทันสมัย</span>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
              ควบคุมทุกอย่าง
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ในหน้าเดียว
              </span>
            </h2>

            <p className="text-xl text-gray-600 leading-relaxed">
              Dashboard ที่ออกแบบมาเพื่อให้คุณเห็นภาพรวมธุรกิจแบบ real-time พร้อมข้อมูลเชิงลึกที่ช่วยในการตัดสินใจ
            </p>

            <div className="space-y-4">
              {[
                { icon: TrendingUp, text: 'Analytics แบบ Real-time' },
                { icon: Zap, text: 'Performance Insights' },
                { icon: Lock, text: 'Security Dashboard' },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-gray-700 font-medium">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={slideInRight} className="relative">
            <div className="relative">
              <Image
                src={HERO_IMG}
                alt="Modern dashboard analytics"
                width={1400}
                height={900}
                className="w-full rounded-3xl shadow-2xl h-auto"
                priority
              />

              {/* Floating elements */}
              <motion.div
                className="absolute -top-6 -right-6 w-24 h-24 bg-white rounded-2xl shadow-xl flex items-center justify-center"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">+40%</div>
                  <div className="text-xs text-gray-500">เพิ่มขึ้น</div>
                </div>
              </motion.div>

              <motion.div
                className="absolute -bottom-6 -left-6 w-32 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center gap-2"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-700">Real-time</span>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

/** ====== Testimonials Section ====== */
const TestimonialsSection = () => {
  const testimonials = [
    {
      quote:
        'Tire Network ช่วยให้เราลดของค้างลง 60% ในเวลาเพียง 3 เดือน ระบบใช้งานง่ายมาก',
      author: 'นาย สมชาย วงศ์ใหญ่',
      role: 'CEO, Thai Tire Distribution',
      rating: 5,
    },
    {
      quote:
        'การโอนสต็อกระหว่างสาขาที่เคยใช้เวลา 2-3 วัน ตอนนี้ทำได้ภายในชั่วโมงเดียว',
      author: 'คุณ อนุชา เจริญสุข',
      role: 'Operations Manager, AutoParts Plus',
      rating: 5,
    },
  ];

  return (
    <section className="py-32 bg-gradient-to-br from-gray-50 to-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={staggerContainer}
          className="text-center mb-20"
        >
          <motion.div variants={fadeInUp}>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-full text-sm text-yellow-700 font-medium mb-6">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span>ความคิดเห็นจากลูกค้า</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              ลูกค้าบอกต่อ
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              หลายพันบริษัทเลือกใช้ Tire Network เพื่อการจัดการสต็อกที่มีประสิทธิภาพ
            </p>
          </motion.div>
        </motion.div>

        <motion.div variants={staggerContainer} className="grid md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div key={index} variants={fadeInUp}>
              <Card className="h-full border-0 bg-white/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                  <div className="flex mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>

                  <Quote className="h-8 w-8 text-gray-300 mb-6" />

                  <blockquote className="text-lg text-gray-700 leading-relaxed mb-6">
                    "{testimonial.quote}"
                  </blockquote>

                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.author}</div>
                    <div className="text-gray-600 text-sm">{testimonial.role}</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

/** ====== CTA Section ====== */
const CTASection = () => {
  return (
    <section className="py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900"></div>
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\\"60\\" height=\\"60\\" viewBox=\\"0 0 60 60\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Cg fill=\\"none\\" fill-rule=\\"evenodd\\"%3E%3Cg fill=\\"%23ffffff\\" fill-opacity=\\"0.05\\"%3E%3Ccircle cx=\\"7\\" cy=\\"7\\" r=\\"1\\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
      ></div>

      <div className="max-w-7xl mx-auto px-6 relative">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={staggerContainer}
          className="text-center"
        >
          <motion.div variants={fadeInUp} className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-full text-sm text-white/80 font-medium backdrop-blur-sm">
              <Sparkles className="h-4 w-4" />
              <span>เริ่มต้นฟรี ไม่มีค่าใช้จ่าย</span>
            </div>
          </motion.div>

          <motion.h2
            variants={fadeInUp}
            className="text-5xl md:text-6xl font-bold text-white mb-8 leading-tight"
          >
            พร้อมเปลี่ยนแปลง
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              ธุรกิจของคุณแล้วหรือยัง?
            </span>
          </motion.h2>

          <motion.p
            variants={fadeInUp}
            className="text-xl text-white/80 max-w-3xl mx-auto mb-12 leading-relaxed"
          >
            เข้าร่วมกับหลายพันบริษัทที่เลือกใช้ Tire Network เพื่อการจัดการสต็อกที่มีประสิทธิภาพสูงสุด
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-6 justify-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                asChild
                size="lg"
                className="px-12 py-6 text-lg bg-white text-gray-900 hover:bg-gray-100 shadow-xl hover:shadow-2xl group"
              >
                <Link href={PATHS.register}>
                  เริ่มใช้งานฟรี
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="px-12 py-6 text-lg border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
              >
                <Link href={PATHS.login}>
                  <Play className="mr-2 h-5 w-5" />
                  ดูการสาธิต
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

/** ====== Main Landing Page Component ====== */
export default function Page() {
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, -100]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0.8]);

  return (
    <div className="min-h-screen bg-white text-gray-900 relative overflow-hidden">
      <PremiumBackground />

      {/* Premium Navigation */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="sticky top-0 z-50 w-full border-b border-gray-200/50 bg-white/80 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto flex h-20 items-center justify-between px-6">
          <motion.div className="flex items-center gap-3" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Tire Network
            </span>
          </motion.div>

          <nav className="flex items-center gap-4">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex text-gray-700 hover:text-gray-900">
                <Link href={PATHS.login}>เข้าสู่ระบบ</Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                asChild
                size="sm"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl text-white border-0"
              >
                <Link href={PATHS.register}>ลงทะเบียนเข้าร่วม</Link>
              </Button>
            </motion.div>
          </nav>
        </div>
      </motion.header>

      {/* Hero Section */}
      <motion.main style={{ y: heroY, opacity: heroOpacity }} className="relative pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-6">
          <section className="text-center space-y-12">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex justify-center"
            >
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 rounded-full text-sm text-blue-700 font-medium backdrop-blur-sm">
                <Sparkles className="h-4 w-4" />
                <span>ระบบจัดการสต็อกระดับองค์กร</span>
              </div>
            </motion.div>

            {/* Main Heading */}
            <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-8">
              <motion.h1 variants={fadeInUp} className="text-6xl md:text-7xl lg:text-8xl font-bold leading-tight tracking-tight">
                <span className="block text-gray-900">เชื่อมต่อทุกสาขา</span>
                <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  ในที่เดียว
                </span>
              </motion.h1>

              <motion.p variants={fadeInUp} className="max-w-4xl mx-auto text-2xl md:text-3xl text-gray-600 leading-relaxed font-light">
                แพลตฟอร์มโอนย้ายสต็อกข้ามสาขาแบบเรียลไทม์ที่
                <span className="font-semibold text-gray-900"> ใช้งานง่าย</span>,
                <span className="font-semibold text-gray-900"> ปลอดภัย</span> และ
                <span className="font-semibold text-gray-900"> ขยายได้</span>
              </motion.p>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8"
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ duration: 0.2 }}>
                <Button
                  asChild
                  size="lg"
                  className="px-12 py-8 text-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-2xl hover:shadow-3xl group border-0 text-white"
                >
                  <Link href={PATHS.register}>
                    ลงทะเบียนเข้าร่วม
                    <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ duration: 0.2 }}>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="px-12 py-8 text-xl border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700"
                >
                  <Link href={PATHS.login}>เข้าสู่ระบบ</Link>
                </Button>
              </motion.div>
            </motion.div>

            {/* Scroll Indicator */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.2 }} className="flex flex-col items-center gap-3 pt-16">
              <span className="text-sm text-gray-500 uppercase tracking-wider font-medium">
                เลื่อนลงเพื่อดูเพิ่มเติม
              </span>
              <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                <ChevronDown className="h-5 w-5 text-gray-400" />
              </motion.div>
            </motion.div>
          </section>
        </div>
      </motion.main>

      {/* Stats Section */}
      <StatsSection />

      {/* Features Section */}
      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
            className="text-center mb-20"
          >
            <motion.div variants={fadeInUp}>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-full text-sm text-gray-700 font-medium mb-6">
                <Zap className="h-4 w-4" />
                <span>ความสามารถหลัก</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">ทุกอย่างที่คุณต้องการ</h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                เครื่องมือครบครันสำหรับการจัดการสต็อกระดับมืออาชีพ
              </p>
            </motion.div>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map((feature, index) => (
              <FeatureCard key={feature.title} feature={feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Product Showcase */}
      <ProductShowcase />

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Benefits Section */}
      <section className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
            className="text-center mb-20"
          >
            <motion.h2 variants={fadeInUp} className="text-4xl md:text-5xl font-bold text-gray-900 mb-8">
              ทำไมต้องเลือก Tire Network
            </motion.h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Smartphone,
                title: 'ตั้งค่าเร็ว ไม่ต้องลงเครื่อง',
                desc: 'พร้อมใช้งานภายใน 5 นาที ไม่ต้องติดตั้งซอฟต์แวร์',
              },
              {
                icon: Users,
                title: 'รองรับหลายสาขาและสิทธิ์การใช้งาน',
                desc: 'จัดการผู้ใช้และสิทธิ์การเข้าถึงได้อย่างละเอียด',
              },
              {
                icon: Cloud,
                title: 'ข้อมูลปลอดภัย มาตรฐานองค์กร',
                desc: 'เข้ารหัสข้อมูลระดับธนาคาร พร้อม backup อัตโนมัติ',
              },
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                whileHover={{ y: -8 }}
                className="group relative overflow-hidden rounded-3xl border border-gray-200/50 bg-white/40 backdrop-blur-sm p-8 shadow-lg hover:shadow-2xl transition-all duration-500"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative">
                  <motion.div
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mb-6"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ duration: 0.2 }}
                  >
                    <benefit.icon className="h-8 w-8 text-white" />
                  </motion.div>

                  <h3 className="text-xl font-semibold text-gray-900 mb-4">{benefit.title}</h3>

                  <p className="text-gray-600 leading-relaxed">{benefit.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid md:grid-cols-4 gap-12 mb-12"
          >
            <motion.div variants={fadeInUp} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Tire Network</span>
              </div>
              <p className="text-gray-600 leading-relaxed">แพลตฟอร์มจัดการสต็อกสำหรับธุรกิจยุคใหม่</p>
            </motion.div>

            {[
              {
                title: 'ผลิตภัณฑ์',
                links: ['ระบบสต็อก', 'Analytics', 'การรายงาน', 'API'],
              },
              {
                title: 'บริษัท',
                links: ['เกี่ยวกับเรา', 'ข่าวสาร', 'อาชีพ', 'ติดต่อเรา'],
              },
              {
                title: 'สนับสนุน',
                links: ['ศูนย์ช่วยเหลือ', 'เอกสาร', 'สถานะระบบ', 'ติดต่อสนับสนุน'],
              },
            ].map((section) => (
              <motion.div key={section.title} variants={fadeInUp} className="space-y-4">
                <h4 className="font-semibold text-gray-900">{section.title}</h4>
                <div className="space-y-2">
                  {section.links.map((link) => (
                    <motion.div
                      key={link}
                      className="text-gray-600 hover:text-gray-900 cursor-pointer transition-colors text-sm"
                      whileHover={{ x: 2 }}
                      transition={{ duration: 0.2 }}
                    >
                      {link}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div variants={fadeInUp} className="pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} Tire Network — สงวนลิขสิทธิ์
          </motion.div>
        </div>
      </footer>
    </div>
  );
}
