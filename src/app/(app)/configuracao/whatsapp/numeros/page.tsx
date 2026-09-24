import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { listarVendedores } from "@/server/comercial/consultas";
import { listarNumerosConfig } from "@/server/whatsapp/consultas";
import { NumerosPainel } from "../NumerosPainel";
import { SECOES_WHATSAPP } from "../secoes";

// Números e sessões do canal: só o administrador (D21). Guard ANTES de qualquer consulta.
export default async function NumerosWhatsAppPage() {
  if (!(await exigirPapelLeitura(...SECOES_WHATSAPP.numeros.papeis))) return <AcessoNegado recurso="os números do WhatsApp" />;
  const [numeros, vendedores] = await Promise.all([listarNumerosConfig(), listarVendedores()]);
  return <NumerosPainel numeros={numeros} vendedores={vendedores} />;
}
