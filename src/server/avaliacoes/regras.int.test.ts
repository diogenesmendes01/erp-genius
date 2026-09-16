import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { consultarRegrasAvaliacao, decidirRegraAvaliacao, prepararRegraAvaliacao, listarNiveisRegrasAvaliacao } from "./regras";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";

let gestor: string, outro: string, nivelId: string;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const entrada = () => ({ nivelId, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(), motivo: "Proposta institucional fictícia", chaveIdempotencia: "regra-avaliacao-teste-1" });
beforeEach(async () => {
  await truncarBanco();
  gestor = (await criarUsuario(["GERENTE_PEDAGOGICO"], "Preparador")).id;
  outro = (await criarUsuario(["GERENTE_PEDAGOGICO"], "Conferente")).id;
  const idioma = await prisma.idioma.create({ data: { nome: "Idioma de teste" } });
  nivelId = (await prisma.nivel.create({ data: { idiomaId: idioma.id, codigo: "A1", ordem: 1 } })).id;
  entrar(gestor);
});
async function criar(d = entrada()) {
  const r = await prepararRegraAvaliacao(d);
  expect(r.ok).toBe(true);
  if (!r.ok || !r.dado) throw new Error("Proposta ausente");
  return prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: r.dado.id } });
}
const decisao = (r: { id: string; conteudoHash: string }) => ({ regraId: r.id, conteudoHash: r.conteudoHash, aprovada: true, motivo: "Conferência independente dos critérios" });

it("prepara, confere e publica sem reescrever versão; repetição não duplica decisão ou evento", async () => {
  const r = await criar();
  expect(await consultarRegrasAvaliacao({ nivelId })).toMatchObject({ ok: true, dado: { vigente: null, regras: [{ podeDecidir: false }] } });
  entrar(outro);
  const d = await decidirRegraAvaliacao(decisao(r));
  expect(d.ok).toBe(true);
  expect(await decidirRegraAvaliacao(decisao(r))).toEqual(d);
  expect(await consultarRegrasAvaliacao({ nivelId })).toMatchObject({ ok: true, dado: { vigente: { id: r.id, versao: 1 }, regras: [{ conteudo: regraAvaliacaoTeste(), decisao: { aprovada: true } }] } });
  expect(await prisma.evento.count({ where: { agregadoId: r.id } })).toBe(2);
  expect(await prisma.decisaoRegraAvaliacao.count()).toBe(1);
  await expect(prisma.versaoRegraAvaliacao.update({ where: { id: r.id }, data: { conteudo: {} } })).rejects.toThrow("imutáveis");
  await expect(prisma.versaoRegraAvaliacao.delete({ where: { id: r.id } })).rejects.toThrow("imutáveis");
  await expect(prisma.decisaoRegraAvaliacao.updateMany({ data: { motivo: "Alteração" } })).rejects.toThrow("imutáveis");
  await expect(prisma.decisaoRegraAvaliacao.deleteMany()).rejects.toThrow("imutáveis");
  expect(await prisma.turma.count()).toBe(0);
});

it("veda autoaprovação por acúmulo de papéis, também no banco", async () => {
  await prisma.usuario.update({ where: { id: gestor }, data: { papeis: ["GERENTE_PEDAGOGICO", "ADMINISTRADOR"] } });
  const r = await criar();
  expect(await decidirRegraAvaliacao(decisao(r))).toMatchObject({ ok: false, erro: expect.stringContaining("Outra pessoa") });
  await expect(prisma.decisaoRegraAvaliacao.create({ data: { regraId: r.id, decisorId: gestor, aprovada: true, motivo: "Acesso direto" } })).rejects.toThrow("independente");
  expect(await prisma.decisaoRegraAvaliacao.count()).toBe(0);
});

it("aceita Administração independente e recusa hash de outra revisão", async () => {
  const r = await criar();
  entrar((await criarUsuario(["ADMINISTRADOR"])).id);
  expect((await decidirRegraAvaliacao({ ...decisao(r), conteudoHash: "0".repeat(64) })).ok).toBe(false);
  expect(await prisma.decisaoRegraAvaliacao.count()).toBe(0);
  expect((await decidirRegraAvaliacao(decisao(r))).ok).toBe(true);
});

it("reenvios concorrentes preservam uma proposta; chaves e versões obsoletas são recusadas", async () => {
  const d = entrada();
  const r = await Promise.all([1, 2].map(() => prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestor, d))));
  expect(r[0]).toEqual(r[1]);
  expect(await prepararRegraAvaliacao(d)).toEqual({ ok: true, dado: r[0] });
  expect((await prepararRegraAvaliacao({ ...d, motivo: "Outra proposta com mesma chave" })).ok).toBe(false);
  expect((await prepararRegraAvaliacao({ ...d, chaveIdempotencia: "outra-chave-teste" })).ok).toBe(false);
  expect(await prisma.versaoRegraAvaliacao.count()).toBe(1);
  expect(await prisma.evento.count({ where: { tipo: "RegraAvaliacaoProposta" } })).toBe(1);
});

it("conferentes concorrentes não produzem decisões opostas", async () => {
  const r = await criar();
  const terceiro = (await criarUsuario(["ADMINISTRADOR"])).id;
  const resultados = await Promise.allSettled([
    prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, outro, decisao(r))),
    prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, terceiro, { ...decisao(r), aprovada: false })),
  ]);
  expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(resultados.filter(r => r.status === "rejected")).toHaveLength(1);
  expect(await prisma.decisaoRegraAvaliacao.count()).toBe(1);
  expect(await prisma.evento.count({ where: { agregadoId: r.id } })).toBe(2);
});

it("rejeitar nova versão preserva a vigente e impede publicar proposta superada", async () => {
  const r1 = await criar(); entrar(outro);
  expect((await decidirRegraAvaliacao(decisao(r1))).ok).toBe(true);
  entrar(gestor);
  const r2 = await criar({ ...entrada(), versaoEsperada: 1, chaveIdempotencia: "proposta-regra-2" });
  const r3 = await criar({ ...entrada(), versaoEsperada: 2, chaveIdempotencia: "proposta-regra-3" });
  entrar(outro);
  expect((await decidirRegraAvaliacao(decisao(r2))).ok).toBe(false);
  await expect(prisma.decisaoRegraAvaliacao.create({ data: { regraId: r2.id, decisorId: outro, aprovada: true, motivo: "Via banco" } })).rejects.toThrow("mais recente");
  expect((await decidirRegraAvaliacao({ ...decisao(r3), aprovada: false })).ok).toBe(true);
  expect(await consultarRegrasAvaliacao({ nivelId })).toMatchObject({ ok: true, dado: { vigente: { id: r1.id }, regras: [{ versao: 3, decisao: { aprovada: false } }, { versao: 2, decisao: null }, { versao: 1, decisao: { aprovada: true } }] } });
});

it("recusa outros papéis, estado revogado e replay de usuário desativado", async () => {
  const r = await criar();
  for (const papel of ["SECRETARIA_ACADEMICA", "PROFESSOR", "VENDEDOR", "FINANCEIRO"] as const) {
    const u = await criarUsuario([papel]); entrar(u.id);
    expect((await prepararRegraAvaliacao(entrada())).ok).toBe(false);
    expect((await decidirRegraAvaliacao(decisao(r))).ok).toBe(false);
    expect((await consultarRegrasAvaliacao({ nivelId })).ok).toBe(false);
    expect((await listarNiveisRegrasAvaliacao()).ok).toBe(false);
    await expect(prisma.decisaoRegraAvaliacao.create({ data: { regraId: r.id, decisorId: u.id, aprovada: true, motivo: "Via banco" } })).rejects.toThrow("gestão pedagógica");
  }
  await prisma.usuario.update({ where: { id: gestor }, data: { ativo: false } }); entrar(gestor);
  expect((await prepararRegraAvaliacao(entrada())).ok).toBe(false);
  await expect(prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestor, entrada()))).rejects.toThrow("permissão");
  await prisma.usuario.update({ where: { id: outro }, data: { papeis: ["PROFESSOR"] } }); entrar(outro);
  expect((await decidirRegraAvaliacao(decisao(r))).ok).toBe(false);
});

it("pagina histórico sem expor chaves e preserva separação por nível", async () => {
  for (let i = 0; i < 21; i++) await criar({ ...entrada(), versaoEsperada: i, chaveIdempotencia: `historico-avaliacao-${i}` });
  const p1 = await consultarRegrasAvaliacao({ nivelId }), p2 = await consultarRegrasAvaliacao({ nivelId, pagina: 2 });
  if (!p1.ok || !p1.dado || !p2.ok || !p2.dado) throw new Error("Histórico ausente");
  expect(p1.dado.regras.map(r => r.versao)).toEqual(Array.from({ length: 20 }, (_, i) => 21 - i));
  expect(p1.dado.temProxima).toBe(true);
  expect(p2.dado.regras.map(r => r.versao)).toEqual([1]);
  expect(p2.dado.temProxima).toBe(false);
  expect(p1.dado.regras[0]).not.toHaveProperty("chaveIdempotencia");
  expect(p1.dado.regras[0]).not.toHaveProperty("entradaHash");
  const nivel = await prisma.nivel.findUniqueOrThrow({ where: { id: nivelId } });
  const outroNivel = await prisma.nivel.create({ data: { idiomaId: nivel.idiomaId, codigo: "A2", ordem: 2 } });
  expect(await consultarRegrasAvaliacao({ nivelId: outroNivel.id })).toMatchObject({ ok: true, dado: { vigente: null, regras: [] } });
  expect((await consultarRegrasAvaliacao({ nivelId, pagina: 0 })).ok).toBe(false);
});

it("recusa regra incompleta e nível inexistente antes de persistir", async () => {
  const d = entrada();
  d.conteudo.habilidades[0].peso = "0";
  expect((await prepararRegraAvaliacao(d)).ok).toBe(false);
  expect((await prepararRegraAvaliacao({ ...entrada(), nivelId: "inexistente" })).ok).toBe(false);
  expect(await prisma.versaoRegraAvaliacao.count()).toBe(0);
  expect(await prisma.evento.count({ where: { agregadoTipo: "RegraAvaliacao" } })).toBe(0);
});

it("busca níveis para a tela com paginação e projeção limitada", async () => {
  const nivel = await prisma.nivel.findUniqueOrThrow({ where: { id: nivelId } });
  await prisma.nivel.createMany({ data: Array.from({ length: 30 }, (_, i) => ({ idiomaId: nivel.idiomaId, codigo: `Teste ${i + 2}`, ordem: i + 2 })) });
  const p1 = await listarNiveisRegrasAvaliacao({ busca: "Idioma de teste" }), p2 = await listarNiveisRegrasAvaliacao({ pagina: 2 });
  if (!p1.ok || !p1.dado || !p2.ok || !p2.dado) throw new Error("Níveis ausentes");
  expect(p1.dado.niveis).toHaveLength(30); expect(p1.dado.temProxima).toBe(true);
  expect(p2.dado.niveis).toHaveLength(1); expect(p2.dado.temProxima).toBe(false);
  expect(Object.keys(p1.dado.niveis[0]).sort()).toEqual(["codigo", "id", "idioma"]);
  expect(await listarNiveisRegrasAvaliacao({ busca: "A1" })).toMatchObject({ ok: true, dado: { niveis: [{ id: nivelId }] } });
  expect((await listarNiveisRegrasAvaliacao({ pagina: 0 })).ok).toBe(false);
  expect((await consultarRegrasAvaliacao({ nivelId: "inexistente" })).ok).toBe(false);
});
