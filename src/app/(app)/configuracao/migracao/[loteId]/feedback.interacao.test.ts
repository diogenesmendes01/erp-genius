import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/43-medicao-auditoria-ux.md §6 item 2 (docs/42 E3): erro e sucesso separados no ensaio/aplicação
// de cadastros e no ensaio de vínculo da migração — erro em role="alert", sucesso em role="status",
// falha de rede como resultado incerto e os botões saindo do ocupado. Sem DOM: src/test/tela-sem-dom.ts.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  refresh: vi.fn(),
  aplicarCadastro: vi.fn(),
  ensaiar: vi.fn(), revisarProduto: vi.fn(), revisarStatus: vi.fn(), revisarTurma: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((inicial: unknown) => m.ganchos!.useRef(inicial)) as unknown as typeof real.useRef,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh, push: vi.fn() }) }));
vi.mock("@/server/migracao/aplicacao-cadastro", () => ({ aplicarCadastroPreparacaoMigracao: m.aplicarCadastro }));
vi.mock("@/server/migracao/ensaio-vinculo", () => ({
  ensaiarVinculoMigracao: m.ensaiar, revisarCorrespondenciaProdutoMigracao: m.revisarProduto,
  revisarCorrespondenciaStatusMatriculaMigracao: m.revisarStatus, revisarCorrespondenciaTurmaMigracao: m.revisarTurma,
}));

import { AplicarCadastroMigracao } from "./AplicarCadastroMigracao";
import { EnsaioVinculoMigracao } from "./EnsaioVinculoMigracao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado, novosAnuncios } from "@/test/feedback-acao";
import { botao, clicar, criarGanchos, elementos, temBotao, texto } from "@/test/tela-sem-dom";

beforeEach(() => { vi.clearAllMocks(); m.ganchos = criarGanchos(); });

describe("AplicarCadastroMigracao", () => {
  const tela = () => m.ganchos!.renderizar(AplicarCadastroMigracao, { loteId: "lote" });
  const explicacao = "Apenas cadastros completos foram ensaiados ou aplicados; demais entidades permanecem em conferência.";
  const ensaio = { ok: true, dado: { aplicadas: 0, ensaiadas: 1, bloqueadas: 0, divergencias: 0, resultados: [], confirmacaoHash: "h".repeat(64), explicacao } };
  /** Os dois botões passam a "Processando…" e ficam travados enquanto a action roda. */
  const ocupado = () => elementos(tela()).filter((n) => n.type === "button" && texto(n.props.children) === "Processando…" && n.props.disabled === true).length === 2;
  contratoFeedbackSeparado({
    nome: "ensaiar cadastros", tela, action: m.aplicarCadastro, respostaOk: ensaio,
    acionar: () => clicar(tela(), "Ensaiar cadastros"),
    sucesso: explicacao, incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE, ocupado,
  });

  it("aplica com a confirmação do ensaio e atualiza a página só no sucesso", async () => {
    expect(botao(tela(), "Aplicar cadastros confirmados").props.disabled).toBe(true);
    m.aplicarCadastro.mockResolvedValueOnce(ensaio);
    await clicar(tela(), "Ensaiar cadastros");
    expect(m.refresh).toHaveBeenCalledTimes(1);
    m.aplicarCadastro.mockResolvedValueOnce({ ok: false, erro: "Lote em revisão por outra pessoa." });
    await clicar(tela(), "Aplicar cadastros confirmados");
    expect(m.aplicarCadastro).toHaveBeenLastCalledWith({ loteId: "lote", modo: "APLICAR", confirmacaoHash: "h".repeat(64) });
    expect(m.refresh).toHaveBeenCalledTimes(1);
    // O erro não descarta a confirmação: o operador pode repetir a aplicação do mesmo ensaio.
    expect(botao(tela(), "Aplicar cadastros confirmados").props.disabled).toBe(false);
  });

  it("resposta sem dado sai como erro, não como confirmação", async () => {
    const antes = anuncios(tela());
    m.aplicarCadastro.mockResolvedValueOnce({ ok: true });
    await clicar(tela(), "Ensaiar cadastros");
    expect(novosAnuncios(antes, anuncios(tela()))).toEqual({ alerta: ["Não foi possível processar o lote."], status: [] });
    expect(m.refresh).not.toHaveBeenCalled();
  });
});

describe("EnsaioVinculoMigracao", () => {
  const props = {
    linhaId: "linha", origem: "LEGADO", produtoOrigemId: "produto-origem", turmaOrigemId: null, statusOrigem: null,
    produtoAtual: null, turmaAtual: null, statusAtual: null, ofertasProduto: [], turmas: [], ensaios: [], preferenciaFusoExibicao: null,
  };
  const tela = () => m.ganchos!.renderizar(EnsaioVinculoMigracao, props);
  const ocupado = () => temBotao(tela(), "Conferindo…") && botao(tela(), "Conferindo…").props.disabled === true;

  contratoFeedbackSeparado({
    nome: "ensaiar vínculo", tela, action: m.ensaiar,
    acionar: () => clicar(tela(), "Ensaiar vínculo"),
    sucesso: "Ensaio registrado. O histórico abaixo foi atualizado.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE, ocupado,
  });

  // O bloco de produto é um componente filho (não é chamado sem DOM): dispara-se pela função que a tela lhe
  // entrega, como o botão "Salvar correspondência" faria (ativa = true).
  type Executar = (acao: () => Promise<unknown>, ativa: boolean) => Promise<void>;
  const revisarProduto = () => {
    const bloco = elementos(tela()).find((n) => typeof n.type === "function" && "produtoOrigemId" in n.props && "executar" in n.props);
    if (!bloco) throw new Error("bloco de produto ausente");
    return (bloco.props.executar as Executar)(() => m.revisarProduto({ origem: "LEGADO" }), true);
  };
  contratoFeedbackSeparado({
    nome: "revisar correspondência de produto", tela, action: m.revisarProduto, acionar: revisarProduto,
    sucesso: "Correspondência de produto registrada.", incerto: MSG_RESULTADO_INCERTO_SEM_CHAVE, ocupado,
  });

  it("o resultado aparece junto do bloco que disparou a ação", async () => {
    m.revisarProduto.mockResolvedValueOnce({ ok: false, erro: "Correspondência alterada por outra pessoa." });
    await revisarProduto();
    const [doProduto, doEnsaio] = elementos(tela()).filter((n) => n.type === FeedbackAcao);
    expect(doProduto.props.erro).toBe("Correspondência alterada por outra pessoa.");
    expect(doEnsaio.props.erro).toBeNull();
    m.ensaiar.mockResolvedValueOnce({ ok: true });
    await clicar(tela(), "Ensaiar vínculo");
    const [produtoDepois, ensaioDepois] = elementos(tela()).filter((n) => n.type === FeedbackAcao);
    expect(produtoDepois.props.erro).toBeNull();
    expect(ensaioDepois.props.sucesso).toBe("Ensaio registrado. O histórico abaixo foi atualizado.");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
