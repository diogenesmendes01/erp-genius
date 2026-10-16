import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadConversa } from "@/server/whatsapp/consultas";

// Inbox (docs/42 L2298; fatia B, issue #169): escolher um nome no painel de vínculo e "Registrar opt-out"
// só abrem o ConfirmarAcao, com o efeito escrito; só a confirmação chama a action; erro e incerto ficam
// no diálogo. O campo de evidência da reautorização diz o mínimo de 12 caracteres.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  vincular: vi.fn(), optOut: vi.fn(), buscar: vi.fn(), refresh: vi.fn(),
  /** Liga os efeitos (só a busca do painel de vínculo precisa deles); fora disso, efeito não roda. */
  efeitos: false,
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  const g = () => m.ganchos!;
  return {
    ...real,
    useState: ((i: unknown) => g().useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((i: unknown) => g().useRef(i)) as unknown as typeof real.useRef,
    useId: (() => g().useId()) as typeof real.useId,
    useMemo: ((f: () => unknown) => f()) as unknown as typeof real.useMemo,
    useEffect: ((f: () => unknown) => { if (m.efeitos) f(); }) as unknown as typeof real.useEffect,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: vi.fn() }) }));
vi.mock("@/server/whatsapp/acoes", () => ({
  buscarVinculosInbox: m.buscar, criarLeadDaConversa: vi.fn(), editarNomeContatoWhatsApp: vi.fn(), enviarMidiaInbox: vi.fn(), enviarTextoInbox: vi.fn(),
  marcarConversaLida: vi.fn(), marcarConversaTratada: vi.fn(), registrarOptOutContato: m.optOut, removerOptOutContato: vi.fn(), vincularContatoWhatsApp: m.vincular,
}));
vi.mock("@/server/cobrancas/acoes", () => ({ registrarPromessaPagamento: vi.fn() }));

import { Thread, VincularPainel } from "./InboxCliente";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { clicar, criarGanchos, elementos, texto, type Ganchos, type No } from "@/test/tela-sem-dom";
import { confirmarNoDialogo } from "@/test/confirmacao-tela";

const thread = {
  conversaId: "atendimento", finalidade: "FINANCEIRO", matricula: null, podeEnviar: true, podeVincular: true, podeReautorizar: true, podeEditarNome: false,
  linhaComercial: false, podeCriarLead: false, pendenciaDestinatario: null,
  numero: { id: "numero", rotulo: "Escola", driver: "META_CLOUD", finalidade: "COBRANCA", sessao: "s", ativo: true },
  contato: { id: "contato-1", nome: "Carla Souza", telefone: "+50688887777", optOutEm: null, alunoId: null, alunoNome: null, responsavelId: null, responsavelNome: null, leadId: null, leadNome: null, nomeSalvo: null, nomePerfil: null, fonteNome: "perfil" },
  janela24h: null, silencio: { ativo: false, ate: null }, cobrancaAtiva: null, lead: null, mensagens: [],
} as unknown as ThreadConversa;
const callbacks = { onErro: vi.fn(), onNota: vi.fn(), onFechar: vi.fn(), onFeito: vi.fn() };
const confirmacoes = (t: ReactNode): No[] => elementos(t).filter((n: No) => n.type === ConfirmarAcao);
const usar = (g: Ganchos): Ganchos => { const anterior = m.ganchos!; m.ganchos = g; return anterior; };

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.vincular.mockResolvedValue({ ok: true });
  m.optOut.mockResolvedValue({ ok: true });
});

describe("Inbox — registrar opt-out passa pela confirmação", () => {
  const tela = (t: ThreadConversa = thread): ReactNode =>
    m.ganchos!.renderizar(Thread, { thread: t, podeCobranca: false, preferenciaFusoExibicao: null, onErro: callbacks.onErro, onNota: callbacks.onNota });

  it("clicar não registra; a confirmação diz o que para e quem desfaz; só confirmar registra, uma vez", async () => {
    clicar(tela(), "Registrar opt-out");
    expect(m.optOut).not.toHaveBeenCalled();
    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Registrar o opt-out de Carla Souza?");
    expect(c.props.confirmacao).toBe("opt-out");
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("Nenhuma mensagem sai mais para Carla Souza (+50688887777)");
    expect(consequencia).toContain("Só a administração desfaz");
    expect(consequencia).toContain("mínimo de 12 caracteres");
    expect(m.optOut).not.toHaveBeenCalled(); // renderizar a confirmação não executa
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.optOut).toHaveBeenCalledTimes(1);
    expect(m.optOut).toHaveBeenCalledWith("contato-1");
    (c.props.aoConcluir as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(callbacks.onNota).toHaveBeenLastCalledWith("Opt-out registrado — automações bloqueadas.");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("voltar não registra", () => {
    clicar(tela(), "Registrar opt-out");
    (confirmacoes(tela())[0].props.aoCancelar as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.optOut).not.toHaveBeenCalled();
  });

  it("erro e falha de rede aparecem dentro do diálogo, que continua aberto", async () => {
    clicar(tela(), "Registrar opt-out");
    m.optOut.mockResolvedValueOnce({ ok: false, erro: "Contato já está em opt-out." });
    expect(await confirmarNoDialogo(confirmacoes(tela())[0], usar)).toEqual({ erro: "Contato já está em opt-out.", confirmarDisponivel: true });
    m.optOut.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await confirmarNoDialogo(confirmacoes(tela())[0], usar)).erro).toBe(MSG_RESULTADO_INCERTO_SEM_CHAVE);
    expect(confirmacoes(tela())).toHaveLength(1);
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("o campo de evidência da reautorização diz o mínimo de 12 caracteres", () => {
    const t = tela({ ...thread, contato: { ...thread.contato, optOutEm: "2026-10-01T02:30:00.000Z" } } as ThreadConversa);
    const rotulo = elementos(t).find((n: No) => n.type === "label" && texto(n.props.children).includes("Evidência da nova autorização"));
    expect(texto(rotulo?.props.children)).toContain("mínimo de 12 caracteres");
  });
});

describe("Inbox — vincular passa pela confirmação", () => {
  const pessoas = { alunos: [{ id: "aluno-9", nome: "João Silva" }], responsaveis: [{ id: "resp-2", nome: "Marta Silva" }], leads: [] };
  const tela = (): ReactNode =>
    m.ganchos!.renderizar(VincularPainel, {
      contatoId: "contato-1", contatoNome: "Carla Souza", contatoTelefone: "+50688887777", atendimentoId: "atendimento",
      onFechar: callbacks.onFechar, onFeito: callbacks.onFeito, onErro: callbacks.onErro,
    });
  /** Digita na busca e deixa o efeito (timer de 300 ms) trazer os resultados, como na tela. */
  async function buscar(termo: string) {
    m.buscar.mockResolvedValue({ ok: true, dado: pessoas });
    vi.useFakeTimers();
    m.efeitos = true;
    try {
      const campo = elementos(tela()).find((n: No) => n.type === "input")!;
      (campo.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: termo } });
      tela(); // o efeito agenda a busca do termo
      await vi.advanceTimersByTimeAsync(300);
    } finally {
      m.efeitos = false;
      vi.useRealTimers();
    }
    await new Promise((r) => setTimeout(r, 0));
  }
  const escolher = (titulo: string, item: { id: string; nome: string }) => {
    const grupo = elementos(tela()).find((n: No) => n.props.titulo === titulo)!;
    (grupo.props.onEscolher as (i: { id: string; nome: string }) => void)(item);
  };

  it("escolher um nome não vincula; a confirmação diz com quem fica o histórico e que não há desvincular", async () => {
    await buscar("Silva");
    expect(m.buscar).toHaveBeenCalledWith("Silva", "atendimento");
    escolher("Alunos", { id: "aluno-9", nome: "João Silva" });
    expect(m.vincular).not.toHaveBeenCalled();
    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Vincular esta conversa a João Silva (aluno)?");
    expect(c.props.confirmacao).toBe("vínculo");
    const consequencia = texto(c.props.children).replace(/\s+/g, " ");
    expect(consequencia).toContain("O contato Carla Souza (+50688887777) passa a ficar ligado a João Silva (aluno)");
    expect(consequencia).toContain("Não há desvincular pela tela");
    expect(m.vincular).not.toHaveBeenCalled(); // renderizar a confirmação não executa
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.vincular).toHaveBeenCalledTimes(1);
    expect(m.vincular).toHaveBeenCalledWith({ contatoId: "contato-1", atendimentoId: "atendimento", alvo: { tipo: "aluno", id: "aluno-9" } });
    (c.props.aoConcluir as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(callbacks.onFeito).toHaveBeenCalledWith("Contato vinculado a João Silva.");
  });

  it("responsável: o título diz o papel; voltar não vincula", async () => {
    await buscar("Silva");
    escolher("Responsáveis", { id: "resp-2", nome: "Marta Silva" });
    const [c] = confirmacoes(tela());
    expect(c.props.titulo).toBe("Vincular esta conversa a Marta Silva (responsável)?");
    (c.props.aoCancelar as () => void)();
    expect(confirmacoes(tela())).toHaveLength(0);
    expect(m.vincular).not.toHaveBeenCalled();
    expect(callbacks.onFeito).not.toHaveBeenCalled();
  });

  it("erro e falha de rede aparecem dentro do diálogo, que continua aberto", async () => {
    await buscar("Silva");
    escolher("Alunos", { id: "aluno-9", nome: "João Silva" });
    m.vincular.mockResolvedValueOnce({ ok: false, erro: "Telefone do contato não corresponde ao aluno informado." });
    expect(await confirmarNoDialogo(confirmacoes(tela())[0], usar)).toEqual({ erro: "Telefone do contato não corresponde ao aluno informado.", confirmarDisponivel: true });
    m.vincular.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect((await confirmarNoDialogo(confirmacoes(tela())[0], usar)).erro).toBe(MSG_RESULTADO_INCERTO_SEM_CHAVE);
    expect(confirmacoes(tela())).toHaveLength(1);
    expect(callbacks.onFeito).not.toHaveBeenCalled();
  });
});
