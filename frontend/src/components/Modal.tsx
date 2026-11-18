import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "../lib/utils";

export const ModalTitle = Dialog.Title;
export const ModalDescription = Dialog.Description;

// Finestra modale accessibile (Radix): focus intrappolato, Esc e clic fuori chiudono, scorre se è alta
export default function Modal({
  open,
  onOpenChange,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-fade-in fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm">
          <div className="flex min-h-full items-start justify-center px-4 py-8 sm:items-center">
            <Dialog.Content aria-describedby={undefined} className={cn("panel animate-pop w-full p-6 outline-none", className)}>
              {children}
            </Dialog.Content>
          </div>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
