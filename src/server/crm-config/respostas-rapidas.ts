import { Papel, type FinalidadeAtendimentoWhatsApp, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ChaveIdempotenciaSchema, ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento, type Resultado, type UsuarioSessao } from "@/server/_shared";
import { marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import { setoresDoUsuario } from "@/server/crm/setores-papel";
import { SETORES } from "@/server/whatsapp/setor";

export const VARIAVEIS_RESPOSTA = ["{nome}", "{responsavel}", "{curso}"] as const;
const SETOR_DO_ESQUEMA = z.enum(["COMERCIAL", "FINANCEIRO", "SECRETARIA", "PEDAGOGICO"]);

const Schema = z.object({
  id: z.string().trim().min(1).optional(),
  atalho: z.string().trim().regex(/^\/[\p{L}\p{N}_-]{1,30}$/u, "O atalho começa com / seguido de letras ou números (ex.: /preco)."),
  titulo: z.string().trim().min(1, "Informe o título.").max(80),
  corpo: z.string().trim().min(1, "Informe o texto.").max(2000),
  setor: SETOR_DO_ESQUEMA.nullable(),
  ariaPodeUsar: z.boolean(),
  /** Só na criação (#166): a chave vai no `RespostaRapidaSalva`; na edição (com `id`) ela é ignorada. */
  chaveIdempotencia: ChaveIdempotenciaSchema.optional(),
});

function validarVariaveis(corpo: string) {
  if (/\{\{|\}\}/.test(corpo)) throw new ErroRegra("Use variáveis no formato {nome}.");
  for (const v of corpo.match(/\{[^{}]*\}/g) ?? []) {
    if (!(VARIAVEIS_RESPOSTA as readonly string[]).includes(v)) {
      throw new ErroRegra(`Variável ${v} desconhecida. Use ${VARIAVEIS_RESPOSTA.join(", ")}.`);
    }
  }
}

/** Setores em que o autor cria respostas: Admin todos; Gerente Comercial só COMERCIAL (e geral). */
function setoresDoAutor(papeis: Papel[]): FinalidadeAtendimentoWhatsApp[] {
  return papeis.includes(Papel.ADMINISTRADOR) ? [...SETORES] : ["COMERCIAL"];
}

const resumo = (t: { atalho: string | null; titulo: string | null; corpo: string; setor: FinalidadeAtendimentoWhatsApp | null; ariaPodeUsar: boolean }) => ({
  atalho: t.atalho, titulo: t.titulo, corpo: t.corpo, setor: t.setor, ariaPodeUsar: t.ariaPodeUsar,
});

export async function salvarRespostaRapida(i: { id?: string; atalho: string; titulo: string; corpo: string; setor: FinalidadeAtendimentoWhatsApp | null; ariaPodeUsar: boolean; chaveIdempotencia?: string }): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const { chaveIdempotencia, ...d } = Schema.parse(i);
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
    validarVariaveis(d.corpo);
    if (d.setor && !setoresDoAutor(autor.papeis).includes(d.setor)) throw new ErroRegra("Você só pode criar respostas do seu setor ou gerais.");
    const marca = d.id ? null : marcaIdempotencia(chaveIdempotencia, d);
    return prisma.$transaction(async (tx) => {
      if (marca) {
        const repetido = await repeticaoIdempotente(tx, {
          tipo: "RespostaRapidaSalva", agregadoTipo: "TemplateWhatsApp", autorId: autor.id, marca,
          mensagemConflito: "Esta tentativa já foi usada com outros dados. Recarregue a página e confira se a resposta já aparece antes de repetir.",
        });
        if (repetido) return { id: repetido.agregadoId };
      }
      const antes = d.id ? await tx.templateWhatsApp.findFirst({ where: { id: d.id, tipo: "RESPOSTA_RAPIDA" } }) : null;
      if (d.id && !antes) throw new ErroRegra("Resposta rápida não encontrada.");
      if (antes?.arquivadoEm) throw new ErroRegra("Resposta arquivada não pode ser editada.");
      if (antes?.setor && !setoresDoAutor(autor.papeis).includes(antes.setor)) throw new ErroRegra("Você só pode editar respostas do seu setor ou gerais.");
      const dup = await tx.templateWhatsApp.findFirst({
        where: { OR: [{ atalho: d.atalho }, { nome: "rr:" + d.atalho }], ...(antes ? { id: { not: antes.id } } : {}) },
        select: { id: true },
      });
      if (dup) throw new ErroRegra("Já existe uma resposta com este atalho (inclusive arquivada).");
      const dados = { nome: "rr:" + d.atalho, atalho: d.atalho, titulo: d.titulo, corpo: d.corpo, setor: d.setor, ariaPodeUsar: d.ariaPodeUsar };
      const t = antes
        ? await tx.templateWhatsApp.update({ where: { id: antes.id }, data: dados })
        : await tx.templateWhatsApp.create({ data: { ...dados, tipo: "RESPOSTA_RAPIDA" } });
      await registrarEvento(tx, {
        tipo: "RespostaRapidaSalva", agregadoTipo: "TemplateWhatsApp", agregadoId: t.id, autorId: autor.id,
        payload: { de: antes ? resumo(antes) : null, para: resumo(t), ...marca },
      });
      return { id: t.id };
    });
  });
}

export async function arquivarRespostaRapida(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
    await prisma.$transaction(async (tx) => {
      const t = await tx.templateWhatsApp.findFirst({ where: { id, tipo: "RESPOSTA_RAPIDA" } });
      if (!t) throw new ErroRegra("Resposta rápida não encontrada.");
      if (t.arquivadoEm) throw new ErroRegra("Resposta já arquivada.");
      if (t.setor && !setoresDoAutor(autor.papeis).includes(t.setor)) throw new ErroRegra("Você só pode arquivar respostas do seu setor ou gerais.");
      const agora = new Date();
      await tx.templateWhatsApp.update({ where: { id }, data: { arquivadoEm: agora } });
      await registrarEvento(tx, {
        tipo: "RespostaRapidaArquivada", agregadoTipo: "TemplateWhatsApp", agregadoId: id, autorId: autor.id,
        payload: { de: { arquivadoEm: null }, para: { arquivadoEm: agora.toISOString() } },
      });
    });
    return undefined;
  });
}

/** Respostas ativas do(s) setor(es) do usuário e as gerais (sem setor). */
export async function listarRespostasRapidas(u: UsuarioSessao): Promise<{ id: string; atalho: string; titulo: string; corpo: string; setor: FinalidadeAtendimentoWhatsApp | null }[]> {
  const setores = setoresDoUsuario(u.papeis);
  const ts = await prisma.templateWhatsApp.findMany({
    where: { tipo: "RESPOSTA_RAPIDA", arquivadoEm: null, OR: [{ setor: null }, { setor: { in: setores } }] },
    orderBy: { atalho: "asc" },
  });
  return ts.map((t) => ({ id: t.id, atalho: t.atalho ?? "", titulo: t.titulo ?? t.atalho ?? "", corpo: t.corpo, setor: t.setor }));
}

/**
 * Teto de respostas no prompt da Aria, o mesmo da FAQ (`config-schema`: até 100 itens de até 2000
 * caracteres). O corpo já é limitado a 2000 no Schema acima; a ordem por atalho torna o corte estável.
 */
export const LIMITE_RESPOSTAS_ARIA = 100;

/**
 * Respostas que a Aria pode usar no atendimento do setor informado: ativas, marcadas "Aria pode usar",
 * do próprio setor ou gerais (sem setor). Lidas pelo contexto do turno no `db` recebido (tx do turno).
 */
export async function respostasParaAria(
  setor: FinalidadeAtendimentoWhatsApp,
  db: Prisma.TransactionClient = prisma,
): Promise<{ atalho: string; titulo: string; corpo: string; setor: FinalidadeAtendimentoWhatsApp | null }[]> {
  const ts = await db.templateWhatsApp.findMany({
    where: { tipo: "RESPOSTA_RAPIDA", arquivadoEm: null, ariaPodeUsar: true, OR: [{ setor: null }, { setor }] },
    orderBy: [{ atalho: "asc" }, { id: "asc" }],
    take: LIMITE_RESPOSTAS_ARIA,
  });
  return ts.map((t) => ({ atalho: t.atalho ?? "", titulo: t.titulo ?? t.atalho ?? "", corpo: t.corpo, setor: t.setor }));
}
