"use server";

import { revalidatePath } from "next/cache";
import { Papel, EtapaLead, CategoriaDocumento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gerarCodigo } from "@/lib/codigo";
import {
  exigirSessao,
  exigirSessaoComPapel,
  exigirPapel,
  registrarEvento,
  executarAcao,
  ErroRegra,
  ErroPermissao,
  temPapel,
  ehEtapaManual,
  transicaoManualPermitida,
  resolverDonoLead,
  normalizarTelefoneE164,
  podeCheckinExperimental,
  professorNoEscopoExperimental,
  type Resultado,
  type UsuarioSessao,
} from "@/server/_shared";
import {
  EVENTO_EXPERIMENTAL_ATRIBUIDA,
  professorAtribuido,
} from "./experimental";

/** DDI do país do lead (para normalizar o telefone); "" se sem país. */
async function ddiDoPais(paisId?: string | null): Promise<string> {
  if (!paisId) return "";
  return (await prisma.pais.findUnique({ where: { id: paisId } }))?.ddi ?? "";
}
import {
  LeadSchema,
  ResumoSchema,
  DatasSchema,
  InteracaoSchema,
  PerdaSchema,
  AgendarExperimentalSchema,
  ETAPAS_MANUAIS,
  type LeadInput,
  type ResumoInput,
  type DatasInput,
  type InteracaoInput,
  type PerdaInput,
  type AgendarExperimentalInput,
} from "./schema";

/** Valida que `professorId` aponta para um usuário com papel PROFESSOR. */
async function exigirProfessorValido(professorId: string) {
  const professor = await prisma.usuario.findUnique({ where: { id: professorId } });
  if (!professor) throw new ErroRegra("Professor não encontrado.");
  if (!professor.papeis.includes(Papel.PROFESSOR)) {
    throw new ErroRegra("Usuário informado não é professor.");
  }
}

const PAPEIS_COMERCIAL: Papel[] = [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL];

function revalidarLead(id?: string) {
  revalidatePath("/leads");
  revalidatePath("/pipeline");
  if (id) revalidatePath(`/leads/${id}`);
}

/** Carrega o lead garantindo que o usuário pode vê-lo (vendedor só os próprios). */
async function exigirLeadVisivel(id: string, usuario: UsuarioSessao) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw new ErroRegra("Lead não encontrado.");
  const amplo = temPapel(usuario, Papel.GERENTE_COMERCIAL); // Admin passa em temPapel
  if (!amplo && lead.vendedorDonoId !== usuario.id) throw new ErroPermissao();
  return lead;
}

export async function criarLead(input: LeadInput): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    const dados = LeadSchema.parse(input);

    // Vendedor vira dono por padrão; só gerente/admin podem atribuir a outro vendedor.
    // O servidor ignora qualquer vendedorDonoId enviado por um vendedor (doc 09).
    const donoId = resolverDonoLead(autor, dados.vendedorDonoId);
    const ddi = await ddiDoPais(dados.paisId);

    const id = await prisma.$transaction(async (tx) => {
      const codigo = await gerarCodigo("lead");
      const lead = await tx.lead.create({
        data: {
          codigo,
          nome: dados.nome,
          telefoneE164: normalizarTelefoneE164(dados.telefoneE164, ddi),
          paisId: dados.paisId || null,
          segmento: dados.segmento,
          temperatura: dados.temperatura,
          b2b: dados.b2b,
          vendedorDonoId: donoId,
          origemCampanha: dados.origemCampanha || null,
          origemConjunto: dados.origemConjunto || null,
          origemAnuncio: dados.origemAnuncio || null,
          origemPalavra: dados.origemPalavra || null,
          valorPrevisto: dados.valorPrevisto ?? null,
          planoPrevisto: dados.planoPrevisto || null,
          comissaoPrevista: dados.comissaoPrevista ?? null,
        },
      });
      await registrarEvento(tx, {
        tipo: "LeadCriado",
        agregadoTipo: "Lead",
        agregadoId: lead.id,
        autorId: autor.id,
        payload: { codigo, nome: lead.nome, segmento: lead.segmento, b2b: lead.b2b },
      });
      if (donoId) {
        await registrarEvento(tx, {
          tipo: "LeadAtribuido",
          agregadoTipo: "Lead",
          agregadoId: lead.id,
          autorId: autor.id,
          payload: { de: null, para: donoId },
        });
      }
      return lead.id;
    });

    revalidarLead(id);
    return { id };
  });
}

export async function editarLead(id: string, input: LeadInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = LeadSchema.parse(input);
    const ddi = await ddiDoPais(dados.paisId);

    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: {
          nome: dados.nome,
          telefoneE164: normalizarTelefoneE164(dados.telefoneE164, ddi),
          paisId: dados.paisId || null,
          segmento: dados.segmento,
          temperatura: dados.temperatura,
          b2b: dados.b2b,
          origemCampanha: dados.origemCampanha || null,
          origemConjunto: dados.origemConjunto || null,
          origemAnuncio: dados.origemAnuncio || null,
          origemPalavra: dados.origemPalavra || null,
          valorPrevisto: dados.valorPrevisto ?? null,
          planoPrevisto: dados.planoPrevisto || null,
          comissaoPrevista: dados.comissaoPrevista ?? null,
        },
      });
      await registrarEvento(tx, {
        tipo: "LeadEditado",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { nome: dados.nome, temperatura: dados.temperatura },
      });
    });
    revalidarLead(id);
  });
}

export async function atualizarResumo(id: string, input: ResumoInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    const lead = await exigirLeadVisivel(id, autor);
    const dados = ResumoSchema.parse(input);
    // Evento na MESMA transação da mutação (issue #1: resumo alterava sem auditoria).
    // Tipo específico ResumoAtualizado com payload completo, consumido pela linha
    // do tempo da ficha do lead (issue #43).
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: {
          interesse: dados.interesse || null,
          objetivo: dados.objetivo || null,
          urgencia: dados.urgencia || null,
          orcamento: dados.orcamento || null,
          objecao: dados.objecao || null,
          proximaAcao: dados.proximaAcao || null,
        },
      });
      await registrarEvento(tx, {
        tipo: "ResumoAtualizado",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: {
          interesse: dados.interesse || null,
          objetivo: dados.objetivo || null,
          urgencia: dados.urgencia || null,
          orcamento: dados.orcamento || null,
          objecao: dados.objecao || null,
          proximaAcao: dados.proximaAcao || null,
        },
      });
    });
    revalidarLead(id);
  });
}

export async function atualizarDatas(id: string, input: DatasInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    const lead = await exigirLeadVisivel(id, autor);
    const dados = DatasSchema.parse(input);
    // Evento na MESMA transação da mutação (issue #1: datas alteravam sem auditoria).
    // Tipo específico DatasAtualizadas com payload completo, consumido pela linha
    // do tempo da ficha do lead (issue #43).
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: {
          proximoFollowUp: dados.proximoFollowUp ?? null,
          dataExperimental: dados.dataExperimental ?? null,
          dataProposta: dados.dataProposta ?? null,
        },
      });
      await registrarEvento(tx, {
        tipo: "DatasAtualizadas",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: {
          proximoFollowUp: dados.proximoFollowUp?.toISOString() ?? null,
          dataExperimental: dados.dataExperimental?.toISOString() ?? null,
          dataProposta: dados.dataProposta?.toISOString() ?? null,
        },
      });
    });
    revalidarLead(id);
  });
}

export async function moverEtapa(id: string, etapa: EtapaLead): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    const lead = await exigirLeadVisivel(id, autor);
    if (lead.etapa === etapa) return;

    // Etapas geradas por evento (Exp. Realizada, Proposta, Aguardando Matrícula…)
    // e saídas paralelas (Perdido/Matriculado) NÃO se movem por arraste.
    if (!ehEtapaManual(etapa)) {
      throw new ErroRegra(
        "Esta etapa é definida por uma ação específica (agendar/realizar experimental, " +
          "enviar proposta, marcar perdido ou converter em matrícula), não pelo arraste.",
      );
    }
    // Valida a máquina de estados origem→destino — bloqueia saltos inválidos no
    // backend mesmo que o client envie um destino fora da sequência (doc 10 §1).
    if (!transicaoManualPermitida(lead.etapa, etapa)) {
      throw new ErroRegra(
        `Transição inválida: não é possível mover de "${lead.etapa}" para "${etapa}".`,
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id }, data: { etapa } });
      await registrarEvento(tx, {
        tipo: "EtapaAlterada",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: lead.etapa, para: etapa, origem: "manual" },
      });
    });
    revalidarLead(id);
  });
}

export async function registrarInteracao(id: string, input: InteracaoInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = InteracaoSchema.parse(input);
    // Evento gravado em transação (issue #1): consistente com o restante do domínio.
    await prisma.$transaction(async (tx) => {
      await registrarEvento(tx, {
        tipo: "InteracaoRegistrada",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { canal: dados.canal || null, nota: dados.nota },
      });
    });
    revalidarLead(id);
  });
}

/** Agenda a experimental e (opcionalmente) grava o professor responsável na FK
 * `professorExperimentalId` — escopo que a Home do professor e o check-in usam
 * (Issue #13). O vínculo também é auditado no event log. */
export async function agendarExperimental(
  id: string,
  input: AgendarExperimentalInput,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = AgendarExperimentalSchema.parse(input);
    const data = new Date(dados.dataISO);
    if (isNaN(data.getTime())) throw new ErroRegra("Data inválida.");
    // Schema normaliza "" → null; `?? null` cobre o campo ausente. Sempre
    // persistimos a FK para que "Definir depois" limpe o responsável anterior.
    const professorId = dados.professorId ?? null;
    if (professorId) await exigirProfessorValido(professorId);

    // Estado atual da FK para auditar só quando o responsável mudar (incl. remoção).
    const anterior = await professorAtribuido(prisma, id);
    const mudouProfessor = professorId !== anterior;
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: {
          etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
          dataExperimental: data,
          professorExperimentalId: professorId,
        },
      });
      await registrarEvento(tx, {
        tipo: "ExperimentalAgendada",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { data: data.toISOString() },
      });
      // Auditoria do vínculo: mesmo evento para atribuição/remanejamento e
      // remoção (professorId null). Só registra quando houve mudança.
      if (mudouProfessor) {
        await registrarEvento(tx, {
          tipo: EVENTO_EXPERIMENTAL_ATRIBUIDA,
          agregadoTipo: "Lead",
          agregadoId: id,
          autorId: autor.id,
          payload: { de: anterior, professorId },
        });
      }
    });
    revalidarLead(id);
    revalidatePath("/home");
  });
}

export async function enviarProposta(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    await prisma.$transaction(async (tx) => {
      const agora = new Date();
      await tx.lead.update({
        where: { id },
        data: { etapa: EtapaLead.PROPOSTA, dataProposta: agora },
      });
      await registrarEvento(tx, {
        tipo: "PropostaEnviada",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { data: agora.toISOString() },
      });
    });
    revalidarLead(id);
  });
}

export async function marcarPerdido(id: string, input: PerdaInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const dados = PerdaSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: { etapa: EtapaLead.PERDIDO, motivoPerda: dados.motivoPerda },
      });
      await registrarEvento(tx, {
        tipo: "LeadPerdido",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { motivoPerda: dados.motivoPerda, observacao: dados.observacao || null },
      });
    });
    revalidarLead(id);
  });
}

export async function anexarDocumentoLead(
  leadId: string,
  doc: { categoria: CategoriaDocumento; nome: string; url: string },
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(leadId, autor);
    if (!doc.url) throw new ErroRegra("Faça o upload do arquivo antes de salvar.");
    await prisma.$transaction(async (tx) => {
      await tx.documento.create({
        data: { leadId, categoria: doc.categoria, nome: doc.nome, url: doc.url },
      });
      await registrarEvento(tx, {
        tipo: "DocumentoAnexado",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { categoria: doc.categoria, nome: doc.nome },
      });
    });
    revalidarLead(leadId);
  });
}

/** Arquiva o documento (soft-delete — doc 10 §6: ninguém apaga nada). */
export async function arquivarDocumentoLead(documentoId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    const doc = await prisma.documento.findUnique({ where: { id: documentoId } });
    if (!doc) throw new ErroRegra("Documento não encontrado.");
    await exigirLeadVisivel(doc.leadId, autor);
    await prisma.$transaction(async (tx) => {
      await tx.documento.update({ where: { id: documentoId }, data: { arquivado: true } });
      await registrarEvento(tx, {
        tipo: "DocumentoArquivado",
        agregadoTipo: "Lead",
        agregadoId: doc.leadId,
        autorId: autor.id,
        payload: { documentoId, nome: doc.nome },
      });
    });
    revalidarLead(doc.leadId);
  });
}

/** Check-in da experimental (professor): Compareceu → Experimental Realizada · Faltou → No-show.
 * Devolve o lead à fila do comercial (doc 09 §Visão do Professor).
 *
 * Escopo do professor (Issue #13): valida papel, etapa atual (precisa haver uma
 * experimental AGENDADA) e a associação professor↔experimental (FK
 * `professorExperimentalId`). Fora do escopo → ErroPermissao; etapa errada →
 * ErroRegra. */
export async function checkinExperimental(leadId: string, compareceu: boolean): Promise<Resultado> {
  return executarAcao(async () => {
    // 1) papel: só professor (Admin passa em exigirPapel)
    const autor = await exigirSessao();
    exigirPapel(autor, Papel.PROFESSOR);

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new ErroRegra("Lead não encontrado.");

    // 2) etapa/agendamento: só vale enquanto há uma experimental agendada
    if (!podeCheckinExperimental(lead.etapa)) {
      throw new ErroRegra("Não há experimental agendada para check-in neste lead.");
    }

    // 3) escopo: o professor precisa estar atribuído a esta experimental (FK).
    //    Admin (passa em temPapel mas não é professor literal) ignora o vínculo.
    const ehAdmin = autor.papeis.includes(Papel.ADMINISTRADOR);
    if (!ehAdmin) {
      if (!professorNoEscopoExperimental(lead.professorExperimentalId, autor.id)) {
        throw new ErroPermissao("Esta experimental não está atribuída a você.");
      }
    }

    const etapa = compareceu ? EtapaLead.EXPERIMENTAL_REALIZADA : EtapaLead.NO_SHOW;
    const proximaAcao = compareceu ? "Comercial: apresentar proposta" : "Remarcar experimental";

    await prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id: leadId }, data: { etapa, proximaAcao } });
      await registrarEvento(tx, {
        tipo: compareceu ? "ExperimentalRealizada" : "NoShow",
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { data: new Date().toISOString() },
      });
    });
    revalidatePath("/home");
    revalidatePath("/leads");
    revalidatePath("/pipeline");
  });
}

/** Atribui (ou remaneja) o professor responsável por uma experimental — define o
 * escopo que a Home do professor e o check-in usam (Issue #13). Comercial/Admin.
 * Grava a FK `professorExperimentalId` (fonte de verdade) e audita no event log. */
export async function atribuirProfessorExperimental(
  leadId: string,
  professorId: string,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(leadId, autor);
    await exigirProfessorValido(professorId);

    const anterior = await professorAtribuido(prisma, leadId);
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: leadId },
        data: { professorExperimentalId: professorId },
      });
      await registrarEvento(tx, {
        tipo: EVENTO_EXPERIMENTAL_ATRIBUIDA,
        agregadoTipo: "Lead",
        agregadoId: leadId,
        autorId: autor.id,
        payload: { de: anterior, professorId },
      });
    });
    revalidarLead(leadId);
    revalidatePath("/home");
  });
}

/** Redistribuir lead (Gerente Comercial/Admin) — dono = comissão, registra histórico. */
export async function atribuirDono(
  id: string,
  vendedorId: string,
  motivo?: string,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_COMERCIAL);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new ErroRegra("Lead não encontrado.");
    const novo = await prisma.usuario.findUnique({ where: { id: vendedorId } });
    if (!novo) throw new ErroRegra("Vendedor não encontrado.");
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id }, data: { vendedorDonoId: vendedorId } });
      await registrarEvento(tx, {
        tipo: "LeadAtribuido",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: lead.vendedorDonoId, para: vendedorId, motivo: motivo || null },
      });
    });
    revalidarLead(id);
  });
}
