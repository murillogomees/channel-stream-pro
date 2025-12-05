/**
 * ResponsiveText - Tipografia responsiva
 * Escala automaticamente para diferentes tamanhos de tela incluindo TV
 */

import { ReactNode, ElementType } from "react";
import { cn } from "@/lib/utils";

type TextVariant = "h1" | "h2" | "h3" | "h4" | "body" | "small" | "caption";

interface ResponsiveTextProps {
  children: ReactNode;
  variant?: TextVariant;
  as?: ElementType;
  className?: string;
}

const variantClasses: Record<TextVariant, string> = {
  h1: "text-2xl sm:text-3xl md:text-4xl lg:text-4xl 2xl:text-5xl 3xl:text-6xl font-heading font-bold tracking-tight",
  h2: "text-xl sm:text-2xl md:text-3xl lg:text-3xl 2xl:text-4xl 3xl:text-5xl font-heading font-semibold tracking-tight",
  h3: "text-lg sm:text-xl md:text-2xl lg:text-2xl 2xl:text-3xl 3xl:text-4xl font-heading font-semibold",
  h4: "text-base sm:text-lg md:text-xl lg:text-xl 2xl:text-2xl 3xl:text-3xl font-heading font-medium",
  body: "text-sm sm:text-base md:text-base lg:text-base 2xl:text-lg 3xl:text-xl",
  small: "text-xs sm:text-sm md:text-sm lg:text-sm 2xl:text-base 3xl:text-lg",
  caption: "text-[10px] sm:text-xs md:text-xs lg:text-xs 2xl:text-sm 3xl:text-base text-muted-foreground",
};

const defaultElements: Record<TextVariant, ElementType> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  body: "p",
  small: "span",
  caption: "span",
};

export function ResponsiveText({
  children,
  variant = "body",
  as,
  className,
}: ResponsiveTextProps) {
  const Component = as || defaultElements[variant];

  return (
    <Component className={cn(variantClasses[variant], className)}>
      {children}
    </Component>
  );
}

export default ResponsiveText;
