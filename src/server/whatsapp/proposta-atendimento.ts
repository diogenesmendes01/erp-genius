import { CategoriaDocumento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroRegra, type UsuarioSessao } from "@/server/_shared";
import { podeLerArquivo } from "@/server/uploads/autorizacao";
import { atendimentoVisivel } from "./atendimentos";
import { podeVerLeadNaThread } from "./visibilidade-lead";

export interface PropostaAnexavel { id: string; nome: string; criadoEm: string }
export type PropostasDoAtendimento = { oportunidadeId: string | null; propostas: (PropostaAnexavel & { url: string })[] };

export const MAX_PROPOSTAS_LISTADAS = 10;
export const ERRO_ANEXAR_PROPOSTA = "Não foi possível anexar esta proposta. Abra a oportunidade e confira o arquivo.";
const PREFIXO_ARQUIVOS = "/api/files/";

export function segmentosDoArquivo(url: string): string[] | null {
  if (!url.startsWith(PREFIXO_ARQUIVOS)) return null;
  const segmentos = url.slice(PREFIXO_ARQUIVOS.length).split("/").filter(Boolean);
  return segmentos.length ? segmentos : null;
}

async function oportunidadeDaConversa(u: UsuarioSessao, atendimentoId: string): Promise<string | null> {
  const a = await atendimentoVisivel(u, atendimentoId);
  if (!a || a.finalidade !== "COMERCIAL") return null;
  const leadId = a.leadId ?? a.contato.leadId;
  if (!leadId) return null;
  return (await podeVerLeadNaThread(u, a.id, leadId, Date.now())) ? leadId : null;
}

async function legivel(u: UsuarioSessao, url: string): Promise<boolean> {
  const segmentos = segmentosDoArquivo(url);
  return !!segmentos && podeLerArquivo({ id: u.id, papeis: u.papeis }, segmentos);
}

export async function propostasVisiveis(u: UsuarioSessao, atendimentoId: string): Promise<PropostasDoAtendimento> {
  const oportunidadeId = await oportunidadeDaConversa(u, atendimentoId);
  if (!oportunidadeId) return { oportunidadeId: null, propostas: [] };
  const documentos = await prisma.documento.findMany({
    where: { leadId: oportunidadeId, categoria: CategoriaDocumento.PROPOSTA, arquivado: false },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    take: MAX_PROPOSTAS_LISTADAS,
    select: { id: true, nome: true, url: true, criadoEm: true },
  });
  const permitidos = await Promise.all(documentos.map((d) => legivel(u, d.url)));
  return {
    oportunidadeId,
    propostas: documentos.filter((_, i) => permitidos[i]).map((d) => ({ id: d.id, nome: d.nome, url: d.url, criadoEm: d.criadoEm.toISOString() })),
  };
}

export async function exigirPropostaVisivel(u: UsuarioSessao, atendimentoId: string, documentoId: string): Promise<{ url: string; nome: string }> {
  const oportunidadeId = await oportunidadeDaConversa(u, atendimentoId);
  const documento = oportunidadeId ? await prisma.documento.findFirst({
    where: { id: documentoId, leadId: oportunidadeId, categoria: CategoriaDocumento.PROPOSTA, arquivado: false },
    select: { url: true, nome: true },
  }) : null;
  if (!documento || !(await legivel(u, documento.url))) throw new ErroRegra("Proposta não encontrada.");
  return documento;
}
