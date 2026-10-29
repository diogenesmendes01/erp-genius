"use client";

import { DayPicker, type DayPickerProps } from "react-day-picker";
import { ptBR } from "date-fns/locale/pt-BR";
import { cn } from "@/lib/utils";

export type CalendarProps = DayPickerProps;

export function Calendar({ className, classNames, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays
      className={cn("bg-surface-raised p-3 text-gray-800", className)}
      classNames={{
        root: "bg-surface-raised text-gray-800",
        months: "flex flex-col",
        month: "space-y-3",
        month_caption: "flex h-9 items-center justify-center",
        caption_label: "text-sm font-medium text-gray-800",
        nav: "flex items-center justify-between",
        button_previous: "inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-highlight focus-visible:outline-none",
        button_next: "inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-highlight focus-visible:outline-none",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-center text-xs font-medium text-gray-500",
        week: "mt-1 flex w-full",
        day: "relative h-9 w-9 p-0 text-center text-sm",
        day_button: "inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-800 hover:bg-highlight focus-visible:outline-none aria-selected:bg-brand-solid aria-selected:text-on-brand",
        selected: "bg-brand-solid text-on-brand",
        today: "bg-surface-muted font-semibold",
        outside: "text-gray-400",
        disabled: "text-disabled",
        hidden: "invisible",
        chevron: "h-4 w-4",
        ...classNames,
      }}
      {...props}
    />
  );
}
