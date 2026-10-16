import { describe, it, expect, beforeEach } from "vitest";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import { carregarFunil, lerFiltrosFunil } from "./funil";
import { TIPOS_MUDAM_ETAPA } from "@/server/comercial/schema";
import { COLUNAS_FUNIL } from "./etapas";

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let outro: Awaited<ReturnType<typeof criarUsuario>>;
let gerente: Awaited<ReturnType<typeof criarUsuario>>;
const sessaoDe = (u: { id: string; nome: string; papeis: Papel[] }) => ({ id: u.id, nome: u.nome, papeis: u.papeis });

beforeEach(async () => {
  await truncarBanco();
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  outro = await criarUsuario([Papel.VENDEDOR], "Outro");
  await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
  const br = await prisma.pais.create({ data: { nome: "Brasil", codigoISO: "BR", moedaLocal: "BRL", ddi: "+55" } });
  const cr = await prisma.pais.create({ data: { nome: "Costa Rica", codigoISO: "CR", moedaLocal: "CRC", ddi: "+506" } });
  const mk = (nome: string, extra: Record<string, unknown>) =>
    prisma.oportunidade.create({ data: { nome, vendedorDonoId: vendedor.id, ...extra } as never });
  await mk("Novo BR 1", { paisId: br.id, valorPrevisto: "100.00" });
  await mk("Novo BR 2", { paisId: br.id, valorPrevisto: "200.00" });
  await mk("Novo CR", { paisId: cr.id, valorPrevisto: "85000.00" });
  await mk("Faltou", { etapa: "NO_SHOW" });
  await prisma.oportunidade.create({ data: { nome: "Alheio", vendedorDonoId: outro.id, paisId: br.id, valorPrevisto: "999.00" } });
  const velho = await mk("Perdido há 100 dias", { etapa: "PERDIDO", criadoEm: new Date(Date.now() - 100 * 86_400_000) });
  const recente = await mk("Perdido há 10 dias", { etapa: "PERDIDO", criadoEm: new Date(Date.now() - 100 * 86_400_000) });
  const evento = (id: string, dias: number) =>
    prisma.evento.create({
      data: { tipo: "LeadPerdido", agregadoTipo: "Lead", agregadoId: id, payload: {}, criadoEm: new Date(Date.now() - dias * 86_400_000) },
    });
  await evento(velho.id, 100);
  await evento(recente.id, 10);
});

describe("carregarFunil", () => {
  it("vendedor vê só a carteira; soma é por moeda; NO_SHOW tem coluna", async () => {
    const colunas = await carregarFunil(sessaoDe(vendedor), lerFiltrosFunil({}));
    expect(colunas.map((c) => c.etapa)).toEqual(COLUNAS_FUNIL);
    expect(colunas.flatMap((c) => c.cartoes).every((c) => c.dono?.id === vendedor.id)).toBe(true);
    expect(colunas.find((c) => c.etapa === "NOVO")!.somaPorMoeda).toEqual([{ moeda: "BRL", valor: "300.00" }, { moeda: "CRC", valor: "85000.00" }]);
    expect(colunas.find((c) => c.etapa === "NO_SHOW")!.total).toBe(1);
  });
  it("perdidos respeitam o período pela última ação", async () => {
    const c = await carregarFunil(sessaoDe(gerente), lerFiltrosFunil({ perdidosDias: "30" }));
    expect(c.find((x) => x.etapa === "PERDIDO")!.cartoes.map((x) => x.nome)).toEqual(["Perdido há 10 dias"]);
    expect(c.find((x) => x.etapa === "PERDIDO")!.total).toBe(1);
  });
  it("ordem tempo usa a data da última mudança de etapa, não a criação", async () => {
    const a = await prisma.oportunidade.findFirstOrThrow({ where: { nome: "Novo BR 1" } });
    const b = await prisma.oportunidade.findFirstOrThrow({ where: { nome: "Novo BR 2" } });
    await prisma.oportunidade.update({ where: { id: a.id }, data: { criadoEm: new Date(Date.now() - 50 * 86_400_000) } });
    await prisma.oportunidade.update({ where: { id: b.id }, data: { criadoEm: new Date(Date.now() - 40 * 86_400_000) } });
    // A é mais antiga, mas entrou na etapa agora; B entrou há 30 dias.
    const tipo = TIPOS_MUDAM_ETAPA[0];
    await prisma.evento.create({ data: { tipo, agregadoTipo: "Lead", agregadoId: a.id, payload: {}, criadoEm: new Date() } });
    await prisma.evento.create({ data: { tipo, agregadoTipo: "Lead", agregadoId: b.id, payload: {}, criadoEm: new Date(Date.now() - 30 * 86_400_000) } });
    const c = await carregarFunil(sessaoDe(vendedor), lerFiltrosFunil({ ordem: "tempo" }));
    const nomes = c.find((x) => x.etapa === "NOVO")!.cartoes.map((x) => x.nome);
    expect(nomes.indexOf("Novo BR 2")).toBeLessThan(nomes.indexOf("Novo BR 1"));
    expect(nomes[nomes.length - 1]).toBe("Novo BR 1");
  });
  it("busca por palavras e filtro de tag pela pessoa titular", async () => {
    const tag = await prisma.tag.create({ data: { nome: "VIP", cor: "MARCA" } });
    const pessoa = await prisma.pessoa.create({ data: { nome: "Titular", tags: { create: { tagId: tag.id } } } });
    await prisma.oportunidade.updateMany({ where: { nome: "Novo CR" }, data: { pessoaId: pessoa.id } });
    const c = await carregarFunil(sessaoDe(vendedor), lerFiltrosFunil({ tagId: tag.id }));
    const novo = c.find((x) => x.etapa === "NOVO")!;
    expect(novo.cartoes.map((x) => x.nome)).toEqual(["Novo CR"]);
    expect(novo.cartoes[0].tags.map((t) => t.nome)).toEqual(["VIP"]);
    const b = await carregarFunil(sessaoDe(vendedor), lerFiltrosFunil({ busca: "novo br" }));
    expect(b.find((x) => x.etapa === "NOVO")!.total).toBe(2);
  });
});
