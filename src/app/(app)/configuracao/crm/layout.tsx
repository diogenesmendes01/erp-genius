import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { SubTabs } from "@/components/SubTabs";
import { hrefSecaoCrm, secoesCrmParaPapeis } from "./secoes";

// Barra de seções do CRM. O guard aqui só decide as abas visíveis; cada página repete o guard da
// própria seção — layout não protege rota filha sozinho.
export default async function CrmConfigLayout({ children }: { children: React.ReactNode }) {
  const papeis = await exigirPapelLeitura(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
  if (!papeis) return <AcessoNegado recurso="a configuração do CRM" />;
  const secoes = secoesCrmParaPapeis(papeis).map((s) => ({ href: hrefSecaoCrm(s.id), label: s.label }));
  return (
    <div>
      <SubTabs tabs={secoes} ariaLabel="Seções do CRM" />
      <div className="mt-6">{children}</div>
    </div>
  );
}
