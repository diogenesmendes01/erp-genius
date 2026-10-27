import { Sidebar } from "@/components/Sidebar";
import { BarraMobile } from "@/components/BarraMobile";
import { Trilha } from "@/components/Trilha";
import { exigirSessaoPagina } from "@/server/_shared";
import { contarConversasNaoLidas } from "@/server/inbox/nao-lidas";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await exigirSessaoPagina();
  const naoLidasInbox = await contarConversasNaoLidas(usuario);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-brand-700 focus:border focus:border-gray-300">
        Pular para o conteúdo
      </a>
      <BarraMobile papeis={usuario.papeis} nome={usuario.nome} naoLidasInbox={naoLidasInbox} />
      <Sidebar papeis={usuario.papeis} nome={usuario.nome} naoLidasInbox={naoLidasInbox} />
      <main id="conteudo" className="min-w-0 flex-1 p-4 md:p-8">
        <Trilha />
        {children}
      </main>
    </div>
  );
}
