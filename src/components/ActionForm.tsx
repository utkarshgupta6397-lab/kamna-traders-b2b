'use client';

import { useTransition, useRef } from 'react';
import toast from 'react-hot-toast';

export default function ActionForm({ 
  action, 
  children, 
  className,
  successMessage = "Updated successfully",
  resetOnSuccess = false,
}: { 
  action: (data: FormData) => Promise<void>;
  children: React.ReactNode;
  className?: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await action(formData);
        toast.success(successMessage);
        if (resetOnSuccess) {
          formRef.current?.reset();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong");
      }
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={className}>
      {children}
    </form>
  );
}
