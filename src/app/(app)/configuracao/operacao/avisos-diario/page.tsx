import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarConfiguracaoAvisosDiario } from "@/server/diario/avisos-pendencias-diario";
import { AvisosDiarioFormulario } from "./AvisosDiarioFormulario";

export default async function AvisosDiarioPage() {
  await exigirSessaoPagina(Papel.ADMINISTRADOR);
  const resultado = await consultarConfiguracaoAvisosDiario();
  return <section className="max-w-2xl space-y-5">
    <Link className="text-sm text-brand-700 underline" href="/configuracao/operacao">Voltar à configuração operacional</Link>
    <div><h1 className="text-2xl font-medium">Avisos do diário</h1><p className="mt-1 text-sm text-gray-600">Configure prazos explícitos; a ausência de valor não recebe prazo implícito.</p></div>
    {!resultado.ok && <p role="alert" className="text-red-700">{resultado.erro}</p>}
    {resultado.ok && resultado.dado && <AvisosDiarioFormulario valores={resultado.dado} />}
  </section>;
}
