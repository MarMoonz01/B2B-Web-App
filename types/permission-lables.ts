import { Permission } from './permission';

export const PERMISSION_LABELS: Record<Permission, { name: string; description: string }> = {
  // Overview
  'overview:read': { name: 'ดูภาพรวมสาขา', description: 'เข้าถึงหน้า Overview (KPI/กราฟ/กิจกรรมล่าสุด) ของสาขาที่ได้รับสิทธิ์' },

  // Inventory
  'inventory:read':   { name: 'ดูคลังสินค้า', description: 'สามารถดูรายการสินค้าในคลังได้' },
  'inventory:write':  { name: 'จัดการคลังสินค้า', description: 'สามารถเพิ่มและแก้ไขข้อมูลสินค้าได้' },
  'inventory:delete': { name: 'ลบสินค้า', description: 'สามารถลบสินค้าออกจากคลังได้' },

  // Transfers
  'transfer:create':   { name: 'สร้างคำขอโอนย้าย', description: 'สามารถสร้างคำขอโอนย้ายสินค้าไปสาขาอื่น' },
  'transfer:approve':  { name: 'อนุมัติคำขอโอนย้าย', description: 'สามารถอนุมัติหรือปฏิเสธคำขอโอนย้ายได้' },
  'transfer:read':     { name: 'ดูรายการโอนย้าย', description: 'สามารถดูประวัติการโอนย้ายทั้งหมดของสาขาได้' },

  // Branch Users
  'users:manage':       { name: 'จัดการผู้ใช้ในสาขา', description: 'สามารถเพิ่มหรือลบผู้ใช้ออกจากสาขาได้' },
  'users:assign_roles': { name: 'กำหนดสิทธิ์ในสาขา', description: 'สามารถกำหนด Role ให้กับผู้ใช้ในสาขาได้' },

  // Branch Settings
  'branch:settings':    { name: 'ตั้งค่าสาขา', description: 'สามารถแก้ไขข้อมูลทั่วไปของสาขาได้' },

  // Super Admin
  'admin:roles:manage':     { name: 'จัดการ Roles ระบบ', description: 'สามารถสร้าง/แก้ไข/ลบ Role ทั้งหมดในระบบ' },
  'admin:users:manage':     { name: 'จัดการผู้ใช้ทั้งหมด', description: 'สามารถจัดการผู้ใช้ทั้งหมด ทุกสาขา' },
  'admin:branches:manage':  { name: 'จัดการสาขาทั้งหมด', description: 'สามารถสร้าง/แก้ไข/ลบสาขาในระบบได้' },
  'admin:view_analytics':   { name: 'ดูภาพรวม Analytics', description: 'สามารถเข้าถึง Dashboard ภาพรวมธุรกิจได้' },
};
