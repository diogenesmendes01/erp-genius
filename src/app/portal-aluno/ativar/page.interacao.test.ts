import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// docs/43 §6 item 8 (docs/42 /portal-aluno/ativar #1, #2, #4 e #5): o link sobrevive ao F5; sem link, nada de
// formulário e duas saídas; regra da senha escrita, confirmação que bloqueia o envio, autocomplete de senha nova;
// erro em role="alert" e sucesso em role="status". Sem DOM e sem rede: ganchos de src/test/tela-sem-dom.ts, o
// efeito de montagem rodado à mão e a chamada à rota (../requisicoes) trocada por um mock.
const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  efeitos: [] as (() => void)[],
  definir: vi.fn(), replace: vi.fn(), refresh: vi.fn(), replaceState: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((inicial: unknown) => m.ganchos!.useState(inicial)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    // Efeitos não rodam no render: o teste roda o de montagem quando quer (montar()).
    useEffect: ((efeito: () => void) => { m.efeitos.push(efeito); }) as unknown as typeof real.useEffect,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: m.replace, refresh: m.refresh, push: vi.fn() }) }));
vi.mock("next/link", async () => {
  const { createElement } = await vi.importActual<typeof import("react")>("react");
  return { default: ({ href, children }: { href: string; children?: import("react").ReactNode }) => createElement("a", { href }, children) };
});
vi.mock("../requisicoes", async (original) => ({ ...(await original<typeof import("../requisicoes")>()), definirSenhaPortalAluno: m.definir }));

import AtivarPortalAlunoPage from "./page";
import { CHAVE_TOKEN_ATIVACAO, type ArmazenamentoDaAba } from "./ativacao";
import { ERRO_LINK_INDISPONIVEL } from "../requisicoes";
import { Botao } from "@/components/Botao";
import { MSG_ATIVACAO_INCERTA } from "@/lib/mensagens";
import { anuncios, contratoFeedbackSeparado } from "@/test/feedback-acao";
import { campos, criarGanchos, documentoQueRegistraFoco, elementos, errosDosCampos, formularios, preencher, submeter, texto } from "@/test/tela-sem-dom";

const SEGREDO = "segredo-do-convite-com-mais-de-trinta-e-dois-caracteres";
const SENHA = "senha-boa-de-teste";
const SUCESSO = "Senha definida. Abrindo a sua área do aluno…";

type Aba = ArmazenamentoDaAba & { dados: Map<string, string> };
function abaFalsa(inicial: Record<string, string> = {}): Aba {
  const dados = new Map(Object.entries(inicial));
  return { dados, getItem: (k) => dados.get(k) ?? null, setItem: (k, v) => { dados.set(k, v); }, removeItem: (k) => { dados.delete(k); } };
}

let aba: Aba;
const tela = () => m.ganchos!.renderizar(AtivarPortalAlunoPage, {});
const html = () => renderToStaticMarkup(tela() as ReactElement);

/** Abre a tela (componente novo) com este fragmento e roda o efeito de montagem. */
function montar(hash: string) {
  m.ganchos = criarGanchos();
  vi.stubGlobal("window", { location: { hash, pathname: "/portal-aluno/ativar" }, history: { replaceState: m.replaceState }, sessionStorage: aba });
  m.efeitos = [];
  tela();
  const [montagem] = m.efeitos;
  m.efeitos = [];
  montagem();
}
const abrirPeloLink = () => montar(`#token=${SEGREDO}`);
const preencherSenhas = (senha = SENHA, confirmacao = senha) => {
  preencher(tela(), "ativar-senha", senha);
  preencher(tela(), "ativar-confirmacao", confirmacao);
};
const botaoDeEnvio = () => elementos(tela()).find((n) => n.type === Botao);

beforeEach(() => {
  vi.clearAllMocks();
  aba = abaFalsa();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("ativar — o link de acesso", () => {
  it("antes de ler o link, não mostra formulário (o servidor não conhece o fragmento)", () => {
    m.ganchos = criarGanchos();
    expect(formularios(tela())).toHaveLength(0);
    expect(texto(tela())).toContain("Conferindo o link de acesso…");
  });

  it("com o link: o segredo sai da barra, fica guardado nesta aba e o formulário aparece", () => {
    abrirPeloLink();
    expect(m.replaceState).toHaveBeenCalledWith(null, "", "/portal-aluno/ativar");
    expect(aba.dados.get(CHAVE_TOKEN_ATIVACAO)).toBe(SEGREDO);
    expect(formularios(tela())).toHaveLength(1);
  });

  it("F5 depois de abrir o link: sem fragmento, a tela relê a cópia da aba e envia com ela", async () => {
    abrirPeloLink();
    montar(""); // recarga: componente novo, fragmento já limpo
    expect(formularios(tela())).toHaveLength(1);
    preencherSenhas();
    m.definir.mockResolvedValueOnce({ ok: true, dado: { conclusao: "SESSAO" } });
    await submeter(tela());
    expect(m.definir).toHaveBeenCalledWith(SEGREDO, SENHA);
  });

  it("sem link nesta aba: não há formulário nem campo de senha, e há as duas saídas", () => {
    montar("");
    expect(formularios(tela())).toHaveLength(0);
    const pagina = html();
    expect(pagina).toContain("Não encontramos o link de acesso nesta aba.");
    expect(pagina).toContain('href="/portal-aluno/recuperar"');
    expect(pagina).toContain('href="/portal-aluno/entrar"');
    expect(pagina).not.toContain("<input");
  });
});

describe("ativar — a senha", () => {
  beforeEach(() => abrirPeloLink());

  it("mostra a regra (mínimo de 12), pede a confirmação e usa autocomplete de senha nova nos dois campos", () => {
    const pagina = html();
    expect(pagina).toContain("Mínimo de 12 caracteres");
    expect(pagina).toContain("Repita a senha");
    expect(pagina.match(/<input[^>]*type="password"[^>]*>/g)).toHaveLength(2);
    expect(pagina.match(/autoComplete="new-password"/g)).toHaveLength(2);
    expect(campos(tela()).map((c) => c.props.id)).toEqual(["ativar-senha", "ativar-confirmacao"]);
  });

  it("o contador acompanha o que foi digitado", () => {
    preencher(tela(), "ativar-senha", "abc");
    expect(html()).toContain("Digitados: 3.");
  });

  it("senha curta: não envia, marca o campo e leva o foco a ele", async () => {
    const { focados, documento } = documentoQueRegistraFoco();
    vi.stubGlobal("document", documento);
    preencherSenhas("curta", "curta");
    await submeter(tela());
    expect(m.definir).not.toHaveBeenCalled();
    expect(errosDosCampos(tela())).toEqual({ "ativar-senha": "A senha precisa de pelo menos 12 caracteres." });
    expect(focados).toEqual(["ativar-senha"]);
  });

  it("as duas não coincidem: o envio fica bloqueado e o foco vai para a confirmação", async () => {
    const { focados, documento } = documentoQueRegistraFoco();
    vi.stubGlobal("document", documento);
    preencherSenhas(SENHA, `${SENHA}x`);
    await submeter(tela());
    expect(m.definir).not.toHaveBeenCalled();
    expect(errosDosCampos(tela())).toEqual({ "ativar-confirmacao": "As duas senhas não coincidem. Digite a mesma senha nos dois campos." });
    expect(focados).toEqual(["ativar-confirmacao"]);
  });

  it("depois de corrigir, o erro sai e a senha é enviada", async () => {
    preencherSenhas(SENHA, "outra-senha-qualquer");
    await submeter(tela());
    preencherSenhas();
    m.definir.mockResolvedValueOnce({ ok: true, dado: { conclusao: "SESSAO" } });
    await submeter(tela());
    expect(m.definir).toHaveBeenCalledTimes(1);
    expect(errosDosCampos(tela())).toEqual({});
  });
});

describe("ativar — resultado", () => {
  contratoFeedbackSeparado({
    nome: "definir a senha",
    preparar: () => { aba = abaFalsa(); abrirPeloLink(); preencherSenhas(); },
    tela,
    acionar: () => submeter(tela()),
    action: m.definir,
    respostaOk: { ok: true, dado: { conclusao: "SESSAO" } },
    sucesso: SUCESSO,
    incerto: MSG_ATIVACAO_INCERTA,
    ocupado: () => botaoDeEnvio()?.props.disabled === true,
  });

  it("sessão aberta: apaga a cópia do link e leva à área do aluno", async () => {
    abrirPeloLink();
    preencherSenhas();
    m.definir.mockResolvedValueOnce({ ok: true, dado: { conclusao: "SESSAO" } });
    await submeter(tela());
    expect(aba.dados.has(CHAVE_TOKEN_ATIVACAO)).toBe(false);
    expect(m.replace).toHaveBeenCalledWith("/portal-aluno");
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });

  it("e-mail novo validado: é sucesso (role=status), não erro; não redireciona e o formulário sai", async () => {
    abrirPeloLink();
    preencherSenhas();
    m.definir.mockResolvedValueOnce({ ok: true, dado: { conclusao: "EMAIL_VALIDADO" } });
    await submeter(tela());
    expect(anuncios(tela())).toEqual({ alerta: [], status: ["Seu novo e-mail foi validado. A escola vai liberar o acesso com ele; você receberá um aviso."] });
    expect(m.replace).not.toHaveBeenCalled();
    expect(formularios(tela())).toHaveLength(0);
  });

  it("link recusado pela rota: apaga a cópia, tira o formulário e mostra por quê e as saídas", async () => {
    abrirPeloLink();
    preencherSenhas();
    m.definir.mockResolvedValueOnce({ ok: false, erro: ERRO_LINK_INDISPONIVEL });
    await submeter(tela());
    expect(aba.dados.has(CHAVE_TOKEN_ATIVACAO)).toBe(false);
    expect(formularios(tela())).toHaveLength(0);
    const pagina = html();
    expect(pagina).toContain(ERRO_LINK_INDISPONIVEL);
    expect(pagina).toContain('href="/portal-aluno/recuperar"');
  });

  it("falha de rede: resultado incerto e o link continua na aba (dá para conferir e repetir)", async () => {
    abrirPeloLink();
    preencherSenhas();
    m.definir.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await submeter(tela());
    expect(anuncios(tela())).toEqual({ alerta: [MSG_ATIVACAO_INCERTA], status: [] });
    expect(aba.dados.get(CHAVE_TOKEN_ATIVACAO)).toBe(SEGREDO);
    expect(formularios(tela())).toHaveLength(1);
  });
});
