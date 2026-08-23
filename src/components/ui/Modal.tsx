import React, { useEffect } from "react";
import { cn } from "../../lib/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-xs animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog box */}
      <div
        className={cn(
          "relative z-10 w-full max-w-lg bg-surface border border-border-strong rounded-lg shadow-overlay animate-scale-in flex flex-col overflow-hidden max-h-[90vh]",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border bg-surface-2/40">
          <div>
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-subtle mt-0.5">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-subtle hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto text-sm">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-border bg-surface-2/30">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
