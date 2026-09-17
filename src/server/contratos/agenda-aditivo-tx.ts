import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { ErroRegra } from "@/server/_shared";
import { PeriodosCalendarioSchema } from "@/server/agenda/calendario-schema";
import { conferirDiasNaoLetivos } from "@/server/agenda/calendario-intervalo";
import { PrepararAgendaAditivoSchema, PropostaAgendaAditivoSchema } from "./agenda-aditivo-schema";
import { ConclusaoAssinaturaSchema, validarConclusaoAssinatura } from "./conclusao-assinatura-schema";
import { carregarCadeiaAditivoTx } from "./aditivo-cadeia";

/**
 * Carrega uma fotografia para conferência. É deliberadamente somente leitura:
 * não reserva horário, não cria proposta e não aplica alteração alguma.
 * A ordem de bloqueio é calendário, matrícula e agenda, para permanecer
 * compatível com as futuras operações que transformarão esta fotografia em ato.
 */
export async function carregarConferenciaAgendaAditivoTx(tx: Prisma.TransactionClient, preparadorId: string, entrada: unknown) {
  const d = PrepararAgendaAditivoSchema.parse(entrada);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  await tx.$queryRaw`SELECT id FROM "ConfiguracaoOperacional" WHERE id = 'escola' FOR SHARE`;
  const [configuracao, calendario] = await Promise.all([
    tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } }),
    tx.versaoCalendarioEscolar.findFirst({ where: { decisao: { aprovada: true } }, orderBy: { versao: "desc" }, select: { id: true, versao: true, fusoInstitucional: true, periodos: true } }),
  ]);
  if (!calendario || configuracao?.fusoInstitucional !== calendario.fusoInstitucional) throw new ErroRegra("Confira calendário aprovado e fuso institucional.");

  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id = ${d.matriculaId} FOR SHARE`;
  const matricula = await tx.matricula.findUnique({ where: { id: d.matriculaId }, select: { id: true, status: true, aluno: { select: { primeiroNome: true, sobrenome: true } } } });
  if (!matricula || matricula.status !== "ATIVA") throw new ErroRegra("A conferência exige matrícula ativa.");
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${preparadorId} FOR SHARE`;
  const preparador = await tx.usuario.findUnique({ where: { id: preparadorId }, select: { ativo: true, papeis: true } });
  if (!preparador?.ativo || !preparador.papeis.some(p => ["SECRETARIA_ACADEMICA", "ADMINISTRADOR", "GERENTE_PEDAGOGICO"].includes(p))) throw new ErroRegra("Permissão operacional necessária.");

  const fontes = await tx.conclusaoAssinaturaContratual.findMany({
    where: { processo: { matriculaId: matricula.id, estado: "ENVIADO" } }, orderBy: { concluidaEm: "desc" },
    include: { processo: { include: { artefato: { include: { conferencia: true } }, tentativas: { orderBy: { numero: "desc" }, take: 1 } } } },
  });
  if (fontes.length !== 1) throw new ErroRegra("Confira a fonte assinada vigente do contrato antes da alteração de agenda.");
  const fonte = fontes[0], tentativa = fonte.processo.tentativas[0], artefato = fonte.processo.artefato;
  if (fonte.processo.ambiente !== "PRODUCAO" || !tentativa || fonte.processo.referenciaExterna !== fonte.referenciaExterna || fonte.originalHash !== artefato.pdfHash || createHash("sha256").update(artefato.pdf).digest("hex") !== artefato.pdfHash) throw new ErroRegra("Confira a fonte assinada em produção e sua integridade antes da alteração de agenda.");
  const validada = validarConclusaoAssinatura({ processoId: fonte.processo.id, referenciaExterna: fonte.referenciaExterna, originalHash: fonte.originalHash, concluidaEm: fonte.concluidaEm.toISOString(), pdfAssinado: fonte.pdfAssinado, evidencias: fonte.evidencias, assinaturas: ConclusaoAssinaturaSchema.shape.assinaturas.element.strip().array().parse(fonte.assinaturas) }, artefato.conferencia.snapshot, tentativa.iniciadaEm);
  if (validada.entradaHash !== fonte.entradaHash || validada.pdfHash !== fonte.pdfHash || validada.evidenciasHash !== fonte.evidenciasHash) throw new ErroRegra("As evidências da fonte assinada divergem da conclusão preservada.");
  if (!await tx.aceiteOriginalContratual.count({ where: { matriculaId: matricula.id, conclusaoId: fonte.id } })) throw new ErroRegra("O aceite conferido do contrato original é necessário antes da alteração de agenda.");
  await carregarCadeiaAditivoTx(tx, { matriculaId: matricula.id });
  // Uma versão formalizada mas ainda sem efeito não é tomada como vigente por
  // esta consulta. Ela fica explícita para que a futura decisão revalide a base.
  const aditivos = await tx.versaoCondicoesAditivo.findMany({ where: { matriculaId: matricula.id }, orderBy: { versao: "asc" }, select: { id: true, propostaId: true, condicoesHash: true, aplicacao: { select: { id: true } } } });
  const aditivosPendentes = aditivos.filter(a => !a.aplicacao).length;

  const ids = d.encontros.map(e => e.encontroId);
  await tx.$queryRaw`SELECT id FROM "EncontroAgenda" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`;
  const encontros = await tx.encontroAgenda.findMany({ where: { id: { in: ids }, matriculaId: matricula.id }, select: {
    id: true, professorId: true, inicio: true, fim: true, fusoOrigem: true, status: true, turmaId: true, finalidade: true, reposicaoIndividualId: true,
    agendaReposicaoIndividual: { select: { id: true } }, diario: { select: { id: true } }, ocorrenciasParticulares: { select: { id: true } }, conferenciaOcorrenciaHoras: { select: { id: true } },
    reservasHoras: { select: { id: true, consumo: { select: { id: true } } } }, professor: { select: { id: true, nome: true } },
    cancelamentosParticulares: { where: { decisao: null }, select: { id: true } },
  } });
  if (encontros.length !== ids.length) throw new ErroRegra("Há encontro fora da matrícula informada.");
  const porId = new Map(encontros.map(e => [e.id, e]));
  const agora = new Date();
  const pendencias: string[] = aditivosPendentes ? ["Há aditivo formalizado com efeitos pendentes; a fonte vigente deve ser revalidada antes da decisão."] : [];
  const periodos = PeriodosCalendarioSchema.parse(calendario.periodos).map(({ id, inicio, fim }) => ({ id, inicio, fim }));
  const fotografia = [];

  for (let i = 0; i < d.encontros.length; i++) for (let j = i + 1; j < d.encontros.length; j++) {
    const a = d.encontros[i], b = d.encontros[j];
    if (new Date(a.inicioNovo) < new Date(b.fimNovo) && new Date(a.fimNovo) > new Date(b.inicioNovo)) pendencias.push("Os novos horários selecionados colidem entre si na mesma matrícula.");
  }

  for (const solicitado of d.encontros) {
    const anterior = porId.get(solicitado.encontroId)!;
    if (anterior.finalidade !== "AULA" || anterior.turmaId || anterior.reposicaoIndividualId || anterior.agendaReposicaoIndividual || anterior.status !== "PREVISTO" || anterior.inicio <= agora || !anterior.professorId || !anterior.professor) {
      throw new ErroRegra("A alteração exige encontro particular previsto, futuro e com professor definido.");
    }
    if (anterior.cancelamentosParticulares.length) pendencias.push(`Há cancelamento aguardando decisão para o encontro ${anterior.id}.`);
    if (anterior.diario) pendencias.push(`Há diário vinculado ao encontro ${anterior.id}.`);
    if (anterior.ocorrenciasParticulares.length) pendencias.push(`Há ocorrência particular vinculada ao encontro ${anterior.id}.`);
    if (anterior.conferenciaOcorrenciaHoras) pendencias.push(`Há conferência de ocorrência vinculada ao encontro ${anterior.id}.`);
    if (anterior.reservasHoras.length) pendencias.push(`Há reserva de horas vinculada ao encontro ${anterior.id}.`);
    if (anterior.reservasHoras.some(r => r.consumo)) pendencias.push(`Há consumo de horas vinculado ao encontro ${anterior.id}.`);
    const inicioNovo = new Date(solicitado.inicioNovo), fimNovo = new Date(solicitado.fimNovo);
    if (inicioNovo <= agora) pendencias.push(`O novo horário de ${anterior.id} precisa ser futuro.`);
    const professorNovo = await tx.usuario.findUnique({ where: { id: solicitado.professorNovoId }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!professorNovo?.ativo || !professorNovo.papeis.includes("PROFESSOR")) pendencias.push(`Defina professor ativo para ${anterior.id}.`);
    const naoLetivos = conferirDiasNaoLetivos({ inicio: inicioNovo.toISOString(), fim: fimNovo.toISOString(), fusoEscola: calendario.fusoInstitucional, periodos }).periodosAfetados;
    if (naoLetivos.length) pendencias.push(`O novo horário de ${anterior.id} atinge período não letivo.`);
    if (professorNovo) {
      const [conflitos, indisponibilidades, reservas] = await Promise.all([
        tx.encontroAgenda.count({ where: { id: { notIn: ids }, status: { in: ["PREVISTO", "MINISTRADO"] }, inicio: { lt: fimNovo }, fim: { gt: inicioNovo }, OR: [{ professorId: professorNovo.id }, { matriculaId: matricula.id }] } }),
        tx.indisponibilidadeDocente.count({ where: { professorId: professorNovo.id, decisao: { aprovada: true }, inicio: { lt: fimNovo }, fim: { gt: inicioNovo } } }),
        tx.horarioReservaParticular.count({ where: { professorId: professorNovo.id, reserva: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } }, inicio: { lt: fimNovo }, fim: { gt: inicioNovo } } }),
      ]);
      if (conflitos) pendencias.push(`Há conflito operacional no novo horário de ${anterior.id}.`);
      if (indisponibilidades) pendencias.push(`Há indisponibilidade docente no novo horário de ${anterior.id}.`);
      if (reservas) pendencias.push(`Há reserva comercial no novo horário de ${anterior.id}.`);
    }
    fotografia.push({ encontroId: anterior.id, professorAnteriorId: anterior.professor.id, professorAnteriorNome: anterior.professor.nome,
      professorNovoId: solicitado.professorNovoId, professorNovoNome: professorNovo?.nome ?? "Professor indisponível",
      inicioAnterior: anterior.inicio.toISOString(), fimAnterior: anterior.fim.toISOString(), inicioNovo: inicioNovo.toISOString(), fimNovo: fimNovo.toISOString(),
      duracaoMinutos: solicitado.duracaoMinutos, fusoAnterior: anterior.fusoOrigem, fusoNovo: solicitado.fusoOrigem });
  }
  const proposta = PropostaAgendaAditivoSchema.parse({ matriculaId: matricula.id, preparadorId, fonteContratualId: fonte.id, fonteContratualHash: fonte.entradaHash,
    contexto: { calendarioId: calendario.id, calendarioVersao: calendario.versao, fusoInstitucional: calendario.fusoInstitucional, aditivos: aditivos.map(a => ({ versaoId: a.id, propostaId: a.propostaId, condicoesHash: a.condicoesHash, aplicada: !!a.aplicacao })) }, encontros: fotografia });
  return { somenteConsulta: true as const, matricula: { id: matricula.id, aluno: `${matricula.aluno.primeiroNome} ${matricula.aluno.sobrenome}`.trim() },
    fonte: { conclusaoId: fonte.id, conclusaoHash: fonte.entradaHash, concluidaEm: fonte.concluidaEm.toISOString() }, calendario: { id: calendario.id, versao: calendario.versao, fuso: calendario.fusoInstitucional }, proposta, pendencias };
}
