import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const textareaVariants = cva(
  [
    "flex w-full rounded-lg border border-input bg-background px-3 py-3 ring-offset-background",
    "placeholder:text-muted-foreground",
    "transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary/50",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "resize-none",
  ],
  {
    variants: {
      textareaSize: {
        default: "min-h-[120px] text-base md:text-sm",
        sm: "min-h-[80px] text-sm",
        lg: "min-h-[180px] text-base",
      },
    },
    defaultVariants: {
      textareaSize: "default",
    },
  }
);

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size">,
    VariantProps<typeof textareaVariants> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, textareaSize, ...props }, ref) => {
    return (
      <textarea
        className={cn(textareaVariants({ textareaSize, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea, textareaVariants };
