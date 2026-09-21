import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { PeriodosCalendarioSchema } from "@/server/agenda/calendario-schema";
import { conferirDiasNaoLetivos } from "@/server/agenda/calendario-intervalo";
import { hashPropostaAgendaAditivo, PrepararAgendaAditivoSchema, PropostaAgendaAditivoSchema, textoAgendaAditivo } from "./agenda-aditivo-schema";
import { hashSubstituicao } from "./substituicao-estado";

const RegistrarAgendaAditivoSchema = z.object({ matriculaId: z.string().trim().min(1), encontros: z.array(z.unknown()), chaveIdempotencia: z.string().trim().min(8).max(200) }).strict();
const AplicarAgendaAditivoSchema = z.object({ matriculaId: z.string().trim().min(1), propostaAditivoId: z.string().trim().min(1), aplicacaoCondicoesId: z.string().trim().min(1), aplicacaoAgendaId: z.string().trim().min(1), eventoId: z.string().trim().min(1), chaveIdempotencia: z.string().trim().min(8).max(200) }).strict();
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

  // Contrato legado: a origem histórica aprovada é a fonte contratual da agenda (sem aceite no sistema).
  const origensHistoricas = await tx.propostaOrigemContratualHistorica.findMany({ where: { matriculaId: matricula.id, decisao: { is: { aprovada: true } } }, take: 2, select: { id: true, entradaHash: true, assinadoEm: true } });
  let fonte: { id: string; entradaHash: string; concluidaEm: Date; tipo: "CONCLUSAO" | "ORIGEM_HISTORICA" };
  if (origensHistoricas.length) {
    if (origensHistoricas.length > 1 || await tx.conclusaoAssinaturaContratual.count({ where: { processo: { matriculaId: matricula.id } } })) throw new ErroRegra("Confira a fonte contratual vigente antes da alteração de agenda.");
    await tx.$queryRaw`SELECT id FROM "PropostaOrigemContratualHistorica" WHERE id = ${origensHistoricas[0].id} FOR UPDATE`;
    fonte = { id: origensHistoricas[0].id, entradaHash: origensHistoricas[0].entradaHash, concluidaEm: origensHistoricas[0].assinadoEm, tipo: "ORIGEM_HISTORICA" };
  } else {
    const fontes = await tx.conclusaoAssinaturaContratual.findMany({
      where: { processo: { matriculaId: matricula.id, estado: "ENVIADO" } }, orderBy: { concluidaEm: "desc" },
      include: { processo: { include: { artefato: { include: { conferencia: true } }, tentativas: { orderBy: { numero: "desc" }, take: 1 } } } },
    });
    if (fontes.length !== 1) throw new ErroRegra("Confira a fonte assinada vigente do contrato antes da alteração de agenda.");
    const fonteAssinada = fontes[0], tentativa = fonteAssinada.processo.tentativas[0], artefato = fonteAssinada.processo.artefato;
    if (fonteAssinada.processo.ambiente !== "PRODUCAO" || !tentativa || fonteAssinada.processo.referenciaExterna !== fonteAssinada.referenciaExterna || fonteAssinada.originalHash !== artefato.pdfHash || createHash("sha256").update(artefato.pdf).digest("hex") !== artefato.pdfHash) throw new ErroRegra("Confira a fonte assinada em produção e sua integridade antes da alteração de agenda.");
    const validada = validarConclusaoAssinatura({ processoId: fonteAssinada.processo.id, referenciaExterna: fonteAssinada.referenciaExterna, originalHash: fonteAssinada.originalHash, concluidaEm: fonteAssinada.concluidaEm.toISOString(), pdfAssinado: fonteAssinada.pdfAssinado, evidencias: fonteAssinada.evidencias, assinaturas: ConclusaoAssinaturaSchema.shape.assinaturas.element.strip().array().parse(fonteAssinada.assinaturas) }, artefato.conferencia.snapshot, tentativa.iniciadaEm);
    if (validada.entradaHash !== fonteAssinada.entradaHash || validada.pdfHash !== fonteAssinada.pdfHash || validada.evidenciasHash !== fonteAssinada.evidenciasHash) throw new ErroRegra("As evidências da fonte assinada divergem da conclusão preservada.");
    if (!await tx.aceiteOriginalContratual.count({ where: { matriculaId: matricula.id, conclusaoId: fonteAssinada.id } })) throw new ErroRegra("O aceite conferido do contrato original é necessário antes da alteração de agenda.");
    fonte = { id: fonteAssinada.id, entradaHash: fonteAssinada.entradaHash, concluidaEm: fonteAssinada.concluidaEm, tipo: "CONCLUSAO" };
  }
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
    propostasSubstituicao: { where: { proposta: { decisao: null } }, select: { id: true } },
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
    if (anterior.propostasSubstituicao.length) pendencias.push(`Há substituição docente aguardando decisão para o encontro ${anterior.id}.`);
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
  const semTexto = { matriculaId: matricula.id, preparadorId, fonteContratualId: fonte.id, fonteContratualHash: fonte.entradaHash,
    contexto: { calendarioId: calendario.id, calendarioVersao: calendario.versao, fusoInstitucional: calendario.fusoInstitucional, aditivos: aditivos.map(a => ({ versaoId: a.id, propostaId: a.propostaId, condicoesHash: a.condicoesHash, aplicada: !!a.aplicacao })) }, encontros: fotografia };
  const proposta = PropostaAgendaAditivoSchema.parse({ ...semTexto, texto: textoAgendaAditivo({ ...semTexto, texto: "Agenda" }) });
  return { somenteConsulta: true as const, matricula: { id: matricula.id, aluno: `${matricula.aluno.primeiroNome} ${matricula.aluno.sobrenome}`.trim() },
    fonte: { tipo: fonte.tipo, conclusaoId: fonte.id, conclusaoHash: fonte.entradaHash, concluidaEm: fonte.concluidaEm.toISOString() }, calendario: { id: calendario.id, versao: calendario.versao, fuso: calendario.fusoInstitucional }, proposta, pendencias };
}

/** Persiste somente a fotografia conferida. A proposta contratual posterior é
 * quem a referencia e continua pertencendo ao preparador contratual. */
export async function registrarPropostaAgendaAditivoTx(tx: Prisma.TransactionClient, preparadorId: string, input: unknown) {
  const d = RegistrarAgendaAditivoSchema.parse(input);
  const conferenciaEntrada = PrepararAgendaAditivoSchema.parse({ matriculaId: d.matriculaId, encontros: d.encontros });
  const conferencia = await carregarConferenciaAgendaAditivoTx(tx, preparadorId, conferenciaEntrada);
  if (conferencia.pendencias.length) throw new ErroRegra("Resolva as pendências da conferência antes de registrar a proposta de agenda.");
  const fotografia = conferencia.proposta, fotografiaHash = hashPropostaAgendaAditivo(fotografia);
  const entradaHash = hashSubstituicao({ preparadorId, entrada: conferenciaEntrada, fotografiaHash });
  const existentes = await tx.$queryRaw<{ id: string; "fotografiaHash": string; "entradaHash": string }[]>(Prisma.sql`
    SELECT id,"fotografiaHash","entradaHash" FROM "PropostaAgendaAditivoParticular"
    WHERE "preparadorId"=${preparadorId} AND "chaveIdempotencia"=${d.chaveIdempotencia} FOR UPDATE`);
  if (existentes[0]) {
    const existente = existentes[0];
    if (existente.fotografiaHash !== fotografiaHash || existente.entradaHash !== entradaHash) throw new ErroRegra("A chave idempotente já corresponde a outra proposta de agenda.");
    return { id: existente.id, fotografiaHash, proposta: fotografia };
  }
  const id = randomUUID();
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "PropostaAgendaAditivoParticular"
      (id,"matriculaId","conclusaoFonteId","origemHistoricaId","preparadorId",fotografia,"fotografiaHash",pendencias,"chaveIdempotencia","entradaHash")
    VALUES (${id},${fotografia.matriculaId},${conferencia.fonte.tipo === "CONCLUSAO" ? fotografia.fonteContratualId : null},${conferencia.fonte.tipo === "ORIGEM_HISTORICA" ? fotografia.fonteContratualId : null},${preparadorId},${JSON.stringify(fotografia)}::jsonb,${fotografiaHash},'[]'::jsonb,${d.chaveIdempotencia},${entradaHash})`);
  return { id, fotografiaHash, proposta: fotografia };
}

/** Aplica a fotografia dentro da mesma transação que já registrou a aplicação
 * formalizada. Cada UPDATE condiciona o estado antes fotografado; se alguém
 * mudou um encontro, nada é aplicado e a transação inteira é desfeita. */
export async function aplicarAgendaAditivoTx(tx: Prisma.TransactionClient, aplicadorId: string, input: unknown) {
  const d = AplicarAgendaAditivoSchema.parse(input);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
  const linhas = await tx.$queryRaw<{ id: string; fotografia: Prisma.JsonValue; "fotografiaHash": string; "preparadorId": string; "aplicacaoId": string | null; "aplicadorId": string | null; "chaveAplicacao": string | null; "versaoCondicoesId": string; "versaoAgendaId": string | null }[]>(Prisma.sql`
    SELECT agenda.id,agenda.fotografia,agenda."fotografiaHash",agenda."preparadorId",
      aplicada.id AS "aplicacaoId",aplicada."aplicadorId",aplicada."chaveIdempotencia" AS "chaveAplicacao",
      condicao."versaoCondicoesId",versao."propostaAgendaId" AS "versaoAgendaId"
    FROM "PropostaAgendaAditivoParticular" agenda
    JOIN "PropostaAditivoContratual" proposta ON proposta."propostaAgendaId"=agenda.id
    JOIN "AplicacaoCondicoesAditivo" condicao ON condicao.id=${d.aplicacaoCondicoesId} AND condicao."propostaId"=proposta.id AND condicao."matriculaId"=agenda."matriculaId"
    JOIN "VersaoCondicoesAditivo" versao ON versao.id=condicao."versaoCondicoesId"
    LEFT JOIN "AplicacaoAgendaAditivoParticular" aplicada ON aplicada."propostaId"=agenda.id
    WHERE agenda."matriculaId"=${d.matriculaId} AND proposta.id=${d.propostaAditivoId} FOR UPDATE OF agenda,proposta`);
  const linha = linhas[0];
  if (!linha) throw new ErroRegra("A proposta de agenda não corresponde ao aditivo informado.");
  if (linha.aplicacaoId) {
    if (linha.aplicadorId !== aplicadorId || linha.chaveAplicacao !== d.chaveIdempotencia) throw new ErroRegra("A agenda já recebeu outra aplicação.");
    return { id: linha.aplicacaoId, fotografiaHash: linha.fotografiaHash };
  }
  const fotografia = PropostaAgendaAditivoSchema.parse(linha.fotografia);
  if (hashPropostaAgendaAditivo(fotografia) !== linha.fotografiaHash) throw new ErroRegra("A fotografia de agenda diverge de sua integridade.");
  if (linha.versaoAgendaId !== linha.id) throw new ErroRegra("A versão formalizada não referencia a fotografia de agenda.");
  const conferencia = await carregarConferenciaAgendaAditivoTx(tx, fotografia.preparadorId, {
    matriculaId: fotografia.matriculaId,
    encontros: fotografia.encontros.map(e => ({ encontroId: e.encontroId, professorNovoId: e.professorNovoId, inicioNovo: e.inicioNovo, fimNovo: e.fimNovo, duracaoMinutos: e.duracaoMinutos, fusoOrigem: e.fusoNovo })),
  });
  const propostaRevalidada = { ...conferencia.proposta, contexto: { ...conferencia.proposta.contexto, aditivos: conferencia.proposta.contexto.aditivos.filter(a => a.versaoId !== linha.versaoCondicoesId) } };
  if (conferencia.pendencias.length || hashPropostaAgendaAditivo(propostaRevalidada) !== linha.fotografiaHash) throw new ErroRegra("A agenda mudou desde a fotografia formalizada; faça nova conferência.");
  for (const encontro of fotografia.encontros) {
    const alterados = await tx.encontroAgenda.updateMany({
      where: { id: encontro.encontroId, matriculaId: d.matriculaId, status: "PREVISTO", professorId: encontro.professorAnteriorId,
        inicio: new Date(encontro.inicioAnterior), fim: new Date(encontro.fimAnterior), fusoOrigem: encontro.fusoAnterior },
      data: { professorId: encontro.professorNovoId, inicio: new Date(encontro.inicioNovo), fim: new Date(encontro.fimNovo), fusoOrigem: encontro.fusoNovo },
    });
    if (alterados.count !== 1) throw new ErroRegra("Um encontro mudou desde a fotografia; a agenda não foi aplicada.");
  }
  await tx.$executeRaw(Prisma.sql`
    INSERT INTO "AplicacaoAgendaAditivoParticular" (id,"propostaId","aplicacaoCondicoesId","matriculaId","aplicadorId","eventoId","fotografiaHash","chaveIdempotencia")
    VALUES (${d.aplicacaoAgendaId},${linha.id},${d.aplicacaoCondicoesId},${d.matriculaId},${aplicadorId},${d.eventoId},${linha.fotografiaHash},${d.chaveIdempotencia})`);
  return { id: d.aplicacaoAgendaId, fotografiaHash: linha.fotografiaHash };
}
