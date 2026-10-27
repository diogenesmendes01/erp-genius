import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { carregarPoliticaConfig, listarNumerosConfig, listarTemplatesConfig } from "@/server/whatsapp/consultas";
import { PoliticaPainel } from "../PoliticaPainel";
import { SECOES_WHATSAPP } from "../secoes";

export default async function PoliticaWhatsAppPage() {
  if (!(await exigirPapelLeitura(...SECOES_WHATSAPP.politica.papeis))) return <AcessoNegado recurso="a política da régua" />;
  const [politica, numeros, templates] = await Promise.all([carregarPoliticaConfig(), listarNumerosConfig(), listarTemplatesConfig()]);
  return <PoliticaPainel politica={politica} numeros={numeros} templates={templates} />;
}
