import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { SubTabs } from "./_componentes/SubTabs";
import { tabsParaPapeis } from "./_componentes/tabs";

export default async function ConfiguracaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { papeis } = await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO, Papel.GERENTE_COMERCIAL, Papel.SECRETARIA_ACADEMICA);
  const tabs = tabsParaPapeis(papeis).map((t) => ({ href: t.href, label: t.label }));

  return (
    <div>
      <h1 className="text-2xl font-medium">Configuração</h1>
      <p className="mt-1 text-sm text-gray-500">
        Configurações disponíveis para sua função.
      </p>
      <SubTabs tabs={tabs} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
