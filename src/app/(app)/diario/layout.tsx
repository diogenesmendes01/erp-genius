import { exigirSessaoPagina } from "@/server/_shared";
import { abasParaPapeis } from "@/lib/nav";
import { SubTabs } from "@/components/SubTabs";
import { SECOES_DIARIO } from "./secoes";

export default async function DiarioLayout({ children }: { children: React.ReactNode }) {
  const { papeis } = await exigirSessaoPagina();
  const abas = abasParaPapeis(SECOES_DIARIO, papeis);
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
