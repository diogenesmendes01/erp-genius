import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const m = vi.hoisted(() => ({ sessao: vi.fn(), fresco: vi.fn(), sair: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (orig) => {
  const real = await orig<typeof import("@/server/_shared/sessao")>();
  return {
    ...real,
    exigirSessaoComPrazo: async () => {
      const r = await m.sessao();
      if (r === "SEM_SESSAO") throw new real.ErroAutenticacao();
      if (r?.usuario && real.apenasPortal(r.usuario)) throw new real.ErroPermissao();
      return r;
    },
    carregarUsuarioFresco: (id: string) => m.fresco(id),
  };
});
vi.mock("@/server/inbox/barramento", () => ({ assinarInbox: vi.fn(() => m.sair), iniciarEscuta: vi.fn(async () => {}) }));
import { GET } from "./route";
import { REVALIDAR_MS, RETRY_MS, VIDA_MAX_MS } from "./limites";

const AGORA = new Date("2026-10-19T12:00:00.000Z").getTime();
const usuario = (papeis: Papel[]) => ({ id: "u1", nome: "U", papeis });
const sessao = (papeis: Papel[], expiraEm: number | null = AGORA + 24 * 60 * 60 * 1000) => ({ usuario: usuario(papeis), expiraEm });

beforeEach(() => {
  vi.useFakeTimers({ now: AGORA });
  m.sessao.mockReset(); m.fresco.mockReset(); m.sair.mockReset();
  m.fresco.mockImplementation(async () => usuario([Papel.VENDEDOR]));
});
afterEach(() => { vi.useRealTimers(); });

/** Lê tudo o que o stream já entregou e diz se ele terminou. */
async function ler(res: Response) {
  const leitor = res.body!.getReader();
  const dec = new TextDecoder();
  let texto = "";
  for (;;) {
    const r = await Promise.race([leitor.read(), Promise.resolve("pendente" as const)]);
    if (r === "pendente") { leitor.releaseLock(); return { texto, fechado: false }; }
    if (r.done) return { texto, fechado: true };
    texto += dec.decode(r.value);
  }
}
const abrir = async () => {
  const ctl = new AbortController();
  const res = await GET(new Request("http://x/api/inbox/eventos", { signal: ctl.signal }));
  return { res, ctl };
};

describe("GET /api/inbox/eventos", () => {
  it("sem sessão → 401", async () => {
    m.sessao.mockResolvedValue("SEM_SESSAO");
    expect((await GET(new Request("http://x/api/inbox/eventos"))).status).toBe(401);
  });
  it("aluno → 403", async () => {
    m.sessao.mockResolvedValue(sessao([Papel.ALUNO]));
    expect((await GET(new Request("http://x/api/inbox/eventos"))).status).toBe(403);
  });
  it("com sessão → text/event-stream, com o intervalo de reconexão do navegador", async () => {
    m.sessao.mockResolvedValue(sessao([Papel.VENDEDOR]));
    const { res, ctl } = await abrir();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect((await ler(res)).texto).toContain(`retry: ${RETRY_MS}\n`);
    expect(m.sair).not.toHaveBeenCalled();
    ctl.abort();
    expect(m.sair).toHaveBeenCalledTimes(1);
    await res.body!.cancel(); // cancel depois do abort não desassina de novo
    expect(m.sair).toHaveBeenCalledTimes(1);
  });
  it("cancel do corpo (aba fechada) desassina uma vez", async () => {
    m.sessao.mockResolvedValue(sessao([Papel.VENDEDOR]));
    const { res, ctl } = await abrir();
    await res.body!.cancel();
    expect(m.sair).toHaveBeenCalledTimes(1);
    ctl.abort();
    expect(m.sair).toHaveBeenCalledTimes(1);
  });
});

describe("prazo de vida e revalidação da sessão (B9, #201 C6)", () => {
  it("usuário ativo e com papel: a revalidação periódica mantém o stream aberto até o prazo máximo, e aí fecha", async () => {
    m.sessao.mockResolvedValue(sessao([Papel.VENDEDOR]));
    const { res } = await abrir();
    await vi.advanceTimersByTimeAsync(REVALIDAR_MS * 2);
    expect(m.fresco).toHaveBeenCalledWith("u1");
    expect(m.sair).not.toHaveBeenCalled();
    expect((await ler(res)).fechado).toBe(false);
    await vi.advanceTimersByTimeAsync(VIDA_MAX_MS);
    expect(m.sair).toHaveBeenCalledTimes(1);
    expect((await ler(res)).fechado).toBe(true);
  });

  it("usuário desativado no meio da conexão: fecha na revalidação seguinte", async () => {
    m.sessao.mockResolvedValue(sessao([Papel.VENDEDOR]));
    const { res } = await abrir();
    m.fresco.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(REVALIDAR_MS);
    expect(m.sair).toHaveBeenCalledTimes(1);
    expect((await ler(res)).fechado).toBe(true);
  });

  it("papel do Inbox revogado (ou só portal): fecha na revalidação", async () => {
    m.sessao.mockResolvedValue(sessao([Papel.VENDEDOR]));
    const { res } = await abrir();
    m.fresco.mockResolvedValue(usuario([]));
    await vi.advanceTimersByTimeAsync(REVALIDAR_MS);
    expect((await ler(res)).fechado).toBe(true);

    m.sessao.mockResolvedValue(sessao([Papel.VENDEDOR]));
    m.fresco.mockResolvedValue(usuario([Papel.ALUNO]));
    const outra = await abrir();
    await vi.advanceTimersByTimeAsync(REVALIDAR_MS);
    expect((await ler(outra.res)).fechado).toBe(true);
  });

  it("falha ao revalidar fecha (falha fechada); o navegador reconecta e a abertura confere tudo de novo", async () => {
    m.sessao.mockResolvedValue(sessao([Papel.VENDEDOR]));
    const { res } = await abrir();
    m.fresco.mockRejectedValue(new Error("banco fora"));
    await vi.advanceTimersByTimeAsync(REVALIDAR_MS);
    expect((await ler(res)).fechado).toBe(true);
  });

  it("sessão que expira antes do prazo máximo: fecha no vencimento do JWT", async () => {
    m.sessao.mockResolvedValue(sessao([Papel.VENDEDOR], AGORA + 30_000));
    const { res } = await abrir();
    await vi.advanceTimersByTimeAsync(29_000);
    expect((await ler(res)).fechado).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(m.sair).toHaveBeenCalledTimes(1);
    expect((await ler(res)).fechado).toBe(true);
  });

  it("sessão já vencida na abertura → 401", async () => {
    m.sessao.mockResolvedValue(sessao([Papel.VENDEDOR], AGORA - 1));
    expect((await GET(new Request("http://x/api/inbox/eventos"))).status).toBe(401);
  });
});
