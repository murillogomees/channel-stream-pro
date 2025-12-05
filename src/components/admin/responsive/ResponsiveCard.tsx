/**
 * ResponsiveCard - Card responsivo com padding adaptativo
 * Otimizado para touch em mobile e foco em TV
 */

import { ReactNode, forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ResponsiveCardProps {
  children: ReactNode;
  title?: string;
  description?: string;
  footer?: ReactNode;
  /** Tamanho do padding */
  size?: "sm" | "md" | "lg";
  /** Focusável para navegação TV */
  focusable?: boolean;
  /** Clicável */
  onClick?: () => void;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

const paddingClasses = {
  sm: "p-3 sm:p-4 md:p-4 lg:p-4 2xl:p-5 3xl:p-6",
  md: "p-4 sm:p-5 md:p-6 lg:p-6 2xl:p-7 3xl:p-8",
  lg: "p-5 sm:p-6 md:p-8 lg:p-8 2xl:p-10 3xl:p-12",
};

export const ResponsiveCard = forwardRef<HTMLDivElement, ResponsiveCardProps>(
  ({
    children,
    title,
    description,
    footer,
    size = "md",
    focusable = false,
    onClick,
    className,
    headerClassName,
    contentClassName,
  }, ref) => {
    return (
      <Card
        ref={ref}
        tabIndex={focusable ? 0 : undefined}
        onClick={onClick}
        className={cn(
          "transition-all duration-200",
          onClick && "cursor-pointer hover:shadow-lg hover:border-primary/30",
          focusable && [
            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
            "2xl:focus:ring-4 2xl:focus:ring-offset-4", // Foco mais visível em TV
          ],
          className
        )}
      >
        {(title || description) && (
          <CardHeader className={cn(paddingClasses[size], "pb-2 2xl:pb-3 3xl:pb-4", headerClassName)}>
            {title && (
              <CardTitle className="text-base sm:text-lg md:text-lg lg:text-lg 2xl:text-xl 3xl:text-2xl">
                {title}
              </CardTitle>
            )}
            {description && (
              <CardDescription className="text-xs sm:text-sm md:text-sm 2xl:text-base 3xl:text-lg">
                {description}
              </CardDescription>
            )}
          </CardHeader>
        )}
        <CardContent className={cn(paddingClasses[size], title && "pt-0", contentClassName)}>
          {children}
        </CardContent>
        {footer && (
          <CardFooter className={cn(paddingClasses[size], "pt-0 2xl:pt-2 3xl:pt-4")}>
            {footer}
          </CardFooter>
        )}
      </Card>
    );
  }
);

ResponsiveCard.displayName = "ResponsiveCard";

export default ResponsiveCard;
