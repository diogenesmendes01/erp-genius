import type { ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

// C2 da R1 do #217 (decisão do dono: portar tudo): as ações que o Inbox antigo tinha na thread voltam no painel
// lateral, pelas mesmas Server Actions. Marcação com o React real; interação com os ganchos de tela-sem-dom.
const m = vi.hoisted(() => ({ g: null as null | import("@/test/tela-sem-dom").Ganchos }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useState: ((i: unknown) => (m.g ? m.g.useState(i) : real.useState(i as never))) as unknown as typeof real.useState,
    useRef: ((i: unknown) => (m.g ? m.g.useRef(i) : real.useRef(i as never))) as unknown as typeof real.useRef,
    useId: (() => (m.g ? m.g.useId() : real.useId())) as typeof real.useId,
    useCallback: ((f: unknown, d?: unknown[]) => (m.g ? m.g.useCallback(f) : real.useCallback(f as never, d as never))) as unknown as typeof real.useCallback,
    useEffect: ((f: () => void, d?: unknown[]) => (m.g ? undefined : real.useEffect(f, d))) as unknown as typeof real.useEffect,
  };
});
const acoes = vi.hoisted(() => ({
  criarLeadDaConversa: vi.fn(async () => ({ ok: true as const, dado: { leadId: "op9", criado: true } })),
  editarNomeContatoWhatsApp: vi.fn(async () => ({ ok: true as const })),
  buscarVinculosInbox: vi.fn(async () => ({ ok: true as const, dado: { alunos: [{ id: "al2", nome: "Bia Souza" }], responsaveis: [], leads: [{ id: "op3", nome: "Caio", codigo: "L-3" }] } })),
  vincularContatoWhatsApp: vi.fn(async () => ({ ok: true as const })),
  marcarConversaTratada: vi.fn(async () => ({ ok: true as const })),
  registrarPromessaPagamento: vi.fn(async () => ({ ok: true as const })),
  desvincularContatoWhatsApp: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/server/whatsapp/acoes", () => ({
  criarLeadDaConversa: acoes.criarLeadDaConversa, editarNomeContatoWhatsApp: acoes.editarNomeContatoWhatsApp,
  buscarVinculosInbox: acoes.buscarVinculosInbox, vincularContatoWhatsApp: acoes.vincularContatoWhatsApp,
  marcarConversaTratada: acoes.marcarConversaTratada,
}));
vi.mock("@/server/whatsapp/desvincular-contato", () => ({ desvincularContatoWhatsApp: acoes.desvincularContatoWhatsApp }));
vi.mock("@/server/cobrancas/acoes", () => ({ registrarPromessaPagamento: acoes.registrarPromessaPagamento }));
vi.mock("@/components/PagamentoModal", () => ({ PagamentoModal: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { Botao } from "@/components/Botao";
import { CampoTexto } from "@/components/CampoTexto";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { MSG_RESULTADO_INCERTO, MSG_RESULTADO_INCERTO_SEM_CHAVE } from "@/lib/mensagens";
import { PagamentoModal } from "@/components/PagamentoModal";
import type { AcoesContatoInbox } from "@/server/whatsapp/consultas-inbox";
import { criarGanchos, clicarBotao, elementos, texto } from "@/test/tela-sem-dom";
import { AcoesContato, CobrancaContato, DesvincularContato, EditarNomeContato, VincularContato, type PropsAcoesContato } from "./AcoesContato";

const base: AcoesContatoInbox = {
  contatoId: "c1", contatoNome: "Maria", nomeSalvo: "Maria", nomePerfil: "Mari", fonteNome: "contato",
  alunoId: null, leadId: null, podeCriarLead: false, podeVincular: false, podeEditarNome: false, vinculos: [], cobranca: null,
};
const cobranca: NonNullable<AcoesContatoInbox["cobranca"]> = {
  silencio: { ativo: true, ate: "2026-10-18T15:00:00.000Z" },
  ativa: { id: "cob1", matriculaId: "m1", alunoId: "al1", alunoNome: "Ana Lima", moeda: "BRL", vencimento: { estado: "CONFIRMADO", dataCivil: "2026-10-10" } as never,
    valorNegociado: 300, valorRecebido: 100, saldo: 200, status: "ATRASADO" },
};
const props = (a: Partial<AcoesContatoInbox> = {}, p: Partial<PropsAcoesContato> = {}): PropsAcoesContato =>
  ({ atendimentoId: "a1", acoes: { ...base, ...a }, fuso: "America/Sao_Paulo", aoMudar: vi.fn(), ...p });
const html = (a: Partial<AcoesContatoInbox> = {}) => renderToStaticMarkup(createElement(AcoesContato, props(a)));
const marcacao = (n: ReactNode) => renderToStaticMarkup(createElement("div", null, n));
const esvaziar = () => new Promise((r) => setTimeout(r, 0));
const entrada = (raiz: ReactNode, rotulo: string) => {
  const achado = elementos(raiz).filter((n) => n.type === "input" && n.props["aria-label"] === rotulo);
  if (achado.length !== 1) throw new Error(`esperava 1 campo "${rotulo}", achei ${achado.length}`);
  return achado[0];
};
const digitar = (raiz: ReactNode, rotulo: string, v: string) => (entrada(raiz, rotulo).props.onChange as (e: unknown) => void)({ target: { value: v } });
const submeterForm = (raiz: ReactNode, i = 0) => (elementos(raiz).filter((n) => n.type === "form")[i].props.onSubmit as (e: unknown) => unknown)({ preventDefault() {} });

afterEach(() => { m.g = null; vi.clearAllMocks(); });

describe("AcoesContato: marcação", () => {
  it("links do cadastro: oportunidade no funil (/funil?o=) e ficha do aluno; nunca /leads", () => {
    const h = html({ leadId: "op1", alunoId: "al1" });
    expect(h).toContain('href="/funil?o=op1"');
    expect(h).toContain('href="/alunos/al1"');
    expect(h).not.toContain("/leads");
  });
  it("cada botão só aparece com a regra do servidor", () => {
    const nada = html();
    for (const r of ["Criar oportunidade", "Editar nome", "Vincular"]) expect(nada).not.toContain(`>${r}<`);
    const tudo = html({ podeCriarLead: true, podeVincular: true, podeEditarNome: true });
    for (const r of ["Criar oportunidade", "Editar nome", "Vincular"]) expect(tudo).toContain(r);
  });
  it("sem bloco de cobrança fora do financeiro; com ele, silêncio, cobrança ativa e as ações", () => {
    expect(html()).not.toContain("Registrar pagamento");
    const h = html({ cobranca });
    expect(h).toContain("Régua automática em silêncio");
    expect(h).toContain("Retomar régua");
    expect(h).toContain("Ana Lima");
    expect(h).toContain("Registrar pagamento");
    expect(h).toContain("Promessa de pagamento");
    expect(html({ cobranca: { silencio: { ativo: false, ate: null }, ativa: null } })).not.toContain("Retomar régua");
  });
  it("Desvincular só aparece com vínculo que a pessoa pode desfazer (regra do servidor, D8)", () => {
    expect(html()).not.toContain(">Desvincular<");
    expect(html({ podeVincular: true })).not.toContain(">Desvincular<");
    expect(html({ vinculos: [{ tipo: "aluno", id: "al1", nome: "Ana Lima" }] })).toContain(">Desvincular<");
  });
  it("a confirmação do vínculo aponta o desvincular da administração ou do gerente do setor", () => {
    expect(readFileSync("src/app/(app)/inbox/AcoesContato.tsx", "utf8")).not.toContain("Não há desvincular pela tela");
  });
  it("não mostra telefone (regra 5)", () => {
    expect(html({ podeEditarNome: true, podeVincular: true, cobranca })).not.toMatch(/\+\d{6,}/);
  });
});

describe("AcoesContato: interação", () => {
  it("Criar oportunidade chama criarLeadDaConversa com o atendimento e avisa a tela", async () => {
    m.g = criarGanchos();
    const p = props({ podeCriarLead: true });
    const tela = () => m.g!.renderizar(AcoesContato, p);
    clicarBotao(tela(), "Criar oportunidade");
    await esvaziar();
    expect(acoes.criarLeadDaConversa).toHaveBeenCalledWith("a1");
    expect(p.aoMudar).toHaveBeenCalled();
    expect(marcacao(tela())).toContain("Oportunidade criada e vinculada à conversa.");
  });

  it("Criar oportunidade com falha de transporte manda conferir antes de repetir (sem chave de idempotência)", async () => {
    acoes.criarLeadDaConversa.mockRejectedValueOnce(new Error("rede"));
    m.g = criarGanchos();
    const p = props({ podeCriarLead: true });
    const tela = () => m.g!.renderizar(AcoesContato, p);
    clicarBotao(tela(), "Criar oportunidade");
    await esvaziar();
    expect(p.aoMudar).not.toHaveBeenCalled();
    expect(marcacao(tela())).toContain(MSG_RESULTADO_INCERTO_SEM_CHAVE);
  });

  it("Editar nome grava pelo editarNomeContatoWhatsApp com o nome lido (gravação condicional)", async () => {
    m.g = criarGanchos();
    const p = props({ podeEditarNome: true });
    const painel = () => m.g!.renderizar(AcoesContato, p);
    expect(elementos(painel()).some((n) => n.type === EditarNomeContato)).toBe(false);
    clicarBotao(painel(), "Editar nome");
    expect(elementos(painel()).find((n) => n.type === EditarNomeContato)!.props).toMatchObject({ atendimentoId: "a1", acoes: p.acoes });
    m.g = criarGanchos();
    const sub = { atendimentoId: "a1", acoes: p.acoes, aoFechar: vi.fn(), aoMudar: p.aoMudar };
    const tela = () => m.g!.renderizar(EditarNomeContato, sub);
    digitar(tela(), "Nome salvo do contato", "Maria Souza");
    submeterForm(tela());
    await esvaziar();
    expect(acoes.editarNomeContatoWhatsApp).toHaveBeenCalledWith({ atendimentoId: "a1", nome: "Maria Souza", nomeAnterior: "Maria" });
    expect(p.aoMudar).toHaveBeenCalled();
  });

  it("Editar nome quando o nome vem do cadastro da oportunidade leva ao funil", () => {
    m.g = criarGanchos();
    const p = props({ podeEditarNome: true, fonteNome: "lead", leadId: "op1" });
    const h = marcacao(m.g!.renderizar(EditarNomeContato, { atendimentoId: "a1", acoes: p.acoes, aoFechar: vi.fn() }));
    expect(h).toContain("cadastro da oportunidade");
    expect(h).toContain('href="/funil?o=op1"');
  });

  it("Vincular busca pelo buscarVinculosInbox e só vincula dentro do ConfirmarAcao", async () => {
    m.g = criarGanchos();
    const p = props({ podeVincular: true });
    const painel = () => m.g!.renderizar(AcoesContato, p);
    clicarBotao(painel(), "Vincular");
    expect(elementos(painel()).some((n) => n.type === VincularContato)).toBe(true);
    m.g = criarGanchos();
    const tela = () => m.g!.renderizar(VincularContato, { atendimentoId: "a1", acoes: p.acoes, aoFechar: vi.fn(), aoMudar: p.aoMudar });
    digitar(tela(), "Buscar aluno, responsável ou oportunidade para vincular", "Bi");
    submeterForm(tela());
    await esvaziar();
    expect(acoes.buscarVinculosInbox).toHaveBeenCalledWith("Bi", "a1");
    clicarBotao(tela(), "Vincular a Bia Souza");
    expect(acoes.vincularContatoWhatsApp).not.toHaveBeenCalled();
    const conf = elementos(tela()).find((n) => n.type === ConfirmarAcao)!;
    expect(conf.props.confirmacao).toBe("vínculo");
    expect(String(conf.props.titulo)).toContain("Bia Souza");
    await (conf.props.acao as () => Promise<unknown>)();
    expect(acoes.vincularContatoWhatsApp).toHaveBeenCalledWith({ contatoId: "c1", atendimentoId: "a1", alvo: { tipo: "aluno", id: "al2" } });
    (conf.props.aoConcluir as () => void)();
    expect(p.aoMudar).toHaveBeenCalled();
  });

  it("Desvincular (D8): escolhe o vínculo, exige o motivo e só desfaz dentro do ConfirmarAcao", async () => {
    const vinculos: AcoesContatoInbox["vinculos"] = [{ tipo: "lead", id: "op1", nome: "Lead Errado" }];
    m.g = criarGanchos();
    const p = props({ vinculos });
    const painel = () => m.g!.renderizar(AcoesContato, p);
    clicarBotao(painel(), "Desvincular");
    expect(elementos(painel()).some((n) => n.type === DesvincularContato)).toBe(true);
    m.g = criarGanchos();
    const tela = () => m.g!.renderizar(DesvincularContato, { atendimentoId: "a1", vinculos, aoFechar: vi.fn(), aoMudar: p.aoMudar });
    clicarBotao(tela(), "Desvincular de Lead Errado");
    const motivo = () => elementos(tela()).find((n) => n.type === CampoTexto && n.props["aria-label"] === "Motivo do desvínculo")!;
    const revisar = () => elementos(tela()).find((n) => n.type === Botao && texto(n.props.children) === "Revisar desvínculo")!;
    expect(motivo().props.required).toBe(true);
    expect(revisar().props.disabled).toBe(true);
    (motivo().props.onChange as (e: unknown) => void)({ target: { value: "Oportunidade errada, era o irmão" } });
    expect(revisar().props.disabled).toBe(false);
    clicarBotao(tela(), "Revisar desvínculo");
    expect(acoes.desvincularContatoWhatsApp).not.toHaveBeenCalled();
    const conf = elementos(tela()).find((n) => n.type === ConfirmarAcao)!;
    expect(conf.props.confirmacao).toBe("desvínculo");
    expect(String(conf.props.titulo)).toBe("Desvincular esta conversa de Lead Errado (oportunidade)?");
    expect(marcacao(conf.props.children as ReactNode)).toContain("Nada é apagado");
    await (conf.props.acao as () => Promise<unknown>)();
    expect(acoes.desvincularContatoWhatsApp).toHaveBeenCalledWith({ atendimentoId: "a1", alvo: { tipo: "lead", id: "op1" }, motivo: "Oportunidade errada, era o irmão" });
    (conf.props.aoConcluir as () => void)();
    expect(p.aoMudar).toHaveBeenCalled();
  });

  it("Retomar régua trata a conversa com motivo retomar_regua", async () => {
    m.g = criarGanchos();
    const p = props({ cobranca });
    expect(elementos(m.g!.renderizar(AcoesContato, p)).find((n) => n.type === CobrancaContato)!.props).toMatchObject({ atendimentoId: "a1", cobranca });
    m.g = criarGanchos();
    const tela = () => m.g!.renderizar(CobrancaContato, { atendimentoId: "a1", cobranca, fuso: null, aoMudar: p.aoMudar });
    clicarBotao(tela(), "Retomar régua");
    await esvaziar();
    expect(acoes.marcarConversaTratada).toHaveBeenCalledWith({ conversaId: "a1", motivo: "retomar_regua" });
    expect(p.aoMudar).toHaveBeenCalled();
  });

  it("contato em opt-out: o bloco Retomar régua some, o resto da cobrança fica (C7 do #217, como no Inbox antigo)", async () => {
    m.g = criarGanchos();
    const p = props({ cobranca }, { optOut: true });
    expect(elementos(m.g!.renderizar(AcoesContato, p)).find((n) => n.type === CobrancaContato)!.props).toMatchObject({ atendimentoId: "a1", cobranca, optOut: true });
    m.g = criarGanchos();
    const tela = () => m.g!.renderizar(CobrancaContato, { atendimentoId: "a1", cobranca, fuso: null, optOut: true, aoMudar: p.aoMudar });
    expect(() => clicarBotao(tela(), "Retomar régua")).toThrow();
    expect(marcacao(tela())).not.toContain("Régua automática em silêncio");
    expect(marcacao(tela())).toContain("Registrar pagamento");
    clicarBotao(tela(), "Registrar pagamento");
    expect(elementos(tela()).some((n) => n.type === PagamentoModal)).toBe(true);
    await esvaziar();
    expect(acoes.marcarConversaTratada).not.toHaveBeenCalledWith({ conversaId: "a1", motivo: "retomar_regua" });
  });

  it("InboxNovo passa o opt-out do contato às ações do painel (fonte)", () => {
    const fonte = readFileSync("src/app/(app)/inbox/InboxNovo.tsx", "utf8");
    expect(fonte).toMatch(/<AcoesContato[^>]*optOut=\{atual\.optOut\}/);
  });

  it("Registrar pagamento abre o PagamentoModal da cobrança e, no fim, trata a conversa como pagamento", async () => {
    m.g = criarGanchos();
    const p = props({ cobranca });
    expect(elementos(m.g!.renderizar(AcoesContato, p)).find((n) => n.type === CobrancaContato)!.props).toMatchObject({ atendimentoId: "a1", cobranca });
    m.g = criarGanchos();
    const tela = () => m.g!.renderizar(CobrancaContato, { atendimentoId: "a1", cobranca, fuso: null, aoMudar: p.aoMudar });
    expect(elementos(tela()).some((n) => n.type === PagamentoModal)).toBe(false);
    clicarBotao(tela(), "Registrar pagamento");
    const modal = elementos(tela()).find((n) => n.type === PagamentoModal)!;
    expect(modal.props).toMatchObject({ cobrancaId: "cob1", alunoNome: "Ana Lima", moeda: "BRL", valorEsperado: 300, jaRecebido: 100, saldoRestante: 200 });
    await (modal.props.onDone as () => Promise<void>)();
    expect(acoes.marcarConversaTratada).toHaveBeenCalledWith({ conversaId: "a1", motivo: "pagamento" });
    expect(elementos(tela()).some((n) => n.type === PagamentoModal)).toBe(false);
  });

  it("Promessa de pagamento registra a data e trata a conversa como promessa", async () => {
    m.g = criarGanchos();
    const p = props({ cobranca });
    expect(elementos(m.g!.renderizar(AcoesContato, p)).find((n) => n.type === CobrancaContato)!.props).toMatchObject({ atendimentoId: "a1", cobranca });
    m.g = criarGanchos();
    const tela = () => m.g!.renderizar(CobrancaContato, { atendimentoId: "a1", cobranca, fuso: null, aoMudar: p.aoMudar });
    clicarBotao(tela(), "Promessa de pagamento");
    digitar(tela(), "Data da promessa de pagamento", "2026-10-25");
    clicarBotao(tela(), "Registrar promessa");
    await esvaziar();
    expect(acoes.registrarPromessaPagamento).toHaveBeenCalledWith("cob1", "2026-10-25", expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(acoes.marcarConversaTratada).toHaveBeenCalledWith({ conversaId: "a1", motivo: "promessa" });
    expect(marcacao(tela())).toContain("Promessa registrada");
  });

  it("promessa com chave de idempotência (#166): o reenvio depois do incerto manda a mesma chave; depois do sucesso, outra", async () => {
    m.g = criarGanchos();
    const tela = () => m.g!.renderizar(CobrancaContato, { atendimentoId: "a1", cobranca, fuso: null, aoMudar: vi.fn() });
    const registrar = async () => {
      if (!elementos(tela()).some((n) => n.type === "input" && n.props["aria-label"] === "Data da promessa de pagamento")) clicarBotao(tela(), "Promessa de pagamento");
      digitar(tela(), "Data da promessa de pagamento", "2026-10-25");
      clicarBotao(tela(), "Registrar promessa");
      await esvaziar();
    };
    acoes.registrarPromessaPagamento.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await registrar();
    expect(marcacao(tela())).toContain(MSG_RESULTADO_INCERTO);
    await registrar();
    await registrar();
    const chaves = acoes.registrarPromessaPagamento.mock.calls.map((c) => (c as unknown[])[2]);
    expect(chaves).toHaveLength(3);
    expect(chaves[1]).toBe(chaves[0]);
    expect(chaves[2]).not.toBe(chaves[0]);
  });
});

describe("InboxNovo liga as ações do contato no painel (fonte)", () => {
  it("o painel renderiza AcoesContato com as ações que o servidor mandou", () => {
    const fonte = readFileSync("src/app/(app)/inbox/InboxNovo.tsx", "utf8");
    expect(fonte).toMatch(/<AcoesContato[^>]*acoes=\{painelSetor\.dado\.acoes\}/);
  });
});
