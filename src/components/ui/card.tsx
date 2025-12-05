import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "rounded-lg border text-card-foreground transition-all duration-300 ease-out",
  {
    variants: {
      variant: {
        default: "bg-card shadow-elevation-1 hover:shadow-elevation-2 border-border/50",
        flat: "bg-card shadow-none border-border/30",
        elevated: "bg-card shadow-elevation-2 border-transparent hover:shadow-elevation-3",
        interactive: "bg-card shadow-elevation-1 hover:shadow-elevation-3 hover:-translate-y-1 hover:border-primary/30 cursor-pointer",
        gradient: "bg-gradient-card border-primary/10 shadow-elevation-2",
        surface: "bg-surface-1 border-border/20 shadow-elevation-1",
        // Semantic stat variants with colored accents
        stat: "bg-card shadow-elevation-1 border-l-4 border-l-stat-primary border-border/30",
        "stat-success": "bg-card shadow-elevation-1 border-l-4 border-l-stat-success border-border/30",
        "stat-warning": "bg-card shadow-elevation-1 border-l-4 border-l-stat-warning border-border/30",
        "stat-danger": "bg-card shadow-elevation-1 border-l-4 border-l-stat-danger border-border/30",
        "stat-info": "bg-card shadow-elevation-1 border-l-4 border-l-stat-info border-border/30",
        "stat-purple": "bg-card shadow-elevation-1 border-l-4 border-l-stat-purple border-border/30",
        // Action cards with hover states
        action: "bg-card shadow-elevation-1 hover:shadow-elevation-3 hover:-translate-y-0.5 hover:border-primary/40 cursor-pointer group",
        // Accent cards for highlighted content
        accent: "bg-primary/5 border-primary/20 shadow-elevation-1 hover:bg-primary/10",
        // Glass effect
        glass: "bg-card/80 backdrop-blur-sm border-border/20 shadow-elevation-2",
      },
      size: {
        default: "",
        compact: "p-0",
        sm: "[&_.card-content]:p-4 [&_.card-header]:p-4 [&_.card-footer]:p-4",
        lg: "[&_.card-content]:p-8 [&_.card-header]:p-8 [&_.card-footer]:p-8",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, size, ...props }, ref) => (
    <article
      ref={ref}
      className={cn(cardVariants({ variant, size, className }))}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <header ref={ref} className={cn("card-header flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-xl font-semibold leading-none tracking-tight text-foreground", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("card-content p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <footer ref={ref} className={cn("card-footer flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, cardVariants, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
