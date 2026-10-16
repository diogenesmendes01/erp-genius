import { IconAlertTriangle } from "@tabler/icons-react";
import { EstadoRota } from "./EstadoRota";
import { VoltarPara } from "./VoltarPara";

// Erro de uma área do shell (docs/42-auditoria-frontend-ux.md; docs/43 §6 item 10). O (app)/error.tsx
// já segura qualquer throw dentro da Sidebar, mas não diz qual área falhou nem dá o caminho de volta
// a ela. Este é o corpo comum dos error.tsx de área: título com o nome da área, "Tentar de novo"
// (reset) e o link de volta no formato único de <VoltarPara/>. Nunca mostra error.message nem digest
// (achado N1 do relatório): a mensagem só serve para depuração e pode vazar detalhe interno.
// Sem "use client", como o EstadoRota: o boundary fica no arquivo da rota.

export const TEXTO_ERRO_AREA =
  "A consulta falhou ou o servidor não respondeu. Seus dados não foram alterados. Tente de novo; se repetir, fale com um administrador.";

type Props = {
  titulo: string;
  reset: () => void;
  voltar: { href: string; para?: string };
  /** 2 quando o layout do segmento já tem o h1 da área (ex.: /configuracao). */
  nivel?: 1 | 2;
};

export function ErroArea({ titulo, reset, voltar, nivel }: Props) {
  return (
    <div>
      <VoltarPara href={voltar.href} para={voltar.para} />
      <EstadoRota icone={IconAlertTriangle} titulo={titulo} texto={TEXTO_ERRO_AREA} acao={{ onClick: reset, rotulo: "Tentar de novo" }} nivel={nivel} aviso="erro" />
    </div>
  );
}

/**
 * Para onde leva o "voltar" do erro: o índice da área — ou `acima` quando o que falhou foi o próprio
 * índice (voltar para a mesma tela que acabou de falhar não é caminho de volta). Query string e barra
 * final não contam.
 */
export function destinoDoErro(caminho: string, indice: string, acima = "/home"): string {
  const atual = caminho.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return atual === indice ? acima : indice;
}
