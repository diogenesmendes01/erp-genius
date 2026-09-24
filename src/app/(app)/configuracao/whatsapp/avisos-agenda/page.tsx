import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { carregarConfiguracaoAvisosAgenda } from "@/server/whatsapp/consultas";
import { AvisosAgendaPainel } from "../AvisosAgendaPainel";
import { SECOES_WHATSAPP } from "../secoes";

// Avisos de alteração na agenda: só o administrador (D21). Guard ANTES de qualquer consulta.
export default async function AvisosAgendaWhatsAppPage() {
  if (!(await exigirPapelLeitura(...SECOES_WHATSAPP.avisosAgenda.papeis))) return <AcessoNegado recurso="os avisos da agenda" />;
  return <AvisosAgendaPainel config={await carregarConfiguracaoAvisosAgenda()} />;
}
