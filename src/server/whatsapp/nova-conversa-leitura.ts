import { Papel, Prisma } from "@prisma/client";
import { apenasPortal, ErroAutenticacao, ErroPermissao, ErroRegra, exigirPapel } from "@/server/_shared/sessao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { whereOportunidadeEmSql } from "@/server/crm/oportunidade-sql";
import type { CadastroTelefoneInterno } from "./nova-conversa-interna";

export interface PropriosNovaConversaTx {
 contato?: { id: string; telefoneE164: string; pessoaId: string|null; leadId: string|null };
 lead?: { id: string; telefoneE164: string; pessoaId: string; vendedorDonoId: string };
}
export interface EntradaLeituraNovaConversa { autorId: string; telefoneE164: string; leadEsperadoId?: string; proprios?: PropriosNovaConversaTx }
type Projecao = Omit<CadastroTelefoneInterno, "oportunidadesAutorizadas"> & { oportunidadesAutorizadas: unknown };

export async function lerCadastroNovaConversaTx(tx: Prisma.TransactionClient, entrada: EntradaLeituraNovaConversa): Promise<CadastroTelefoneInterno> {
 const fresco = await tx.usuario.findUnique({ where: { id: entrada.autorId }, select: { nome: true, ativo: true, papeis: true, permissoes: true } });
 if (!fresco?.ativo) throw new ErroAutenticacao();
 const usuario = { id: entrada.autorId, nome: fresco.nome, papeis: fresco.papeis, permissoes: fresco.permissoes };
 if (apenasPortal(usuario)) throw new ErroPermissao();
 exigirPapel(usuario, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
 const scope = whereOportunidadeEmSql(await escopoComercialAtual(usuario, tx), "l");
 const c = entrada.proprios?.contato, l = entrada.proprios?.lead;
 const contatoProprio = c ? Prisma.sql`c."id" = ${c.id} AND c."telefoneE164" = ${c.telefoneE164}
  AND c."pessoaId" IS NOT DISTINCT FROM ${c.pessoaId} AND c."leadId" IS NOT DISTINCT FROM ${c.leadId}
  AND c."alunoId" IS NULL AND c."responsavelId" IS NULL` : Prisma.sql`FALSE`;
 const leadProprio = l ? Prisma.sql`l."id" = ${l.id} AND l."telefoneE164" = ${l.telefoneE164}
  AND l."pessoaId" = ${l.pessoaId} AND l."vendedorDonoId" = ${l.vendedorDonoId}` : Prisma.sql`FALSE`;
 const esperado = entrada.leadEsperadoId === undefined ? Prisma.sql`TRUE` : Prisma.sql`l."id" = ${entrada.leadEsperadoId}`;
 const limite = entrada.leadEsperadoId === undefined ? Prisma.sql`2` : Prisma.sql`1`;
 const rows = await tx.$queryRaw<Projecao[]>(Prisma.sql`
  WITH autorizadas AS (
   SELECT l."id", l."telefoneE164" FROM "Lead" l
   WHERE l."telefoneE164" = ${entrada.telefoneE164} AND (${scope}) AND (${esperado}) AND (${leadProprio}) IS NOT TRUE
   ORDER BY l."id" LIMIT ${limite}
  )
  SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a."id", 'telefoneE164', a."telefoneE164") ORDER BY a."id") FROM autorizadas a), '[]'::jsonb) AS "oportunidadesAutorizadas",
   EXISTS(SELECT 1 FROM "ContatoWhatsApp" c WHERE c."telefoneE164" = ${entrada.telefoneE164} AND (${contatoProprio}) IS NOT TRUE) AS "contatoIdentificado",
   EXISTS(SELECT 1 FROM "Aluno" a WHERE a."telefoneE164" = ${entrada.telefoneE164}) AS "alunoIdentificado",
   EXISTS(SELECT 1 FROM "Responsavel" r WHERE r."telefoneE164" = ${entrada.telefoneE164}) AS "responsavelIdentificado",
   (EXISTS(SELECT 1 FROM "ContatoWhatsApp" c WHERE c."telefoneE164" = ${entrada.telefoneE164} AND c."pessoaId" IS NOT NULL AND (${contatoProprio}) IS NOT TRUE)
    OR EXISTS(SELECT 1 FROM "Aluno" a WHERE a."telefoneE164" = ${entrada.telefoneE164} AND a."pessoaId" IS NOT NULL)
    OR EXISTS(SELECT 1 FROM "Responsavel" r WHERE r."telefoneE164" = ${entrada.telefoneE164} AND r."pessoaId" IS NOT NULL)
    OR EXISTS(SELECT 1 FROM "Lead" l WHERE l."telefoneE164" = ${entrada.telefoneE164} AND l."pessoaId" IS NOT NULL AND (${leadProprio}) IS NOT TRUE)) AS "pessoaIdentificada",
   EXISTS(SELECT 1 FROM "Lead" l WHERE l."telefoneE164" = ${entrada.telefoneE164} AND (${scope}) IS NOT TRUE AND (${leadProprio}) IS NOT TRUE) AS "oportunidadeOcultaIdentificada"
 `);
 const row = rows[0];
 const lista = row?.oportunidadesAutorizadas ?? [];
 const flags = row && [row.pessoaIdentificada, row.alunoIdentificado, row.responsavelIdentificado, row.contatoIdentificado, row.oportunidadeOcultaIdentificada];
 if (rows.length !== 1 || !flags?.every(f => typeof f === "boolean") || !Array.isArray(lista) || lista.some(o => !o || typeof o.id !== "string" || !(o.telefoneE164 === null || typeof o.telefoneE164 === "string"))) throw new ErroRegra("Não foi possível conferir o cadastro atual.");
 return {
  oportunidadesAutorizadas: lista.map(o => ({ id: o.id as string, telefoneE164: o.telefoneE164 as string|null })),
  pessoaIdentificada: row.pessoaIdentificada, alunoIdentificado: row.alunoIdentificado, responsavelIdentificado: row.responsavelIdentificado,
  contatoIdentificado: row.contatoIdentificado, oportunidadeOcultaIdentificada: row.oportunidadeOcultaIdentificada,
 };
}
