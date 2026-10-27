import { forwardRef, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  fuso: string;
  nomeFuso?: string;
  classeFuso?: string;
};

export const CampoDataHoraLocal = forwardRef<HTMLInputElement, Props>(function CampoDataHoraLocal({ fuso, nomeFuso, classeFuso = "block text-xs text-gray-600", ...props }, ref) {
  return <>
    <input {...props} ref={ref} type="datetime-local" data-fuso={fuso} />
    <span className={classeFuso}>Horário em {fuso}.</span>
    {nomeFuso && <input type="hidden" name={nomeFuso} value={fuso} readOnly />}
  </>;
});
