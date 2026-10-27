"use server";

import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apenasPortal, ErroAutenticacao, ErroPermissao, ErroRegra, exigirPapel, exigirSessao, type UsuarioSessao } from "@/server/_shared/sessao";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { donosDeLinhaVisiveis } from "./linha-comercial";
import { lerCadastroNovaConversaTx } from "./nova-conversa-leitura";
import { classificarAlvoNovaConversa } from "./nova-conversa-interna";
import { normalizarNumeroNovaConversa } from "./telefone-nova-conversa";

const PreviewSchema = z.object({ telefone: z.string().max(100), numeroId: z.string().trim().min(1).max(200) }).strict();
const mudou = () => new ErroRegra("O cadastro ou acesso mudou. Confira o número e o canal antes de continuar.");
async function atorFresco(tx: Prisma.TransactionClient, autorId: string): Promise<UsuarioSessao> {
 const u = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, nome: true, papeis: true, permissoes: true } });
 if (!u?.ativo) throw new ErroAutenticacao();
 const autor = { id: autorId, nome: u.nome, papeis: u.papeis, permissoes: u.permissoes };
 if (apenasPortal(autor)) throw new ErroPermissao();
 exigirPapel(autor, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
 return autor;
}
function conjunto(a: readonly string[]): string { return JSON.stringify([...a].sort()); }
function conferirPerfil(a: UsuarioSessao, b: UsuarioSessao): void {
 if (a.id !== b.id || conjunto(a.papeis) !== conjunto(b.papeis) || conjunto(a.permissoes ?? []) !== conjunto(b.permissoes ?? [])) throw mudou();
}
async function linhaAtual(tx: Prisma.TransactionClient, autor: UsuarioSessao, numeroId: string): Promise<string | null> {
 const n = await tx.numeroWhatsApp.findUnique({ where: { id: numeroId }, select: { id: true, ativo: true, finalidade: true, donoId: true } });
 if (!n || n.id !== numeroId || !n.ativo || n.finalidade !== "VENDAS") throw mudou();
 if (!autor.papeis.includes(Papel.ADMINISTRADOR) && (!n.donoId || !(await donosDeLinhaVisiveis(autor, tx)).includes(n.donoId))) throw mudou();
 return n.donoId;
}
interface FotoConsulta {
 autor: { id: string; ativo: boolean; papeis: Papel[]; permissoes: string[] } | null;
 linhas: { id: string; rotulo: string; ativo: boolean; finalidade: string; donoId: string | null; donoGerenteId: string | null }[];
 candidatos: { id: string; telefoneE164: string | null; vendedorDonoId: string | null; donoGerenteId: string | null; coberturaVigente: boolean }[];
}
async function fotoFinal(tx: Prisma.TransactionClient, perfil: UsuarioSessao, ids: readonly string[], candidatos: readonly { id: string; telefoneE164: string | null }[] = []): Promise<FotoConsulta> {
 const filtroLinhas = ids.length ? Prisma.sql`n.id IN (${Prisma.join([...ids])})` : Prisma.sql`FALSE`;
 const filtroLeads = candidatos.length ? Prisma.sql`l.id IN (${Prisma.join(candidatos.map(c => c.id))})` : Prisma.sql`FALSE`;
 const rows = await tx.$queryRaw<{ foto: FotoConsulta }[]>(Prisma.sql`
  SELECT jsonb_build_object(
   'autor', CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('id',u.id,'ativo',u.ativo,'papeis',u.papeis,'permissoes',u.permissoes) END,
   'linhas', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',n.id,'rotulo',n.rotulo,'ativo',n.ativo,'finalidade',n.finalidade,'donoId',n."donoId",'donoGerenteId',d."gerenteComercialId") ORDER BY n."criadoEm",n.id)
    FROM "NumeroWhatsApp" n LEFT JOIN "Usuario" d ON d.id=n."donoId" WHERE ${filtroLinhas}), '[]'::jsonb),
   'candidatos', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'telefoneE164',l."telefoneE164",'vendedorDonoId',l."vendedorDonoId",'donoGerenteId',v."gerenteComercialId",'coberturaVigente',EXISTS(
     SELECT 1 FROM "CoberturaCarteira" c WHERE c."substitutoId"=u.id AND c."titularId"=l."vendedorDonoId" AND c.inicio<=timezone('UTC',statement_timestamp()) AND c.fim>timezone('UTC',statement_timestamp()) AND c."revogadaEm" IS NULL)) ORDER BY l.id)
    FROM "Lead" l LEFT JOIN "Usuario" v ON v.id=l."vendedorDonoId" WHERE ${filtroLeads}), '[]'::jsonb)
  ) AS foto FROM (SELECT 1) base LEFT JOIN "Usuario" u ON u.id=${perfil.id}
 `);
 const foto = rows.length === 1 ? rows[0].foto : null;
 if (!foto?.autor?.ativo) throw new ErroAutenticacao();
 conferirPerfil(perfil, { ...foto.autor, nome: "" });
 const u = foto.autor, admin = u.papeis.includes(Papel.ADMINISTRADOR), gerente = u.papeis.includes(Papel.GERENTE_COMERCIAL), vendedor = u.papeis.includes(Papel.VENDEDOR);
 if (foto.linhas.length !== new Set(ids).size || foto.linhas.some(n => !ids.includes(n.id) || !n.ativo || n.finalidade !== "VENDAS" || (!admin && n.donoId !== u.id && !(gerente && n.donoId && n.donoGerenteId === u.id)))) throw mudou();
 if (foto.candidatos.length !== new Set(candidatos.map(c => c.id)).size || foto.candidatos.some(l => !candidatos.some(c => c.id === l.id && c.telefoneE164 === l.telefoneE164) || (!admin && !(vendedor && (l.vendedorDonoId === u.id || l.coberturaVigente)) && !(gerente && l.donoGerenteId === u.id)))) throw mudou();
 return foto;
}
export async function listarLinhasNovaConversa(): Promise<Resultado<{ linhas: { id: string; rotulo: string }[] }>> {
 return executarAcao(async () => {
  const sessao = await exigirSessao();
  return prisma.$transaction(async tx => {
   const autor = await atorFresco(tx, sessao.id);
   const donos = autor.papeis.includes(Papel.ADMINISTRADOR) ? null : await donosDeLinhaVisiveis(autor, tx);
   const linhas = await tx.numeroWhatsApp.findMany({ where: { ativo: true, finalidade: "VENDAS", ...(donos === null ? {} : { donoId: { in: donos } }) }, select: { id: true, rotulo: true }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }] });
   const atual = await atorFresco(tx, sessao.id);
   conferirPerfil(autor, atual);
   if (donos !== null && conjunto(donos) !== conjunto(await donosDeLinhaVisiveis(atual, tx))) throw mudou();
   const foto = await fotoFinal(tx, atual, linhas.map(n => n.id));
   return { linhas: foto.linhas.map(n => ({ id: n.id, rotulo: n.rotulo })) };
  });
 });
}
export async function consultarTelefoneNovaConversa(input: unknown): Promise<Resultado<{ tipo: "NOVO" | "EXISTENTE" | "RECUSAR"; telefoneE164: string }>> {
 return executarAcao(async () => {
  const sessao = await exigirSessao();
  const dados = PreviewSchema.parse(input);
  const telefoneE164 = normalizarNumeroNovaConversa(dados.telefone);
  if (!telefoneE164) throw new ErroRegra("Informe o telefone internacional válido.");
  return prisma.$transaction(async tx => {
   const autor = await atorFresco(tx, sessao.id);
   const donoId = await linhaAtual(tx, autor, dados.numeroId);
   const cadastro = await lerCadastroNovaConversaTx(tx, { autorId: sessao.id, telefoneE164 });
   const alvo = classificarAlvoNovaConversa({ telefoneE164 }, cadastro);
   const tipo = cadastro.alunoIdentificado || cadastro.responsavelIdentificado || cadastro.oportunidadeOcultaIdentificada || alvo.tipo === "recusar" ? "RECUSAR" : alvo.tipo === "novo" ? "NOVO" : "EXISTENTE";
   const atual = await atorFresco(tx, sessao.id);
   conferirPerfil(autor, atual);
   if (await linhaAtual(tx, atual, dados.numeroId) !== donoId) throw mudou();
   await fotoFinal(tx, atual, [dados.numeroId], cadastro.oportunidadesAutorizadas);
   return { tipo, telefoneE164 };
  });
 });
}