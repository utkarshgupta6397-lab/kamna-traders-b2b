'use client';

import { ChatMessageShape } from './types';

interface ChatMessageProps {
  message: ChatMessageShape;
  currentUserId: string;
  onRetry?: () => void;
}

export function ChatMessage({ message, currentUserId, onRetry }: ChatMessageProps) {
  const isMine = message.createdById === currentUserId;
  const senderName = isMine ? 'You' : message.createdBy?.name || 'Unknown';
  
  // Format time (e.g., "10:35 AM")
  const dateObj = new Date(message.createdAt);
  const timeString = dateObj.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  let displayTime = timeString;
  if (message.status === 'sending') displayTime = 'Sending...';
  if (message.status === 'failed') displayTime = 'Failed to send';

  // Animation classes
  const animationClass = isMine 
    ? 'animate-in fade-in duration-150' 
    : 'animate-in slide-in-from-bottom-2 fade-in duration-150';

  if (isMine) {
    return (
      <div className={`flex flex-col items-end w-full mb-3 pl-12 ${animationClass}`}>
        <div className="flex items-baseline justify-end gap-2 mb-1 w-full">
          <span className={`text-[10px] flex-shrink-0 ${message.status === 'failed' ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            {displayTime}
          </span>
          {message.status === 'failed' && onRetry && (
            <button 
              onClick={onRetry}
              className="text-[10px] text-red-600 hover:text-red-800 font-semibold underline decoration-red-300"
            >
              Retry
            </button>
          )}
          <span className="text-[11px] font-semibold text-gray-700 truncate">{senderName}</span>
        </div>
        <div 
          className={`text-gray-900 border rounded-2xl rounded-tr-sm px-4 py-2 shadow-sm text-sm whitespace-pre-wrap break-words max-w-full transition-colors ${
            message.status === 'failed' 
              ? 'bg-red-50 border-red-200' 
              : 'bg-blue-50 border-blue-100'
          }`}
        >
          {message.message}
        </div>
      </div>
    );
  }

  // Other person's message
  const initials = senderName.substring(0, 2).toUpperCase();

  return (
    <div className={`flex items-end gap-2 w-full mb-3 pr-8 ${animationClass}`}>
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0 select-none">
        {initials}
      </div>
      <div className="flex flex-col items-start w-full">
        <div className="flex items-baseline justify-start gap-2 mb-1 w-full">
          <span className="text-[11px] font-semibold text-gray-700 truncate">{senderName}</span>
          <span className="text-[10px] text-gray-400 flex-shrink-0">{timeString}</span>
        </div>
        <div className="bg-white text-gray-900 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2 shadow-sm text-sm whitespace-pre-wrap break-words max-w-full">
          {message.message}
        </div>
      </div>
    </div>
  );
}
