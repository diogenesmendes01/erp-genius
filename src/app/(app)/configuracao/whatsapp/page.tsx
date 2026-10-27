import { Papel } from "@prisma/client";
import { redirect } from "next/navigation";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { secoesParaPapeis } from "./secoes";

export default async function WhatsAppConfigPage() {
  const papeis = await exigirPapelLeitura(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
  if (!papeis) return <AcessoNegado recurso="a configuração do WhatsApp" />;
  const [primeira] = secoesParaPapeis(papeis);
  if (!primeira) redirect("/home");
  redirect(primeira.href);
}
