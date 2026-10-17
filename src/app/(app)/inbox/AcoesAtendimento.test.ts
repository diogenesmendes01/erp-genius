import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/whatsapp/acoes-atendimento", () => ({ assumirAtendimento: vi.fn(), atribuirAtendimento: vi.fn(), convidarParticipante: vi.fn(), devolverParaFila: vi.fn(), transferirAtendimento: vi.fn() }));
vi.mock("@/server/whatsapp/acoes-conversa", () => ({ agendarMensagemNoAtendimento: vi.fn(), registrarNotaAtendimento: vi.fn() }));
vi.mock("@/server/whatsapp/consultas-acoes-atendimento", () => ({ listarPessoasParaAtendimento: vi.fn(), origemVisivelDaTransferencia: vi.fn() }));
vi.mock("@/server/whatsapp/operacoes-atendimento", () => ({ encerrarAtendimentoWhatsApp: vi.fn() }));
vi.mock("@/server/whatsapp/preferencias", () => ({ alternarFixada: vi.fn(), silenciarConversa: vi.fn() }));

import { AVISO_RECURSO_MOTOR } from "@/components/conversa/recursos-canal";
import type { Setor } from "@/server/whatsapp/setor";
import { AcoesAtendimento, DialogoTransferir, validarQuando } from "./AcoesAtendimento";
import { ConversaAberta, textoOrigem } from "./ConversaAberta";

type Opcoes = { papeis?: Papel[]; responsavelId?: string | null; finalidade?: Setor; status?: string; linhaComercial?: boolean; donoLinhaId?: string | null };
const html = (o: Opcoes = {}) =>
  renderToStaticMarkup(createElement(AcoesAtendimento, {
    atendimento: { id: "a1", finalidade: o.finalidade ?? "COMERCIAL", responsavelId: o.responsavelId === undefined ? "eu" : o.responsavelId, status: o.status ?? "EM_ATENDIMENTO" },
    usuario: { id: "eu", papeis: o.papeis ?? [Papel.VENDEDOR] },
    setoresDoNumero: ["COMERCIAL", "SECRETARIA"], fixada: false, silenciada: false,
    linhaComercial: o.linhaComercial, donoLinhaId: o.donoLinhaId,
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
  const agora = new Date("2026-10-17T12:00:00");
  it("vazio, inválido, passado e agora são recusados; futuro passa", () => {
    expect(validarQuando("", agora)).not.toBeNull();
    expect(validarQuando("xx", agora)).not.toBeNull();
    expect(validarQuando("2026-10-17T11:59", agora)).toBe("Escolha um horário no futuro.");
    expect(validarQuando("2026-10-17T12:00", agora)).toBe("Escolha um horário no futuro.");
    expect(validarQuando("2026-10-17T12:01", agora)).toBeNull();
  });
});

describe("ConversaAberta", () => {
  it("cadeia de transferência: 'Transferido de Comercial' só quando há setor visível", () => {
    expect(textoOrigem("COMERCIAL")).toBe("Transferido de Comercial");
    expect(textoOrigem(null)).toBeNull();
  });
  it("cabeçalho com setor, número, status e responsável, e as ações", () => {
    const item = { id: "a1", numeroId: "n1", numeroRotulo: "Cobrança", finalidade: "FINANCEIRO", driver: "BAILEYS", contatoId: "c1", contatoNome: "Maria Souza", contatoTelefone: "+5511999990000",
      optOut: false, vinculo: null, naoLidas: 0, ultimaMensagemEm: null, preview: null, linhaComercial: false, status: "ABERTO_SEM_RESPONSAVEL", responsavelNome: null, prazoRespostaEm: null,
      fixada: false, silenciada: false, grupo: false, responsavelId: null, numeroDonoId: null, setoresDoNumero: ["FINANCEIRO"], atendimentoOrigemId: null };
    const conversa = { mensagens: [], notas: [], temMaisAntes: false, carregandoAntigas: false, erro: null, maisAntigas: vi.fn() };
    const h = renderToStaticMarkup(createElement(ConversaAberta, { item, usuario: { id: "eu", papeis: [Papel.FINANCEIRO] }, fuso: null, conversa, aoVoltar: vi.fn(), aoAbrirPainel: vi.fn(), aoMudar: vi.fn() } as never));
    for (const t of ["Maria Souza", "Financeiro", "Cobrança", "Na fila", "Sem responsável", "Assumir"]) expect(h).toContain(t);
    expect(h).not.toContain("+5511999990000");
  });
});
