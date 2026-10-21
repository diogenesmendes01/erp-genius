import { forwardRef, type InputHTMLAttributes } from "react";

// Campo de data e hora digitadas (lote 3 do fuso pessoal nas telas, Q176). Um <input type="datetime-local"> não tem
// fuso: o mesmo "21/10/2026 20:30" é um instante em São Paulo e outro em San José. Antes, cada tela lia o valor no
// fuso do navegador (`new Date(valor)`) ou do servidor, sem dizer qual. Este componente:
// - escreve AO LADO do campo o fuso em que o valor é lido ("Horário em America/Sao_Paulo.");
// - marca o campo com `data-fuso` e, com `nomeFuso`, envia o fuso junto no formulário (campo oculto);
// - não converte nada: quem envia manda o texto digitado e o fuso, e o servidor converte com
//   `exigirInstanteDoCampoLocal` (src/server/_shared/campo-local.ts). O valor inicial sai de `valorCampoLocal` no
//   MESMO fuso (src/server/operacao/fuso-entrada.ts).
// O fuso vem de `fusoDoCampoLocal` (pessoal; sem preferência, o da escola; nenhum válido → "UTC", escrito aqui).
// Formulário em que a pessoa ESCOLHE o fuso num <CampoFuso> pode usar o <input> nativo no mesmo <form>; fora isso,
// todo `datetime-local` passa por aqui — a trava é src/app/fuso-pessoal-telas.test.ts (regra "campo-local").

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Fuso em que o valor digitado é lido e o inicial é escrito. */
  fuso: string;
  /** Nome do campo oculto que leva o fuso no envio do formulário (telas que leem o FormData). */
  nomeFuso?: string;
  /** Classe do texto que diz o fuso. */
  classeFuso?: string;
};

/** `ref` chega ao <input> (o `useInicioDoPeriodo` sincroniza o `min` do fim por ele). */
export const CampoDataHoraLocal = forwardRef<HTMLInputElement, Props>(function CampoDataHoraLocal({ fuso, nomeFuso, classeFuso = "block text-xs text-gray-600", ...props }, ref) {
  return <>
    <input {...props} ref={ref} type="datetime-local" data-fuso={fuso} />
    <span className={classeFuso}>Horário em {fuso}.</span>
    {nomeFuso && <input type="hidden" name={nomeFuso} value={fuso} readOnly />}
  </>;
});
