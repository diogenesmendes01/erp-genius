import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarOcorrenciasFinanceiras } from "@/server/matricula/ocorrencia-financeira-consulta";
import { ConferenciaHoras } from "./ConferenciaHoras";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cursor?: string }> }) {
  await exigirSessaoPagina(Papel.FINANCEIRO);
  const { id } = await params, { cursor } = await searchParams;
  const r = await consultarOcorrenciasFinanceiras({ matriculaId: id, cursor });
  if (!r.ok || !r.dado) return <p role="alert">{r.ok ? "Consulta indisponível." : r.erro}</p>;
  const d = r.dado;
  return <div className="space-y-4">
    <Link href={`/alunos/${d.matricula.alunoId}/financeiro`} className="underline">Voltar à ficha financeira</Link>
    <h1 className="text-2xl">Conferência das particulares · {d.matricula.codigo ?? id}</h1>
    <p>Confira os informes e a versão contratual antes de registrar a apuração. Conferência não é cobrança emitida nem pagamento.</p>
    <Link href={`/matriculas/${id}/condicoes-horas`} className="underline">Condições contratuais por hora</Link>
    <p><Link href={`/matriculas/${id}/fechamentos-horas?aluno=${encodeURIComponent(d.matricula.alunoId)}`} className="underline">Histórico de fechamentos por hora</Link></p>
    {!d.encontros.length && <p>Nenhum encontro particular nesta página.</p>}
    {d.encontros.map(e => <ConferenciaHoras key={e.conferencia?.id ?? `${e.id}:${e.ocorrencia?.id ?? "sem-informe"}`} encontro={e} condicoes={d.condicoes} matricula={d.matricula} />)}
    {d.proximoCursor && <Link href={`/matriculas/${id}/ocorrencias-financeiras?cursor=${encodeURIComponent(d.proximoCursor)}`} className="underline">Próximos encontros</Link>}
  </div>;
}
