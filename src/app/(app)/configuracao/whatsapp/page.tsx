import { Papel } from "@prisma/client";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { listarVendedores } from "@/server/comercial/consultas";
import {
  carregarPoliticaConfig,
  listarNumerosConfig,
  listarTemplatesConfig,
} from "@/server/whatsapp/consultas";
import { NumerosPainel } from "./NumerosPainel";
import { TemplatesPainel } from "./TemplatesPainel";
import { PoliticaPainel } from "./PoliticaPainel";

// CONFIG DO CANAL WHATSAPP (docs 26/30 — E3/E4): tela do número (sessão/QR), templates
// (entidade única, ciclo duplo) e política da régua (config como dado). Exclusiva do
// Administrador (doc 26: "régua configurável pelo admin"; matriz D21 fechada na E3).

export default async function WhatsAppConfigPage() {
  const papeis = await exigirPapelLeitura(Papel.ADMINISTRADOR);
  if (!papeis) return <AcessoNegado recurso="a configuração do WhatsApp" />;

  const [numeros, templates, politica, vendedores] = await Promise.all([
    listarNumerosConfig(),
    listarTemplatesConfig(),
    carregarPoliticaConfig(),
    listarVendedores(),
  ]);

  return (
    <div className="space-y-10">
      <NumerosPainel numeros={numeros} vendedores={vendedores} />
      <TemplatesPainel templates={templates} />
      <PoliticaPainel politica={politica} numeros={numeros} templates={templates} />
    </div>
  );
}
