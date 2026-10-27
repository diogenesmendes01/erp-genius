import Link from "next/link";
import { botaoClasses } from "@/components/Botao";
import { SairPortal } from "../SairPortal";

export default function PortalLegado() {
  return (
    <section className="mx-auto flex min-h-screen max-w-md items-center px-5">
      <div className="w-full rounded-xl border bg-surface p-7">
        <p className="text-sm text-brand-700">Genius Idiomas</p>
        <h1 className="mt-1 text-2xl font-medium">A área do aluno tem acesso próprio</h1>
        <p className="mt-2 text-sm text-gray-600">
          Este endereço é antigo, e o acesso da equipe não abre a área do aluno. Entre com o e-mail individual
          confirmado no seu convite.
        </p>
        <Link href="/portal-aluno/entrar" className={`${botaoClasses({ tamanho: "lg" })} mt-6 w-full`}>
          Entrar na área do aluno
        </Link>
        <div className="mt-5 flex justify-end">
          <SairPortal />
        </div>
      </div>
    </section>
  );
}
