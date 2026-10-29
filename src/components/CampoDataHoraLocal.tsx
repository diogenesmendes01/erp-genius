"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { DateTimePicker } from "@/components/ui/date-time-picker";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue"> & {
  fuso: string;
  nomeFuso?: string;
  classeFuso?: string;
  value?: string;
  defaultValue?: string;
};

export const CampoDataHoraLocal = forwardRef<HTMLInputElement, Props>(function CampoDataHoraLocal({ fuso, nomeFuso, classeFuso = "block text-xs text-gray-600", className, ...props }, ref) {
  return (
    <>
      <DateTimePicker ref={ref} {...props} fuso={fuso} className={className} />
      <span className={classeFuso}>Horário em {fuso}.</span>
      {nomeFuso && <input type="hidden" name={nomeFuso} value={fuso} readOnly />}
    </>
  );
});
