import { Papel, type Prisma, type TelaFiltroSalvo } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared/evento";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ErroRegra, exigirSessao, type UsuarioSessao } from "@/server/_shared/sessao";
import type { FiltrosFunil } from "./funil";
import { exigirCapacidadeCrm } from "./permissoes";
import { comUnicidade } from "./unicidade";

/** As chaves do funil são as de FiltrosFunil (lerFiltrosFunil lê a URL com esses nomes). */
const CHAVES_FUNIL = [
  "busca", "tipo", "donoId", "temperatura", "origem", "tagId", "perdidosDias", "ordem",
] as const satisfies readonly (keyof FiltrosFunil)[];

/** Chaves de filtro aceitas por tela; qualquer outra é descartada ao salvar. */
export const CHAVES_FILTRO: Record<TelaFiltroSalvo, readonly string[]> = {
  FUNIL: CHAVES_FUNIL,
  CONTATOS: ["busca", "tag", "origem", "pais", "empresa", "vendedor", "situacao"],
  CARTEIRA: ["busca", "vendedor", "etapa", "temperatura", "situacao"],
  TAREFAS: ["busca", "responsavel", "tipo", "situacao", "periodo", "prioridade"],
  COMISSOES: ["vendedor", "situacao", "periodo", "moeda"],
};

const EntradaSchema = z.object({
  tela: z.enum(["FUNIL", "CONTATOS", "CARTEIRA", "TAREFAS", "COMISSOES"], {
    errorMap: () => ({ message: "Tela inválida." }),
  }),
  nome: z.string().trim().min(1, "Dê um nome à visualização.").max(60, "O nome deve ter até 60 caracteres."),
  filtros: z.record(z.string()),
  compartilhado: z.boolean().optional(),
});

export async function salvarFiltro(input: {
  tela: TelaFiltroSalvo;
  nome: string;
  filtros: Record<string, string>;
  compartilhado?: boolean;
}): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    const dados = EntradaSchema.parse(input);
    const compartilhado = dados.compartilhado === true;
    if (compartilhado) exigirCapacidadeCrm(autor, "carteira.equipe");

    const permitidas = CHAVES_FILTRO[dados.tela];
    const filtros: Record<string, string> = {};
    for (const [k, v] of Object.entries(dados.filtros)) {
      if (permitidas.includes(k) && v.trim() !== "") filtros[k] = v;
    }

    const existente = await prisma.filtroSalvo.findUnique({
      where: { usuarioId_tela_nome: { usuarioId: autor.id, tela: dados.tela, nome: dados.nome } },
      select: { id: true, arquivadoEm: true },
    });
    const repetida = "Já existe uma visualização com este nome.";
    if (existente && !existente.arquivadoEm) throw new ErroRegra(repetida);

    return comUnicidade(repetida, () => prisma.$transaction(async (tx) => {
      // A unicidade (usuário, tela, nome) inclui arquivados e não há delete físico:
      // salvar com o nome de um arquivado o reativa com os novos filtros. A reativação só vale
      // se ele ainda estiver arquivado: outra chamada simultânea pode tê-lo reativado antes.
      let f;
      if (existente) {
        const { count } = await tx.filtroSalvo.updateMany({
          where: { id: existente.id, arquivadoEm: { not: null } },
          data: { filtros, compartilhado, arquivadoEm: null },
        });
        if (count === 0) throw new ErroRegra(repetida);
        f = await tx.filtroSalvo.findUniqueOrThrow({ where: { id: existente.id } });
      } else {
        f = await tx.filtroSalvo.create({
          data: { usuarioId: autor.id, tela: dados.tela, nome: dados.nome, filtros, compartilhado },
        });
      }
      await registrarEvento(tx, {
        tipo: "FiltroSalvoCriado",
        agregadoTipo: "FiltroSalvo",
        agregadoId: f.id,
        autorId: autor.id,
        payload: { tela: f.tela, nome: f.nome, compartilhado: f.compartilhado },
      });
      return { id: f.id };
    }));
  });
}

export async function arquivarFiltro(id: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    await prisma.$transaction(async (tx) => {
      const f = await tx.filtroSalvo.findFirst({ where: { id, usuarioId: autor.id, arquivadoEm: null } });
      if (!f) throw new ErroRegra("Visualização não encontrada.");
      await tx.filtroSalvo.update({ where: { id }, data: { arquivadoEm: new Date() } });
      await registrarEvento(tx, {
        tipo: "FiltroSalvoArquivado",
        agregadoTipo: "FiltroSalvo",
        agregadoId: id,
        autorId: autor.id,
        payload: { tela: f.tela, nome: f.nome },
      });
    });
  });
}

export async function listarFiltros(
  usuario: UsuarioSessao,
  tela: TelaFiltroSalvo,
): Promise<{ id: string; nome: string; filtros: Record<string, string>; compartilhado: boolean; meu: boolean }[]> {
  const atual = await prisma.usuario.findUnique({ where: { id: usuario.id }, select: { gerenteComercialId: true } });
  const visiveis: Prisma.FiltroSalvoWhereInput[] = [
    { usuarioId: usuario.id },
    { compartilhado: true, usuario: { papeis: { has: Papel.ADMINISTRADOR } } },
  ];
  if (atual?.gerenteComercialId) visiveis.push({ compartilhado: true, usuarioId: atual.gerenteComercialId });

  const linhas = await prisma.filtroSalvo.findMany({
    where: { tela, arquivadoEm: null, OR: visiveis },
    orderBy: [{ nome: "asc" }, { criadoEm: "asc" }],
  });
  return linhas.map((f) => ({
    id: f.id,
    nome: f.nome,
    filtros: (f.filtros ?? {}) as Record<string, string>,
    compartilhado: f.compartilhado,
    meu: f.usuarioId === usuario.id,
  }));
}
