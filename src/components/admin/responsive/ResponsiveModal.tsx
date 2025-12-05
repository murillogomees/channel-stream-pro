/**
 * ResponsiveModal - Modal responsivo
 * Mobile: Full-screen sheet
 * Desktop/TV: Centered modal
 */

import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Largura máxima em desktop */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  className?: string;
}

const maxWidthClasses = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  full: "sm:max-w-[90vw]",
};

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = "lg",
  className,
}: ResponsiveModalProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Mobile: Drawer (bottom sheet)
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          {(title || description) && (
            <DrawerHeader className="text-left">
              {title && <DrawerTitle className="text-lg">{title}</DrawerTitle>}
              {description && (
                <DrawerDescription className="text-sm">{description}</DrawerDescription>
              )}
            </DrawerHeader>
          )}
          <div className={cn("px-4 pb-4 overflow-y-auto", className)}>
            {children}
          </div>
          {footer && (
            <DrawerFooter className="pt-2">
              {footer}
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop/TV: Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          maxWidthClasses[maxWidth],
          "2xl:text-base 3xl:text-lg",
          "2xl:p-8 3xl:p-10",
          className
        )}
      >
        {(title || description) && (
          <DialogHeader>
            {title && (
              <DialogTitle className="text-lg md:text-xl 2xl:text-2xl 3xl:text-3xl">
                {title}
              </DialogTitle>
            )}
            {description && (
              <DialogDescription className="text-sm md:text-base 2xl:text-lg">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        )}
        {children}
        {footer && (
          <DialogFooter className="2xl:mt-6 3xl:mt-8">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ResponsiveModal;
