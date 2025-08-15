// hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // ตั้งค่า timer ที่จะอัปเดตค่า debounced value หลังจาก delay ผ่านไป
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function: จะถูกเรียกเมื่อ value หรือ delay เปลี่ยนแปลง
    // เพื่อยกเลิก timer ก่อนหน้า ป้องกันการอัปเดตที่ไม่จำเป็น
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]); // Effect นี้จะทำงานอีกครั้งเมื่อ value หรือ delay เปลี่ยนไป

  return debouncedValue;
}