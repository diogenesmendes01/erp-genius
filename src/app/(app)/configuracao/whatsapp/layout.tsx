import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { SubTabs } from "@/components/SubTabs";
import { secoesParaPapeis } from "./secoes";

// Barra de seções do WhatsApp (E8). O guard aqui só decide as abas visíveis; cada página repete o
// guard da própria seção — layout não protege rota filha sozinho (a página pode ser pedida direto).
export default async function WhatsAppConfigLayout({ children }: { children: React.ReactNode }) {
  const papeis = await exigirPapelLeitura(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
  if (!papeis) return <AcessoNegado recurso="a configuração do WhatsApp" />;
  const secoes = secoesParaPapeis(papeis).map((s) => ({ href: s.href, label: s.label }));
  return (
    <div>
      <SubTabs tabs={secoes} ariaLabel="Seções do WhatsApp" />
      <div className="mt-6">{children}</div>
    </div>
  );
}
