'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-brand-surface group-[.toaster]:text-brand-text group-[.toaster]:border-brand-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-brand-muted',
          actionButton: 'group-[.toast]:bg-brand group-[.toast]:text-white',
          cancelButton: 'group-[.toast]:bg-brand-surface group-[.toast]:text-brand-muted',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
