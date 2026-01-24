'use client';

import type { ReactNode } from 'react';

type ModalProps = {
  onClose: () => void;
  maxWidthClassName?: string;
  children: ReactNode;
};

export function Modal({ onClose, maxWidthClassName, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10">
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur"
        onClick={onClose}
        aria-label="关闭弹窗"
      />
      <div
        className={`relative w-full rounded-3xl border border-border bg-card p-6 shadow-2xl ${
          maxWidthClassName ?? 'max-w-5xl'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
