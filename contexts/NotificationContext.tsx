'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy, writeBatch } from "firebase/firestore";
import { useBranch } from './BranchContext';
import type { Notification } from '@/lib/services/InventoryService';

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  /** true เมื่อมี branch แล้วและโหลดเสร็จ */
  ready: boolean; // ✅ มีตัวแปรนี้จริง
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { selectedBranchId } = useBranch();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ไม่มี branch → clear แล้วไม่ subscribe
    if (!selectedBranchId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'notifications'),
      where('branchId', '==', selectedBranchId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Notification));
        setNotifications(notifs);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching notifications:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedBranchId]);

  
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  // state พร้อมใช้งาน (มี branch และโหลดเสร็จ)
  const ready = !!selectedBranchId && !loading;

  const markAsRead = useCallback(
    async (id: string) => {
      if (!id) return;
      const notif = notifications.find((n) => n.id === id);
      if (!notif || notif.isRead) return;

      try {
        const ref = doc(db, 'notifications', id);
        await updateDoc(ref, { isRead: true });
      } catch (err) {
        console.error(`Failed to mark notification ${id} as read:`, err);
      }
    },
    [notifications]
  );

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.isRead && n.id);
    if (unread.length === 0) return;

    try {
      
      const batch = writeBatch(db);
      unread.forEach((n) => {
        const ref = doc(db, 'notifications', n.id!);
        batch.update(ref, { isRead: true });
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  }, [notifications]);

  const value: NotificationContextType = {
    notifications,
    unreadCount, // ✅ มีใน scope แล้ว
    loading,
    ready,       // ✅ มีใน scope แล้ว
    markAsRead,
    markAllAsRead,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}
