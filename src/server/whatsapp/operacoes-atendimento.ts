"use server";

import { Papel, type FinalidadeAtendimentoWhatsApp } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { ErroRegra, executarAcao, exigirSessao, exigirSessaoComPapel, temPapel, registrarEvento, type Resultado } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { garantirContato } from "./identidade";
import { atendimentoVisivel, garantirAtendimento } from "./atendimentos";
import { escopoTurmasDocente } from "@/server/diario/permissoes";
import { snapshotCobranca } from "./elegibilidade";
import { INCLUDE_MATRICULA_DESTINO, resolverDestinoFinanceiroDaMatricula } from "./destinatario-financeiro";

export interface OpcaoAtendimento {
  chave: string; nome: string; finalidade: FinalidadeAtendimentoWhatsApp;
  alunoId?: string; leadId?: string; turmaId?: string; matriculaId?: string;
}
export interface OpcoesAtendimento { destinos: OpcaoAtendimento[]; numeros: { id: string; nome: string }[] }

export async function listarOpcoesAtendimento(): Promise<OpcoesAtendimento> {
  const u = await exigirSessao();
  const destinos: OpcaoAtendimento[] = [];
  const comercial = temPapel(u, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
  const academico = temPapel(u, Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO, Papel.SECRETARIA_ACADEMICA);
  if (comercial || academico) {
    const leads = await prisma.lead.findMany({ where: { OR: [
      ...(comercial ? [await escopoComercialAtual(u)] : []),
      ...(academico ? [{ professorExperimentalId: u.id, etapa: "EXPERIMENTAL_AGENDADA" as const }] : []),
    ] }, take: 200, select: { id: true, nome: true, professorExperimentalId: true, etapa: true } });
    for (const l of leads) {
      if (comercial && await prisma.lead.count({ where: { AND: [{ id: l.id }, await escopoComercialAtual(u)] } })) destinos.push({ chave: `COMERCIAL:${l.id}`, nome: `Comercial · ${l.nome}`, finalidade: "COMERCIAL", leadId: l.id });
      if (academico && l.professorExperimentalId === u.id && l.etapa === "EXPERIMENTAL_AGENDADA") destinos.push({ chave: `PEDAGOGICO:${l.id}`, nome: `Experimental · ${l.nome}`, finalidade: "PEDAGOGICO", leadId: l.id });
    }
  }
  const amplo = temPapel(u, Papel.GERENTE_PEDAGOGICO, Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO);
  if (amplo || u.papeis.includes(Papel.PROFESSOR)) {
    const turmasDocente = u.papeis.includes(Papel.PROFESSOR) ? new Set((await prisma.turma.findMany({ where: escopoTurmasDocente(u.id), select: { id: true } })).map((t) => t.id)) : new Set<string>();
    const alunos = await prisma.aluno.findMany({ where: amplo ? {} : { alocacoes: { some: { ativa: true, turmaId: { in: [...turmasDocente] } } } }, take: 200,
      select: { id: true, primeiroNome: true, sobrenome: true, alocacoes: { where: { ativa: true, ...(amplo ? {} : { turmaId: { in: [...turmasDocente] } }) }, select: { turmaId: true } } } });
    for (const a of alunos) {
      if (academico) for (const turma of a.alocacoes) {
        if (!temPapel(u, Papel.GERENTE_PEDAGOGICO, Papel.SECRETARIA_ACADEMICA) && !turmasDocente.has(turma.turmaId)) continue;
        destinos.push({ chave: `PEDAGOGICO:${a.id}:${turma.turmaId}`, nome: `Pedagógico · ${nomeCompleto(a)}`, finalidade: "PEDAGOGICO", alunoId: a.id, turmaId: turma.turmaId });
      }
      if (temPapel(u, Papel.SECRETARIA_ACADEMICA)) destinos.push({ chave: `SECRETARIA:${a.id}`, nome: `Secretaria · ${nomeCompleto(a)}`, finalidade: "SECRETARIA", alunoId: a.id });
    }
  }
  // Cobrança sempre abre no contrato escolhido, nunca no primeiro contrato do
  // aluno. Isso mantém conversas de responsáveis com mais de uma matrícula
  // separadas e dá à revalidação posterior uma referência inequívoca.
  if (temPapel(u, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA)) {
    const matriculas = await prisma.matricula.findMany({ take: 200, orderBy: { criadoEm: "desc" }, include: INCLUDE_MATRICULA_DESTINO });
    for (const matricula of matriculas) {
      const financeiro = resolverDestinoFinanceiroDaMatricula(matricula);
      destinos.push({
      chave: `FINANCEIRO:${matricula.id}`,
      nome: `Financeiro · ${financeiro?.nome ?? nomeCompleto(matricula.aluno)} · contrato ${matricula.codigo ?? matricula.id}${financeiro ? "" : " · destinatário pendente de conferência"}`,
      finalidade: "FINANCEIRO", alunoId: matricula.alunoId, matriculaId: matricula.id,
      });
    }
  }
  if (!destinos.length) return { destinos: [], numeros: [] };
  const numeros = await prisma.numeroWhatsApp.findMany({ where: { ativo: true }, select: { id: true, rotulo: true }, orderBy: { criadoEm: "asc" } });
  const soPedagogico = destinos.every((d) => d.finalidade === "PEDAGOGICO");
  return { destinos, numeros: numeros.map((n, i) => ({ id: n.id, nome: soPedagogico ? `Canal institucional ${i + 1}` : n.rotulo })) };
}

const AbrirSchema = z.object({ numeroId: z.string().min(1), destinoChave: z.string().min(1) });

/** O cliente escolhe um identificador interno. Telefones são resolvidos somente no servidor. */
export async function abrirAtendimentoInstitucional(input: z.input<typeof AbrirSchema>): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    const dados = AbrirSchema.parse(input);
    const opcoes = await listarOpcoesAtendimento();
    const destino = opcoes.destinos.find((d) => d.chave === dados.destinoChave);
    if (!destino || !opcoes.numeros.some((n) => n.id === dados.numeroId)) throw new ErroRegra("Destinatário ou canal fora do seu escopo atual.");
    let telefone: string | null = null;
    let nome = "Contato institucional";
    let responsavelId: string | null = null;
    let matriculaId: string | null = null;
    let contatoAlunoId: string | null | undefined = destino.alunoId;
    let alunoAtendimentoId: string | null | undefined = destino.alunoId;
    if (destino.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: destino.leadId } });
      telefone = lead?.telefoneE164 ?? null; nome = lead?.nome ?? nome;
    } else if (destino.alunoId) {
      if (destino.finalidade === "FINANCEIRO") {
        if (!destino.matriculaId) throw new ErroRegra("Selecione uma matrícula para o atendimento financeiro.");
        const matricula = await prisma.matricula.findUnique({ where: { id: destino.matriculaId }, include: INCLUDE_MATRICULA_DESTINO });
        const financeiro = matricula && resolverDestinoFinanceiroDaMatricula(matricula);
        if (!financeiro || matricula.alunoId !== destino.alunoId) throw new ErroRegra("A matrícula selecionada não possui destinatário válido para cobrança. Confira o pagador e o telefone deste contrato.");
        matriculaId = financeiro.matriculaId;
        alunoAtendimentoId = financeiro.alunoId;
        contatoAlunoId = financeiro.contatoAlunoId;
        telefone = financeiro.telefoneE164;
        nome = financeiro.nome;
        responsavelId = financeiro.responsavelId;
      } else {
        const a = await prisma.aluno.findUnique({ where: { id: destino.alunoId }, include: { responsaveis: { include: { responsavel: true } } } });
        if (!a) throw new ErroRegra("Aluno não encontrado.");
        const papeis = ["PEDAGOGICO"];
        const vinculos = a.responsaveis.filter((r) => papeis.includes(r.papel));
        const resp = vinculos.find((r) => r.responsavel.telefoneE164);
        telefone = vinculos.length ? resp?.responsavel.telefoneE164 ?? null : a.telefoneE164;
        nome = resp?.responsavel.nome ?? nomeCompleto(a); responsavelId = resp?.responsavelId ?? null;
      }
    }
    if (!telefone) throw new ErroRegra("A secretaria precisa cadastrar um destinatário válido para essa finalidade.");
    const atendimento = await prisma.$transaction(async (tx) => {
      const contato = await garantirContato(tx, { telefoneE164: telefone!, nomeExibicao: nome, responsavelId,
        leadId: destino.leadId, alunoId: destino.finalidade === "FINANCEIRO" ? contatoAlunoId : responsavelId ? null : destino.alunoId });
      const a = await garantirAtendimento(tx, { numeroId: dados.numeroId, contatoId: contato.id, finalidade: destino.finalidade,
        leadId: destino.leadId, alunoId: alunoAtendimentoId, turmaId: destino.turmaId, matriculaId, responsavelId: u.id });
      if (a.encerradoEm) throw new ErroRegra("Atendimento encerrado; solicite revisão à gestão antes de reabri-lo.");
      await registrarEvento(tx, { tipo: "AtendimentoInstitucionalAberto", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id,
        autorId: u.id, payload: { finalidade: a.finalidade, leadId: a.leadId, alunoId: a.alunoId, turmaId: a.turmaId, matriculaId: a.matriculaId } });
      return a;
    });
    revalidatePath("/inbox");
    return { id: atendimento.id };
  });
}

export interface ItemTriagem {
  id: string; conversaId: string; nome: string; corpo: string | null; tipo: string; criadoEm: string;
  midiaPath: string | null;
  atendimentos: { id: string; nome: string }[];
}

/** Legado e inbound ambíguo são lidos exclusivamente na triagem administrativa. */
export async function listarTriagemWhatsApp(): Promise<ItemTriagem[]> {
  await exigirSessaoComPapel(Papel.ADMINISTRADOR);
  const mensagens = await prisma.mensagemWhatsApp.findMany({ where: { atendimentoId: null }, take: 100, orderBy: { criadoEm: "desc" },
    include: { conversa: { include: { contato: true, atendimentos: { include: {
      aluno: true, lead: true, matricula: { select: { id: true, codigo: true } },
    } } } } } });
  return mensagens.map((m) => ({ id: m.id, conversaId: m.conversaId, nome: m.conversa.contato.nomeExibicao ?? m.conversa.contato.telefoneE164,
    corpo: m.corpo, tipo: m.tipo, midiaPath: m.midiaPath, criadoEm: m.criadoEm.toISOString(), atendimentos: m.conversa.atendimentos
      // Um contexto financeiro legado/encerrado é histórico consultável, mas
      // não é destino de uma nova classificação manual.
      .filter((a) => a.finalidade !== "FINANCEIRO" || (!!a.matriculaId && !a.encerradoEm))
      .map((a) => ({
        id: a.id,
        nome: a.finalidade === "FINANCEIRO"
          ? `FINANCEIRO · ${a.aluno ? nomeCompleto(a.aluno) : "sem aluno"} · contrato ${a.matricula?.codigo ?? a.matricula?.id}`
          : `${a.finalidade} · ${a.aluno ? nomeCompleto(a.aluno) : a.lead?.nome ?? "sem vínculo"}`,
      })) }));
}

export async function classificarMensagemWhatsApp(input: { mensagemId: string; atendimentoId: string; motivo: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = z.object({ mensagemId: z.string().min(1), atendimentoId: z.string().min(1), motivo: z.string().trim().min(12).max(1000) }).parse(input);
    await prisma.$transaction(async (tx) => {
      const [m, a] = await Promise.all([
        tx.mensagemWhatsApp.findUnique({ where: { id: dados.mensagemId } }),
        tx.atendimentoWhatsApp.findUnique({ where: { id: dados.atendimentoId } }),
      ]);
      if (!m || !a || m.conversaId !== a.conversaId || m.atendimentoId) throw new ErroRegra("Mensagem ausente, já classificada ou de outro contato/canal.");
      if (a.finalidade === "FINANCEIRO" && (!a.matriculaId || a.encerradoEm)) {
        throw new ErroRegra("Atendimento financeiro sem matrícula atual ou encerrado não recebe nova classificação.");
      }
      const r = await tx.mensagemWhatsApp.updateMany({ where: { id: m.id, atendimentoId: null }, data: { atendimentoId: a.id } });
      if (r.count !== 1) throw new ErroRegra("Mensagem já classificada por outra pessoa.");
      await tx.atendimentoWhatsApp.update({ where: { id: a.id }, data: {
        ...(m.direcao === "ENTRADA" ? { naoLidas: { increment: 1 } } : {}),
        ...(m.direcao === "ENTRADA" && (!a.ultimoInboundEm || a.ultimoInboundEm < m.criadoEm) ? { ultimoInboundEm: m.criadoEm } : {}),
        ...(!a.ultimaMensagemEm || a.ultimaMensagemEm < m.criadoEm ? { ultimaMensagemEm: m.criadoEm } : {}),
      } });
      await registrarEvento(tx, { tipo: "MensagemClassificada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: u.id,
        payload: { mensagemId: m.id, finalidade: a.finalidade, motivo: dados.motivo } });
    });
    revalidatePath("/inbox");
  });
}

export interface RevisaoEnvio {
  id: string; corpo: string; motivo: string | null; criadoEm: string; contato: string;
}

export async function listarRevisoesEnvio(): Promise<RevisaoEnvio[]> {
  await exigirSessaoComPapel(Papel.ADMINISTRADOR);
  const itens = await prisma.intencaoMensagem.findMany({ where: { status: "FALHOU" }, take: 100, orderBy: { atualizadoEm: "desc" }, include: { contato: true } });
  return itens.map((i) => ({ id: i.id, corpo: i.corpoRenderizado, motivo: i.motivoFalha,
    criadoEm: i.criadaEm.toISOString(), contato: i.contato.nomeExibicao ?? i.contato.telefoneE164 }));
}

/** Só uma revisão explícita pode liberar um envio cujo resultado foi incerto. */
export async function revisarFalhaEnvio(input: { id: string; decisao: "CANCELAR" | "REENVIAR_APOS_VERIFICACAO"; evidencia: string }): Promise<Resultado<{ mensagem: string }>> {
  return executarAcao(async () => {
    const u = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = z.object({ id: z.string().min(1), decisao: z.enum(["CANCELAR", "REENVIAR_APOS_VERIFICACAO"]), evidencia: z.string().trim().min(12).max(1000) }).parse(input);
    let mensagem = "Envio cancelado após revisão; não será repetido automaticamente.";
    await prisma.$transaction(async (tx) => {
      const i = await tx.intencaoMensagem.findUnique({ where: { id: dados.id } });
      if (!i || i.status !== "FALHOU") throw new ErroRegra("Envio já revisado ou fora do estado de falha.");
      let novoStatus: "PENDENTE" | "CANCELADA" = "CANCELADA";
      let motivo = "revisado_sem_reenvio";
      if (dados.decisao === "REENVIAR_APOS_VERIFICACAO") {
        if (!i.atendimentoId || !await atendimentoVisivel(u, i.atendimentoId, true)) throw new ErroRegra("Classifique o atendimento e confira o canal antes de solicitar novo envio.");
        const snapshot = i.cobrancaId ? await snapshotCobranca(i.cobrancaId, tx) : null;
        if (i.cobrancaId && (!snapshot || snapshot.assinatura !== i.referenciaCobranca)) {
          motivo = "cobranca_alterada_revisar";
          mensagem = "A cobrança mudou. Revise o valor atual na fila financeira e enfileire uma nova mensagem; o texto anterior foi cancelado.";
        } else {
          novoStatus = "PENDENTE"; motivo = "revisao_manual";
          mensagem = "Nova tentativa autorizada após verificação do provedor. O despacho revalidará as condições atuais.";
        }
      }
      const r = await tx.intencaoMensagem.updateMany({ where: { id: i.id, status: "FALHOU" }, data: {
        status: novoStatus, motivoFalha: motivo, despacharAposEm: null,
        ...(novoStatus === "PENDENTE" ? { origem: "HUMANO", autorId: u.id, criadaEm: new Date() } : {}),
      } });
      if (r.count !== 1) throw new ErroRegra("Envio revisado por outra operação.");
      await registrarEvento(tx, { tipo: "FalhaWhatsAppRevisada", agregadoTipo: "AtendimentoWhatsApp", agregadoId: i.atendimentoId ?? i.id,
        autorId: u.id, payload: { intencaoId: i.id, autorOriginalId: i.autorId, motivoOriginal: i.motivoFalha, decisao: dados.decisao, evidencia: dados.evidencia, resultado: novoStatus } });
    });
    revalidatePath("/inbox");
    return { mensagem };
  });
}

export async function encerrarAtendimentoWhatsApp(atendimentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    if (!temPapel(u, Papel.GERENTE_COMERCIAL, Papel.GERENTE_PEDAGOGICO, Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO)) throw new ErroRegra("Encerramento exige gestão do atendimento.");
    const a = await atendimentoVisivel(u, atendimentoId, true);
    if (!a) throw new ErroRegra("Atendimento fora do seu escopo.");
    const papeisDaFinalidade = a.finalidade === "COMERCIAL" ? [Papel.GERENTE_COMERCIAL]
      : a.finalidade === "FINANCEIRO" ? [Papel.FINANCEIRO]
        : a.finalidade === "SECRETARIA" ? [Papel.SECRETARIA_ACADEMICA]
          : [Papel.GERENTE_PEDAGOGICO, Papel.SECRETARIA_ACADEMICA];
    if (!temPapel(u, ...papeisDaFinalidade)) throw new ErroRegra("Sua função não autoriza encerrar atendimentos desta finalidade.");
    await prisma.$transaction(async (tx) => {
      await tx.atendimentoWhatsApp.update({ where: { id: a.id }, data: { encerradoEm: new Date() } });
      await tx.intencaoMensagem.updateMany({ where: { atendimentoId: a.id, status: { in: ["PENDENTE", "ADIADA"] } }, data: { status: "CANCELADA", motivoFalha: "atendimento_encerrado" } });
      await registrarEvento(tx, { tipo: "AtendimentoEncerrado", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: u.id, payload: {} });
    });
    revalidatePath("/inbox");
  });
}
