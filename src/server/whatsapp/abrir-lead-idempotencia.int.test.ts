import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriverWhatsApp, Papel } from "@prisma/client";

// #166 (4º lote), Inbox:
// - Abrir atendimento institucional: o atendimento é por upsert, mas cada abertura gravava outro
//   AtendimentoInstitucionalAberto. Com chave, o reenvio devolve o mesmo atendimento sem Evento novo.
// - Criar oportunidade pela conversa: o reenvio (inclusive simultâneo) devolve a mesma oportunidade, com o mesmo
//   `criado`, em vez de "Esta conversa já tem lead.", e não grava outro ContatoVinculado.

// Sessão: só `exigirSessao`/`exigirSessaoComPapel` são trocadas (mesmo motivo de
// comercial/criar-lead-idempotencia.int.test.ts); os papéis continuam lidos do banco.
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  const exigirSessao = async () => {
    const u = await o.carregarUsuarioFresco(sessao.usuarioId);
    if (!u) throw new o.ErroAutenticacao();
    return u;
  };
  return { ...o, exigirSessao, exigirSessaoComPapel: async (...papeis: Papel[]) => { const u = await exigirSessao(); o.exigirPapel(u, ...papeis); return u; } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { seedCanal, seedCobranca } from "@/test/integracao-whatsapp";
import { listaDoInbox } from "@/test/inbox-consultas";
import { abrirAtendimentoInstitucional } from "./operacoes-atendimento";
import { criarLeadDaConversa } from "./acoes";
import { processarMensagemNormalizada } from "./inbound";

beforeEach(async () => { await truncarBanco(); sessao.usuarioId = ""; });

describe("abrirAtendimentoInstitucional com chave (#166)", () => {
  async function base() {
    const canal = await seedCanal();
    const c = await seedCobranca({ vencimento: new Date("2026-10-10T12:00:00Z"), responsavelTelefone: "+50680001111" });
    const fin = await criarUsuario([Papel.FINANCEIRO], "Fin");
    sessao.usuarioId = fin.id;
    return { numeroId: canal.numero.id, destinoChave: `FINANCEIRO:${c.matricula.id}`, secretaria: `SECRETARIA:${c.aluno.id}` };
  }
  const abertos = () => prisma.evento.count({ where: { tipo: "AtendimentoInstitucionalAberto" } });

  it("a mesma chave, inclusive simultânea, devolve o mesmo atendimento com um Evento", async () => {
    const { numeroId, destinoChave } = await base();
    const entrada = { numeroId, destinoChave, chaveIdempotencia: "chave-abrir-01" };
    const [a, b] = await Promise.all([abrirAtendimentoInstitucional(entrada), abrirAtendimentoInstitucional(entrada)]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(b).toEqual(a);
    expect(await abrirAtendimentoInstitucional(entrada)).toEqual(a);
    expect(await prisma.atendimentoWhatsApp.count()).toBe(1);
    expect(await abertos()).toBe(1);
  });

  it("recusa a mesma chave com outro destino, sem gravar; sem chave segue gravando a abertura", async () => {
    const { numeroId, destinoChave } = await base();
    expect((await abrirAtendimentoInstitucional({ numeroId, destinoChave, chaveIdempotencia: "chave-abrir-02" })).ok).toBe(true);
    const outro = await abrirAtendimentoInstitucional({ numeroId, destinoChave: `${destinoChave}x`, chaveIdempotencia: "chave-abrir-02" });
    expect(outro.ok).toBe(false);
    if (!outro.ok) expect(outro.erro).toMatch(/já foi usada/);
    expect(await abertos()).toBe(1);
    expect((await abrirAtendimentoInstitucional({ numeroId, destinoChave })).ok).toBe(true);
    expect(await abertos()).toBe(2);
  });
});

describe("criarLeadDaConversa repetido (#166)", () => {
  async function conversa() {
    const vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
    await prisma.numeroWhatsApp.create({ data: {
      telefoneE164: "+5511988880000", rotulo: "Vendas", driver: DriverWhatsApp.MOTOR, finalidade: "VENDAS", providerRef: "linha-idem", donoId: vendedor.id,
    } });
    await processarMensagemNormalizada({
      numeroProviderRef: "linha-idem", contatoWaId: "50670001111", nomeExibicao: "Desconhecido", providerMessageId: `idem-${Date.now()}`,
      corpo: "Oi", tipo: "TEXTO", driver: DriverWhatsApp.MOTOR, fromMe: false, quando: new Date(),
    });
    const [item] = await listaDoInbox({ id: vendedor.id, nome: vendedor.nome, papeis: vendedor.papeis });
    sessao.usuarioId = vendedor.id;
    return item.id;
  }
  const vinculos = () => prisma.evento.count({ where: { tipo: "ContatoVinculado" } });

  it("o reenvio, inclusive simultâneo, devolve a mesma oportunidade criada, com um lead e um vínculo", async () => {
    const id = await conversa();
    const [a, b] = await Promise.all([criarLeadDaConversa(id), criarLeadDaConversa(id)]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(a.ok && a.dado?.criado).toBe(true);
    expect(b).toEqual(a);
    expect(await criarLeadDaConversa(id)).toEqual(a);
    expect(await prisma.oportunidade.count()).toBe(1);
    expect(await vinculos()).toBe(1);
  });
});
