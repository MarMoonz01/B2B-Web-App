// src/app/components/NotificationBell.tsx
'use client';

import React from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/contexts/NotificationContext';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

function timeSince(date: any) {
  if (!date?.seconds) return '';
  const seconds = Math.floor((new Date().getTime() - date.seconds * 1000) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "m ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "min ago";
  return "just now";
}

export default function NotificationBell() {
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleNotificationClick = (notif: any) => {
    markAsRead(notif.id);
    router.push(notif.link || '/');
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
            <h4 className="font-medium text-sm">Notifications</h4>
            {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={markAllAsRead}>
                    <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all as read
                </Button>
            )}
        </div>
        <ScrollArea className="h-96">
            {notifications.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground p-10">
                    No notifications yet.
                </div>
            ) : (
                <div className="space-y-1 p-2">
                    {notifications.map((notif) => (
                        <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className="flex items-start gap-3 rounded-md p-3 hover:bg-muted cursor-pointer"
                        >
                            {!notif.isRead && (
                                <span className="flex h-2 w-2 translate-y-1 rounded-full bg-sky-500" />
                            )}
                            <div className={`flex-1 space-y-1 ${notif.isRead ? 'opacity-70' : ''}`}>
                                <p className="text-sm font-medium leading-none">{notif.title}</p>
                                <p className="text-sm text-muted-foreground">{notif.message}</p>
                                <p className="text-xs text-muted-foreground">{timeSince(notif.createdAt)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}