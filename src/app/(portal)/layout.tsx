import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { SairPortal } from "./SairPortal";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  // O /portal NÃO vive sob o layout interno (app) — review PR #60 rodada 2: lá o guard sem
  // alvo redireciona usuário só-ALUNO para /portal e, no mesmo grupo, isso seria um
  // redirect de /portal para /portal (loop infinito). Neste grupo o alvo ALUNO deixa o
  // aluno passar; staff sem o papel cai em /acesso-negado (admin passa, como em tudo).
  await exigirSessaoPagina(Papel.ALUNO);
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <span className="text-sm font-medium">Portal do aluno</span>
          <SairPortal />
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
