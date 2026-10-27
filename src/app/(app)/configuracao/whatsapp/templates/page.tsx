import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { listarTemplatesConfig } from "@/server/whatsapp/consultas";
import { TemplatesPainel } from "../TemplatesPainel";
import { SECOES_WHATSAPP } from "../secoes";

export default async function TemplatesWhatsAppPage() {
  if (!(await exigirPapelLeitura(...SECOES_WHATSAPP.templates.papeis))) return <AcessoNegado recurso="os templates do WhatsApp" />;
  return <TemplatesPainel templates={await listarTemplatesConfig()} />;
}
