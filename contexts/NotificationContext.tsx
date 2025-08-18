// contexts/NotificationContext.tsx
'use client'; // << [FIX] แก้ไขจาก 'use-client' เป็น 'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from 'firebase/firestore';
import { useBranch } from './BranchContext';
import type { Notification } from '@/lib/services/InventoryService';

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { selectedBranchId } = useBranch();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(notifs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notifications:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedBranchId]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = useCallback(async (id: string) => {
    if (!id) return;
    
    const notif = notifications.find(n => n.id === id);
    if (notif && !notif.isRead) {
      try {
        const notifRef = doc(db, 'notifications', id);
        await updateDoc(notifRef, { isRead: true });
      } catch (error) {
        console.error(`Failed to mark notification ${id} as read:`, error);
      }
    }
  }, [notifications]);

  const markAllAsRead = useCallback(async () => {
    const unreadNotifications = notifications.filter(n => !n.isRead && n.id);
    if (unreadNotifications.length === 0) return;

    try {
      const batch = unreadNotifications.map(notif => {
        const notifRef = doc(db, 'notifications', notif.id!);
        return updateDoc(notifRef, { isRead: true });
      });
      await Promise.all(batch);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }, [notifications]);

  const value = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}