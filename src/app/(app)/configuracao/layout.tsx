import { Papel } from "@prisma/client";
import { auth } from "@/lib/auth";
import { SubTabs } from "./_componentes/SubTabs";
import { tabsParaPapeis } from "./_componentes/tabs";

export default async function ConfiguracaoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const papeis = (session?.user?.papeis ?? []) as Papel[];
  const tabs = tabsParaPapeis(papeis).map((t) => ({ href: t.href, label: t.label }));

  return (
    <div>
      <h1 className="text-2xl font-medium">Configuração</h1>
      <p className="mt-1 text-sm text-gray-500">
        O backstage que abastece todas as telas.
      </p>
      <SubTabs tabs={tabs} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
