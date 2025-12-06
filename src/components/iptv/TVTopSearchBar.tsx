import { useState, useRef, useCallback, useEffect, memo } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TVTopSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  isSearching?: boolean;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const TVTopSearchBar = memo(function TVTopSearchBar({
  value,
  onChange,
  isSearching = false,
  placeholder = "Buscar canais, filmes e séries...",
  className,
  onFocus,
  onBlur,
}: TVTopSearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle input change with debounce
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      
      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce the onChange to prevent freezing
      debounceRef.current = setTimeout(() => {
        onChange(newValue);
      }, 250);
    },
    [onChange],
  );

  // Handle Enter key - immediate search
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        onChange(inputRef.current?.value || "");
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        if (inputRef.current) {
          inputRef.current.value = "";
        }
        onChange("");
        inputRef.current?.blur();
      }
    },
    [onChange],
  );

  // Clear search
  const handleClear = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  // Handle focus/blur
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Sync input with controlled value only when empty/cleared externally
  useEffect(() => {
    if (inputRef.current && value === "" && inputRef.current.value !== "") {
      inputRef.current.value = "";
    }
  }, [value]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        "relative flex items-center transition-all duration-200",
        isFocused ? "w-64 sm:w-80 md:w-96" : "w-48 sm:w-56 md:w-72",
        className,
      )}
    >
      <Search
        className={cn(
          "absolute left-3 w-4 h-4 transition-colors pointer-events-none z-10",
          isFocused ? "text-primary" : "text-muted-foreground",
        )}
      />
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        defaultValue={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "w-full h-10 sm:h-11 pl-10 pr-10 rounded-xl",
          "bg-muted/60 border border-border/50",
          "text-sm sm:text-base text-foreground placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 focus:bg-muted/80",
          "transition-all duration-200",
        )}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />

      {/* Right side icons */}
      <div className="absolute right-3 flex items-center gap-1">
        {isSearching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        {value && !isSearching && (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 rounded-full hover:bg-foreground/10 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
    </div>
  );
});
