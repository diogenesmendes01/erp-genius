import { expect, it } from "vitest";
import { conferirNovaAdmissaoTurma } from "./admissao-turma";
const base = () => ({ agora: new Date("2026-09-12T20:00:00Z"), fusoAdmissao: "America/Sao_Paulo", limiteEntrada: "2026-09-12",
  status: "EM_ANDAMENTO" as const, agendaPublicada: true, professorApto: true, disponibilidadeConferida: true, capacidade: 10, ocupacoes: 8, reservasOcupando: 1 });

it("permite nova entrada em turma em andamento dentro da janela e desconta reservas", () => {
  expect(conferirNovaAdmissaoTurma(base())).toMatchObject({ elegivel: true, vagas: 1, impedimentos: [], reservada: false });
});
it("considera o último dia inteiro na referência institucional e bloqueia o instante seguinte", () => {
  expect(conferirNovaAdmissaoTurma({ ...base(), agora: new Date("2026-09-13T02:59:59.999Z") }).elegivel).toBe(true);
  expect(conferirNovaAdmissaoTurma({ ...base(), agora: new Date("2026-09-13T03:00:00Z") }).impedimentos).toContain("JANELA_ENCERRADA");
});
it("não presume limite ou saldo de reservas desconhecidos", () => {
  expect(conferirNovaAdmissaoTurma({ ...base(), limiteEntrada: null, reservasOcupando: null })).toMatchObject({ elegivel: false, vagas: null,
    impedimentos: expect.arrayContaining(["LIMITE_NAO_CONFIGURADO", "RESERVAS_NAO_CONFERIDAS"]) });
});
it("conclusão, falta de publicação, professor inapto e disponibilidade pendente impedem nova reserva", () => {
  expect(conferirNovaAdmissaoTurma({ ...base(), status: "CONCLUIDA", agendaPublicada: false, professorApto: false, disponibilidadeConferida: false })).toMatchObject({ elegivel: false,
    impedimentos: expect.arrayContaining(["TURMA_CONCLUIDA", "AGENDA_NAO_PUBLICADA", "PROFESSOR_INAPTO", "DISPONIBILIDADE_NAO_CONFERIDA"]) });
});
it("não oferece a última vaga já reservada nem saldo negativo", () => {
  expect(conferirNovaAdmissaoTurma({ ...base(), reservasOcupando: 2 })).toMatchObject({ elegivel: false, vagas: 0, impedimentos: ["SEM_VAGA"] });
  expect(conferirNovaAdmissaoTurma({ ...base(), ocupacoes: 20 }).vagas).toBe(0);
});
it("estado planejado sozinho não substitui a publicação nem impede grade já publicada", () => {
  expect(conferirNovaAdmissaoTurma({ ...base(), status: "PLANEJADA", agendaPublicada: false }).elegivel).toBe(false);
  expect(conferirNovaAdmissaoTurma({ ...base(), status: "PLANEJADA" }).elegivel).toBe(true);
});
it("recusa contagens, datas e fusos inválidos sem normalização silenciosa", () => {
  expect(() => conferirNovaAdmissaoTurma({ ...base(), reservasOcupando: -1 })).toThrow();
  expect(() => conferirNovaAdmissaoTurma({ ...base(), ocupacoes: 1.5 })).toThrow();
  expect(() => conferirNovaAdmissaoTurma({ ...base(), limiteEntrada: "2026-02-30" })).toThrow();
  expect(() => conferirNovaAdmissaoTurma({ ...base(), fusoAdmissao: "inexistente" })).toThrow();
});
