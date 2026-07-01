'use client';

import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { SendHorizontal, Loader2 } from 'lucide-react';

interface ChatComposerProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
  isOpen?: boolean;
}

export function ChatComposer({ onSend, disabled, isOpen }: ChatComposerProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus when drawer opens
  useEffect(() => {
    if (isOpen) {
      // Small timeout to ensure transition doesn't block focus
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || isSending || disabled) return;

    if (trimmed.length > 2000) {
      alert('Message cannot exceed 2000 characters.');
      return;
    }

    setIsSending(true);
    try {
      await onSend(trimmed);
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsSending(false);
      // Ensure focus returns after sending completes or fails
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
      <div className="relative flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSending}
          placeholder="Type a message..."
          className="w-full max-h-[120px] bg-transparent border-0 resize-none py-2 px-3 text-sm text-gray-900 placeholder-gray-400 focus:ring-0 focus:outline-none"
          rows={1}
          style={{ minHeight: '38px' }}
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || isSending || disabled}
          className="flex-shrink-0 p-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 transition-colors m-0.5"
          aria-label="Send Message"
        >
          {isSending ? <Loader2 size={16} className="animate-spin" /> : <SendHorizontal size={16} />}
        </button>
      </div>
      <div className="flex justify-between items-center px-1 mt-1.5">
        <span className="text-[10px] text-gray-400">Enter to send, Shift+Enter for new line</span>
        <span className={`text-[10px] ${message.length > 2000 ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
          {message.length} / 2000
        </span>
      </div>
    </div>
  );
}
