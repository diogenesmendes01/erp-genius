import { notFound } from "next/navigation";
import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoPagina } from "@/server/_shared";
import { PeriodosCalendarioSchema } from "@/server/agenda/calendario-schema";
import { PrepararCalendario } from "./PrepararCalendario";
import { VoltarPara } from "@/components/VoltarPara";

export default async function NovoCalendarioPage({ searchParams }: { searchParams: Promise<{ base?: string }> }) {
  await exigirSessaoPagina(Papel.SECRETARIA_ACADEMICA, Papel.GERENTE_PEDAGOGICO);
  const q = await searchParams;
  const { ultima, base, config } = await prisma.$transaction(async (tx) => {
    const ultima = await tx.versaoCalendarioEscolar.findFirst({ orderBy: { versao: "desc" } });
    const base = q.base ? await tx.versaoCalendarioEscolar.findUnique({ where: { id: q.base } }) :
      await tx.versaoCalendarioEscolar.findFirst({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" } }) ?? ultima;
    return { ultima, base, config: await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } }) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  if (q.base && !base) notFound();
  return <div className="space-y-5">
    <VoltarPara href="/academico/calendario" para="Calendário" />
    <h1 className="text-2xl font-medium">Preparar calendário da escola</h1>
    <p>{base ? `Períodos copiados da versão ${base.versao}.` : "Preparação do primeiro calendário."} A proposta será uma nova versão e dependerá de aprovação independente.</p>
    {config?.fusoInstitucional ? <><p>Fuso institucional: {config.fusoInstitucional}</p><PrepararCalendario key={`${ultima?.versao ?? 0}:${base?.id ?? "novo"}`} fusoConferido={config.fusoInstitucional} versaoAnterior={ultima?.versao ?? 0} periodosIniciais={base ? PeriodosCalendarioSchema.parse(base.periodos) : []} /></> :
      <p role="alert">Configure o fuso institucional da escola antes de preparar o calendário.</p>}
  </div>;
}
