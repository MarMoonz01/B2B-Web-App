import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
// เพิ่มฟังก์ชันนี้เข้าไปในไฟล์ utils.ts ที่มีอยู่แล้ว หรือสร้างไฟล์ใหม่

/**
 * Formats a number into a Thai Baht currency string.
 * @param n - The number to format.
 * @returns A string representing the number in THB currency format (e.g., "฿3,500").
 */
export const formatTHB = (n: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

// ... other utility functions ...