"use server";

import { revalidatePath } from "next/cache";
import { CategoriaDocumento, EtapaLead, Papel, Temperatura, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ErroPermissao, ErroRegra, apenasPortal, exigirSessao, type UsuarioSessao } from "@/server/_shared/sessao";
import { exigirInstanteDoCampoLocal } from "@/server/_shared/campo-local";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { DataCivilSchema } from "@/server/matricula/cobertura";
import { AgendarExperimentalSchema, ResumoSchema, type ResumoInput } from "@/server/comercial/schema";
import { prepararMudancaPrevisao, type PrevisaoOportunidadeInput, type ValoresPrevisao } from "@/server/comercial/previsao-schema";
import { EVENTO_EXPERIMENTAL_ATRIBUIDA } from "@/server/comercial/experimental";
import { destinoDoArraste } from "@/server/crm/etapas";
import { concluirTarefa, criarTarefa, reabrirTarefa } from "@/server/crm/tarefas";
import { capacidadesCrm } from "@/server/crm/permissoes";
import { exigirArquivoVinculavel } from "@/server/uploads/autorizacao";
import { avisarAtendimento } from "./aviso";
import { avisarAtendimentoAtualizado } from "./barramento";
import { comOportunidadeDoInboxTx } from "./contexto-oportunidade";
import { papelEditaPrevisao } from "./previsao-capacidade";
import { leadOcupadoParaPrevisao } from "./previsao-oportunidade";

const Id = z.string().min(1);
const DocumentoPropostaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do arquivo.").max(255, "Nome longo demais."),
  url: z.string().trim().min(1, "Faça o upload do arquivo antes de salvar."),
}).strict();
const PrevisaoDiretaSchema = z.object({
  esperado: z.object({
    probabilidadePct: z.number().int().min(0).max(100).nullable(),
    previsaoFechamento: DataCivilSchema.nullable(),
  }).strict(),
  alteracoes: z.unknown(),
}).strict();

function encerrada(etapa: EtapaLead): boolean {
  return etapa === EtapaLead.MATRICULADO || etapa === EtapaLead.PERDIDO;
}

async function mutarOportunidadeDoInbox(
  atendimentoId: string,
  oportunidadeIdEsperada: string,
  aplicar: (tx: Prisma.TransactionClient, autor: UsuarioSessao, leadId: string) => Promise<boolean>,
): Promise<void> {
  const sessao = await exigirSessao();
  const id = Id.parse(atendimentoId);
  const esperada = Id.parse(oportunidadeIdEsperada);
  await prisma.$transaction((tx) => comOportunidadeDoInboxTx(tx, sessao, id, esperada, async (autor, leadId) => {
    const mudou = await aplicar(tx, autor, leadId);
    if (mudou) await avisarAtendimento(tx, id);
  }));
  revalidatePath("/funil");
}

export async function definirTemperaturaNoInbox(atendimentoId: string, oportunidadeIdEsperada: string, temperatura: Temperatura): Promise<Resultado> {
  return executarAcao(() => mutarOportunidadeDoInbox(atendimentoId, oportunidadeIdEsperada, async (tx, autor, leadId) => {
    if (!Object.values(Temperatura).includes(temperatura)) throw new ErroRegra("Temperatura inválida.");
    const lead = await tx.oportunidade.findUniqueOrThrow({ where: { id: leadId }, select: { temperatura: true, etapa: true } });
    if (encerrada(lead.etapa)) throw new ErroRegra("Oportunidade encerrada não pode ser alterada.");
    if (lead.temperatura === temperatura) return false;
    await tx.oportunidade.update({ where: { id: leadId }, data: { temperatura } });
    await registrarEvento(tx, {
      tipo: "LeadEditado",
      agregadoTipo: "Lead",
      agregadoId: leadId,
      autorId: autor.id,
      payload: { de: lead.temperatura, temperatura, campo: "temperatura" },
    });
    return true;
  }));
}

export async function atualizarResumoNoInbox(atendimentoId: string, oportunidadeIdEsperada: string, input: ResumoInput): Promise<Resultado> {
  return executarAcao(async () => {
    const dados = ResumoSchema.parse(input);
    const campos = {
      interesse: dados.interesse || null,
      objetivo: dados.objetivo || null,
      urgencia: dados.urgencia || null,
      orcamento: dados.orcamento || null,
      objecao: dados.objecao || null,
      proximaAcao: dados.proximaAcao || null,
    };
    await mutarOportunidadeDoInbox(atendimentoId, oportunidadeIdEsperada, async (tx, autor, leadId) => {
      const lead = await tx.oportunidade.findUniqueOrThrow({ where: { id: leadId }, select: { etapa: true } });
      if (encerrada(lead.etapa)) throw new ErroRegra("Oportunidade encerrada não pode ser alterada.");
      await tx.oportunidade.update({ where: { id: leadId }, data: campos });
      await registrarEvento(tx, {
        tipo: "ResumoAtualizado",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: campos,
      });
      return true;
    });
  });
}

export async function enviarPropostaNoInbox(atendimentoId: string, oportunidadeIdEsperada: string): Promise<Resultado> {
  return executarAcao(() => mutarOportunidadeDoInbox(atendimentoId, oportunidadeIdEsperada, async (tx, autor, leadId) => {
    const lead = await tx.oportunidade.findUniqueOrThrow({ where: { id: leadId }, select: { etapa: true } });
    const destino = destinoDoArraste(lead.etapa, EtapaLead.PROPOSTA);
    if (destino.tipo === "nenhum") return false;
    if (destino.tipo === "recusar") throw new ErroRegra(destino.motivo);
    if (destino.tipo !== "acao" || destino.acao !== "enviarProposta") throw new ErroRegra("Use “Enviar proposta”.");
    const agora = new Date();
    await tx.oportunidade.update({ where: { id: leadId }, data: { etapa: EtapaLead.PROPOSTA, dataProposta: agora } });
    await registrarEvento(tx, {
      tipo: "PropostaEnviada",
      agregadoTipo: "Lead",
      agregadoId: leadId,
      autorId: autor.id,
      payload: { data: agora.toISOString() },
    });
    return true;
  }));
}

export async function anexarDocumentoPropostaNoInbox(
  atendimentoId: string,
  oportunidadeIdEsperada: string,
  doc: { nome: string; url: string },
): Promise<Resultado> {
  return executarAcao(async () => {
    const dados = DocumentoPropostaSchema.parse(doc);
    await mutarOportunidadeDoInbox(atendimentoId, oportunidadeIdEsperada, async (tx, autor, leadId) => {
      await exigirArquivoVinculavel(autor, dados.url, { leadId, categoriaDocumento: CategoriaDocumento.PROPOSTA }, tx);
      const jaAnexado = await tx.documento.findFirst({ where: { leadId, url: dados.url, arquivado: false }, select: { categoria: true, nome: true } });
      if (jaAnexado) {
        if (jaAnexado.categoria === CategoriaDocumento.PROPOSTA && jaAnexado.nome === dados.nome) return false;
        throw new ErroRegra("Este arquivo já está anexado a esta oportunidade com outro nome. Recarregue a página e confira os documentos.");
      }
      await tx.documento.create({ data: { leadId, categoria: CategoriaDocumento.PROPOSTA, nome: dados.nome, url: dados.url } });
      await registrarEvento(tx, {
        tipo: "DocumentoAnexado",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { categoria: CategoriaDocumento.PROPOSTA, nome: dados.nome },
      });
      return true;
    });
  });
}

export async function agendarExperimentalNoInbox(
  atendimentoId: string,
  oportunidadeIdEsperada: string,
  input: { dataISO?: string; dataLocal?: string; fuso?: string; professorId?: string | null },
): Promise<Resultado> {
  return executarAcao(async () => {
    const dados = AgendarExperimentalSchema.parse(input);
    const data = dados.dataLocal ? exigirInstanteDoCampoLocal(dados.dataLocal, dados.fuso) : new Date(dados.dataISO ?? "");
    if (Number.isNaN(data.getTime())) throw new ErroRegra("Data inválida.");
    const professorId = dados.professorId ?? null;
    await mutarOportunidadeDoInbox(atendimentoId, oportunidadeIdEsperada, async (tx, autor, leadId) => {
      const lead = await tx.oportunidade.findUniqueOrThrow({ where: { id: leadId }, select: { etapa: true, professorExperimentalId: true } });
      const destino = destinoDoArraste(lead.etapa, EtapaLead.EXPERIMENTAL_AGENDADA);
      const remarcando = lead.etapa === EtapaLead.EXPERIMENTAL_AGENDADA;
      if (!remarcando) {
        if (destino.tipo === "recusar") throw new ErroRegra(destino.motivo);
        if (destino.tipo !== "acao" || destino.acao !== "agendarExperimental") throw new ErroRegra("Use “Agendar experimental”.");
      }
      if (professorId) {
        const professor = await tx.usuario.findUnique({ where: { id: professorId }, select: { ativo: true, papeis: true } });
        if (!professor?.ativo) throw new ErroRegra("Professor não encontrado.");
        if (!professor.papeis.includes(Papel.PROFESSOR)) throw new ErroRegra("Usuário informado não é professor.");
      }
      await tx.oportunidade.update({
        where: { id: leadId },
        data: {
          etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
          dataExperimental: data,
          professorExperimentalId: professorId,
          experimentalConfirmadaEm: null,
          aguardandoReagendamentoEm: null,
        },
      });
      await registrarEvento(tx, {
        tipo: "ExperimentalAgendada",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { data: data.toISOString() },
      });
      if (professorId !== lead.professorExperimentalId) {
        await registrarEvento(tx, {
          tipo: EVENTO_EXPERIMENTAL_ATRIBUIDA,
          agregadoTipo: "Lead",
          agregadoId: leadId,
          autorId: autor.id,
          payload: { de: lead.professorExperimentalId, professorId },
        });
      }
      return true;
    });
  });
}

export async function confirmarExperimentalNoInbox(atendimentoId: string, oportunidadeIdEsperada: string): Promise<Resultado> {
  return executarAcao(() => mutarOportunidadeDoInbox(atendimentoId, oportunidadeIdEsperada, async (tx, autor, leadId) => {
    const lead = await tx.oportunidade.findUniqueOrThrow({
      where: { id: leadId },
      select: { etapa: true, dataExperimental: true, experimentalConfirmadaEm: true },
    });
    if (lead.etapa !== EtapaLead.EXPERIMENTAL_AGENDADA || !lead.dataExperimental) throw new ErroRegra("Não há experimental agendada para confirmar.");
    if (lead.experimentalConfirmadaEm) return false;
    const quando = new Date();
    await tx.oportunidade.update({ where: { id: leadId }, data: { experimentalConfirmadaEm: quando } });
    await registrarEvento(tx, {
      tipo: "LeadEditado",
      agregadoTipo: "Lead",
      agregadoId: leadId,
      autorId: autor.id,
      payload: { campo: "experimentalConfirmada", experimentalConfirmadaEm: quando.toISOString() },
    });
    return true;
  }));
}

export async function professoresParaExperimental(): Promise<Resultado<{ id: string; nome: string }[]>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    if (!capacidadesCrm(autor.papeis).has("funil.mover")) throw new ErroPermissao("Você não tem acesso a esta função do CRM.");
    return prisma.usuario.findMany({
      where: { ativo: true, papeis: { has: Papel.PROFESSOR } },
      orderBy: [{ nome: "asc" }, { id: "asc" }],
      select: { id: true, nome: true },
    });
  });
}

export async function definirPrevisaoOportunidade(
  oportunidadeId: string,
  entrada: { esperado: ValoresPrevisao; alteracoes: PrevisaoOportunidadeInput },
): Promise<Resultado> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    if (!papelEditaPrevisao(sessao)) throw new ErroPermissao("Você não tem acesso à edição desta oportunidade.");
    const id = Id.parse(oportunidadeId);
    const dados = PrevisaoDiretaSchema.parse(entrada);
    try {
      await prisma.$transaction(async (tx) => {
        const travado = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Lead" WHERE id = ${id} FOR UPDATE NOWAIT`;
        if (travado.length !== 1) throw new ErroRegra("Oportunidade não encontrada.");
        const fresco = await tx.usuario.findUnique({ where: { id: sessao.id }, select: { id: true, nome: true, papeis: true, permissoes: true, ativo: true } });
        if (!fresco?.ativo || apenasPortal(fresco)) throw new ErroPermissao("Sua sessão não permite editar esta oportunidade.");
        const autor = { ...sessao, nome: fresco.nome, papeis: fresco.papeis, permissoes: fresco.permissoes };
        if (!papelEditaPrevisao(autor)) throw new ErroPermissao("Você não tem acesso à edição desta oportunidade.");
        const op = await tx.oportunidade.findFirst({
          where: { AND: [{ id }, await escopoComercialAtual(autor, tx)] },
          select: { id: true, probabilidadePct: true, previsaoFechamento: true },
        });
        if (!op) throw new ErroPermissao("Você não tem acesso à edição desta oportunidade.");
        const mudanca = prepararMudancaPrevisao(op, dados.alteracoes);
        if (!mudanca.alterado) return;
        const probabilidadeDivergiu = mudanca.dados.probabilidadePct !== undefined && op.probabilidadePct !== dados.esperado.probabilidadePct;
        const previsaoDivergiu = mudanca.dados.previsaoFechamento !== undefined && op.previsaoFechamento !== dados.esperado.previsaoFechamento;
        if (probabilidadeDivergiu || previsaoDivergiu) throw new ErroRegra("A previsão mudou. Atualize o painel antes de salvar novamente.");
        await tx.oportunidade.update({ where: { id: op.id }, data: mudanca.dados });
        await registrarEvento(tx, {
          tipo: "LeadEditado",
          agregadoTipo: "Lead",
          agregadoId: op.id,
          autorId: autor.id,
          payload: { previsoes: mudanca.mudancas },
        });
        const abertos = await tx.atendimentoWhatsApp.findMany({
          where: { leadId: op.id, status: { not: "ENCERRADO" } },
          select: { id: true, conversaId: true },
        });
        for (const atendimento of abertos) await avisarAtendimentoAtualizado(tx, atendimento);
      });
    } catch (erro) {
      if (leadOcupadoParaPrevisao(erro)) throw new ErroRegra("A oportunidade está sendo atualizada. Atualize o painel e tente salvar novamente.");
      throw erro;
    }
    revalidatePath("/funil");
  });
}

export async function criarTarefaOportunidade(oportunidadeId: string, titulo: string): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const id = Id.parse(oportunidadeId);
    const nome = z.string().trim().min(1, "Informe o título da tarefa.").parse(titulo);
    const criada = await criarTarefa({ titulo: nome, tipo: "OUTRO", leadId: id });
    if (!criada.ok || !criada.dado) throw new ErroRegra(criada.ok ? "Não foi possível criar a tarefa." : criada.erro);
    revalidatePath("/funil");
    return criada.dado;
  });
}

export async function concluirTarefaOportunidade(tarefaId: string, versao: number): Promise<Resultado> {
  return executarAcao(async () => {
    const concluida = await concluirTarefa(Id.parse(tarefaId), z.number().int().parse(versao));
    if (!concluida.ok) throw new ErroRegra(concluida.erro);
    revalidatePath("/funil");
  });
}

export async function reabrirTarefaOportunidade(tarefaId: string, versao: number): Promise<Resultado> {
  return executarAcao(async () => {
    const reaberta = await reabrirTarefa(Id.parse(tarefaId), z.number().int().parse(versao));
    if (!reaberta.ok) throw new ErroRegra(reaberta.erro);
    revalidatePath("/funil");
  });
}
