import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROTULOS_TRILHA, SEM_PAGINA, rotuloDoDestino, trilhaDoCaminho } from "./trilha";
import { SECOES_MATRICULA } from "@/app/(app)/matriculas/[id]/secoes";

/** Rotas com page.tsx em src/app/(app), com `*` no lugar dos segmentos dinâmicos e sem grupos. */
const ROTAS = new Set(
  (readdirSync("src/app/(app)", { recursive: true }) as string[])
    .filter((f) => /(^|[\\/])page\.tsx$/.test(f))
    .map((f) => ("/" + join(f, "..").split("\\").join("/"))
      .replace(/\/\([^/]*\)/g, "")
      .replace(/\[[^\]]+\]/g, "*")
      .replace(/\/\.$/, "") || "/"),
);

const resumo = (caminho: string) => trilhaDoCaminho(caminho).map((i) => `${i.rotulo}${i.atual ? "" : ` → ${i.href}`}`);

/**
 * Páginas que de propósito ficam fora do mapa (C22 da #170: eram 60 de 181). Cada uma com o motivo —
 * página nova entra no mapa, ou aqui com justificativa; a lista não pode sobrar.
 */
const FORA_DA_TRILHA: Record<string, string> = {
  "/acesso-negado": "tela de erro de permissão: não tem lugar na hierarquia, e a trilha apontaria para a área que acabou de negar",
  "/academico/recuperacoes/tentativas/*": "tela do professor designado: o pai dele é \"Minhas recuperações\" (/academico/recuperacoes/designadas), fora do caminho",
  "/academico/reposicoes/correcoes/*": "o pai depende do papel: o professor chega pelo Diário (/diario/reposicoes), a gestão pelo Acadêmico",
};

describe("trilha de navegação", () => {
  it("toda entrada do mapa é uma página que existe (a trilha nunca leva a um 404)", () => {
    expect(Object.keys(ROTULOS_TRILHA).filter((r) => !ROTAS.has(r))).toEqual([]);
  });

  it("toda página está no mapa ou em FORA_DA_TRILHA com motivo — e a lista de fora não sobra (C22 da #170)", () => {
    expect([...ROTAS].filter((r) => r !== "/" && !(r in ROTULOS_TRILHA) && !(r in FORA_DA_TRILHA)).sort()).toEqual([]);
    expect(Object.keys(FORA_DA_TRILHA).filter((r) => !ROTAS.has(r) || r in ROTULOS_TRILHA)).toEqual([]);
    for (const [rota, motivo] of Object.entries(FORA_DA_TRILHA)) expect(motivo.length, rota).toBeGreaterThan(30);
    // Teto: eram 60 páginas fora; só sobe com uma decisão escrita aqui.
    expect(Object.keys(FORA_DA_TRILHA).length).toBeLessThanOrEqual(3);
    expect(ROTAS.size).toBeGreaterThan(150); // a varredura achou as páginas (não passa vazia por caminho errado)
  });

  it("as seções da matrícula têm na trilha o mesmo nome da aba do cabeçalho", () => {
    const divergentes = SECOES_MATRICULA
      .filter((s) => ROTULOS_TRILHA[`/matriculas/*/${s.caminho}`] !== s.rotulo)
      .map((s) => `${s.caminho}: aba "${s.rotulo}", trilha "${ROTULOS_TRILHA[`/matriculas/*/${s.caminho}`]}"`);
    expect(divergentes).toEqual([]);
  });

  it("segmento sem página aponta para uma página que existe, e ele mesmo não tem página", () => {
    for (const [segmento, { href }] of Object.entries(SEM_PAGINA)) {
      expect(ROTAS.has(segmento), segmento).toBe(false);
      expect(ROTAS.has(href), href).toBe(true);
    }
  });

  it("ancestrais conhecidos viram links; a página atual fica marcada", () => {
    expect(resumo("/secretaria/reservas/clx9abc123")).toEqual(["Secretaria → /secretaria", "Reservas → /secretaria/reservas", "Reserva"]);
    expect(trilhaDoCaminho("/secretaria/reservas/clx9abc123").at(-1)).toMatchObject({ href: "/secretaria/reservas/clx9abc123", atual: true });
  });

  it("registro de aluno: área → ficha → seção", () => {
    expect(resumo("/alunos/clx1a2b3c/financeiro")).toEqual(["Alunos → /alunos", "Ficha do aluno → /alunos/clx1a2b3c", "Financeiro"]);
  });

  it("matrícula não tem lista própria: o primeiro elo é a Secretaria (\"Matrículas\")", () => {
    expect(resumo("/matriculas/cm0xyz9/contrato/aditivos/cp1q2w3/alcadas")).toEqual([
      "Matrículas → /secretaria",
      "Matrícula → /matriculas/cm0xyz9",
      "Contrato → /matriculas/cm0xyz9/contrato",
      "Aditivos → /matriculas/cm0xyz9/contrato/aditivos",
      "Proposta de aditivo → /matriculas/cm0xyz9/contrato/aditivos/cp1q2w3",
      "Alçadas", // fora do mapa até a #170 (C22): a trilha parava no pai, sem a página atual
    ]);
  });

  it("segmento estático vence o dinâmico (\"nova\" não é uma grade chamada nova)", () => {
    expect(resumo("/academico/grades/nova")).toEqual(["Acadêmico → /academico", "Grades → /academico/grades", "Nova grade"]);
    expect(resumo("/academico/grades/cg7h8j9")).toEqual(["Acadêmico → /academico", "Grades → /academico/grades", "Grade"]);
  });

  it("segmento estático fora do mapa encerra a trilha — nunca vira um id inventado", () => {
    // /academico/recuperacoes/* é a página de UMA recuperação; "inexistente" não é uma delas.
    expect(resumo("/academico/recuperacoes/inexistente/ct1x2y3/agenda")).toEqual(["Acadêmico → /academico", "Recuperações → /academico/recuperacoes"]);
  });

  it("segmento estático conhecido vence o id: \"tentativas\" não é uma recuperação, e a tentativa sem página fica sem elo", () => {
    expect(resumo("/academico/recuperacoes/tentativas/ct1x2y3/autorizacao")).toEqual([
      "Acadêmico → /academico", "Recuperações → /academico/recuperacoes", "Autorização especial",
    ]);
    expect(resumo("/academico/recuperacoes/tentativas/ct1x2y3/designacao/propostas")).toEqual([
      "Acadêmico → /academico", "Recuperações → /academico/recuperacoes",
      "Avaliador da recuperação → /academico/recuperacoes/tentativas/ct1x2y3/designacao", "Propostas de substituição",
    ]);
    // O "voltar" da autorização especial leva à designação: o nome é o do destino (docs/42 L1617, C23 da #170).
    expect(rotuloDoDestino("/academico/recuperacoes/tentativas/ct1x2y3/designacao")).toBe("Avaliador da recuperação");
    // A tentativa (tela do professor) continua fora do mapa: nenhum elo, nenhum nome.
    expect(rotuloDoDestino("/academico/recuperacoes/tentativas/ct1x2y3")).toBeNull();
  });

  it("páginas que estavam fora do mapa (C22 da #170) ganham trilha até o pai", () => {
    // "agenda" é estático: não é uma proposta de aditivo chamada agenda.
    expect(resumo("/matriculas/cm0xyz9/contrato/aditivos/agenda")).toEqual([
      "Matrículas → /secretaria", "Matrícula → /matriculas/cm0xyz9", "Contrato → /matriculas/cm0xyz9/contrato",
      "Aditivos → /matriculas/cm0xyz9/contrato/aditivos", "Agenda do aditivo",
    ]);
    expect(resumo("/matriculas/cm0xyz9/indisponibilidade-oferta/ci4r5t6/termino")).toEqual([
      "Matrículas → /secretaria", "Matrícula → /matriculas/cm0xyz9",
      "Indisponibilidade → /matriculas/cm0xyz9/indisponibilidade-oferta", "Término da indisponibilidade",
    ]);
    expect(resumo("/secretaria/reservas/particulares/cr7y8u9")).toEqual(["Secretaria → /secretaria", "Reservas → /secretaria/reservas", "Reserva particular"]);
    expect(resumo("/secretaria/reservas/cr7y8u9")).toEqual(["Secretaria → /secretaria", "Reservas → /secretaria/reservas", "Reserva"]);
    // Segmento intermediário sem página não vira elo: a trilha sobe ao ancestral que é página.
    expect(resumo("/financeiro/acertos-vencimento/cm0xyz9/cp1q2w3")).toEqual(["Financeiro → /financeiro", "Acerto do vencimento"]);
    expect(resumo("/academico/segundas-chamadas/reservas/cs1d2f3/remarcacao")).toEqual(["Acadêmico → /academico", "Remarcação da segunda chamada"]);
  });

  it("seções da configuração do WhatsApp (E8): configuração → WhatsApp → seção", () => {
    expect(resumo("/configuracao/whatsapp/reguas")).toEqual(["Configuração → /configuracao", "WhatsApp → /configuracao/whatsapp", "Régua comercial"]);
  });

  it("query string e barra final são ignoradas; área sozinha tem um item só", () => {
    expect(resumo("/leads/cl1z2x3/?aba=historico")).toEqual(["Leads → /leads", "Ficha do lead"]);
    expect(trilhaDoCaminho("/home")).toHaveLength(1);
    expect(trilhaDoCaminho("/")).toEqual([]);
  });
});
