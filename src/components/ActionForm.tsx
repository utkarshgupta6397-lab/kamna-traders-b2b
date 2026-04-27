'use client';

import { useTransition, useRef, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const FormContext = createContext({ isPending: false });

export const useFormState = () => useContext(FormContext);

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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await action(formData);
        toast.success(successMessage);
        router.refresh();
        if (resetOnSuccess) {
          formRef.current?.reset();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong");
      }
    });
  };

  return (
    <FormContext.Provider value={{ isPending }}>
      <form ref={formRef} onSubmit={handleSubmit} className={className}>
        {children}
      </form>
    </FormContext.Provider>
  );
}

export function FormSubmit({ 
  children, 
  className,
  loadingText = "Saving...",
  icon
}: { 
  children?: React.ReactNode; 
  className?: string;
  loadingText?: string;
  icon?: React.ReactNode;
}) {
  const { isPending: isActionPending } = useFormState();
  const { pending: isFormPending } = useFormStatus();
  
  const isPending = isActionPending || isFormPending;
  
  return (
    <button 
      type="submit" 
      disabled={isPending}
      className={`${className} flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed`}
    >
      {isPending ? (
        <>
          <Loader2 size={16} className="animate-spin" />
          {children && <span>{loadingText}</span>}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
