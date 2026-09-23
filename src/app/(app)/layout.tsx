import { Sidebar } from "@/components/Sidebar";
import { exigirSessaoPagina } from "@/server/_shared";
import { contarNaoLidas } from "@/server/whatsapp/consultas";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Papéis FRESCOS do banco (não do JWT) — o menu passa a refletir revogações na hora,
  // igual às páginas/ações (ver _shared/sessao). Usuário desativado cai para /login.
  const usuario = await exigirSessaoPagina();
  // Notificação básica da inbox (doc 30 E3). O escopo é fail-closed: papel sem acesso → 0.
  const naoLidasInbox = await contarNaoLidas(usuario);

  return (
    <div className="flex min-h-screen">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-brand-700 focus:border focus:border-gray-200">
        Pular para o conteúdo
      </a>
      <Sidebar papeis={usuario.papeis} nome={usuario.nome} naoLidasInbox={naoLidasInbox} />
      <main id="conteudo" className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
