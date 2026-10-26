import { beforeAll, beforeEach, expect, it } from "vitest";
import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { ErroAutenticacao, ErroPermissao } from "@/server/_shared/sessao";
import { lerCadastroNovaConversaTx } from "./nova-conversa-leitura";
let vendedor: Awaited<ReturnType<typeof criarUsuario>>, outro: Awaited<ReturnType<typeof criarUsuario>>, gerente: Awaited<ReturnType<typeof criarUsuario>>;
let paisId: string, seq = 0;
const tel = (n: number) => `+5068888${String(n).padStart(4, "0")}`;
const vazio = { oportunidadesAutorizadas: [], pessoaIdentificada: false, alunoIdentificado: false, responsavelIdentificado: false, contatoIdentificado: false, oportunidadeOcultaIdentificada: false };
const ler = (telefoneE164: string, leadEsperadoId?: string, autorId?: string) => prisma.$transaction(tx => lerCadastroNovaConversaTx(tx, { autorId: autorId ?? vendedor.id, telefoneE164, leadEsperadoId }));
const lead = (telefoneE164: string, vendedorDonoId: string|null) => prisma.oportunidade.create({ data: { codigo: `L-LEIT-${++seq}`, nome: "Lead fictício", telefoneE164, vendedorDonoId } });
beforeAll(async () => {
 await truncarBanco(); vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor fictício"); outro = await criarUsuario([Papel.VENDEDOR], "Outro fictício"); gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente fictício");
 paisId = (await prisma.pais.create({ data: { nome: "País fictício", codigoISO: "CR", moedaLocal: "CRC", ddi: "+506" } })).id;
});
beforeEach(async () => { await prisma.usuario.update({ where: { id: vendedor.id }, data: { ativo: true, papeis: [Papel.VENDEDOR], gerenteComercialId: null } }); });
it("sem cadastro retorna flags false e JSON vazio como []", async () => { expect(await ler(tel(1))).toEqual(vazio); });
it("paridade com scopePrisma e ownerNULL fora de scope como IS NOT TRUE", async () => {
 const t = tel(2), proprio = await lead(t, vendedor.id); await lead(t, outro.id); await lead(t, null);
 await prisma.$transaction(async tx => {
  const u = { id: vendedor.id, nome: vendedor.nome, papeis: vendedor.papeis, permissoes: vendedor.permissoes };
  const expected = await tx.oportunidade.findMany({ where: { AND: [{ telefoneE164: t }, await escopoComercialAtual(u, tx)] }, orderBy: { id: "asc" }, take: 2, select: { id: true, telefoneE164: true } });
  const r = await lerCadastroNovaConversaTx(tx, { autorId: vendedor.id, telefoneE164: t }); expect(r.oportunidadesAutorizadas).toEqual(expected); expect(r.oportunidadesAutorizadas.map(o => o.id)).toEqual([proprio.id]); expect(r.oportunidadeOcultaIdentificada).toBe(true);
 });
 const nulo = tel(3); await lead(nulo, null); expect((await ler(nulo)).oportunidadeOcultaIdentificada).toBe(true); expect((await ler(nulo)).oportunidadesAutorizadas).toEqual([]);
});
it("limite2 e expected exato+telefone+scope, sem fallback para oculto", async () => {
 const t = tel(4), a = await lead(t, vendedor.id), b = await lead(t, vendedor.id), c = await lead(t, vendedor.id), oculto = await lead(t, outro.id);
 const ids = [a.id,b.id,c.id].sort(); expect((await ler(t)).oportunidadesAutorizadas.map(o => o.id)).toEqual(ids.slice(0,2));
 expect((await ler(t, c.id)).oportunidadesAutorizadas.map(o => o.id)).toEqual([c.id]); expect((await ler(t, oculto.id)).oportunidadesAutorizadas).toEqual([]); expect((await ler(tel(99),c.id)).oportunidadesAutorizadas).toEqual([]);
});
it("Pessoa/Contato/Aluno/Responsável identificados sem expor seus IDs", async () => {
 const t = tel(5), p = await prisma.pessoa.create({ data: { nome: "Pessoa fictícia" } });
 await prisma.contatoWhatsApp.create({ data: { telefoneE164: t, pessoaId: p.id } }); await prisma.aluno.create({ data: { primeiroNome: "Aluno fictício", paisId, telefoneE164: t, pessoaId: p.id } }); await prisma.responsavel.create({ data: { nome: "Responsável fictício", telefoneE164: t } });
 expect(await ler(t)).toEqual({ ...vazio, pessoaIdentificada: true, contatoIdentificado: true, alunoIdentificado: true, responsavelIdentificado: true });
});
it("witness só tuplas próprias exatas; null não é curinga e acadêmico externo permanece", async () => {
 await prisma.$transaction(async tx => {
  const t = tel(6), p = await tx.pessoa.create({ data: { nome: "Pessoa própria fictícia" } });
  const l = await tx.oportunidade.create({ data: { codigo: `L-LEIT-${++seq}`, nome: "Lead próprio fictício", telefoneE164: t, pessoaId: p.id, vendedorDonoId: vendedor.id } });
  const c = await tx.contatoWhatsApp.create({ data: { telefoneE164: t, pessoaId: p.id, leadId: l.id } });
  const proprios = { contato: { id: c.id, telefoneE164: t, pessoaId: p.id, leadId: l.id }, lead: { id: l.id, telefoneE164: t, pessoaId: p.id, vendedorDonoId: vendedor.id } };
  const entrada = { autorId: vendedor.id, telefoneE164: t, proprios };
  expect(await lerCadastroNovaConversaTx(tx, entrada)).toEqual(vazio);
  expect((await lerCadastroNovaConversaTx(tx, { ...entrada, proprios: { ...proprios, contato: { ...proprios.contato, pessoaId: null } } })).contatoIdentificado).toBe(true);
  expect((await lerCadastroNovaConversaTx(tx, { ...entrada, proprios: { ...proprios, lead: { ...proprios.lead, vendedorDonoId: outro.id } } })).oportunidadesAutorizadas.map(o => o.id)).toEqual([l.id]);
  await tx.aluno.create({ data: { primeiroNome: "Aluno externo fictício", paisId, telefoneE164: t, pessoaId: p.id } });
  const r = await lerCadastroNovaConversaTx(tx, entrada); expect(r.alunoIdentificado).toBe(true); expect(r.pessoaIdentificada).toBe(true); expect(r.contatoIdentificado).toBe(false);
 });
});
it("ator é relido: desativação e papel Portal não usam scope antigo", async () => {
 const t = tel(7); expect(await ler(t)).toEqual(vazio); await prisma.usuario.update({ where: { id: vendedor.id }, data: { ativo: false } }); await expect(ler(t)).rejects.toBeInstanceOf(ErroAutenticacao);
 await prisma.usuario.update({ where: { id: vendedor.id }, data: { ativo: true, papeis: [Papel.ALUNO] } }); await expect(ler(t)).rejects.toBeInstanceOf(ErroPermissao);
});
it("GC perde equipe em leitura nova, sem cachedtrue ou grants", async () => {
 const t = tel(8), l = await lead(t, vendedor.id); await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
 expect((await ler(t,undefined,gerente.id)).oportunidadesAutorizadas.map(o => o.id)).toEqual([l.id]); await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: null } });
 const r = await ler(t,undefined,gerente.id); expect(r.oportunidadesAutorizadas).toEqual([]); expect(r.oportunidadeOcultaIdentificada).toBe(true);
});
it("uma projeção raw por reader, custo transitive separado e nenhuma escrita", async () => {
 const operacoes: { model?: string; operation: string }[] = [];
 const antes = { pessoas: await prisma.pessoa.count(), contatos: await prisma.contatoWhatsApp.count(), leads: await prisma.oportunidade.count(), eventos: await prisma.evento.count() };
 await prisma.$transaction(async tx => {
  // Observação callthrough do tx REAL: não muda SQL/args e não usa outro cliente ou $extends.
  const observado = new Proxy(tx, { get(alvo, propriedade, receptor) {
   const valor = Reflect.get(alvo, propriedade, receptor);
   if ((propriedade === "$queryRaw" || propriedade === "$executeRaw") && typeof valor === "function") return (...args: unknown[]) => {
    operacoes.push({ operation: String(propriedade) }); return Reflect.apply(valor, alvo, args);
   };
   if (typeof propriedade === "string" && valor && typeof valor === "object" && typeof Reflect.get(valor, "findMany") === "function") return new Proxy(valor, { get(delegate, metodo, receiver) {
    const fn = Reflect.get(delegate, metodo, receiver);
    if (typeof fn !== "function") return fn;
    return (...args: unknown[]) => { operacoes.push({ model: propriedade, operation: String(metodo) }); return Reflect.apply(fn, delegate, args); };
   } });
   return valor;
  } });
  expect(await observado.$queryRaw<{ canario: number }[]>(Prisma.sql`SELECT 1::int AS "canario"`)).toEqual([{ canario: 1 }]);
  expect(operacoes).toEqual([{ operation: "$queryRaw" }]);
  operacoes.length = 0; // Canary não pertence ao custo do reader.
  expect(await lerCadastroNovaConversaTx(observado, { autorId: vendedor.id, telefoneE164: tel(9) })).toEqual(vazio);
  expect(operacoes.filter(o => o.operation === "$queryRaw")).toHaveLength(1);
  expect(operacoes).toEqual([{ model: "usuario", operation: "findUnique" }, { model: "coberturaCarteira", operation: "findMany" }, { operation: "$queryRaw" }]);
  // Três leituras deste caminho vendedor: actor + scope + projeção. Não é um SELECT total.
  // BEGIN/COMMIT e SET CONSTRAINTS do wrapper fora do callback observado não são contados.
 });
 expect({ pessoas: await prisma.pessoa.count(), contatos: await prisma.contatoWhatsApp.count(), leads: await prisma.oportunidade.count(), eventos: await prisma.evento.count() }).toEqual(antes);
});
