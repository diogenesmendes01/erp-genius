import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROTULOS_TRILHA, SEM_PAGINA, rotuloDoDestino, trilhaDoCaminho } from "./trilha";
import { SECOES_MATRICULA } from "@/app/(app)/matriculas/[id]/secoes";

const ROTAS = new Set(
  (readdirSync("src/app/(app)", { recursive: true }) as string[])
    .filter((f) => /(^|[\\/])page\.tsx$/.test(f))
    .map((f) => ("/" + join(f, "..").split("\\").join("/"))
      .replace(/\/\([^/]*\)/g, "")
      .replace(/\[[^\]]+\]/g, "*")
      .replace(/\/\.$/, "") || "/"),
);

const resumo = (caminho: string) => trilhaDoCaminho(caminho).map((i) => `${i.rotulo}${i.atual ? "" : ` → ${i.href}`}`);

describe("trilha de navegação", () => {
  it("toda entrada do mapa é uma página que existe (a trilha nunca leva a um 404)", () => {
    expect(Object.keys(ROTULOS_TRILHA).filter((r) => !ROTAS.has(r))).toEqual([]);
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

  it("oportunidades sem página própria volta ao Funil", () => {
    expect(SEM_PAGINA["/oportunidades"]).toEqual({ href: "/funil", rotulo: "Funil" });
    expect(resumo("/oportunidades/clx9abc/contratacao")).toEqual(["Funil → /funil", "Contratação"]);
  });

  it("matrícula não tem lista própria: o primeiro elo é a Secretaria (\"Matrículas\")", () => {
    expect(resumo("/matriculas/cm0xyz9/contrato/aditivos/cp1q2w3/alcadas")).toEqual([
      "Matrículas → /secretaria",
      "Matrícula → /matriculas/cm0xyz9",
      "Contrato → /matriculas/cm0xyz9/contrato",
      "Aditivos → /matriculas/cm0xyz9/contrato/aditivos",
      "Proposta de aditivo → /matriculas/cm0xyz9/contrato/aditivos/cp1q2w3",
      "Alçadas",
    ]);
  });

  it("segmento estático vence o dinâmico (\"nova\" não é uma grade chamada nova)", () => {
    expect(resumo("/academico/grades/nova")).toEqual(["Acadêmico → /academico", "Grades → /academico/grades", "Nova grade"]);
    expect(resumo("/academico/grades/cg7h8j9")).toEqual(["Acadêmico → /academico", "Grades → /academico/grades", "Grade"]);
  });

  it("segmento estático fora do mapa encerra a trilha — nunca vira um id inventado", () => {
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
    expect(rotuloDoDestino("/academico/recuperacoes/tentativas/ct1x2y3/designacao")).toBe("Avaliador da recuperação");
    expect(rotuloDoDestino("/academico/recuperacoes/tentativas/ct1x2y3")).toBeNull();
  });

  it("páginas que estavam fora do mapa (C22 da #170) ganham trilha até o pai", () => {
    expect(resumo("/matriculas/cm0xyz9/contrato/aditivos/agenda")).toEqual([
      "Matrículas → /secretaria", "Matrícula → /matriculas/cm0xyz9", "Contrato → /matriculas/cm0xyz9/contrato",
      "Aditivos → /matriculas/cm0xyz9/contrato/aditivos", "Agenda do aditivo",
    ]);
    expect(resumo("/matriculas/cm0xyz9/indisponibilidade-oferta/ci4r5t6/termino")).toEqual([
      "Matrículas → /secretaria", "Matrícula → /matriculas/cm0xyz9",
      "Indisponibilidade → /matriculas/cm0xyz9/indisponibilidade-oferta", "Término da indisponibilidade",
    ]);
    expect(resumo("/matriculas/cm0xyz9/indisponibilidade-oferta/ci4r5t6/correcao")).toEqual([
      "Matrículas → /secretaria", "Matrícula → /matriculas/cm0xyz9",
      "Indisponibilidade → /matriculas/cm0xyz9/indisponibilidade-oferta", "Correção do período",
    ]);
    expect(resumo("/secretaria/reservas/particulares/cr7y8u9")).toEqual(["Secretaria → /secretaria", "Reservas → /secretaria/reservas", "Reserva particular"]);
    expect(resumo("/secretaria/reservas/cr7y8u9")).toEqual(["Secretaria → /secretaria", "Reservas → /secretaria/reservas", "Reserva"]);
    expect(resumo("/financeiro/acertos-vencimento/cm0xyz9/cp1q2w3")).toEqual(["Financeiro → /financeiro", "Acerto do vencimento"]);
    expect(resumo("/financeiro/acertos-adiantamento/cm0xyz9/cp1q2w3")).toEqual(["Financeiro → /financeiro", "Acerto do adiantamento"]);
    expect(resumo("/financeiro/acertos-moeda/cm0xyz9/cp1q2w3")).toEqual(["Financeiro → /financeiro", "Trocas de moeda → /financeiro/acertos-moeda", "Troca de moeda"]);
    expect(resumo("/academico/segundas-chamadas/reservas/cs1d2f3/remarcacao")).toEqual(["Acadêmico → /academico", "Remarcação da segunda chamada"]);
  });

  it("seções da configuração do WhatsApp (E8): configuração → WhatsApp → seção", () => {
    expect(resumo("/configuracao/whatsapp/politica")).toEqual(["Configuração → /configuracao", "WhatsApp → /configuracao/whatsapp", "Política da régua"]);
  });

  it("query string e barra final são ignoradas; área sozinha tem um item só", () => {
    expect(resumo("/empresas/cl1z2x3/?aba=historico")).toEqual(["Empresas → /empresas", "Empresa"]);
    expect(trilhaDoCaminho("/home")).toHaveLength(1);
    expect(trilhaDoCaminho("/")).toEqual([]);
  });
});
