'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatHeader } from './ChatHeader';
import { ChatMessage } from './ChatMessage';
import { ChatComposer } from './ChatComposer';
import { ChatMessageShape } from './types';
import toast from 'react-hot-toast';

interface ProjectChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  customerName: string;
  currentUserId: string;
}

export function ProjectChatDrawer({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  customerName,
  currentUserId,
}: ProjectChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessageShape[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewMessagesBadge, setShowNewMessagesBadge] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Fetch messages
  const fetchMessages = useCallback(async (showLoading = false) => {
    if (!isOpen) return;
    if (showLoading) setIsLoading(true);
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/chat`);
      const data = await res.json();
      if (res.ok) {
        if (!isFirstLoad.current && messages.length > 0) {
          const isActuallyAtBottom = isAtBottom; // capture current state
          
          setMessages(prev => {
            if (prev.length < data.messages.length && !isActuallyAtBottom) {
              setShowNewMessagesBadge(true);
            }
            return data.messages || [];
          });
          
          if (isActuallyAtBottom) {
            setTimeout(() => scrollToBottom('smooth'), 100);
          }
        } else {
          setMessages(data.messages || []);
        }

        // Update last seen
        const key = `lastSeen_${orderId}_${currentUserId}`;
        localStorage.setItem(key, new Date().toISOString());
      }
    } catch (e) {
      console.error('Failed to fetch messages', e);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, orderId, currentUserId, messages.length, isAtBottom]);

  // Auto scroll to bottom
  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'smooth') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior,
      });
      setIsAtBottom(true);
      setShowNewMessagesBadge(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMessages(true);
    }
  }, [isOpen, fetchMessages]);

  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      scrollToBottom(isFirstLoad.current ? 'auto' : 'smooth');
      isFirstLoad.current = false;
    }
  }, [messages, isLoading]);

  // Polling
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      fetchMessages(false);
    }, 15000);
    return () => clearInterval(interval);
  }, [isOpen, fetchMessages]);

  const handleSend = async (messageText: string) => {
    try {
      // Optimistic append
      const tempId = 'temp-' + Date.now();
      const optimisticMsg: ChatMessageShape = {
        id: tempId,
        message: messageText,
        createdAt: new Date().toISOString(),
        createdById: currentUserId,
        createdBy: { name: 'You' },
        status: 'sending'
      };
      setMessages(prev => [...prev, optimisticMsg]);
      scrollToBottom('smooth');

      const res = await fetch(`/api/solar-orders/${orderId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Mark as failed
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      } else {
        // Replace temp with actual
        setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
      }
    } catch (e) {
      setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, status: 'failed' } : m)));
    }
  };

  const handleRetry = async (tempId: string, messageText: string) => {
    // Re-mark as sending
    setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sending' } : m));
    
    try {
      const res = await fetch(`/api/solar-orders/${orderId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      } else {
        setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
      }
    } catch (e) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
    }
  };

  // Prevent scroll propagation to body when Drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      isFirstLoad.current = true; // reset for next open
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const renderDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let display = '';
    if (date.toDateString() === today.toDateString()) {
      display = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      display = 'Yesterday';
    } else {
      display = date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }

    return (
      <div className="flex items-center justify-center my-4">
        <div className="bg-gray-100 text-gray-500 text-[10px] font-medium px-3 py-1 rounded-full shadow-sm">
          {display}
        </div>
      </div>
    );
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    // Consider it at the bottom if within 50px of the max scroll
    const atBottom = Math.abs(target.scrollHeight - target.clientHeight - target.scrollTop) < 50;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setShowNewMessagesBadge(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[100] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        aria-hidden="true" 
        onClick={onClose}
      />

      {/* Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-[420px] bg-slate-50 shadow-2xl z-[101] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <ChatHeader 
          orderNumber={orderNumber} 
          customerName={customerName} 
          onClose={onClose} 
        />
        
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 flex flex-col relative"
        >
          {isLoading ? (
            <div className="flex flex-col gap-4 animate-pulse pt-4">
              <div className="flex items-end gap-2 w-3/4">
                <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
                <div className="bg-white rounded-2xl rounded-tl-sm h-12 w-full" />
              </div>
              <div className="flex items-end gap-2 w-3/4 self-end pl-12">
                <div className="bg-blue-50 rounded-2xl rounded-tr-sm h-16 w-full" />
              </div>
              <div className="flex items-end gap-2 w-3/4">
                <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0" />
                <div className="bg-white rounded-2xl rounded-tl-sm h-10 w-full" />
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-2 h-full">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                💬
              </div>
              <p className="text-sm font-medium text-gray-600">No conversation yet</p>
              <p className="text-xs">Start the discussion below.</p>
            </div>
          ) : (
            <div className="flex flex-col min-h-full justify-end pb-2">
              {messages.map((msg, index) => {
                const currentDateStr = new Date(msg.createdAt).toDateString();
                const prevDateStr = index > 0 ? new Date(messages[index - 1].createdAt).toDateString() : null;
                const showDate = currentDateStr !== prevDateStr;

                return (
                  <div key={msg.id}>
                    {showDate && renderDateSeparator(msg.createdAt)}
                    <ChatMessage 
                      message={msg} 
                      currentUserId={currentUserId} 
                      onRetry={msg.status === 'failed' ? () => handleRetry(msg.id, msg.message) : undefined} 
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showNewMessagesBadge && (
          <div className="absolute bottom-20 left-0 right-0 flex justify-center z-10">
            <button
              onClick={() => scrollToBottom('smooth')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-md flex items-center gap-1 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              New Messages ↓
            </button>
          </div>
        )}

        <ChatComposer onSend={handleSend} disabled={isLoading} isOpen={isOpen} />
      </div>
    </>
  );
}
