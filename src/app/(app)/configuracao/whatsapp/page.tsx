import { Papel } from "@prisma/client";
import { redirect } from "next/navigation";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { secoesParaPapeis } from "./secoes";

// CONFIG DO CANAL WHATSAPP (docs 26/30 · fase comercial doc 27) — uma rota por seção (E8). O
// endereço antigo continua valendo: leva à primeira seção que a função enxerga (admin: Números;
// gerente comercial: Comercial). Nenhuma consulta de dados aqui.
export default async function WhatsAppConfigPage() {
  const papeis = await exigirPapelLeitura(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
  if (!papeis) return <AcessoNegado recurso="a configuração do WhatsApp" />;
  const [primeira] = secoesParaPapeis(papeis);
  if (!primeira) return <AcessoNegado recurso="a configuração do WhatsApp" />;
  redirect(primeira.href);
}
