import { exigirSessaoPagina } from "@/server/_shared";
import { abasParaPapeis } from "@/lib/nav";
import { SubTabs } from "@/components/SubTabs";
import { SECOES_ACADEMICO } from "./secoes";

// Camada de área de /academico (docs/42-auditoria-frontend-ux.md, E2): as sub-seções viram abas
// acima de cada uma das 64 páginas, com a ativa marcada. O layout NÃO decide acesso — só a sessão
// (memoizada por requisição, a mesma do shell e da página); cada página mantém o próprio guard, e
// a barra mostra só as abas que o papel abre. Trilha e "Voltar" continuam no shell e na página.
export default async function AcademicoLayout({ children }: { children: React.ReactNode }) {
  const { papeis } = await exigirSessaoPagina();
  const abas = abasParaPapeis(SECOES_ACADEMICO, papeis);
  // Uma aba só não é navegação — a página basta.
  if (abas.length < 2) return <>{children}</>;
  return (
    <div>
      <div className="mb-5 border-b border-gray-200 pb-3">
        <SubTabs tabs={abas} ariaLabel="Seções do acadêmico" />
      </div>
      {children}
    </div>
  );
}
