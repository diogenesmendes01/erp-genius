import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { Papel, DriverWhatsApp } from "@prisma/client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/whatsapp/acoes-atendimento", () => ({ assumirAtendimento: vi.fn(), atribuirAtendimento: vi.fn(), convidarParticipante: vi.fn(), devolverParaFila: vi.fn(), revogarParticipante: vi.fn(), transferirAtendimento: vi.fn() }));
vi.mock("@/server/whatsapp/acoes-conversa", () => ({ agendarMensagemNoAtendimentoLocal: vi.fn(), agendarMensagemNoAtendimento: vi.fn(), cancelarAgendamentoDoAtendimento: vi.fn(), registrarNotaAtendimento: vi.fn() }));
vi.mock("@/server/whatsapp/consultas-acoes-atendimento", () => ({ listarConvitesEAgendamentos: vi.fn(() => new Promise(() => {})), listarPessoasParaAtendimento: vi.fn(), origemVisivelDaTransferencia: vi.fn() }));
vi.mock("@/server/whatsapp/operacoes-atendimento", () => ({ encerrarAtendimentoWhatsApp: vi.fn() }));
vi.mock("@/server/whatsapp/preferencias", () => ({ alternarFixada: vi.fn(), silenciarConversa: vi.fn() }));

import { AVISO_RECURSO_MOTOR } from "@/components/conversa/recursos-canal";
import type { Setor } from "@/server/whatsapp/setor";
import { Modal } from "@/components/Modal";
import { AcoesAtendimento, DialogoPendentes, DialogoPessoa, DialogoTransferir, quandoPendente, validarQuando } from "./AcoesAtendimento";
import { ConversaAberta, textoOrigem } from "./ConversaAberta";

type Opcoes = { papeis?: Papel[]; responsavelId?: string | null; finalidade?: Setor; status?: string; linhaComercial?: boolean; donoLinhaId?: string | null };
const html = (o: Opcoes = {}) =>
  renderToStaticMarkup(createElement(AcoesAtendimento, {
    atendimento: { id: "a1", finalidade: o.finalidade ?? "COMERCIAL", responsavelId: o.responsavelId === undefined ? "eu" : o.responsavelId, status: o.status ?? "EM_ATENDIMENTO" },
    usuario: { id: "eu", papeis: o.papeis ?? [Papel.VENDEDOR] },
    setoresDoNumero: ["COMERCIAL", "SECRETARIA"], fixada: false, silenciada: false,
    linhaComercial: o.linhaComercial, donoLinhaId: o.donoLinhaId, fuso: "America/Sao_Paulo",
  } as never));
const htmlTransferir = (o: { setoresDoNumero: Setor[]; finalidade: Setor }) =>
  renderToStaticMarkup(createElement(DialogoTransferir, { atendimentoId: "a1", aoFechar: vi.fn(), aoConcluir: vi.fn(), ...o }));

describe("AcoesAtendimento", () => {
  it("vendedor responsável: Transferir, Convidar, Devolver para a fila, Nota, Agendar; sem Encerrar e sem Atribuir", () => {
    const h = html({ papeis: [Papel.VENDEDOR], responsavelId: "eu" });
    for (const t of ["Transferir", "Convidar", "Devolver para a fila", "Nota interna", "Agendar mensagem"]) expect(h).toContain(t);
    expect(h).not.toContain("Encerrar atendimento"); expect(h).not.toContain("Atribuir");
  });
  it("fila: só Assumir", () => {
    const h = html({ papeis: [Papel.FINANCEIRO], responsavelId: null, finalidade: "FINANCEIRO", status: "ABERTO_SEM_RESPONSAVEL" });
    expect(h).toContain("Assumir");
    for (const t of ["Devolver para a fila", "Transferir", "Convidar", "Atribuir"]) expect(h).not.toContain(t);
  });
  it("gerente do setor: Atribuir e Encerrar atendimento; Bloquear desabilitado com o aviso do motor", () => {
    const h = html({ papeis: [Papel.GERENTE_COMERCIAL], responsavelId: "outro" });
    expect(h).toContain("Atribuir"); expect(h).toContain("Encerrar atendimento");
    expect(h).toMatch(/<button[^>]*disabled=""[^>]*>Bloquear<\/button>/);
    expect(h).toContain(AVISO_RECURSO_MOTOR);
  });
  it("vendedor não vê Bloquear", () => { expect(html({ papeis: [Papel.VENDEDOR] })).not.toContain("Bloquear"); });
  it("transferir só lista setores do número diferentes do atual", () => {
    expect(htmlTransferir({ setoresDoNumero: ["COMERCIAL", "SECRETARIA"], finalidade: "COMERCIAL" })).toMatch(/Secretaria(?![\s\S]*Comercial)/);
  });
  it("não existe Arquivar; preferências dizem 'só para você'", () => {
    const h = html({}); expect(h).not.toContain("Arquivar"); expect(h).toContain("só para você");
  });
  it("encerrado: só as preferências pessoais", () => {
    const h = html({ papeis: [Papel.GERENTE_COMERCIAL], status: "ENCERRADO" });
    for (const t of ["Transferir", "Encerrar atendimento", "Nota interna", "Assumir"]) expect(h).not.toContain(t);
    expect(h).toContain("Fixar");
  });

  describe("C3: Assumir numa linha de vendas só para quem não seria recusado", () => {
    const fila = { responsavelId: null, status: "ABERTO_SEM_RESPONSAVEL", linhaComercial: true };
    it("vendedor que não é o dono da linha não vê Assumir", () => {
      expect(html({ ...fila, papeis: [Papel.VENDEDOR], donoLinhaId: null })).not.toContain("Assumir");
      expect(html({ ...fila, papeis: [Papel.VENDEDOR], donoLinhaId: "outro" })).not.toContain("Assumir");
    });
    it("o dono da linha e o gerente veem Assumir", () => {
      expect(html({ ...fila, papeis: [Papel.VENDEDOR], donoLinhaId: "eu" })).toContain("Assumir");
      expect(html({ ...fila, papeis: [Papel.GERENTE_COMERCIAL], donoLinhaId: null })).toContain("Assumir");
    });
    it("fora de linha de vendas o vendedor assume da fila", () => {
      expect(html({ ...fila, linhaComercial: false, papeis: [Papel.VENDEDOR] })).toContain("Assumir");
    });
  });
});

describe("agendar recusa horário passado na própria tela", () => {
  // Lote 3 do fuso pessoal: o horário é lido no fuso escrito ao lado do campo, não no do navegador. `agora` é um
  // instante absoluto; as expectativas passam em TZ=UTC e America/Sao_Paulo.
  const agora = new Date("2026-10-17T15:00:00Z"); // 12:00 em São Paulo
  it("vazio, inválido, passado e agora são recusados; futuro passa — no fuso do campo", () => {
    expect(validarQuando("", "America/Sao_Paulo", agora)).not.toBeNull();
    expect(validarQuando("xx", "America/Sao_Paulo", agora)).not.toBeNull();
    expect(validarQuando("2026-10-17T11:59", "America/Sao_Paulo", agora)).toBe("Escolha um horário no futuro.");
    expect(validarQuando("2026-10-17T12:00", "America/Sao_Paulo", agora)).toBe("Escolha um horário no futuro.");
    expect(validarQuando("2026-10-17T12:01", "America/Sao_Paulo", agora)).toBeNull();
    // O mesmo texto em UTC é 3 horas antes: já passou.
    expect(validarQuando("2026-10-17T12:01", "UTC", agora)).toBe("Escolha um horário no futuro.");
    expect(validarQuando("2026-10-17T12:01", "Fuso/Invalido", agora)).toMatch(/fuso válido/);
  });
});

describe("ConversaAberta", () => {
  it("cadeia de transferência: 'Transferido de Comercial' só quando há setor visível", () => {
    expect(textoOrigem("COMERCIAL")).toBe("Transferido de Comercial");
    expect(textoOrigem(null)).toBeNull();
  });
  it("cabeçalho com setor, número, status e responsável, e as ações", () => {
    const item = { id: "a1", numeroId: "n1", numeroRotulo: "Cobrança", finalidade: "FINANCEIRO", driver: DriverWhatsApp.BAILEYS, contatoId: "c1", contatoNome: "Maria Souza", contatoTelefone: "+5511999990000",
      optOut: false, vinculo: null, naoLidas: 0, ultimaMensagemEm: null, preview: null, linhaComercial: false, status: "ABERTO_SEM_RESPONSAVEL", responsavelNome: null, prazoRespostaEm: null,
      fixada: false, silenciada: false, grupo: false, responsavelId: null, numeroDonoId: null, setoresDoNumero: ["FINANCEIRO"], atendimentoOrigemId: null };
    const conversa = { mensagens: [], notas: [], temMaisAntes: false, carregandoAntigas: false, erro: null, maisAntigas: vi.fn() };
    const h = renderToStaticMarkup(createElement(ConversaAberta, { item, usuario: { id: "eu", papeis: [Papel.FINANCEIRO] }, fuso: null, conversa, aoVoltar: vi.fn(), aoAbrirPainel: vi.fn(), aoMudar: vi.fn() } as never));
    for (const t of ["Maria Souza", "Financeiro", "Cobrança", "Na fila", "Sem responsável", "Assumir"]) expect(h).toContain(t);
    expect(h).not.toContain("+5511999990000");
  });
});

describe("revogar convite e cancelar agendamento pedem confirmação; diálogos viram bottom sheet no celular", () => {
  it("quem pode convidar ou agendar vê 'Convites e agendamentos'; atendimento encerrado, não", () => {
    expect(html({ papeis: [Papel.VENDEDOR] })).toContain("Convites e agendamentos");
    expect(html({ papeis: [Papel.VENDEDOR], status: "ENCERRADO" })).not.toContain("Convites e agendamentos");
    expect(html({ papeis: [Papel.FINANCEIRO], responsavelId: null, finalidade: "FINANCEIRO", status: "ABERTO_SEM_RESPONSAVEL" })).toContain("Convites e agendamentos"); // pode agendar
  });
  it("o diálogo abre como folha (bottom sheet) e carrega a lista", () => {
    const h = renderToStaticMarkup(createElement(DialogoPendentes, { atendimentoId: "a1", fuso: "America/Sao_Paulo", aoFechar: vi.fn(), aoConcluir: vi.fn() }));
    expect(h).toContain("Convites e agendamentos"); expect(h).toContain("Carregando");
    expect(h).toContain("items-end");
  });
  it("Modal: sem `folha` continua centralizado; com `folha` ancora embaixo no celular e volta ao centro a partir de sm", () => {
    const base = renderToStaticMarkup(createElement(Modal, { titulo: "x", aoFechar: vi.fn() }));
    const folha = renderToStaticMarkup(createElement(Modal, { titulo: "x", aoFechar: vi.fn(), folha: true }));
    expect(base).not.toContain("items-end");
    expect(folha).toMatch(/items-end p-0 sm:items-center sm:p-4/);
    expect(folha).toContain("rounded-b-none");
  });
  it("Modal: com `folha` e `telaCheiaNoCelular` juntos, a tela cheia do celular manda no layout (merge 2F × 3F)", () => {
    const ambos = renderToStaticMarkup(createElement(Modal, { titulo: "x", aoFechar: vi.fn(), folha: true, telaCheiaNoCelular: true }));
    expect(ambos).not.toContain("items-end");
    expect(ambos).not.toContain("rounded-b-none");
    expect(ambos).toContain("h-dvh w-full max-w-none rounded-none");
  });
  it("revogar e cancelar só rodam dentro da prop `acao` de um ConfirmarAcao (fonte)", () => {
    const fonte = readFileSync("src/app/(app)/inbox/AcoesAtendimento.tsx", "utf8");
    const usos = (nome: string) => fonte.match(new RegExp(`${nome}\\(`, "g"))?.length ?? 0;
    expect(usos("revogarParticipante")).toBe(1);
    expect(usos("cancelarAgendamentoDoAtendimento")).toBe(1);
    expect(fonte).toMatch(/<ConfirmarAcao[^>]*\n\s*folha\n[\s\S]*?acao=\{\(\) => \(convite \? revogarParticipante\([^)]*\) : cancelarAgendamentoDoAtendimento\(/);
    expect(fonte.match(/<Modal /g)!.length).toBe(fonte.match(/<Modal folha /g)!.length);
  });
});

describe("diálogos carregam fora do render (efeito, não chamada no corpo do componente)", () => {
  it("DialogoPessoa e DialogoPendentes não chamam a server action durante o render", async () => {
    const consultas = await import("@/server/whatsapp/consultas-acoes-atendimento");
    vi.mocked(consultas.listarPessoasParaAtendimento).mockClear();
    vi.mocked(consultas.listarConvitesEAgendamentos).mockClear();
    const h = renderToStaticMarkup(createElement(DialogoPessoa, { atendimentoId: "a1", modo: "atribuir", aoFechar: vi.fn(), aoConcluir: vi.fn() }));
    expect(h).toContain("Carregando…");
    renderToStaticMarkup(createElement(DialogoPendentes, { atendimentoId: "a1", fuso: "America/Sao_Paulo", aoFechar: vi.fn(), aoConcluir: vi.fn() }));
    expect(consultas.listarPessoasParaAtendimento).not.toHaveBeenCalled();
    expect(consultas.listarConvitesEAgendamentos).not.toHaveBeenCalled();
    const fonte = readFileSync("src/app/(app)/inbox/AcoesAtendimento.tsx", "utf8");
    expect(fonte).not.toMatch(/setCarregou|as Resultado\b/);
  });
});

// Fuso pessoal nas telas (pendência da Q176): o fim do convite e o horário do agendamento saíam no fuso do
// navegador (Intl sem timeZone). Agora no fuso de exibição resolvido pela página; o resultado não depende do TZ.
describe("convites e agendamentos no fuso de exibição", () => {
  it("o mesmo instante, em São Paulo e em Costa Rica, cruzando o dia", () => {
    expect(quandoPendente("2026-10-21T02:30:00.000Z", "America/Sao_Paulo")).toBe("20/10/2026, 23:30");
    expect(quandoPendente("2026-10-21T02:30:00.000Z", "America/Costa_Rica")).toBe("20/10/2026, 20:30");
  });
});
