import { Sidebar } from "@/components/Sidebar";
import { exigirSessaoPagina } from "@/server/_shared";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Papéis FRESCOS do banco (não do JWT) — o menu passa a refletir revogações na hora,
  // igual às páginas/ações (ver _shared/sessao). Usuário desativado cai para /login.
  const usuario = await exigirSessaoPagina();

  return (
    <div className="flex min-h-screen">
      <Sidebar papeis={usuario.papeis} nome={usuario.nome} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
