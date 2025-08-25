// contexts/NotificationContext.tsx
'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  orderBy,
  limit,
  writeBatch,
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useBranch } from '@/contexts/BranchContext';
import type { Notification } from '@/lib/services/InventoryService';

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  ready: boolean;               // ล็อกอิน + มี branch แล้วหรือยัง
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { selectedBranchId } = useBranch();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  // ติดตามสถานะล็อกอิน
  useEffect(() => {
    const auth = getAuth();
    const off = onAuthStateChanged(auth, (u) => setAuthed(!!u));
    return () => off();
  }, []);

  // subscribe เฉพาะเมื่อ authed + มี branch
  useEffect(() => {
    if (!authed || !selectedBranchId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const qref = query(
      collection(db, 'notifications'),
      where('branchId', '==', selectedBranchId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      qref,
      (snapshot) => {
        const rows = snapshot.docs.map(
          (d) => ({ id: d.id, ...(d.data() as any) }) as Notification
        );
        setNotifications(rows);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching notifications:', error);
        setNotifications([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authed, selectedBranchId]);

  const unreadCount = notifications.reduce((n, x) => n + (!x.isRead ? 1 : 0), 0);
  const ready = authed && !!selectedBranchId;

  const markAsRead = useCallback(async (id: string) => {
    if (!id) return;
    const n = notifications.find((x) => x.id === id);
    if (!n || n.isRead) return;
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (error) {
      console.error(`Failed to mark notification ${id} as read:`, error);
    }
  }, [notifications]);

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.isRead && n.id);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => batch.update(doc(db, 'notifications', n.id!), { isRead: true }));
      await batch.commit();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, [notifications]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, ready, markAsRead, markAllAsRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
}
