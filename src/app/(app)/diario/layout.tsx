import { exigirSessaoPagina } from "@/server/_shared";
import { abasParaPapeis } from "@/lib/nav";
import { SubTabs } from "@/components/SubTabs";
import { SECOES_DIARIO } from "./secoes";

// Camada de área de /diario (docs/42-auditoria-frontend-ux.md, E2): as sub-seções viram abas acima
// de cada página, com a ativa marcada. O layout NÃO decide acesso — só a sessão (memoizada por
// requisição); cada página mantém o próprio guard, e a barra mostra só as abas que o papel abre.
// A Secretaria, que chega a /diario/encontros pelo acadêmico, abre uma seção só — e não vê barra.
export default async function DiarioLayout({ children }: { children: React.ReactNode }) {
  const { papeis } = await exigirSessaoPagina();
  const abas = abasParaPapeis(SECOES_DIARIO, papeis);
  // Uma aba só não é navegação — a página basta.
  if (abas.length < 2) return <>{children}</>;
  return (
    <div>
      <div className="mb-5 border-b border-gray-200 pb-3">
        <SubTabs tabs={abas} ariaLabel="Seções do diário" />
      </div>
      {children}
    </div>
  );
}
