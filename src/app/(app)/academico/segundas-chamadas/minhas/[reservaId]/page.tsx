import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import { consultarSegundaChamadaDocente } from "@/server/avaliacoes/segunda-chamada-docente";
import { FormularioNota, FormularioRealizacao } from "./Formulario";
import { consultarPreferenciaFusoEquipe } from "@/server/preferencias/fuso-exibicao";
import { formatarInstanteExibicao, resolverFusoExibicao } from "@/server/operacao/fuso-exibicao";
import { consultarFusoInstitucional } from "@/server/operacao/consultas";
import { VoltarPara } from "@/components/VoltarPara";


export default async function MinhaSegundaChamada({ params }: { params: Promise<{ reservaId: string }> }) {
  await exigirSessaoPagina(Papel.PROFESSOR);
  const { reservaId } = await params;
  const [resultado, preferencia, fusoInstitucional] = await Promise.all([consultarSegundaChamadaDocente({ reservaId }), consultarPreferenciaFusoEquipe(), consultarFusoInstitucional()]);
  if (!resultado.ok || !resultado.dado) return <p role="alert">{resultado.ok ? "Consulta indisponível." : resultado.erro}</p>;
  const d = resultado.dado;
  const fuso = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, d.horario.fusoOrigem);
  const fusoAdministrativo = resolverFusoExibicao(preferencia.ok ? preferencia.dado?.fusoExibicao : null, "UTC");

  return <section className="space-y-4">
    <VoltarPara href="/academico/segundas-chamadas/minhas" />
    <h1 className="text-2xl font-medium">Segunda chamada designada · {d.codigoAvaliacao}</h1>
    <p>{d.identificacao.aluno} · matrícula {d.identificacao.matriculaCodigo ?? d.identificacao.matriculaId} · {d.identificacao.turma} · nível {d.identificacao.nivel}.</p>
    <p>Horário reservado: {formatarInstanteExibicao(d.horario.inicio, fuso, d.horario.fusoOrigem).texto} a {formatarInstanteExibicao(d.horario.fim, fuso, d.horario.fusoOrigem).texto} ({fuso}; origem {d.horario.fusoOrigem}).</p>
    <p>Situação da reserva: {d.status}.</p>
    {!d.realizacao && d.podeRealizar && <FormularioRealizacao reservaId={d.reservaId} fusoInstitucional={fusoInstitucional} />}
    {!d.realizacao && !d.podeRealizar && <p role="status">A realização não pode ser registrada nas condições atuais.</p>}
    {d.realizacao && <p role="status">Realização registrada em {formatarInstanteExibicao(d.realizacao.realizadaEm, fusoAdministrativo, "UTC").texto} ({fusoAdministrativo}; origem UTC) por {d.realizador?.nome ?? "professor não identificado"}. O horário do fato é imutável para a nota original.</p>}
    {d.notaOriginal?.status === "REJEITADA" && <p role="status">Nota original devolvida: {d.notaOriginal.motivoDecisao ?? "sem justificativa informada"}. Corrija e reenvie nesta página; não use o fluxo de correção de nota oficial.</p>}
    {d.realizacao && d.podeLancarNota && <FormularioNota realizacaoId={d.realizacao.id} alocacaoId={d.alocacaoId} codigoAvaliacao={d.codigoAvaliacao} realizadaEm={d.realizacao.realizadaEm} escala={d.escala} habilidades={d.habilidadesNecessarias} versaoEsperada={d.versaoEsperada} regularizacao={d.regularizacao} preferenciaFusoExibicao={preferencia.ok ? preferencia.dado?.fusoExibicao : null} />}
    {d.notaOriginal && <p role="status">Nota original: {d.notaOriginal.status}.</p>}
    {d.realizacao && !d.podeLancarNota && !d.notaOriginal && <p role="status">A nota original não está disponível para lançamento nas condições atuais.</p>}
    <p>Esta página é limitada à reserva designada. O lançamento submetido ainda exige conferência independente.</p>
  </section>;
}
