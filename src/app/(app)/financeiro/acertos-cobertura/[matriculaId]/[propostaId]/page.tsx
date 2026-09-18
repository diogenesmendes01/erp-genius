import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarImpactosCoberturaAditivo, consultarPreparoCoberturaAditivo } from "@/server/contratos/aditivo-cobertura-consulta";
import { ImpactosCoberturaFormulario } from "../../ImpactosCoberturaFormulario";
import { ImpactosCoberturaOperacao } from "../../ImpactosCoberturaOperacao";

export default async function AcertoCoberturaDetalhe({ params }: { params: Promise<{ matriculaId: string; propostaId: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const d = await params, [preparo, impactos] = await Promise.all([consultarPreparoCoberturaAditivo(d), consultarImpactosCoberturaAditivo(d)]);
  return <main className="space-y-5"><Link className="underline" href="/financeiro/acertos-cobertura">Voltar às correções de cobertura</Link><h1 className="text-2xl">Correção de cobertura · matrícula {d.matriculaId}</h1>
    {!preparo.ok ? <p role="alert">{preparo.erro}</p> : preparo.dado?.estado === "PRONTA" ? <ImpactosCoberturaFormulario matriculaId={d.matriculaId} propostaId={d.propostaId} conclusaoId={preparo.dado.conclusaoId} revisaoHash={preparo.dado.revisaoHash} cobrancas={preparo.dado.cobrancas} /> : <p role="status">{preparo.dado?.mensagem}</p>}
    {!impactos.ok ? <p role="alert">{impactos.erro}</p> : <ImpactosCoberturaOperacao conjunto={impactos.dado ?? null} reprepararHref={`/financeiro/acertos-cobertura/${encodeURIComponent(d.matriculaId)}/${encodeURIComponent(d.propostaId)}`} />}
  </main>;
}
