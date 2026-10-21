import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/42 /pagar #2, #3, #4, #6 e #7 (docs/43 §6 item 8): a página trata cada situação do link e da cobrança com
// texto e saída; só pendente e vencida têm caminho de pagamento. A consulta é mock (nenhum banco).
const m = vi.hoisted(() => ({ cobranca: vi.fn(), simulado: vi.fn() }));
vi.mock("@/server/financeiro/gateway", () => ({ cobrancaPorToken: m.cobranca, pagamentoSimuladoHabilitado: m.simulado }));
// O PagarCliente usa o router do App Router para renderizar a página de novo depois do pagamento.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import PagarPage, { metadata } from "./page";

const TOKEN = "0123456789abcdef0123456789abcdef";
const cobranca = (status: string) => ({ valor: 350.5, moeda: "BRL", vencimentoISO: "2026-10-15T00:00:00.000Z", status, descricao: "Mensalidade — Ana" });
async function abrir(token = TOKEN) {
  return renderToStaticMarkup(await PagarPage({ params: Promise.resolve({ token }) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  m.simulado.mockReturnValue(false);
});

describe("/pagar/[token]", () => {
  it("pendente: valor em reais com centavos, vencimento pela data civil e o caminho de pagamento", async () => {
    m.cobranca.mockResolvedValue(cobranca("PENDENTE"));
    const html = await abrir();
    expect(m.cobranca).toHaveBeenCalledWith(TOKEN);
    expect(html).toContain("Pagamento em aberto");
    expect(html).toContain("Mensalidade — Ana");
    expect(html).toMatch(/R\$\s350,50/);
    expect(html).toContain("Vencimento: 15/10/2026");
    expect(html).toContain("Pagamento online indisponível no momento");
  });

  it("pendente com o ambiente de teste ligado: botão de pagar do design system", async () => {
    m.cobranca.mockResolvedValue(cobranca("PENDENTE"));
    m.simulado.mockReturnValue(true);
    const html = await abrir();
    expect(html).toMatch(/<button(?=[^>]*type="button")(?=[^>]*bg-brand-solid)[^>]*>Pagar \(ambiente de teste\)<\/button>/);
  });

  it("vencida: avisa a data e mantém o caminho de pagamento", async () => {
    m.cobranca.mockResolvedValue(cobranca("ATRASADO"));
    m.simulado.mockReturnValue(true);
    const html = await abrir();
    expect(html).toContain("Cobrança vencida");
    expect(html).toContain("O vencimento era 15/10/2026");
    expect(html).toContain("Pagar (ambiente de teste)");
  });

  it("paga: confirma com ícone, sem valor e sem botão (mesmo com o ambiente de teste ligado)", async () => {
    m.cobranca.mockResolvedValue(cobranca("PAGO"));
    m.simulado.mockReturnValue(true);
    const html = await abrir();
    expect(html).toContain("Pagamento confirmado");
    expect(html).toContain("Não é preciso pagar de novo");
    expect(html).toContain("<svg");
    expect(html).not.toContain("✅");
    expect(html).not.toMatch(/R\$/);
    expect(html).not.toContain("<button");
  });

  it("cancelada: diz que não deve ser paga e não oferece pagamento nem valor", async () => {
    m.cobranca.mockResolvedValue(cobranca("CANCELADA"));
    m.simulado.mockReturnValue(true);
    const html = await abrir();
    expect(html).toContain("Cobrança cancelada");
    expect(html).toContain("não deve ser paga");
    expect(html).not.toMatch(/R\$/);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Pagamento online indisponível");
  });

  it("link no formato e sem cobrança: expirado ou substituído, com a saída", async () => {
    m.cobranca.mockResolvedValue(null);
    const html = await abrir();
    expect(html).toContain("Link de pagamento expirado");
    expect(html).toContain("Use o link mais recente que a escola enviou.");
    expect(html).not.toContain("<button");
  });

  it("link fora do formato: inválido, com a saída", async () => {
    m.cobranca.mockResolvedValue(null);
    const html = await abrir("link-cortado");
    expect(html).toContain("Link de pagamento inválido");
    expect(html).toContain("Abra de novo o link inteiro que você recebeu.");
  });

  it("não é indexada por buscadores", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
