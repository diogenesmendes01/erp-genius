import Link from "next/link";
import { IconLock } from "@tabler/icons-react";

// Destino dos guards de página quando o usuário está autenticado mas sem o papel
// exigido. Nenhum dado sensível é consultado aqui (ver docs/07-papeis-permissoes).
export default function AcessoNegadoPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <IconLock className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-medium">Acesso negado</h1>
      <p className="max-w-sm text-sm text-gray-500">
        Você não tem permissão para acessar esta área. Se acredita que isso é um
        engano, fale com um administrador.
      </p>
      <Link
        href="/home"
        className="mt-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
