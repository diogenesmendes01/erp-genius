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
  normalizarTelefoneE164,
  type Resultado,
  type UsuarioSessao,
} from "@/server/_shared";

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
  ETAPAS_MANUAIS,
  type LeadInput,
  type ResumoInput,
  type DatasInput,
  type InteracaoInput,
  type PerdaInput,
} from "./schema";

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

    // Vendedor vira dono por padrão; gerente/admin podem atribuir (mas NÃO viram dono sozinhos).
    // Checagem LITERAL de papel — temPapel() não serve aqui (Admin passa em tudo).
    const ehVendedor = autor.papeis.includes(Papel.VENDEDOR);
    const donoId = dados.vendedorDonoId || (ehVendedor ? autor.id : null);
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
    await exigirLeadVisivel(id, autor);
    const dados = ResumoSchema.parse(input);
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
    await exigirLeadVisivel(id, autor);
    const dados = DatasSchema.parse(input);
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
    if (!ETAPAS_MANUAIS.includes(etapa)) {
      throw new ErroRegra(
        "Use 'Marcar perdido' ou 'Converter em matrícula' para essas etapas.",
      );
    }
    if (lead.etapa === etapa) return;
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({ where: { id }, data: { etapa } });
      await registrarEvento(tx, {
        tipo: "EtapaAlterada",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { de: lead.etapa, para: etapa },
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
    await registrarEvento(prisma, {
      tipo: "InteracaoRegistrada",
      agregadoTipo: "Lead",
      agregadoId: id,
      autorId: autor.id,
      payload: { canal: dados.canal || null, nota: dados.nota },
    });
    revalidarLead(id);
  });
}

export async function agendarExperimental(id: string, dataISO: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_COMERCIAL);
    await exigirLeadVisivel(id, autor);
    const data = new Date(dataISO);
    if (isNaN(data.getTime())) throw new ErroRegra("Data inválida.");
    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: { etapa: EtapaLead.EXPERIMENTAL_AGENDADA, dataExperimental: data },
      });
      await registrarEvento(tx, {
        tipo: "ExperimentalAgendada",
        agregadoTipo: "Lead",
        agregadoId: id,
        autorId: autor.id,
        payload: { data: data.toISOString() },
      });
    });
    revalidarLead(id);
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
 * Devolve o lead à fila do comercial (doc 09 §Visão do Professor). */
export async function checkinExperimental(leadId: string, compareceu: boolean): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, Papel.PROFESSOR);
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new ErroRegra("Lead não encontrado.");

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
