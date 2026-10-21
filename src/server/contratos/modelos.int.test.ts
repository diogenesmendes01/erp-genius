import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { prepararModeloContratual, decidirModeloContratual, consultarModelosContratuais, listarFamiliasModelos } from "./modelos";
import { prepararModeloTx } from "./modelos-tx";
import { ConteudoModeloSchema } from "./modelo-schema";

let secretaria: string, admin: string;
const conteudo = () => ConteudoModeloSchema.parse({
  titulo: "Contrato de teste", finalidade: "CONTRATO", regimes: ["MENSALIDADE"],
  aplicacao: "Modelo fictício usado somente nos testes automatizados.",
  campos: [{ chave: "aluno_nome", descricao: "Nome completo conferido" }],
  secoes: [{ titulo: "Identificação", texto: "Aluno: {{aluno_nome}}." }],
  assinaturas: [{ papel: "ALUNO", condicao: "ALUNO_MAIOR" }, { papel: "REPRESENTANTE_LEGAL", condicao: "ALUNO_MENOR" }],
});
const entrada = () => ({ codigo: "TESTE", versaoEsperada: 0, conteudo: conteudo(), motivo: "Preparar versão para conferência", chaveIdempotencia: "modelo-proposta-1" });
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
beforeEach(async () => {
  await truncarBanco();
  secretaria = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  admin = (await criarUsuario(["ADMINISTRADOR"])).id;
  entrar(secretaria);
});
async function criar() {
  const r = await prepararModeloContratual(entrada());
  expect(r.ok).toBe(true);
  if (!r.ok || !r.dado) throw new Error("Proposta ausente");
  return prisma.versaoModeloContratual.findUniqueOrThrow({ where: { id: r.dado.id } });
}
it("prepara sem publicar, publica por outro administrador e preserva conteúdo/histórico", async () => {
  const m = await criar();
  expect(await prisma.decisaoModeloContratual.count()).toBe(0);
  const d = { modeloId: m.id, conteudoHash: m.conteudoHash, aprovada: true, motivo: "Conteúdo institucional conferido" };
  expect((await decidirModeloContratual(d)).ok).toBe(false);
  entrar(admin);
  const publicada = await decidirModeloContratual(d);
  expect(publicada.ok).toBe(true); expect(await decidirModeloContratual(d)).toEqual(publicada);
  expect(await prisma.decisaoModeloContratual.count()).toBe(1);
  const consulta = await consultarModelosContratuais({ codigo: "TESTE" });
  expect(consulta.modelos[0]).toMatchObject({ conteudo: conteudo(), decisao: { aprovada: true } });
  expect(consulta.modelos[0]).not.toHaveProperty("chaveIdempotencia");
  await expect(prisma.versaoModeloContratual.update({ where: { id: m.id }, data: { conteudo: {} } })).rejects.toThrow("imutáveis");
  await expect(prisma.decisaoModeloContratual.deleteMany()).rejects.toThrow("imutáveis");
  expect(await prisma.documento.count()).toBe(0);
});
it("nega autoaprovação mesmo acumulando Administração e Secretaria, também no banco", async () => {
  await prisma.usuario.update({ where: { id: secretaria }, data: { papeis: ["SECRETARIA_ACADEMICA", "ADMINISTRADOR"] } });
  const m = await criar();
  expect(await decidirModeloContratual({ modeloId: m.id, conteudoHash: m.conteudoHash, aprovada: true, motivo: "Tentativa de autoaprovação" })).toMatchObject({ ok: false, erro: expect.stringContaining("Outra pessoa") });
  await expect(prisma.decisaoModeloContratual.create({ data: { modeloId: m.id, decisorId: secretaria, aprovada: true, motivo: "Acesso direto" } })).rejects.toThrow("independente");
});
it("protege chave idempotente, versão concorrente e decisão sobre hash diferente", async () => {
  const d = entrada();
  const resultados = await Promise.all([1, 2].map(() => prisma.$transaction((tx) => prepararModeloTx(tx, secretaria, d))));
  expect(resultados[0]).toEqual(resultados[1]);
  expect(await prepararModeloContratual(d)).toEqual({ ok: true, dado: resultados[0] });
  expect(await prisma.versaoModeloContratual.count()).toBe(1);
  expect((await prepararModeloContratual({ ...d, motivo: "Conteúdo de outra tentativa" })).ok).toBe(false);
  expect((await prepararModeloContratual({ ...d, chaveIdempotencia: "modelo-outra-chave" })).ok).toBe(false);
  const m = await prisma.versaoModeloContratual.findFirstOrThrow(); entrar(admin);
  expect((await decidirModeloContratual({ modeloId: m.id, conteudoHash: "0".repeat(64), aprovada: true, motivo: "Hash de conteúdo diferente" })).ok).toBe(false);
  expect(await prisma.decisaoModeloContratual.count()).toBe(0);
});
it("nova versão e rejeição não sobrescrevem publicação anterior", async () => {
  const m = await criar(); entrar(admin);
  expect((await decidirModeloContratual({ modeloId: m.id, conteudoHash: m.conteudoHash, aprovada: true, motivo: "Publicação versão original" })).ok).toBe(true);
  entrar(secretaria);
  const nova = await prepararModeloContratual({ ...entrada(), versaoEsperada: 1, chaveIdempotencia: "modelo-proposta-2", conteudo: { ...conteudo(), titulo: "Segunda versão" } });
  expect(nova).toMatchObject({ ok: true, dado: { versao: 2 } });
  const m2 = await prisma.versaoModeloContratual.findFirstOrThrow({ where: { versao: 2 } }); entrar(admin);
  expect((await decidirModeloContratual({ modeloId: m2.id, conteudoHash: m2.conteudoHash, aprovada: false, motivo: "Revisar texto antes da publicação" })).ok).toBe(true);
  expect((await consultarModelosContratuais({ codigo: "TESTE" })).modelos.map((v) => [v.versao, v.decisao?.aprovada])).toEqual([[2, false], [1, true]]);
});
it("vendedor e professor não acessam modelos; revogação vale na próxima ação", async () => {
  for (const papel of ["VENDEDOR", "PROFESSOR"] as const) {
    entrar((await criarUsuario([papel])).id);
    expect((await prepararModeloContratual(entrada())).ok).toBe(false);
    await expect(consultarModelosContratuais({ codigo: "TESTE" })).rejects.toThrow("permissão");
    await expect(listarFamiliasModelos()).rejects.toThrow("permissão");
  }
  entrar(secretaria); await prisma.usuario.update({ where: { id: secretaria }, data: { ativo: false } });
  expect((await prepararModeloContratual(entrada())).ok).toBe(false);
  expect(await prisma.versaoModeloContratual.count()).toBe(0);
});
it("pagina famílias e histórico sem omitir versões nem expor conteúdo na listagem", async () => {
  for (let i = 0; i < 21; i++) {
    const codigo = `MODELO_${String(i).padStart(2, "0")}`;
    await prisma.$transaction((tx) => prepararModeloTx(tx, secretaria, { ...entrada(), codigo, chaveIdempotencia: `familia-${codigo}` }));
  }
  const primeira = await listarFamiliasModelos(), segunda = await listarFamiliasModelos({ pagina: 2 });
  expect(primeira.familias).toHaveLength(20); expect(primeira.temProxima).toBe(true);
  expect(segunda.familias).toEqual([{ codigo: "MODELO_20", ultimaVersao: 1, quantidade: 1 }]); expect(segunda.temProxima).toBe(false);
  expect(primeira.familias[0]).not.toHaveProperty("conteudo");
  for (let i = 1; i <= 20; i++) {
    await prisma.$transaction((tx) => prepararModeloTx(tx, secretaria, { ...entrada(), codigo: "MODELO_00", versaoEsperada: i, chaveIdempotencia: `historico-versao-${i}` }));
  }
  expect((await consultarModelosContratuais({ codigo: "MODELO_00" })).modelos.map((m) => m.versao)).toEqual(Array.from({ length: 20 }, (_, i) => 21 - i));
  const historico = await consultarModelosContratuais({ codigo: "MODELO_00", pagina: 2 });
  expect(historico.modelos.map((m) => m.versao)).toEqual([1]); expect(historico.temProxima).toBe(false);
  expect((await listarFamiliasModelos()).familias[0]).toMatchObject({ ultimaVersao: 21, quantidade: 21 });
});
it("bloqueia campos não declarados, expressões e regras de assinatura duplicadas", async () => {
  const d = entrada();
  expect((await prepararModeloContratual({ ...d, conteudo: { ...d.conteudo, secoes: [{ titulo: "Dados", texto: "{{campo_inexistente}}" }] } })).ok).toBe(false);
  expect((await prepararModeloContratual({ ...d, conteudo: { ...d.conteudo, secoes: [{ titulo: "Dados", texto: "{{valor * 2}}" }] } })).ok).toBe(false);
  expect((await prepararModeloContratual({ ...d, conteudo: { ...d.conteudo, assinaturas: [d.conteudo.assinaturas[0], d.conteudo.assinaturas[0]] } })).ok).toBe(false);
  expect(await prisma.versaoModeloContratual.count()).toBe(0);
});
