import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroRegra, type UsuarioSessao } from "@/server/_shared";
import { contentTypePorExtensao } from "@/lib/uploads";
import { atendimentoVisivel } from "./atendimentos";
import { extensaoPorMime } from "./midia";

export interface MaterialCatalogo { id: string; nome: string }

export const MAX_MATERIAIS_CATALOGO = 20;
export const ERRO_MATERIAL_INDISPONIVEL = "Este material não está mais disponível no catálogo.";
export const ERRO_ANEXAR_MATERIAL = "Não foi possível anexar este material. Confira o arquivo no conhecimento da Aria.";
const PREFIXO_ARQUIVOS = "/api/files/";

type Banco = Prisma.TransactionClient | typeof prisma;

export function ondeMaterialAtivo(agora: Date): Prisma.FonteConhecimentoWhereInput {
  return {
    tipo: "ARQUIVO",
    status: "PRONTA",
    enviavelAoLead: true,
    arquivadaEm: null,
    registroUpload: { is: { url: { startsWith: PREFIXO_ARQUIVOS } } },
    OR: [{ validoAte: null }, { validoAte: { gt: agora } }],
  };
}

export function arquivoEnviavel(url: string): boolean {
  return url.startsWith(PREFIXO_ARQUIVOS) && !!extensaoPorMime(contentTypePorExtensao(url));
}

async function conversaComCatalogo(u: UsuarioSessao, atendimentoId: string): Promise<boolean> {
  const a = await atendimentoVisivel(u, atendimentoId, true);
  return !!a && !a.encerradoEm && a.finalidade === "COMERCIAL";
}

export async function catalogoVisivel(u: UsuarioSessao, atendimentoId: string, agora = new Date()): Promise<MaterialCatalogo[]> {
  if (!(await conversaComCatalogo(u, atendimentoId))) return [];
  const fontes = await prisma.fonteConhecimento.findMany({
    where: ondeMaterialAtivo(agora),
    orderBy: [{ nome: "asc" }, { id: "asc" }],
    select: { id: true, nome: true, registroUpload: { select: { url: true } } },
  });
  return fontes
    .filter((f) => !!f.registroUpload && arquivoEnviavel(f.registroUpload.url))
    .slice(0, MAX_MATERIAIS_CATALOGO)
    .map((f) => ({ id: f.id, nome: f.nome }));
}

export async function exigirMaterialAtivo(db: Banco, fonteId: string, agora = new Date()): Promise<{ url: string; nome: string }> {
  const fonte = await db.fonteConhecimento.findFirst({
    where: { AND: [{ id: fonteId }, ondeMaterialAtivo(agora)] },
    select: { nome: true, registroUpload: { select: { url: true } } },
  });
  const url = fonte?.registroUpload?.url;
  if (!fonte || !url || !arquivoEnviavel(url)) throw new ErroRegra(ERRO_MATERIAL_INDISPONIVEL);
  return { url, nome: fonte.nome };
}

export async function exigirMaterialDoCatalogo(u: UsuarioSessao, atendimentoId: string, fonteId: string): Promise<{ url: string; nome: string }> {
  if (!(await conversaComCatalogo(u, atendimentoId))) throw new ErroRegra(ERRO_MATERIAL_INDISPONIVEL);
  return exigirMaterialAtivo(prisma, fonteId);
}
