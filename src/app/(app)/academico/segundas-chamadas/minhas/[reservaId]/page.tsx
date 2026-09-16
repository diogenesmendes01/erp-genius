import Link from "next/link";
import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarSegundaChamadaDocente } from "@/server/avaliacoes/segunda-chamada-docente";
import { FormularioNota, FormularioRealizacao } from "./Formulario";

const dataHoraUtc = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(valor));

export default async function MinhaSegundaChamada({ params }: { params: Promise<{ reservaId: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR);
  const { reservaId } = await params;
  const resultado = await consultarSegundaChamadaDocente({ reservaId });
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;

  return <section className="space-y-4">
    <Link className="underline" href="/academico/segundas-chamadas/minhas">Voltar para minhas segundas chamadas</Link>
    <h1 className="text-2xl font-medium">Segunda chamada designada · {d.codigoAvaliacao}</h1>
    <p>{d.identificacao.aluno} · matrícula {d.identificacao.matriculaCodigo ?? d.identificacao.matriculaId} · {d.identificacao.turma} · nível {d.identificacao.nivel}.</p>
    <p>Horário reservado: {dataHoraUtc(d.horario.inicio)} a {dataHoraUtc(d.horario.fim)} (UTC).</p>
    <p>Situação da reserva: {d.status}.</p>
    {!d.realizacao && d.podeRealizar && <FormularioRealizacao reservaId={d.reservaId} />}
    {!d.realizacao && !d.podeRealizar && <p role="status">A realização não pode ser registrada nas condições atuais.</p>}
    {d.realizacao && <p role="status">Realização registrada em {dataHoraUtc(d.realizacao.realizadaEm)} (UTC) por {d.realizador?.nome ?? "professor não identificado"}. O horário do fato é imutável para a nota original.</p>}
    {d.notaOriginal?.status === "REJEITADA" && <p role="status">Nota original devolvida: {d.notaOriginal.motivoDecisao ?? "sem justificativa informada"}. Corrija e reenvie nesta página; não use o fluxo de correção de nota oficial.</p>}
    {d.realizacao && d.podeLancarNota && <FormularioNota realizacaoId={d.realizacao.id} alocacaoId={d.alocacaoId} codigoAvaliacao={d.codigoAvaliacao} realizadaEm={d.realizacao.realizadaEm} escala={d.escala} habilidades={d.habilidadesNecessarias} versaoEsperada={d.versaoEsperada} regularizacao={d.regularizacao} />}
    {d.notaOriginal && <p role="status">Nota original: {d.notaOriginal.status}.</p>}
    {d.realizacao && !d.podeLancarNota && !d.notaOriginal && <p role="status">A nota original não está disponível para lançamento nas condições atuais.</p>}
    <p>Esta página é limitada à reserva designada. O lançamento submetido ainda exige conferência independente.</p>
  </section>;
}
