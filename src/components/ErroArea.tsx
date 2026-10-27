import { IconAlertTriangle } from "@tabler/icons-react";
import { EstadoRota } from "./EstadoRota";
import { VoltarPara } from "./VoltarPara";

export const TEXTO_ERRO_AREA =
  "A consulta falhou ou o servidor não respondeu. Seus dados não foram alterados. Tente de novo; se repetir, fale com um administrador.";

type Props = {
  titulo: string;
  reset: () => void;
  voltar: { href: string; para?: string };
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

export function destinoDoErro(caminho: string, indice: string, acima = "/home"): string {
  const atual = caminho.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return atual === indice ? acima : indice;
}
