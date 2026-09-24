import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/server/whatsapp/acoes", () => ({ buscarVinculosInbox: vi.fn(), enviarMidiaInbox: vi.fn(), enviarTextoInbox: vi.fn(), marcarConversaLida: vi.fn(), marcarConversaTratada: vi.fn(), registrarOptOutContato: vi.fn(), removerOptOutContato: vi.fn(), vincularContatoWhatsApp: vi.fn() }));
vi.mock("@/server/cobrancas/acoes", () => ({ registrarPromessaPagamento: vi.fn() }));
vi.mock("@/server/comercial/acoes", () => ({ definirTemperatura: vi.fn(), moverEtapa: vi.fn(), registrarNotaInterna: vi.fn() }));

import { InboxCliente } from "./InboxCliente";

const mensagens = [
  { id: "m1", direcao: "ENTRADA", tipo: "TEXTO", corpo: "Oi", midiaPath: null, status: "RECEBIDA", origem: null, autorNome: null, templateNome: null, criadoEm: "2026-10-01T02:30:00.000Z" },
  { id: "m2", direcao: "SAIDA", tipo: "TEXTO", corpo: "Olá", midiaPath: null, status: "ENTREGUE", origem: "HUMANO", autorNome: "Equipe", templateNome: null, criadoEm: "2026-10-01T03:30:00.000Z" },
];

const thread = {
  conversaId: "atendimento", finalidade: "COMERCIAL", matricula: null, podeEnviar: true, podeVincular: false, podeReautorizar: false, pendenciaDestinatario: null,
  numero: { id: "numero", rotulo: "Escola", driver: "META_CLOUD", finalidade: "COMERCIAL", sessao: "s", ativo: true },
  contato: { id: "contato", nome: "Ana", telefone: "+506", optOutEm: "2026-10-01T02:30:00.000Z", alunoId: null, alunoNome: null, responsavelId: null, responsavelNome: null, leadId: "lead", leadNome: "Ana" },
  janela24h: { aberta: true, fechaEm: "2026-10-01T04:30:00.000Z" }, silencio: { ativo: false, ate: null }, cobrancaAtiva: null,
  lead: { id: "lead", nome: "Ana", etapa: "EXPERIMENTAL_AGENDADA", temperatura: "MORNO", dataExperimental: "2026-10-01T02:30:00.000Z", etapasPermitidas: [], notas: [{ id: "nota", nota: "ligar", autorNome: "Equipe", criadoEm: "2026-10-01T03:30:00.000Z" }] },
  mensagens,
};

describe("InboxCliente", () => {
  it("usa a preferência nos instantes e agrupa mensagens pela mesma data local", () => {
    const html = renderToStaticMarkup(createElement(InboxCliente, {
      conversas: [{ id: "atendimento", numeroId: "numero", numeroRotulo: "Escola", finalidade: "COMERCIAL", driver: "META_CLOUD", contatoId: "contato", contatoNome: "Ana", contatoTelefone: "+506", optOut: true, vinculo: null, naoLidas: 0, ultimaMensagemEm: mensagens[1].criadoEm, preview: "Olá" }],
      thread, podeCobranca: false, preferenciaFusoExibicao: "America/Costa_Rica",
    } as never));
    expect(html).toContain("30/09/2026");
    expect(html).toMatch(/30\/09\/2026.*20:30/);
    expect(html).toMatch(/30\/09\/2026.*21:30/);
    expect(html).toContain("experimental 30/09/2026, 20:30");
    expect(html).toContain("Notas internas");
  });

  it("não inventa vencimento civil quando a origem exige conferência", () => {
    const html = renderToStaticMarkup(createElement(InboxCliente, {
      conversas: [],
      thread: { ...thread, finalidade: "FINANCEIRO", contato: { ...thread.contato, optOutEm: null }, cobrancaAtiva: { id: "cobranca", matriculaId: "m", alunoId: "a", alunoNome: "Ana", moeda: "CRC", valorNegociado: 100, valorRecebido: 0, saldo: 100, status: "PENDENTE", vencimento: { estado: "A_CONFERIR", motivo: "legado" } } },
      podeCobranca: true, preferenciaFusoExibicao: null,
    } as never));
    expect(html).toContain("vence em conferência");
    expect(html).not.toContain("2099");
  });

  it("formata a janela de 24 horas e o silêncio como instantes, sem alterar os comandos", () => {
    const html = renderToStaticMarkup(createElement(InboxCliente, {
      conversas: [],
      thread: { ...thread, contato: { ...thread.contato, optOutEm: null }, silencio: { ativo: true, ate: "2026-10-01T03:30:00.000Z" } },
      podeCobranca: true, preferenciaFusoExibicao: "America/Costa_Rica",
    } as never));
    expect(html).toContain("janela 24h aberta até 30/09/2026, 22:30");
    expect(html).toContain("silêncio até 30/09/2026, 21:30");
    expect(html).toContain('placeholder="Escreva uma mensagem (Enter envia)"');
  });
});

describe("InboxCliente — master-detail no celular (E6)", () => {
  const conversa = { id: "atendimento", numeroId: "numero", numeroRotulo: "Escola", finalidade: "COMERCIAL", driver: "META_CLOUD", contatoId: "contato", contatoNome: "Ana", contatoTelefone: "+506", optOut: false, vinculo: null, naoLidas: 0, ultimaMensagemEm: null, preview: null };
  const render = (comThread: boolean) => renderToStaticMarkup(createElement(InboxCliente, {
    conversas: [conversa], thread: comThread ? thread : null, podeCobranca: false, preferenciaFusoExibicao: null,
  } as never));
  // Classe da coluna que contém a busca de conversas (a lista).
  const classeDaLista = (html: string) => html.match(/<div class="([^"]*)"><div class="border-b border-gray-100 p-2"><input[^>]*aria-label="Buscar conversas por contato"/)?.[1] ?? "";

  it("sem conversa aberta: a lista ocupa a tela; o aviso de escolher só aparece a partir de md", () => {
    const html = render(false);
    const lista = classeDaLista(html);
    expect(lista.split(" ")).toContain("flex");
    expect(lista.split(" ")).not.toContain("hidden");
    // Largura toda no celular; a coluna fixa (w-80) só a partir de md.
    expect(lista.split(" ")).toContain("w-full");
    expect(lista.split(" ")).not.toContain("w-80");
    expect(lista.split(" ")).toContain("md:w-80");
    expect(html).toMatch(/<div class="hidden [^"]*md:flex[^"]*">Escolha uma conversa ao lado\.<\/div>/);
    expect(html).not.toContain('href="/inbox"');
    // Itens da lista não submetem formulário algum.
    expect(html).toMatch(/<button type="button"[^>]*aria-current|<button type="button"[^>]*class="block w-full/);
  });

  it("thread com min-h-0 (seção e raiz): sem isso a rolagem das mensagens não encolhe e o compositor some", () => {
    const html = render(true);
    const secao = html.match(/<section aria-label="Conversa com Ana" class="([^"]*)"/)?.[1].split(" ") ?? [];
    expect(secao).toEqual(expect.arrayContaining(["flex", "min-h-0", "min-w-0", "flex-1", "flex-col"]));
    // Raiz do Thread: primeira div depois do link de volta.
    const raiz = html.match(/Conversas<\/a><div class="([^"]*)"/)?.[1].split(" ") ?? [];
    expect(raiz).toEqual(expect.arrayContaining(["min-h-0", "flex-1", "flex-col"]));
  });

  it("link de volta com alvo de toque de 40px", () => {
    const link = render(true).match(/<a[^>]*href="\/inbox"[^>]*>/)?.[0] ?? "";
    expect(link).toMatch(/class="[^"]*\bmin-h-10\b/);
  });

  it("com conversa aberta: a lista some abaixo de md e a thread tem o caminho de volta", () => {
    const html = render(true);
    const lista = classeDaLista(html).split(" ");
    expect(lista).toContain("hidden");
    expect(lista).toContain("md:flex");
    expect(lista).not.toContain("flex");
    expect(html).toContain('aria-label="Conversa com Ana"');
    expect(html).toMatch(/<a(?=[^>]*\shref="\/inbox")(?=[^>]*\sclass="[^"]*md:hidden[^"]*")[^>]*>(?:(?!<\/a>).)*Conversas<\/a>/);
    expect(html).toMatch(/<button[^>]*aria-current="true"/);
  });

  it("altura em dvh (100vh no celular inclui a barra do navegador); abaixo de md desconta a barra do shell", () => {
    const html = render(false);
    expect(html).toContain("h-[calc(100dvh-16.5rem)]");
    expect(html).toContain("md:h-[calc(100dvh-13rem)]");
    expect(html).not.toMatch(/\bh-\[calc\(100vh/);
  });
});
