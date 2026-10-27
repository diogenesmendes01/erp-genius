import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ g: null as null | import("@/test/tela-sem-dom").Ganchos }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useCallback: ((f: () => unknown, d: unknown[]) => m.g ? m.g.useCallback(f) : real.useCallback(f, d)) as typeof real.useCallback,
    useId: (() => m.g ? m.g.useId() : real.useId()) as typeof real.useId,
    useState: ((i: unknown) => (m.g ? m.g.useState(i) : real.useState(i as never))) as unknown as typeof real.useState,
    useRef: ((i: unknown) => (m.g ? m.g.useRef(i) : real.useRef(i as never))) as unknown as typeof real.useRef,
  };
});

import { FormEnquete, validarEnquete, type ConteudoEnquete } from "./FormEnquete";
import { FormLocalizacao, validarLocalizacao, DICA_COORDENADAS, ERRO_COORDENADAS, type ConteudoLocalizacao } from "./FormLocalizacao";
import { Botao } from "@/components/Botao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { Modal } from "@/components/Modal";
import { campo, clicarBotao, controle, criarGanchos, elementos, errosDosCampos, preencher, submeter, texto } from "@/test/tela-sem-dom";
import type { Resultado } from "@/server/_shared/resultado";

afterEach(() => { m.g = null; });
const esvaziar = () => new Promise((r) => setTimeout(r, 0));

const enviarBotao = (raiz: ReactNode) => elementos(raiz).find((n) => n.type === Botao && n.props.type === "submit")!;
const opcao = (raiz: ReactNode, i: number) => elementos(raiz).find((n) => n.type === "input" && n.props["aria-label"] === `Opção ${i}`)!;
const digitarOpcao = (raiz: ReactNode, i: number, v: string) => (opcao(raiz, i).props.onChange as (e: unknown) => void)({ target: { value: v } });
const erroAcao = (raiz: ReactNode) => elementos(raiz).find((n) => n.type === FeedbackAcao)!.props.erro;
const enviarEnquete = (impl: (c: ConteudoEnquete) => Promise<Resultado<unknown>> = async () => ({ ok: true })) => vi.fn<(c: ConteudoEnquete) => Promise<Resultado<unknown>>>(impl);
const enviarLocal = (impl: (c: ConteudoLocalizacao) => Promise<Resultado<unknown>> = async () => ({ ok: true })) => vi.fn<(c: ConteudoLocalizacao) => Promise<Resultado<unknown>>>(impl);

describe("validarEnquete", () => {
  it("monta o conteúdo com opções preenchidas e aparadas", () => {
    expect(validarEnquete("  Qual turno? ", [" Manhã ", "", "Noite"], 1)).toEqual({ ok: true, conteudo: { tipo: "ENQUETE", nome: "Qual turno?", opcoes: ["Manhã", "Noite"], maxEscolhas: 1 } });
  });
  it("recusa sem pergunta, com menos de 2 opções, repetidas ou escolhas fora do intervalo", () => {
    expect(validarEnquete(" ", ["a", "b"], 1)).toEqual({ ok: false, erro: "Informe a pergunta da enquete." });
    expect(validarEnquete("P", ["a", " "], 1)).toEqual({ ok: false, erro: "A enquete precisa de ao menos 2 opções." });
    expect(validarEnquete("P", ["Sim", "sim"], 1)).toEqual({ ok: false, erro: "As opções precisam ser diferentes." });
    expect(validarEnquete("P", ["a", "b"], 3)).toEqual({ ok: false, erro: "Escolhas por pessoa não pode passar do número de opções." });
    expect(validarEnquete("P", ["a", "b"], 0)).toEqual({ ok: false, erro: "Escolhas por pessoa: no mínimo 1." });
    expect(validarEnquete("P", Array.from({ length: 13 }, (_, i) => `o${i}`), 1)).toEqual({ ok: false, erro: "A enquete pode ter no máximo 12 opções." });
  });
});

describe("FormEnquete", () => {
  it("enquete: 'Enviar' só com pergunta e 2 opções; escolhas não passam do número de opções", () => {
    m.g = criarGanchos();
    const p = { aoEnviar: enviarEnquete(), aoFechar: vi.fn() };
    const tela = () => m.g!.renderizar(FormEnquete, p);
    expect(elementos(tela()).find((n) => n.type === Modal)!.props.titulo).toBe("Enviar enquete");
    expect(elementos(tela()).find((n) => n.type === Modal)!.props.folha).toBe(true);
    expect(enviarBotao(tela()).props.disabled).toBe(true);
    preencher(tela(), "enquete-pergunta", "Qual turno prefere?");
    expect(enviarBotao(tela()).props.disabled).toBe(true);
    digitarOpcao(tela(), 1, "Manhã");
    expect(enviarBotao(tela()).props.disabled).toBe(true);
    digitarOpcao(tela(), 2, "Noite");
    expect(enviarBotao(tela()).props.disabled).toBe(false);

    expect(elementos(tela()).some((n) => String(n.props["aria-label"]).startsWith("Remover opção"))).toBe(false);
    clicarBotao(tela(), "Adicionar opção");
    digitarOpcao(tela(), 3, "Tarde");
    expect(controle(campo(tela(), "enquete-escolhas")).props.max).toBe(3);
    preencher(tela(), "enquete-escolhas", "3");
    (elementos(tela()).find((n) => n.props["aria-label"] === "Remover opção 3")!.props.onClick as () => void)();
    expect(controle(campo(tela(), "enquete-escolhas")).props.value).toBe("2");
    expect(controle(campo(tela(), "enquete-escolhas")).props.max).toBe(2);

    for (let i = 0; i < 20; i++) if (elementos(tela()).some((n) => n.type === Botao && texto(n.props.children).includes("Adicionar opção"))) clicarBotao(tela(), "Adicionar opção");
    expect(elementos(tela()).filter((n) => n.type === "input" && String(n.props["aria-label"]).startsWith("Opção "))).toHaveLength(12);
    expect(p.aoEnviar).not.toHaveBeenCalled();
  });

  it("enquete: envia { tipo: 'ENQUETE', nome, opcoes, maxEscolhas } e fecha no sucesso", async () => {
    m.g = criarGanchos();
    const p = { aoEnviar: enviarEnquete(), aoFechar: vi.fn() };
    const tela = () => m.g!.renderizar(FormEnquete, p);
    preencher(tela(), "enquete-pergunta", " Qual turno? ");
    digitarOpcao(tela(), 1, "Manhã");
    digitarOpcao(tela(), 2, "Noite");
    clicarBotao(tela(), "Adicionar opção");
    digitarOpcao(tela(), 3, "Tarde");
    preencher(tela(), "enquete-escolhas", "2");
    await submeter(tela());
    await esvaziar();
    expect(p.aoEnviar).toHaveBeenCalledExactlyOnceWith({ tipo: "ENQUETE", nome: "Qual turno?", opcoes: ["Manhã", "Noite", "Tarde"], maxEscolhas: 2 });
    expect(p.aoFechar).toHaveBeenCalledOnce();
  });

  it("erro do servidor ('Este canal não envia esse tipo de conteúdo.') fica no formulário", async () => {
    m.g = criarGanchos();
    const p = { aoEnviar: enviarEnquete(async () => ({ ok: false, erro: "Este canal não envia esse tipo de conteúdo." })), aoFechar: vi.fn() };
    const tela = () => m.g!.renderizar(FormEnquete, p);
    preencher(tela(), "enquete-pergunta", "P");
    digitarOpcao(tela(), 1, "a");
    digitarOpcao(tela(), 2, "b");
    await submeter(tela());
    await esvaziar();
    expect(erroAcao(tela())).toBe("Este canal não envia esse tipo de conteúdo.");
    expect(p.aoFechar).not.toHaveBeenCalled();
    expect(controle(campo(tela(), "enquete-pergunta")).props.value).toBe("P");
  });

  it("clique duplo envia uma vez só", async () => {
    m.g = criarGanchos();
    let resolver!: (r: Resultado<unknown>) => void;
    const p = { aoEnviar: enviarEnquete(() => new Promise((r) => { resolver = r; })), aoFechar: vi.fn() };
    const tela = () => m.g!.renderizar(FormEnquete, p);
    preencher(tela(), "enquete-pergunta", "P");
    digitarOpcao(tela(), 1, "a");
    digitarOpcao(tela(), 2, "b");
    const primeiro = submeter(tela());
    const segundo = submeter(tela());
    resolver({ ok: true });
    await primeiro; await segundo; await esvaziar();
    expect(p.aoEnviar).toHaveBeenCalledOnce();
  });

  it("validação local mostra o erro sem chamar o servidor", async () => {
    m.g = criarGanchos();
    const p = { aoEnviar: enviarEnquete(), aoFechar: vi.fn() };
    const tela = () => m.g!.renderizar(FormEnquete, p);
    preencher(tela(), "enquete-pergunta", "P");
    digitarOpcao(tela(), 1, "Sim");
    digitarOpcao(tela(), 2, "sim");
    await submeter(tela());
    expect(erroAcao(tela())).toBe("As opções precisam ser diferentes.");
    expect(p.aoEnviar).not.toHaveBeenCalled();
  });
});

describe("FormLocalizacao", () => {
  it("validarLocalizacao: link obrigatório, nome opcional", () => {
    expect(validarLocalizacao("", "-23.5, -46.6")).toEqual({ ok: true, conteudo: { tipo: "LOCALIZACAO", latitude: -23.5, longitude: -46.6 } });
    expect(validarLocalizacao(" Escola ", "-23.5, -46.6")).toEqual({ ok: true, conteudo: { tipo: "LOCALIZACAO", latitude: -23.5, longitude: -46.6, nome: "Escola" } });
    expect(validarLocalizacao("", "Av. Paulista")).toEqual({ ok: false, erro: ERRO_COORDENADAS });
  });

  it("mostra a dica, envia as coordenadas do link e fecha no sucesso", async () => {
    m.g = criarGanchos();
    const p = { aoEnviar: enviarLocal(), aoFechar: vi.fn() };
    const tela = () => m.g!.renderizar(FormLocalizacao, p);
    expect(elementos(tela()).find((n) => n.type === Modal)!.props.titulo).toBe("Enviar localização");
    expect(campo(tela(), "localizacao-link").props.dica).toBe(DICA_COORDENADAS);
    expect(DICA_COORDENADAS).toBe("Cole o link do Google Maps ou digite latitude, longitude.");
    expect(enviarBotao(tela()).props.disabled).toBe(true);
    preencher(tela(), "localizacao-nome", "Unidade Paulista");
    preencher(tela(), "localizacao-link", "https://www.google.com/maps/place/X/@-23.5614,-46.6559,17z");
    expect(enviarBotao(tela()).props.disabled).toBe(false);
    await submeter(tela());
    await esvaziar();
    expect(p.aoEnviar).toHaveBeenCalledExactlyOnceWith({ tipo: "LOCALIZACAO", latitude: -23.5614, longitude: -46.6559, nome: "Unidade Paulista" });
    expect(p.aoFechar).toHaveBeenCalledOnce();
  });

  it("texto que não é coordenada marca o campo e não envia; erro do servidor fica no formulário", async () => {
    m.g = criarGanchos();
    const p = { aoEnviar: enviarLocal(async () => ({ ok: false, erro: "Este canal não envia esse tipo de conteúdo." })), aoFechar: vi.fn() };
    const tela = () => m.g!.renderizar(FormLocalizacao, p);
    preencher(tela(), "localizacao-link", "Av. Paulista, 1000");
    await submeter(tela());
    expect(errosDosCampos(tela())).toEqual({ "localizacao-link": ERRO_COORDENADAS });
    expect(p.aoEnviar).not.toHaveBeenCalled();
    preencher(tela(), "localizacao-link", "-23.5, -46.6");
    expect(errosDosCampos(tela())).toEqual({});
    await submeter(tela());
    await esvaziar();
    expect(p.aoEnviar).toHaveBeenCalledExactlyOnceWith({ tipo: "LOCALIZACAO", latitude: -23.5, longitude: -46.6 });
    expect(erroAcao(tela())).toBe("Este canal não envia esse tipo de conteúdo.");
    expect(p.aoFechar).not.toHaveBeenCalled();
  });
});
