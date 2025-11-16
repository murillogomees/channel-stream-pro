import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerProps {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  disableFuture?: boolean;
  disablePast?: boolean;
  className?: string;
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "Selecione uma data",
  disabled = false,
  disableFuture = false,
  disablePast = false,
  className,
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP", { locale: ptBR }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-popover" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onDateChange}
          disabled={(date) => {
            if (disableFuture && date > new Date()) return true;
            if (disablePast && date < new Date()) return true;
            return false;
          }}
          initialFocus
          locale={ptBR}
        />
      </PopoverContent>
    </Popover>
  );
}
