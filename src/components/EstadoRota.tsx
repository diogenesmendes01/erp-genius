import Link from "next/link";
import type { IconProps } from "@tabler/icons-react";

// Peça compartilhada para error.tsx / not-found.tsx (ver docs/42-auditoria-frontend-ux.md,
// ganho rápido 1). Sem "use client": quem precisa de client boundary (error.tsx) importa
// daqui normalmente — o boundary fica só no arquivo da rota.
type Props = {
  icone: React.ComponentType<IconProps>;
  titulo: string;
  texto: string;
  acao: { href?: string; onClick?: () => void; rotulo: string };
};

export function EstadoRota({ icone: Icone, titulo, texto, acao }: Props) {
  const classe =
    "mt-2 rounded-md bg-brand-solid px-4 py-2 text-sm font-medium text-white hover:brightness-95";
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <Icone className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-medium">{titulo}</h1>
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
