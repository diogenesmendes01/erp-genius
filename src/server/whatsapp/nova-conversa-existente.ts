import { Papel, type Prisma } from "@prisma/client";
import { apenasPortal, ErroAutenticacao, ErroPermissao, ErroRegra, exigirPapel, type UsuarioSessao } from "@/server/_shared/sessao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import { ChaveIdempotenciaSchema } from "@/server/_shared/validacao";
import { registrarEvento } from "@/server/_shared/evento";
import { exigirDestinoComercial } from "@/server/comercial/destino-comercial";
import { normalizarNumeroNovaConversa } from "./telefone-nova-conversa";
import { lerCadastroNovaConversaTx } from "./nova-conversa-leitura";
import { classificarAlvoNovaConversa } from "./nova-conversa-interna";
import { donosDeLinhaVisiveis } from "./linha-comercial";
import { atendimentoVisivel, garantirAtendimento } from "./atendimentos";

export interface EntradaRamoExistenteConversa { autorId: string; numeroId: string; telefoneE164: string; chaveIdempotencia: string }
interface LeadConfirmado { id: string; pessoaId: string; ownerId: string }
interface TuplaExistente extends LeadConfirmado { atendimentoId: string; contatoId: string; conversaId: string; responsavelId: string | null }
const mudou = () => new ErroRegra("O cadastro ou acesso mudou. Confira a conversa antes de repetir.");

async function resolverLead(tx: Prisma.TransactionClient, e: EntradaRamoExistenteConversa): Promise<{ autor: UsuarioSessao; lead: LeadConfirmado }> {
 const atual = await tx.usuario.findUnique({ where: { id: e.autorId }, select: { ativo: true, nome: true, papeis: true, permissoes: true } });
 if (!atual?.ativo) throw new ErroAutenticacao();
 const autor = { id: e.autorId, nome: atual.nome, papeis: atual.papeis, permissoes: atual.permissoes };
 if (apenasPortal(autor)) throw new ErroPermissao();
 exigirPapel(autor, Papel.VENDEDOR, Papel.GERENTE_COMERCIAL);
 const numero = await tx.numeroWhatsApp.findUnique({ where: { id: e.numeroId }, select: { id: true, ativo: true, finalidade: true, donoId: true } });
 if (!numero?.ativo || numero.finalidade !== "VENDAS" || (!autor.papeis.includes(Papel.ADMINISTRADOR) && (!numero.donoId || !(await donosDeLinhaVisiveis(autor, tx)).includes(numero.donoId)))) throw mudou();
 const cadastro = await lerCadastroNovaConversaTx(tx, { autorId: e.autorId, telefoneE164: e.telefoneE164 });
 const alvo = classificarAlvoNovaConversa({ telefoneE164: e.telefoneE164 }, cadastro);
 if (alvo.tipo !== "existente" || cadastro.alunoIdentificado || cadastro.responsavelIdentificado || cadastro.oportunidadeOcultaIdentificada) throw mudou();
 const l = await tx.oportunidade.findFirst({ where: { AND: [{ id: alvo.leadId, telefoneE164: e.telefoneE164, pessoaId: { not: null }, pessoa: { mescladaEmId: null } }, await escopoComercialAtual(autor, tx)] }, select: { id: true, telefoneE164: true, pessoaId: true, vendedorDonoId: true } });
 if (!l || l.id !== alvo.leadId || l.telefoneE164 !== e.telefoneE164 || !l.pessoaId || !l.vendedorDonoId) throw mudou();
 await exigirDestinoComercial(autor, l.vendedorDonoId, tx);
 return { autor, lead: { id: l.id, pessoaId: l.pessoaId, ownerId: l.vendedorDonoId } };
}
function contatoCompativel(c: { telefoneE164: string; pessoaId: string | null; leadId: string | null; alunoId: string | null; responsavelId: string | null }, e: EntradaRamoExistenteConversa, l: LeadConfirmado): boolean {
 return c.telefoneE164 === e.telefoneE164 && !c.alunoId && !c.responsavelId && (c.pessoaId === null || c.pessoaId === l.pessoaId) && (c.leadId === null || c.leadId === l.id);
}
function mesmaIdentidade(a: LeadConfirmado, b: LeadConfirmado): boolean { return a.id === b.id && a.pessoaId === b.pessoaId && a.ownerId === b.ownerId; }
interface FotoFinal {
 autor: { id: string; ativo: boolean; papeis: Papel[]; permissoes: string[] } | null;
 owner: { id: string; ativo: boolean; papeis: Papel[]; gerenteComercialId: string | null } | null;
 numero: { id: string; ativo: boolean; finalidade: string; donoId: string | null; donoGerenteId: string | null } | null;
 lead: { id: string; telefoneE164: string | null; pessoaId: string | null; vendedorDonoId: string | null } | null;
 pessoa: { id: string; mescladaEmId: string | null } | null;
 contato: { id: string; telefoneE164: string; pessoaId: string | null; leadId: string | null; alunoId: string | null; responsavelId: string | null } | null;
 conversa: { id: string; numeroId: string; contatoId: string | null; grupoId: string | null } | null;
 atendimento: { id: string; conversaId: string; finalidade: string; leadId: string | null; responsavelId: string | null; encerradoEm: string | null } | null;
}
function mesmoConjunto(a: readonly string[], b: readonly string[]): boolean {
 return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}
/** Última leitura qualificada READ COMMITTED, nunca promessa de linearização global. */
async function conferirFotoFinal(tx: Prisma.TransactionClient, e: EntradaRamoExistenteConversa, t: TuplaExistente, perfilUsado: UsuarioSessao): Promise<void> {
 const rows = await tx.$queryRaw<{ foto: FotoFinal }[]>`
  SELECT jsonb_build_object(
   'autor', CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('id',u.id,'ativo',u.ativo,'papeis',u.papeis,'permissoes',u.permissoes) END,
   'owner', CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('id',o.id,'ativo',o.ativo,'papeis',o.papeis,'gerenteComercialId',o."gerenteComercialId") END,
   'numero', CASE WHEN n.id IS NULL THEN NULL ELSE jsonb_build_object('id',n.id,'ativo',n.ativo,'finalidade',n.finalidade,'donoId',n."donoId",'donoGerenteId',d."gerenteComercialId") END,
   'lead', CASE WHEN l.id IS NULL THEN NULL ELSE jsonb_build_object('id',l.id,'telefoneE164',l."telefoneE164",'pessoaId',l."pessoaId",'vendedorDonoId',l."vendedorDonoId") END,
   'pessoa', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id',p.id,'mescladaEmId',p."mescladaEmId") END,
   'contato', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id',c.id,'telefoneE164',c."telefoneE164",'pessoaId',c."pessoaId",'leadId',c."leadId",'alunoId',c."alunoId",'responsavelId',c."responsavelId") END,
   'conversa', CASE WHEN cv.id IS NULL THEN NULL ELSE jsonb_build_object('id',cv.id,'numeroId',cv."numeroId",'contatoId',cv."contatoId",'grupoId',cv."grupoId") END,
   'atendimento', CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object('id',a.id,'conversaId',a."conversaId",'finalidade',a.finalidade,'leadId',a."leadId",'responsavelId',a."responsavelId",'encerradoEm',a."encerradoEm") END
  ) AS foto
  FROM (SELECT 1) base
  LEFT JOIN "Usuario" u ON u.id = ${e.autorId}
  LEFT JOIN "Usuario" o ON o.id = ${t.ownerId}
  LEFT JOIN "NumeroWhatsApp" n ON n.id = ${e.numeroId}
  LEFT JOIN "Usuario" d ON d.id = n."donoId"
  LEFT JOIN "Lead" l ON l.id = ${t.id}
  LEFT JOIN "Pessoa" p ON p.id = l."pessoaId"
  LEFT JOIN "ContatoWhatsApp" c ON c.id = ${t.contatoId}
  LEFT JOIN "ConversaWhatsApp" cv ON cv.id = ${t.conversaId}
  LEFT JOIN "AtendimentoWhatsApp" a ON a.id = ${t.atendimentoId}
 `;
 // Daqui até retornar não há outro await: testemunhas do mesmo snapshot para os guards usados.
 const f = rows.length === 1 ? rows[0].foto : null;
 if (!f) throw new ErroAutenticacao();
 const u = f.autor;
 if (!u?.ativo) throw new ErroAutenticacao();
 if (u.id !== perfilUsado.id || !mesmoConjunto(u.papeis, perfilUsado.papeis) || !mesmoConjunto(u.permissoes, perfilUsado.permissoes ?? [])) throw mudou();
 const admin = u.papeis.includes(Papel.ADMINISTRADOR), gerente = u.papeis.includes(Papel.GERENTE_COMERCIAL);
 if (!f.owner?.ativo || !f.owner.papeis.includes(Papel.VENDEDOR) || f.owner.id !== t.ownerId || (!admin && f.owner.id !== u.id && !(gerente && f.owner.gerenteComercialId === u.id))) throw mudou();
 if (!f.numero?.ativo || f.numero.id !== e.numeroId || f.numero.finalidade !== "VENDAS" || (!admin && f.numero.donoId !== u.id && !(gerente && f.numero.donoId && f.numero.donoGerenteId === u.id))) throw mudou();
 if (!f.lead || f.lead.id !== t.id || f.lead.telefoneE164 !== e.telefoneE164 || f.lead.pessoaId !== t.pessoaId || f.lead.vendedorDonoId !== t.ownerId || !f.pessoa || f.pessoa.id !== t.pessoaId || f.pessoa.mescladaEmId !== null) throw mudou();
 if (!f.contato || f.contato.id !== t.contatoId || !contatoCompativel(f.contato, e, t) || f.contato.pessoaId !== t.pessoaId || f.contato.leadId !== t.id) throw mudou();
 if (!f.conversa || f.conversa.id !== t.conversaId || f.conversa.numeroId !== e.numeroId || f.conversa.contatoId !== t.contatoId || f.conversa.grupoId) throw mudou();
 if (!f.atendimento || f.atendimento.id !== t.atendimentoId || f.atendimento.conversaId !== t.conversaId || f.atendimento.finalidade !== "COMERCIAL" || f.atendimento.leadId !== t.id || f.atendimento.encerradoEm !== null || f.atendimento.responsavelId !== t.responsavelId) throw mudou();
}
async function conferirTupla(tx: Prisma.TransactionClient, e: EntradaRamoExistenteConversa, t: TuplaExistente): Promise<void> {
 const { autor, lead } = await resolverLead(tx, e);
 if (!mesmaIdentidade(lead, t)) throw mudou();
 const contato = await tx.contatoWhatsApp.findUnique({ where: { telefoneE164: e.telefoneE164 } });
 if (!contato || contato.id !== t.contatoId || !contatoCompativel(contato, e, lead) || contato.pessoaId !== lead.pessoaId || contato.leadId !== lead.id) throw mudou();
 const a = await atendimentoVisivel(autor, t.atendimentoId, false, tx);
 if (!a || a.encerradoEm || a.finalidade !== "COMERCIAL" || a.leadId !== lead.id || a.numeroId !== e.numeroId || a.contatoId !== t.contatoId || a.conversaId !== t.conversaId || a.conversa.grupoId || a.responsavelId !== t.responsavelId || !contatoCompativel(a.contato, e, lead) || a.contato.pessoaId !== lead.pessoaId || a.contato.leadId !== lead.id) throw mudou();
 await conferirFotoFinal(tx, e, t, autor);
}
function lerReplay(payload: Prisma.JsonValue, atendimentoId: string, e: EntradaRamoExistenteConversa, lead: LeadConfirmado): Omit<TuplaExistente, "responsavelId"> {
 if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw mudou();
 if (payload.criado !== false || payload.numeroId !== e.numeroId || payload.leadId !== lead.id || payload.pessoaId !== lead.pessoaId || payload.ownerId !== lead.ownerId || typeof payload.contatoId !== "string" || !payload.contatoId || typeof payload.conversaId !== "string" || !payload.conversaId) throw mudou();
 return { ...lead, atendimentoId, contatoId: payload.contatoId, conversaId: payload.conversaId };
}
/** EXISTENTE-only. O caller mantém a única TX; nunca cria Pessoa/Lead nem transfere carteira. */
export async function abrirRamoExistenteConversaTx(tx: Prisma.TransactionClient, e: EntradaRamoExistenteConversa): Promise<{ atendimentoId: string; leadId: string; criado: false }> {
 if (normalizarNumeroNovaConversa(e.telefoneE164) !== e.telefoneE164) throw new ErroRegra("Informe o telefone internacional válido.");
 const chave = ChaveIdempotenciaSchema.parse(e.chaveIdempotencia);
 const marca = marcaIdempotencia(chave, { modo: "EXISTENTE", numeroId: e.numeroId, telefoneE164: e.telefoneE164 });
 if (!marca) throw mudou();
 const { autor, lead } = await resolverLead(tx, e);
 const repetido = await repeticaoIdempotente(tx, { tipo: "ConversaIniciadaPorNumero", agregadoTipo: "AtendimentoWhatsApp", autorId: e.autorId, marca, mensagemConflito: "Esta tentativa já foi usada com outros dados. Confira a conversa antes de repetir." });
 if (repetido) {
  const t = lerReplay(repetido.payload, repetido.agregadoId, e, lead);
  const a = await atendimentoVisivel(autor, t.atendimentoId, false, tx);
  if (!a) throw mudou();
  await conferirTupla(tx, e, { ...t, responsavelId: a.responsavelId });
  return { atendimentoId: t.atendimentoId, leadId: lead.id, criado: false };
 }
 // A espera de idempotência pode ter mudado escopo, carteira ou identidade.
 if (!mesmaIdentidade(lead, (await resolverLead(tx, e)).lead)) throw mudou();
 let contato = await tx.contatoWhatsApp.findUnique({ where: { telefoneE164: e.telefoneE164 } });
 if (contato) {
  if (!contatoCompativel(contato, e, lead)) throw mudou();
  if (contato.pessoaId === null || contato.leadId === null) {
   const r = await tx.contatoWhatsApp.updateMany({ where: { id: contato.id, telefoneE164: e.telefoneE164, pessoaId: contato.pessoaId, leadId: contato.leadId, alunoId: null, responsavelId: null }, data: { pessoaId: lead.pessoaId, leadId: lead.id } });
   if (r.count !== 1) throw mudou();
   contato = await tx.contatoWhatsApp.findUnique({ where: { telefoneE164: e.telefoneE164 } });
   if (!contato || !contatoCompativel(contato, e, lead) || contato.pessoaId !== lead.pessoaId || contato.leadId !== lead.id) throw mudou();
  }
 } else {
  contato = await tx.contatoWhatsApp.create({ data: { telefoneE164: e.telefoneE164, pessoaId: lead.pessoaId, leadId: lead.id } });
 }
 const contatoConfirmado = contato;
 if (!mesmaIdentidade(lead, (await resolverLead(tx, e)).lead)) throw mudou();
 const conversa = await tx.conversaWhatsApp.findUnique({ where: { numeroId_contatoId: { numeroId: e.numeroId, contatoId: contatoConfirmado.id } }, select: { id: true, numeroId: true, contatoId: true, grupoId: true } });
 if (conversa && (conversa.grupoId || conversa.numeroId !== e.numeroId || conversa.contatoId !== contatoConfirmado.id)) throw mudou();
 const a = await garantirAtendimento(tx, { numeroId: e.numeroId, contatoId: contatoConfirmado.id, finalidade: "COMERCIAL", leadId: lead.id, responsavelId: e.autorId });
 if (a.encerradoEm || a.finalidade !== "COMERCIAL" || a.leadId !== lead.id || (conversa && a.conversaId !== conversa.id)) throw mudou();
 const t: TuplaExistente = { ...lead, atendimentoId: a.id, contatoId: contatoConfirmado.id, conversaId: a.conversaId, responsavelId: a.responsavelId };
 await conferirTupla(tx, e, t);
 await registrarEvento(tx, { tipo: "AtendimentoInstitucionalAberto", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: e.autorId, payload: { finalidade: "COMERCIAL", leadId: lead.id, alunoId: null, turmaId: null, matriculaId: null } });
 await registrarEvento(tx, { tipo: "ConversaIniciadaPorNumero", agregadoTipo: "AtendimentoWhatsApp", agregadoId: a.id, autorId: e.autorId, payload: { criado: false, leadId: lead.id, pessoaId: lead.pessoaId, contatoId: contatoConfirmado.id, conversaId: a.conversaId, numeroId: e.numeroId, ownerId: lead.ownerId, ...marca } });
 await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
 await conferirTupla(tx, e, t);
 return { atendimentoId: a.id, leadId: lead.id, criado: false };
}