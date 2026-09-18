import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ErroRegra, registrarEvento } from "@/server/_shared";
import { carregarEstadoConferenciaFinalAditivoTx } from "./aditivo-conferencia-final-estado";
import { PrepararAditivoContratualSchema } from "./aditivo-schema";
import { conferirAutor } from "./modelos-tx";
import { hashSubstituicao } from "./substituicao-estado";
import { representarValorAlteracaoAditivo, validarValorAlteracaoAditivo } from "./aditivo-valores";
import { aplicarAgendaAditivoTx } from "./agenda-aditivo-tx";
import { criarAvisosAlteracaoAgendaTx } from "@/server/comunicacoes-agenda/avisos";

const Entrada = z.object({ matriculaId: z.string().min(1), propostaId: z.string().min(1), conclusaoId: z.string().min(1), revisaoHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const EntradaAplicacao = Entrada.extend({ chaveIdempotencia: z.string().trim().min(1).max(200) }).strict();
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.JsonObject;
const condicoesSemConsumidor = new Set(["TAXA_VALOR", "TAXA_VENCIMENTO", "PRIMEIRA_MENSALIDADE_VENCIMENTO", "COBERTURA_INICIO", "COBERTURA_FIM", "ADIANTAMENTO_VALOR", "ADIANTAMENTO_MINUTOS", "ADIANTAMENTO_VENCIMENTO", "MOEDA", "REGIME"]);

function exigirConsumidorAplicavel(condicoes: Prisma.JsonValue) {
  const campos = Object.keys(z.record(z.unknown()).parse(condicoes));
  const pendente = campos.find((campo) => condicoesSemConsumidor.has(campo));
  if (pendente) throw new ErroRegra(`A condição ${pendente} exige fluxo próprio antes da aplicação.`);
}

async function exigirMoedaERegimeAplicaveis(tx: Prisma.TransactionClient, matriculaId: string, condicoes: Prisma.JsonValue) {
  const matricula = await tx.matricula.findUnique({ where: { id: matriculaId }, select: { moeda: true, preparacaoComercial: { select: { regime: true } } } });
  if (!matricula) throw new ErroRegra("Matrícula não encontrada.");
  const original = await tx.conclusaoAssinaturaContratual.findFirst({ where: { processo: { matriculaId } }, include: { processo: { include: { artefato: { include: { previa: true } } } } } });
  const regimeOriginal = original ? z.object({ condicoes: z.object({ aulas: z.object({ regime: z.enum(["MENSALIDADE", "HORA_PARTICULAR"]) }) }) }).parse(original.processo.artefato.previa.snapshot).condicoes.aulas.regime : null;
  if (!regimeOriginal) throw new ErroRegra("O regime do contrato assinado exige conferência.");
  if (matricula.preparacaoComercial && matricula.preparacaoComercial.regime !== regimeOriginal) throw new ErroRegra("A preparação comercial diverge do contrato assinado.");
  const campos = z.record(z.unknown()).parse(condicoes);
  for (const [origem, valor] of [["MENSALIDADE_VALOR", campos.MENSALIDADE_VALOR], ["HORA_VALOR", campos.HORA_VALOR]] as const) {
    if (!valor) continue;
    const dinheiro = validarValorAlteracaoAditivo(origem, valor);
    if (dinheiro.tipo !== "DINHEIRO" || dinheiro.moeda !== matricula.moeda) throw new ErroRegra("A moeda da condição não corresponde ao contrato atual.");
    if (origem === "MENSALIDADE_VALOR" && regimeOriginal !== "MENSALIDADE") throw new ErroRegra("O valor mensal exige contratação mensal atual.");
    if (origem === "HORA_VALOR" && regimeOriginal !== "HORA_PARTICULAR") throw new ErroRegra("O valor por hora exige contratação por hora atual.");
  }
}

async function bloquearERevalidar(tx: Prisma.TransactionClient, autorId: string, d: z.infer<typeof Entrada>) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id=${d.matriculaId} FOR UPDATE`;
  const referencia = await tx.conclusaoAssinaturaAditivo.findFirst({ where: { id: d.conclusaoId, processo: { propostaId: d.propostaId, proposta: { matriculaId: d.matriculaId } } }, select: { processoId: true } });
  if (!referencia) throw new ErroRegra("Conclusão de aditivo indisponível neste escopo.");
  await tx.$queryRaw`SELECT id FROM "ProcessoAssinaturaAditivo" WHERE id=${referencia.processoId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${autorId} FOR SHARE`;
  await conferirAutor(tx, autorId);
  const estado = await carregarEstadoConferenciaFinalAditivoTx(tx, d);
  if (estado.dados.ambiente !== "PRODUCAO") throw new ErroRegra("Condições formalizadas exigem conclusão em produção.");
  if (d.revisaoHash !== estado.revisaoHash) throw new ErroRegra("A conferência final mudou.");
  const final = await tx.conferenciaFinalAditivo.findUnique({ where: { conclusaoId: d.conclusaoId } });
  if (!final || final.revisaoHash !== estado.revisaoHash || hashSubstituicao(final.snapshot) !== final.revisaoHash) throw new ErroRegra("A conferência final exata é obrigatória.");
  return { estado, final };
}

export async function registrarCondicoesFormalizadasAditivoTx(tx: Prisma.TransactionClient, autorId: string, input: unknown) {
  const d = Entrada.parse(input), { estado, final } = await bloquearERevalidar(tx, autorId, d);
  const proposta = await tx.propostaAditivoContratual.findUniqueOrThrow({ where: { id: d.propostaId } });
  const entrada = PrepararAditivoContratualSchema.parse((proposta.snapshot as { entrada: unknown }).entrada);
  const alteradas: Record<string, unknown> = {};
  for (const a of entrada.alteracoes) {
    if (!a.valorEstruturado) throw new ErroRegra("Toda alteração precisa de valor estruturado antes da formalização.");
    const valor = validarValorAlteracaoAditivo(a.origem, a.valorEstruturado);
    if (a.novo !== representarValorAlteracaoAditivo(valor)) throw new ErroRegra("Texto da alteração diverge do valor estruturado.");
    alteradas[a.origem] = valor;
  }
  const existente = await tx.versaoCondicoesAditivo.findUnique({ where: { propostaId: d.propostaId } });
  const anterior = existente ? (existente.anteriorId ? await tx.versaoCondicoesAditivo.findUnique({ where: { id: existente.anteriorId } }) : null) : await tx.versaoCondicoesAditivo.findFirst({ where: { matriculaId: d.matriculaId }, orderBy: { versao: "desc" } });
  if (anterior && hashSubstituicao(anterior.condicoes) !== anterior.condicoesHash) throw new ErroRegra("A versão anterior das condições diverge de sua integridade.");
  const condicoes = json({ ...((anterior?.condicoes as object) ?? {}), ...alteradas }), condicoesHash = hashSubstituicao(condicoes);
  if (existente) {
    if (existente.conferenciaFinalId !== final.id || existente.autorId !== autorId || existente.condicoesHash !== condicoesHash) throw new ErroRegra("A proposta já formalizou outras condições.");
    return { id: existente.id, versao: existente.versao };
  }
  if (anterior && estado.dados.vigenciaInicio <= anterior.vigenciaInicio.toISOString()) throw new ErroRegra("A vigência precisa ser posterior à versão formalizada anterior.");
  const agenda = entrada.alteracoes.find(a => a.origem === "AGENDA_PARTICULAR")?.valorEstruturado;
  const propostaAgendaId = agenda?.tipo === "AGENDA" ? agenda.propostaAgendaId : undefined;
  const versao = await tx.versaoCondicoesAditivo.create({ data: { matriculaId: d.matriculaId, propostaId: d.propostaId, propostaAgendaId, conferenciaFinalId: final.id, autorId, versao: (anterior?.versao ?? 0) + 1, anteriorId: anterior?.id, condicoes, condicoesHash, vigenciaInicio: new Date(estado.dados.vigenciaInicio) } });
  await registrarEvento(tx, { tipo: "CondicoesAditivoFormalizadas", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId, payload: { propostaId: d.propostaId, versao: versao.versao, condicoesHash } });
  return { id: versao.id, versao: versao.versao };
}

export async function aplicarCondicoesFormalizadasAditivoTx(tx: Prisma.TransactionClient, autorId: string, input: unknown) {
  const d = EntradaAplicacao.parse(input);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id=${d.matriculaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${autorId} FOR SHARE`;
  await conferirAutor(tx, autorId);
  const versao = await tx.versaoCondicoesAditivo.findUnique({ where: { propostaId: d.propostaId }, include: { proposta: true, conferenciaFinal: { select: { conclusaoId: true } } } });
  if (!versao || versao.matriculaId !== d.matriculaId || hashSubstituicao(versao.condicoes) !== versao.condicoesHash) throw new ErroRegra("A versão formalizada não corresponde à matrícula.");
  const igual = (a: { matriculaId: string; propostaId: string; autorId: string; revisaoHash: string; condicoesHash: string; vigenciaInicio: Date; chaveIdempotencia: string }) => a.matriculaId === d.matriculaId && a.propostaId === d.propostaId && a.autorId === autorId && a.revisaoHash === d.revisaoHash && a.condicoesHash === versao.condicoesHash && a.vigenciaInicio.getTime() === versao.vigenciaInicio.getTime() && a.chaveIdempotencia === d.chaveIdempotencia && d.conclusaoId === versao.conferenciaFinal.conclusaoId;
  const existente = await tx.aplicacaoCondicoesAditivo.findUnique({ where: { versaoCondicoesId: versao.id } });
  if (existente) { if (!igual(existente)) throw new ErroRegra("A versão já recebeu outra aplicação."); return { id: existente.id, versao: versao.versao, aplicadaEm: existente.aplicadaEm }; }
  const { estado, final } = await bloquearERevalidar(tx, autorId, d);
  if (versao.conferenciaFinalId !== final.id || versao.vigenciaInicio.getTime() !== new Date(estado.dados.vigenciaInicio).getTime()) throw new ErroRegra("A versão formalizada não corresponde à conferência atual.");
  exigirConsumidorAplicavel(versao.condicoes);
  await exigirMoedaERegimeAplicaveis(tx, d.matriculaId, versao.condicoes);
  const pelaChave = await tx.aplicacaoCondicoesAditivo.findUnique({ where: { autorId_chaveIdempotencia: { autorId, chaveIdempotencia: d.chaveIdempotencia } } });
  if (pelaChave) throw new ErroRegra("A chave idempotente já corresponde a outra aplicação.");
  const ultima = await tx.versaoCondicoesAditivo.findFirst({ where: { matriculaId: d.matriculaId }, orderBy: { versao: "desc" } });
  if (!ultima || ultima.id !== versao.id) throw new ErroRegra("Aplique a última cadeia formalizada de condições.");
  if (await tx.propostaAditivoContratual.count({ where: { matriculaId: d.matriculaId, versao: { gt: versao.proposta.versao } } })) throw new ErroRegra("A proposta foi superada e exige nova conferência.");
  const processo = await tx.processoAssinaturaAditivo.findUnique({ where: { id: estado.dados.processoId }, select: { propostaId: true, artefato: { select: { conferencia: { select: { propostaId: true, versao: true } } } } } });
  const participantes = processo?.artefato.conferencia;
  if (!processo || processo.propostaId !== d.propostaId || !participantes || participantes.propostaId !== d.propostaId || await tx.conferenciaParticipantesAditivo.count({ where: { propostaId: d.propostaId, versao: { gt: participantes.versao } } })) throw new ErroRegra("A conferência de participantes foi superada e exige nova conferência.");
  const aplicacao = await tx.aplicacaoCondicoesAditivo.create({ data: { versaoCondicoesId: versao.id, matriculaId: d.matriculaId, propostaId: d.propostaId, autorId, revisaoHash: d.revisaoHash, condicoesHash: versao.condicoesHash, vigenciaInicio: versao.vigenciaInicio, chaveIdempotencia: d.chaveIdempotencia } });
  const aplicacaoAgendaId = versao.propostaAgendaId ? randomUUID() : null;
  const eventoId = aplicacaoAgendaId ? randomUUID() : null;
  // O evento é criado antes da aplicação de agenda para que a própria aplicação
  // grave a referência canônica. O rollback comum remove ambos se a agenda falhar.
  const evento = eventoId && aplicacaoAgendaId
    ? await tx.evento.create({ data: { id: eventoId, tipo: "CondicoesAditivoAplicadas", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId, payload: { propostaId: d.propostaId, versao: versao.versao, aplicacaoId: aplicacao.id, condicoesHash: versao.condicoesHash, propostaAgendaId: versao.propostaAgendaId, aplicacaoAgendaId } } })
    : await registrarEvento(tx, { tipo: "CondicoesAditivoAplicadas", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId, payload: { propostaId: d.propostaId, versao: versao.versao, aplicacaoId: aplicacao.id, condicoesHash: versao.condicoesHash } });
  const agendaAplicada = aplicacaoAgendaId && eventoId ? await aplicarAgendaAditivoTx(tx, autorId, { matriculaId: d.matriculaId, propostaAditivoId: d.propostaId, aplicacaoCondicoesId: aplicacao.id, aplicacaoAgendaId, eventoId, chaveIdempotencia: `agenda-${hashSubstituicao({ propostaId: d.propostaId, chaveIdempotencia: d.chaveIdempotencia })}` }) : null;
  if (agendaAplicada && versao.propostaAgendaId) {
    const fotografia = await tx.propostaAgendaAditivoParticular.findUniqueOrThrow({ where: { id: versao.propostaAgendaId }, select: { fotografia: true } });
    const encontros = PrepararAditivoContratualSchema.parse((versao.proposta.snapshot as { entrada: unknown }).entrada).alteracoes.find(a => a.origem === "AGENDA_PARTICULAR")?.valorEstruturado;
    if (encontros?.tipo !== "AGENDA" || encontros.propostaAgendaId !== versao.propostaAgendaId) throw new ErroRegra("A aplicação não corresponde à fotografia de agenda.");
    const agenda = z.object({ encontros: z.array(z.object({ encontroId: z.string() })) }).parse(fotografia.fotografia);
    await criarAvisosAlteracaoAgendaTx(tx, { eventoId: evento.id, matriculaId: d.matriculaId, encontrosIds: agenda.encontros.map(e => e.encontroId) });
  }
  return { id: aplicacao.id, versao: versao.versao, aplicadaEm: aplicacao.aplicadaEm };
}
