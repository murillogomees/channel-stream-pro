import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  mask?: 'brazilian' | 'international' | 'none';
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value = "", onChange, mask = 'brazilian', className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(value);

    React.useEffect(() => {
      setDisplayValue(value);
    }, [value]);

    const applyMask = (rawValue: string): string => {
      // Remove tudo exceto números
      const numbers = rawValue.replace(/\D/g, '');
      
      if (mask === 'none') return numbers;

      if (mask === 'brazilian') {
        // Formato brasileiro: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
        if (numbers.length <= 10) {
          // Formato fixo: (XX) XXXX-XXXX
          return numbers
            .replace(/^(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d)/, '$1-$2')
            .slice(0, 14);
        } else {
          // Formato celular: (XX) XXXXX-XXXX
          return numbers
            .replace(/^(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .slice(0, 15);
        }
      }

      if (mask === 'international') {
        // Formato internacional: +XX (XX) XXXXX-XXXX
        if (numbers.startsWith('55')) {
          // Brasil
          return numbers
            .replace(/^(\d{2})(\d{2})(\d)/, '+$1 ($2) $3')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .slice(0, 19);
        } else {
          // Outros países - formato simples
          return '+' + numbers.slice(0, 15);
        }
      }

      return numbers;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const masked = applyMask(rawValue);
      setDisplayValue(masked);
      
      // Retornar apenas números para o parent
      const numbers = rawValue.replace(/\D/g, '');
      onChange?.(numbers);
    };

    return (
      <Input
        ref={ref}
        type="tel"
        value={displayValue}
        onChange={handleChange}
        className={cn(className)}
        {...props}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";
