import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// D14 (decisão do dono, 19/10/2026; #211 C4): antes de confirmar a mesclagem, a tela pede ao servidor a prévia do
// que muda (vínculos, campos e cadastro acadêmico) e a mostra no diálogo. Quando o servidor diz que a mesclagem
// será recusada (por exemplo, falta a alçada da Secretaria para mover o cadastro acadêmico), o diálogo não abre e
// a tela mostra o motivo. Só o "Confirmar" do diálogo mescla.

const m = vi.hoisted(() => ({
  ganchos: null as null | import("@/test/tela-sem-dom").Ganchos,
  previa: vi.fn(), mesclar: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => m.ganchos!.useState(i)) as unknown as typeof real.useState,
    useCallback: ((f: unknown) => f) as unknown as typeof real.useCallback,
    useRef: ((i: unknown) => m.ganchos!.useRef(i)) as unknown as typeof real.useRef,
    useId: (() => m.ganchos!.useId()) as typeof real.useId,
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
vi.mock("@/server/crm/contatos-acoes", () => ({ previaMesclaDaLista: m.previa, mesclarContatosDaLista: m.mesclar }));

import { PainelMescla } from "./MesclarContatos";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { clicarBotao, criarGanchos, elementos, texto, type No } from "@/test/tela-sem-dom";

const a = { id: "pa", nome: "Beatriz Lima", email: "a@x.com", cidade: "Recife", cargo: null };
const b = { id: "pb", nome: "Aluno Lima", email: null, cidade: "Recife", cargo: null };
const props = { a, b, aoFechar: vi.fn(), aoMesclar: vi.fn() };
const tela = (): ReactNode => m.ganchos!.renderizar(PainelMescla, props);
const doTipo = (t: ReactNode, tipo: unknown): No[] => elementos(t).filter((n) => n.type === tipo);
// O conteúdo do diálogo é o <ResumoPrevia>, que a tela-sem-dom não chama: aqui ele é chamado com as props dele.
const resumo = (c: No): string => {
  const r = c.props.children as No;
  return texto((r.type as (p: unknown) => ReactNode)(r.props)).replace(/\s+/g, " ");
};

const previaBase = {
  principal: { id: "pa", nome: "Beatriz Lima" },
  secundaria: { id: "pb", nome: "Aluno Lima" },
  camposDaSecundaria: [] as string[],
  movidos: { contatos: 2, oportunidades: 1, participantes: 0, tags: 3, valoresCampo: 0 },
  cadastroAcademico: { aluno: true, responsavel: false } as null | { aluno: boolean; responsavel: boolean },
  exigeSecretaria: true,
  bloqueio: null as string | null,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.ganchos = criarGanchos();
  m.previa.mockResolvedValue({ ok: true, dado: previaBase });
  m.mesclar.mockResolvedValue({ ok: true });
});

describe("PainelMescla — prévia antes de confirmar (D14)", () => {
  it("revisar pede a prévia com as mesmas escolhas da mesclagem e não mescla", async () => {
    await clicarBotao(tela(), "Revisar mesclagem");
    expect(m.previa).toHaveBeenCalledTimes(1);
    expect(m.previa).toHaveBeenCalledWith({
      principalId: "pa", secundariaId: "pb",
      escolhas: { nome: "principal", email: "principal", cidade: "principal", cargo: "principal" },
    });
    expect(m.mesclar).not.toHaveBeenCalled();
  });

  it("o diálogo mostra o que muda, inclusive o cadastro acadêmico e a alçada da Secretaria", async () => {
    await clicarBotao(tela(), "Revisar mesclagem");
    const [c] = doTipo(tela(), ConfirmarAcao);
    expect(c).toBeDefined();
    const consequencia = resumo(c);
    expect(consequencia).toContain("2 telefones");
    expect(consequencia).toContain("1 oportunidade");
    expect(consequencia).toContain("3 tags");
    expect(consequencia).toContain("cadastro de aluno");
    expect(consequencia).toContain("alçada da Secretaria");
    expect(consequencia).toContain("Não há desfazer pela tela.");
    expect(m.mesclar).not.toHaveBeenCalled();
    await (c.props.acao as () => Promise<unknown>)();
    expect(m.mesclar).toHaveBeenCalledTimes(1);
    expect(m.mesclar).toHaveBeenCalledWith({
      principalId: "pa", secundariaId: "pb",
      escolhas: { nome: "principal", email: "principal", cidade: "principal", cargo: "principal" },
    });
  });

  it("campos que vêm da outra pessoa aparecem na prévia", async () => {
    m.previa.mockResolvedValue({ ok: true, dado: { ...previaBase, camposDaSecundaria: ["nome", "email"], cadastroAcademico: null, exigeSecretaria: false } });
    await clicarBotao(tela(), "Revisar mesclagem");
    const consequencia = resumo(doTipo(tela(), ConfirmarAcao)[0]);
    expect(consequencia).toContain("Nome e E-mail passam a ser os de Aluno Lima");
    expect(consequencia).not.toContain("cadastro de aluno");
  });

  it("quando a prévia diz que será recusada, o diálogo não abre e o motivo aparece", async () => {
    m.previa.mockResolvedValue({ ok: true, dado: { ...previaBase, bloqueio: "Só quem tem a alçada da Secretaria pode." } });
    await clicarBotao(tela(), "Revisar mesclagem");
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(doTipo(t, FeedbackAcao).map((n) => n.props.erro)).toContain("Só quem tem a alçada da Secretaria pode.");
    expect(m.mesclar).not.toHaveBeenCalled();
  });

  it("erro da prévia aparece na tela, sem diálogo", async () => {
    m.previa.mockResolvedValue({ ok: false, erro: "Pessoa não encontrada." });
    await clicarBotao(tela(), "Revisar mesclagem");
    const t = tela();
    expect(doTipo(t, ConfirmarAcao)).toHaveLength(0);
    expect(doTipo(t, FeedbackAcao).map((n) => n.props.erro)).toContain("Pessoa não encontrada.");
  });
});
