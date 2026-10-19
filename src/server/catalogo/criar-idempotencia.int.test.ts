import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { Papel, TipoCobranca } from "@prisma/client";

// #166 (2º lote): os cadastros de criação do catálogo (idioma, nível, modalidade, produto e preço) recebem
// chave de idempotência. O reenvio com a mesma chave devolve o registro já criado: não duplica opções do
// formulário de matrícula nem aposenta o preço de referência que a própria tentativa acabou de criar.

// Sessão: `exigirSessao` e `exigirSessaoComPapel` trocadas (a segunda chama a primeira dentro do módulo);
// os papéis continuam lidos do banco. Mesmo motivo de comercial/criar-lead-idempotencia.int.test.ts.
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  const exigirSessao = async () => {
    const u = await o.carregarUsuarioFresco(sessao.usuarioId);
    if (!u) throw new o.ErroAutenticacao();
    return u;
  };
  return {
    ...o,
    exigirSessao,
    exigirSessaoComPapel: async (...alvo: Papel[]) => {
      const u = await exigirSessao();
      o.exigirPapel(u, ...alvo);
      return u;
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { criarIdioma, criarModalidade, criarNivel, criarPreco, criarProduto } from "./acoes";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";

let gestor: Awaited<ReturnType<typeof criarUsuario>>;
let outroGestor: Awaited<ReturnType<typeof criarUsuario>>;
let paisId: string;
let idiomaId: string;
let modalidadeId: string;
let produtoId: string;

async function contagens() {
  return {
    idiomas: await prisma.idioma.count(),
    niveis: await prisma.nivel.count(),
    modalidades: await prisma.modalidade.count(),
    produtos: await prisma.produto.count(),
    precos: await prisma.precoReferencia.count(),
    precosAtivos: await prisma.precoReferencia.count({ where: { ativo: true } }),
    eventos: await prisma.evento.count(),
  };
}

beforeAll(async () => {
  await truncarBanco();
  gestor = await criarUsuario([Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO], "Gestor");
  outroGestor = await criarUsuario([Papel.ADMINISTRADOR, Papel.GERENTE_PEDAGOGICO], "Outro gestor");
  paisId = (await prisma.pais.create({ data: { nome: "Costa Rica", codigoISO: "CR", moedaLocal: "CRC", ddi: "+506" } })).id;
  idiomaId = (await prisma.idioma.create({ data: { nome: "Base" } })).id;
  modalidadeId = (await prisma.modalidade.create({ data: { nome: "Base", frequencia: "1x/semana", duracaoPorNivel: "3 meses" } })).id;
  produtoId = (await prisma.produto.create({ data: { idiomaId, modalidadeId } })).id;
});

beforeEach(() => {
  sessao.usuarioId = gestor.id;
});

const modalidade = (nome: string) => ({ nome, frequencia: "2x/semana", duracaoPorNivel: "3 meses", horasAula: 2, minimoAbrir: 1 });
const preco = (valor: number, tipoCobranca: TipoCobranca = TipoCobranca.MENSALIDADE) => ({ paisId, produtoId, tipoCobranca, valor });

describe("cadastros do catálogo com chave de idempotência (#166)", () => {
  it("a mesma chave duas vezes cria um registro e um Evento em cada cadastro, e devolve o mesmo resultado", async () => {
    const paraProduto = (await prisma.modalidade.create({ data: { nome: "Para produto", frequencia: "1x", duracaoPorNivel: "1 mês" } })).id;
    const cadastros = [
      { nome: "idioma", criar: () => criarIdioma({ nome: "Alemão", chaveIdempotencia: "chave-idioma-0001" }) },
      { nome: "nível", criar: () => criarNivel({ idiomaId, codigo: "B2", ordem: 4, chaveIdempotencia: "chave-nivel-0001" }) },
      { nome: "modalidade", criar: () => criarModalidade({ ...modalidade("Intensiva"), chaveIdempotencia: "chave-modal-0001" }) },
      { nome: "produto", criar: () => criarProduto({ idiomaId, modalidadeId: paraProduto, chaveIdempotencia: "chave-produto-0001" }) },
      { nome: "preço", criar: () => criarPreco({ ...preco(90000), chaveIdempotencia: "chave-preco-0001" }) },
    ];
    for (const c of cadastros) {
      const antes = await contagens();
      const primeira = await c.criar();
      expect(primeira.ok, `${c.nome}: ${primeira.ok ? "" : primeira.erro}`).toBe(true);
      const depoisDaPrimeira = await contagens();
      expect(depoisDaPrimeira.eventos - antes.eventos, c.nome).toBe(1);
      expect(await c.criar(), c.nome).toEqual(primeira);
      expect(await contagens(), c.nome).toEqual(depoisDaPrimeira);
    }
  });

  it("o reenvio do preço não aposenta o preço que a própria tentativa criou", async () => {
    const entrada = { ...preco(70000, TipoCobranca.MATRICULA), chaveIdempotencia: "chave-preco-0002" };
    const primeira = await criarPreco(entrada);
    expect(primeira.ok).toBe(true);
    expect(await criarPreco(entrada)).toEqual(primeira);
    const ativos = await prisma.precoReferencia.findMany({ where: { paisId, produtoId, tipoCobranca: TipoCobranca.MATRICULA, ativo: true } });
    expect(ativos.map((p) => p.id)).toEqual([primeira.ok ? primeira.dado!.id : ""]);
    expect(await prisma.evento.count({ where: { tipo: "PrecoDefinido", agregadoId: ativos[0].id } })).toBe(1);
  });

  it("dois envios simultâneos com a mesma chave criam um só registro", async () => {
    const antes = await contagens();
    const [a, b] = await Promise.all([
      criarPreco({ ...preco(95000), chaveIdempotencia: "chave-preco-0003" }),
      criarPreco({ ...preco(95000), chaveIdempotencia: "chave-preco-0003" }),
    ]);
    const [c, d] = await Promise.all([
      criarIdioma({ nome: "Italiano", chaveIdempotencia: "chave-idioma-0003" }),
      criarIdioma({ nome: "Italiano", chaveIdempotencia: "chave-idioma-0003" }),
    ]);
    const nova = (await prisma.modalidade.create({ data: { nome: "Simultânea", frequencia: "1x", duracaoPorNivel: "1 mês" } })).id;
    const [e, f] = await Promise.all([
      criarProduto({ idiomaId, modalidadeId: nova, chaveIdempotencia: "chave-produto-0003" }),
      criarProduto({ idiomaId, modalidadeId: nova, chaveIdempotencia: "chave-produto-0003" }),
    ]);
    expect([a, b, c, d, e, f].every((r) => r.ok), JSON.stringify([a, b, c, d, e, f])).toBe(true);
    expect([b, d, f]).toEqual([a, c, e]);
    const depois = await contagens();
    expect(depois.precos - antes.precos).toBe(1);
    expect(depois.idiomas - antes.idiomas).toBe(1);
    expect(depois.produtos - antes.produtos).toBe(1);
  });

  it("recusa a mesma chave com outra entrada, sem gravar nada", async () => {
    expect((await criarIdioma({ nome: "Russo", chaveIdempotencia: "chave-idioma-0004" })).ok).toBe(true);
    expect((await criarPreco({ ...preco(80000), chaveIdempotencia: "chave-preco-0004" })).ok).toBe(true);
    expect((await criarNivel({ idiomaId, codigo: "C1", ordem: 5, chaveIdempotencia: "chave-nivel-0004" })).ok).toBe(true);
    const antes = await contagens();
    const recusas = [
      await criarIdioma({ nome: "Russo (2)", chaveIdempotencia: "chave-idioma-0004" }),
      await criarPreco({ ...preco(81000), chaveIdempotencia: "chave-preco-0004" }),
      await criarNivel({ idiomaId, codigo: "C2", ordem: 6, chaveIdempotencia: "chave-nivel-0004" }),
    ];
    for (const r of recusas) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro).toMatch(/já foi usada/);
    }
    expect(await contagens()).toEqual(antes);
  });

  it("a chave é de cada autor; sem chave continua criando como antes", async () => {
    const antes = await contagens();
    expect((await criarIdioma({ nome: "Grego", chaveIdempotencia: "chave-idioma-0005" })).ok).toBe(true);
    sessao.usuarioId = outroGestor.id;
    expect((await criarIdioma({ nome: "Grego", chaveIdempotencia: "chave-idioma-0005" })).ok).toBe(true);
    expect((await criarIdioma({ nome: "Sem chave" })).ok).toBe(true);
    expect((await criarIdioma({ nome: "Sem chave" })).ok).toBe(true);
    expect((await contagens()).idiomas - antes.idiomas).toBe(4);
  });
});
