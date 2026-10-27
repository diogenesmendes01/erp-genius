import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { carregarConfiguracaoAvisosAgenda } from "@/server/whatsapp/consultas";
import { AvisosAgendaPainel } from "../AvisosAgendaPainel";
import { SECOES_WHATSAPP } from "../secoes";

export default async function AvisosAgendaWhatsAppPage() {
  if (!(await exigirPapelLeitura(...SECOES_WHATSAPP.avisosAgenda.papeis))) return <AcessoNegado recurso="os avisos da agenda" />;
  return <AvisosAgendaPainel config={await carregarConfiguracaoAvisosAgenda()} />;
}
