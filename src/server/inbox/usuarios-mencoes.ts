import { Prisma, type Papel } from "@prisma/client";
import { expressaoOrdenacaoSql, normalizarParaOrdenacao } from "@/lib/nome-ordenacao";
import { PAPEIS_INBOX, type Db } from "@/server/whatsapp/escopo";
export interface UsuarioMencao { id: string; nome: string; ativo: boolean; papeis: Papel[]; permissoes: string[] }
// Coluna literal constante: nenhum nome de coluna/SQL vem do cliente. Valores são parâmetros.
const nomeSql = Prisma.raw(expressaoOrdenacaoSql('u."nome"'));
export async function usuariosRelevantesParaMencao(db: Db, autorId: string, filtro: { busca: string } | { primeiros: string[] }): Promise<UsuarioMencao[]> {
  const condicao = "busca" in filtro
    ? Prisma.sql`strpos(${nomeSql}, ${normalizarParaOrdenacao(filtro.busca)}) > 0`
    : Prisma.sql`split_part(${nomeSql}, ' ', 1) IN (${Prisma.join(filtro.primeiros)})`;
  return db.$queryRaw<UsuarioMencao[]>(Prisma.sql`SELECT u.id, u.nome, u.ativo, u.papeis, u.permissoes FROM "Usuario" u
    WHERE u.ativo = true AND u.id <> ${autorId} AND u.papeis && ARRAY[${Prisma.join(PAPEIS_INBOX)}]::"Papel"[]
      AND ${condicao}
    ORDER BY ${nomeSql}, u.id LIMIT ${201}`);
}
