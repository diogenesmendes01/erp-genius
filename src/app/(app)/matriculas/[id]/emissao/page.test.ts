import { renderToStaticMarkup } from "react-dom/server";
import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// C36 da #170: a emissão registrada oferecia "Abrir Financeiro" a quem abre esta tela — a Secretaria —, que não
// abre /financeiro e caía em "acesso negado". O mesmo beco que a #160 fechou em entrada-particular.
const mocks = vi.hoisted(() => ({ sessao: vi.fn(), consultar: vi.fn(), preferencia: vi.fn() }));
vi.mock("@/server/_shared", () => ({ exigirSessaoPagina: mocks.sessao }));
vi.mock("@/server/secretaria/conferencia-emissao", () => ({ consultarTelaEmissao: mocks.consultar, conferirEEmitirEntrada: vi.fn() }));
vi.mock("@/server/preferencias/fuso-exibicao", () => ({ consultarPreferenciaFusoEquipe: mocks.preferencia }));
vi.mock("./ConfirmarEmissao", () => ({ ConfirmarEmissao: () => null }));
import Page from "./page";

const emitida = (particular = false) => ({
  estado: "EMITIDA",
  particular,
  registro: {
    id: "conferencia", criadaEm: new Date("2026-10-01T12:00:00.000Z"), motivo: "Conferida com o aluno.", autor: { nome: "Sara" },
    cobrancas: [{ id: "c1", tipo: "TAXA_MATRICULA", valor: "100", moeda: "BRL", vencimento: "2026-10-15" }],
  },
});
const renderizar = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ id: "m1" }) }));

describe("emissão inicial registrada: saída para o Financeiro por papel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.consultar.mockResolvedValue({ ok: true, dado: emitida() });
    mocks.preferencia.mockResolvedValue({ ok: false, erro: "Indisponível" });
  });

  it("Secretaria: sem link para /financeiro; a tela diz que o recebimento é acompanhado no Financeiro", async () => {
    mocks.sessao.mockResolvedValue({ id: "sec", papeis: [Papel.SECRETARIA_ACADEMICA] });
    const html = await renderizar();
    expect(mocks.sessao).toHaveBeenCalledWith(Papel.SECRETARIA_ACADEMICA);
    expect(html).toContain("Emissão inicial registrada");
    expect(html).toContain("A confirmação do recebimento e eventuais ajustes são acompanhados no Financeiro.");
    expect(html).not.toContain('href="/financeiro"');
    expect(html).not.toContain("Abrir Financeiro");
  });

  it.each([Papel.ADMINISTRADOR, Papel.FINANCEIRO])("%s (abre /financeiro): o link continua", async (papel) => {
    mocks.sessao.mockResolvedValue({ id: "u", papeis: [Papel.SECRETARIA_ACADEMICA, papel] });
    expect(await renderizar()).toContain('href="/financeiro">Abrir Financeiro</a>');
  });

  it("matrícula particular: o caminho da entrada particular aparece para a Secretaria, que abre essa tela", async () => {
    mocks.sessao.mockResolvedValue({ id: "sec", papeis: [Papel.SECRETARIA_ACADEMICA] });
    mocks.consultar.mockResolvedValue({ ok: true, dado: emitida(true) });
    const html = await renderizar();
    expect(html).toContain('href="/matriculas/m1/entrada-particular">Conferir pagamentos de entrada da particular</a>');
    expect(html).not.toContain('href="/financeiro"');
  });
});
