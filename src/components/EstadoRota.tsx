import Link from "next/link";
import type { IconProps } from "@tabler/icons-react";
import { botaoClasses } from "./Botao";

// Peça compartilhada para error.tsx / not-found.tsx (ver docs/42-auditoria-frontend-ux.md,
// ganho rápido 1). Sem "use client": quem precisa de client boundary (error.tsx) importa
// daqui normalmente — o boundary fica só no arquivo da rota.
type Props = {
  icone: React.ComponentType<IconProps>;
  titulo: string;
  texto: string;
  acao: { href?: string; onClick?: () => void; rotulo: string };
  /** 2 quando o layout do segmento já tem o h1 da área (ex.: /configuracao): o erro não abre um segundo h1. */
  nivel?: 1 | 2;
};

export function EstadoRota({ icone: Icone, titulo, texto, acao, nivel = 1 }: Props) {
  const classe = `${botaoClasses({ tamanho: "lg" })} mt-2`;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <Icone className="h-6 w-6" />
      </div>
      {nivel === 2 ? <h2 className="text-2xl font-medium">{titulo}</h2> : <h1 className="text-2xl font-medium">{titulo}</h1>}
      <p className="max-w-sm text-sm text-gray-500">{texto}</p>
      {acao.href ? (
        <Link href={acao.href} className={classe}>
          {acao.rotulo}
        </Link>
      ) : (
        <button type="button" onClick={acao.onClick} className={classe}>
          {acao.rotulo}
        </button>
      )}
    </div>
  );
}
