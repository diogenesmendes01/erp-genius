import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const permissao = vi.hoisted(() => ({ enviar: true, chamadas: [] as unknown[][] }));
vi.mock("@/server/inbox/permissoes", async (orig) => {
  const real = await orig<typeof import("@/server/inbox/permissoes")>();
  return { ...real, podeExecutar: (...args: Parameters<typeof real.podeExecutar>) => {
    permissao.chamadas.push(args);
    return args[1] === "enviar" ? permissao.enviar : real.podeExecutar(...args);
  } };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/whatsapp/acoes", () => ({ enviarMidiaInbox: vi.fn(), enviarTextoInbox: vi.fn() }));
vi.mock("@/server/whatsapp/acoes-atendimento", () => ({ assumirAtendimento: vi.fn(), atribuirAtendimento: vi.fn(), convidarParticipante: vi.fn(), devolverParaFila: vi.fn(), revogarParticipante: vi.fn(), transferirAtendimento: vi.fn() }));
vi.mock("@/server/whatsapp/acoes-conversa", () => ({ agendarMensagemNoAtendimento: vi.fn(), cancelarAgendamentoDoAtendimento: vi.fn(), registrarNotaAtendimento: vi.fn() }));
vi.mock("@/server/whatsapp/consultas-acoes-atendimento", () => ({ listarConvitesEAgendamentos: vi.fn(() => new Promise(() => {})), listarPessoasParaAtendimento: vi.fn(), origemVisivelDaTransferencia: vi.fn() }));
vi.mock("@/server/whatsapp/operacoes-atendimento", () => ({ encerrarAtendimentoWhatsApp: vi.fn() }));
vi.mock("@/server/whatsapp/preferencias", () => ({ alternarFixada: vi.fn(), silenciarConversa: vi.fn() }));

import { BalaoMensagem } from "@/components/conversa/BalaoMensagem";
import type { MensagemThread } from "@/server/whatsapp/consultas-inbox";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { COMANDOS_MENSAGEM_LIGADOS, podeEnviarNaConversa } from "./ConversaAberta";

const usuario = { id: "u1", papeis: [Papel.VENDEDOR] };
const item = (o: Partial<ItemListaInbox> = {}): ItemListaInbox => ({
  id: "a1", numeroId: "n1", numeroRotulo: "Comercial", finalidade: "COMERCIAL", driver: "MOTOR", contatoId: "c1", contatoNome: "Ana",
  contatoTelefone: "+5511999990000", optOut: false, vinculo: null, naoLidas: 0, ultimaMensagemEm: null, preview: null, linhaComercial: false,
  status: "EM_ATENDIMENTO", responsavelNome: null, prazoRespostaEm: null, fixada: false, silenciada: false, grupo: false,
  responsavelId: "u1", numeroDonoId: null, setoresDoNumero: ["COMERCIAL"], atendimentoOrigemId: null, ...o,
});
const msg: MensagemThread = {
  id: "m1", direcao: "SAIDA", tipo: "TEXTO", corpo: "Olá", midiaPath: null, status: "ENVIADA", origem: "HUMANO",
  autorNome: null, templateNome: null, criadoEm: "2026-10-17T15:30:00.000Z", participanteNome: null, favorita: false, clientMessageId: null,
};

describe("ConversaAberta: menu da mensagem só com comandos ligados (C3 da R1 do #217)", () => {
  it("a lista de comandos ligados é só copiar", () => {
    expect([...COMANDOS_MENSAGEM_LIGADOS]).toEqual(["copiar"]);
  });
  it("BalaoMensagem com `comandos` esconde os itens sem ação", () => {
    const h = renderToStaticMarkup(createElement(BalaoMensagem, { m: msg, fuso: null, aoComando: () => {}, recursos: () => true, menuAberto: true, comandos: COMANDOS_MENSAGEM_LIGADOS }));
    expect(h).toContain("Copiar");
    for (const r of ["Responder", "Reagir", "Encaminhar", "Favoritar", "Editar", "Apagar"]) expect(h).not.toContain(`aria-label="${r}"`);
  });
  it("sem `comandos` o balão mantém o menu completo (outros usos)", () => {
    const h = renderToStaticMarkup(createElement(BalaoMensagem, { m: msg, fuso: null, aoComando: () => {}, recursos: () => true, menuAberto: true }));
    for (const r of ["Responder", "Copiar", "Reagir", "Encaminhar", "Favoritar", "Editar", "Apagar"]) expect(h).toContain(`aria-label="${r}"`);
  });
  it("a conversa passa a lista de comandos ligados ao balão (fonte)", () => {
    const fonte = readFileSync("src/app/(app)/inbox/ConversaAberta.tsx", "utf8");
    expect(fonte).toMatch(/<BalaoMensagem[\s\S]*?comandos=\{COMANDOS_MENSAGEM_LIGADOS\}/);
  });
});

describe("ConversaAberta: o compositor respeita a alçada e o status (C4 da R1 do #217)", () => {
  it("atendimento aberto e alçada de envio: pode enviar", () => {
    permissao.enviar = true; permissao.chamadas = [];
    expect(podeEnviarNaConversa(usuario, item())).toBe(true);
    expect(permissao.chamadas).toContainEqual([usuario, "enviar", { setor: "COMERCIAL", responsavelId: "u1", linhaComercial: false, donoLinhaId: null }]);
  });
  it("sem a alçada de envio (podeExecutar nega): não envia", () => {
    permissao.enviar = false;
    expect(podeEnviarNaConversa(usuario, item())).toBe(false);
    permissao.enviar = true;
  });
  it("atendimento encerrado não envia, mesmo com a alçada", () => {
    expect(podeEnviarNaConversa(usuario, item({ status: "ENCERRADO" }))).toBe(false);
  });
  it("o compositor não usa mais `podeEnviar` fixo (fonte)", () => {
    const fonte = readFileSync("src/app/(app)/inbox/ConversaAberta.tsx", "utf8");
    expect(fonte).not.toMatch(/\bpodeEnviar\s*\n/);
    expect(fonte).toMatch(/podeEnviar=\{podeEnviarNaConversa\(usuario, item\)\}/);
  });
});
