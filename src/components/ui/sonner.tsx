import { Toaster as Sonner, toast } from "sonner";
import { useContext } from "react";
import { ThemeContext } from "@/contexts/ThemeContext";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  // Use context directly with fallback to avoid crash when outside ThemeProvider
  const themeContext = useContext(ThemeContext);
  const theme = themeContext?.theme || 'dark';
  
  // Map our themes to sonner's expected values
  const sonnerTheme = theme === 'dark' || theme === 'high-contrast' ? 'dark' : 'light';

  return (
    <Sonner
      theme={sonnerTheme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };