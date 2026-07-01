'use client';

import { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { ProjectChatDrawer } from './ProjectChatDrawer';

interface OrderChatButtonProps {
  orderId: string;
  orderNumber: string;
  customerName: string;
  currentUserId: string;
}

export function OrderChatButton({
  orderId,
  orderNumber,
  customerName,
  currentUserId,
}: OrderChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll for unread count
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch(`/api/solar-orders/${orderId}/chat`);
        if (!res.ok) return;
        const data = await res.json();
        const messages = data.messages || [];
        
        if (messages.length === 0) {
          setUnreadCount(0);
          return;
        }

        const key = `lastSeen_${orderId}_${currentUserId}`;
        const lastSeenStr = localStorage.getItem(key);
        
        if (!lastSeenStr) {
          // If never opened, all messages from OTHERS are unread
          const othersMessages = messages.filter((m: any) => m.createdById !== currentUserId);
          setUnreadCount(othersMessages.length);
        } else {
          const lastSeenDate = new Date(lastSeenStr);
          let count = 0;
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const msgDate = new Date(msg.createdAt);
            if (msg.createdById !== currentUserId && msgDate > lastSeenDate) {
              count++;
            } else if (msgDate <= lastSeenDate) {
              break;
            }
          }
          setUnreadCount(count);
        }
      } catch (e) {
        // ignore
      }
    };

    fetchUnread();

    const interval = setInterval(() => {
      if (!isOpen) {
        fetchUnread();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [orderId, currentUserId, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setUnreadCount(0); // optimistically clear unread count
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-colors rounded-lg shadow-sm relative"
      >
        <MessageCircle size={16} className={unreadCount > 0 ? "text-blue-500" : "text-gray-400"} />
        <span className="hidden sm:inline">Chat</span>
        {unreadCount > 0 && (
          <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <ProjectChatDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        orderId={orderId}
        orderNumber={orderNumber}
        customerName={customerName}
        currentUserId={currentUserId}
      />
    </>
  );
}
