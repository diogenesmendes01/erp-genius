import { type CorTag, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ErroRegra, exigirSessao, type UsuarioSessao } from "@/server/_shared/sessao";
import { exigirCapacidadeCrm } from "./permissoes";
import { escopoPessoas } from "./pessoas";

/** Classes do mapa de cores do Tailwind (fundo suave + texto), sem hex. */
export const CLASSES_COR_TAG: Record<CorTag, string> = {
  NEUTRA: "bg-gray-100 text-gray-700",
  MARCA: "bg-brand-bg text-brand-800",
  INFO: "bg-blue-100 text-blue-700",
  SUCESSO: "bg-green-100 text-green-700",
  ALERTA: "bg-amber-100 text-amber-800",
  PERIGO: "bg-red-100 text-red-700",
  IA: "bg-indigo-100 text-indigo-700",
};

const CORES = ["NEUTRA", "MARCA", "INFO", "SUCESSO", "ALERTA", "PERIGO", "IA"] as const;

const TagSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome da tag.").max(40, "O nome da tag deve ter até 40 caracteres."),
  cor: z.enum(CORES, { errorMap: () => ({ message: "Escolha uma cor válida." }) }),
  grupo: z
    .string()
    .trim()
    .max(40, "O grupo deve ter até 40 caracteres.")
    .optional()
    .transform((g) => g || undefined),
});

export async function criarTag(input: { nome: string; cor: CorTag; grupo?: string }): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "carteira.equipe");
    const dados = TagSchema.parse(input);
    const existente = await prisma.tag.findUnique({ where: { nome: dados.nome }, select: { id: true } });
    if (existente) throw new ErroRegra("Já existe uma tag com este nome.");
    return prisma.$transaction(async (tx) => {
      const tag = await tx.tag.create({ data: { nome: dados.nome, cor: dados.cor, grupo: dados.grupo ?? null } });
      await registrarEvento(tx, {
        tipo: "TagCriada",
        agregadoTipo: "Tag",
        agregadoId: tag.id,
        autorId: autor.id,
        payload: { nome: tag.nome, cor: tag.cor, grupo: tag.grupo },
      });
      return { id: tag.id };
    });
  });
}

type AlvoTag = { tagId: string; pessoaId?: string; empresaId?: string };

const AlvoSchema = z.object({
  tagId: z.string().min(1, "Escolha a tag."),
  pessoaId: z.string().min(1).optional(),
  empresaId: z.string().min(1).optional(),
});

/** Empresa visível: tem oportunidade no escopo comercial do usuário ou uma pessoa dentro de `escopoPessoas`. */
export async function escopoEmpresas(usuario: UsuarioSessao, tx: Prisma.TransactionClient): Promise<Prisma.EmpresaWhereInput> {
  return {
    OR: [
      { oportunidades: { some: await escopoComercialAtual(usuario, tx) } },
      { pessoas: { some: await escopoPessoas(usuario, tx) } },
    ],
  };
}

type Modo = "atribuir" | "remover";

async function alterarTag(input: AlvoTag, modo: Modo): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirCapacidadeCrm(autor, "contatos.editar");
    const dados = AlvoSchema.parse(input);
    if (!!dados.pessoaId === !!dados.empresaId) throw new ErroRegra("Informe a pessoa ou a empresa, e não as duas.");

    await prisma.$transaction(async (tx) => {
      const tag = await tx.tag.findUnique({ where: { id: dados.tagId } });
      if (!tag) throw new ErroRegra("Tag não encontrada.");
      if (modo === "atribuir" && !tag.ativo) throw new ErroRegra("Esta tag está inativa.");

      const tipo = modo === "atribuir" ? "TagAtribuida" : "TagRemovida";
      const payload = { tagId: tag.id, nome: tag.nome };
      if (dados.pessoaId) {
        const visivel = await tx.pessoa.findFirst({
          where: { AND: [{ id: dados.pessoaId }, await escopoPessoas(autor, tx)] },
          select: { id: true },
        });
        if (!visivel) throw new ErroRegra("Pessoa não encontrada.");
        const chave = { pessoaId_tagId: { pessoaId: dados.pessoaId, tagId: tag.id } };
        const atual = await tx.pessoaTag.findUnique({ where: chave });
        if (modo === "atribuir" && !atual) {
          await tx.pessoaTag.create({ data: { pessoaId: dados.pessoaId, tagId: tag.id, criadoPorId: autor.id } });
        } else if (modo === "remover" && atual) {
          await tx.pessoaTag.delete({ where: chave });
        } else return; // idempotente: já está no estado pedido, sem Evento
        await registrarEvento(tx, { tipo, agregadoTipo: "Pessoa", agregadoId: dados.pessoaId, autorId: autor.id, payload });
      } else {
        const empresaId = dados.empresaId!;
        const visivel = await tx.empresa.findFirst({
          where: { AND: [{ id: empresaId }, await escopoEmpresas(autor, tx)] },
          select: { id: true },
        });
        if (!visivel) throw new ErroRegra("Empresa não encontrada.");
        const chave = { empresaId_tagId: { empresaId, tagId: tag.id } };
        const atual = await tx.empresaTag.findUnique({ where: chave });
        if (modo === "atribuir" && !atual) {
          await tx.empresaTag.create({ data: { empresaId, tagId: tag.id, criadoPorId: autor.id } });
        } else if (modo === "remover" && atual) {
          await tx.empresaTag.delete({ where: chave });
        } else return;
        await registrarEvento(tx, { tipo, agregadoTipo: "Empresa", agregadoId: empresaId, autorId: autor.id, payload });
      }
    });
  });
}

export async function atribuirTag(input: AlvoTag): Promise<Resultado> {
  return alterarTag(input, "atribuir");
}

export async function removerTag(input: AlvoTag): Promise<Resultado> {
  return alterarTag(input, "remover");
}
