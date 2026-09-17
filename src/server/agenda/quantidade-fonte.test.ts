import { describe, expect, it } from "vitest";
import { validarFonteQuantidadeAulasTx } from "./quantidade-fonte";

const antes = (id: string, inicio: string, status = "PREVISTO") => ({ id, inicio, fim: new Date(new Date(inicio).getTime() + 3_600_000).toISOString(), status, professorId: "professor", propostaGradeId: "grade" });
const depois = (id: string | null, inicio: string, status = "PREVISTO") => ({ id, inicio, fim: new Date(new Date(inicio).getTime() + 3_600_000).toISOString(), status, professorId: "professor", propostaGradeId: "grade" });

function fonte(opcoes: { foto?: unknown; atuais?: any[]; payload?: any } = {}) {
  const foto = opcoes.foto ?? {
    agendaAntes: [antes("alterado", "2099-01-01T10:00:00.000Z"), antes("removido", "2099-01-02T10:00:00.000Z")],
    agendaDepois: [depois("alterado", "2099-01-01T11:00:00.000Z"), depois("removido", "2099-01-02T10:00:00.000Z", "CANCELADO"), depois(null, "2099-01-03T10:00:00.000Z")],
  };
  const atuais = opcoes.atuais ?? [
    { id: "alterado", turmaId: "turma", inicio: new Date("2099-01-01T11:00:00.000Z"), fim: new Date("2099-01-01T12:00:00.000Z"), status: "PREVISTO", professorId: "professor", propostaGradeId: "grade", preparadorId: "secretaria", chaveIdempotencia: "antiga" },
    { id: "removido", turmaId: "turma", inicio: new Date("2099-01-02T10:00:00.000Z"), fim: new Date("2099-01-02T11:00:00.000Z"), status: "CANCELADO", professorId: "professor", propostaGradeId: "grade", preparadorId: "secretaria", chaveIdempotencia: "antiga-2" },
    { id: "adicionado", turmaId: "turma", inicio: new Date("2099-01-03T10:00:00.000Z"), fim: new Date("2099-01-03T11:00:00.000Z"), status: "PREVISTO", professorId: "professor", propostaGradeId: "grade", preparadorId: "secretaria", chaveIdempotencia: "quantidade:proposta:turma:0" },
  ];
  const payload = opcoes.payload ?? { propostaId: "proposta", decisaoId: "decisao", aplicacaoId: "aplicacao", encontros: [{ turmaId: "turma", encontroId: "alterado" }, { turmaId: "turma", encontroId: "removido" }, { turmaId: "turma", encontroId: "adicionado" }] };
  const db = {
    evento: { findUnique: async () => ({ tipo: "QuantidadeAulasModalidadeAplicada", agregadoTipo: "Modalidade", agregadoId: "modalidade", autorId: "gerente", payload }) },
    propostaQuantidadeAulasModalidade: { findUnique: async () => ({ id: "proposta", modalidadeId: "modalidade", preparadorId: "secretaria", situacao: "APLICADA", decisao: { id: "decisao", aprovada: true, decisorId: "gerente" }, aplicacao: { id: "aplicacao", aplicadorId: "gerente" }, impactos: [{ turmaId: "turma", publicada: true, snapshot: foto }] }) },
    encontroAgenda: { findMany: async () => atuais },
  };
  return db as any;
}

describe("validarFonteQuantidadeAulasTx", () => {
  it("aceita e resolve encontros alterado, removido e adicionado da fotografia", async () => {
    const resultado = await validarFonteQuantidadeAulasTx(fonte(), { eventoId: "evento" });
    expect(resultado?.porTurma.get("turma")).toEqual(new Set(["alterado", "removido", "adicionado"]));
    expect(resultado?.instantes.get("alterado")?.map((d) => d.toISOString())).toEqual(["2099-01-01T10:00:00.000Z", "2099-01-01T11:00:00.000Z"]);
    expect(resultado?.instantes.get("adicionado")?.map((d) => d.toISOString())).toEqual(["2099-01-03T10:00:00.000Z"]);
  });

  it("recusa ID inalterado ou extra no evento", async () => {
    const db = fonte({ foto: {
      agendaAntes: [antes("alterado", "2099-01-01T10:00:00.000Z"), antes("removido", "2099-01-02T10:00:00.000Z"), antes("preservado", "2099-01-04T10:00:00.000Z")],
      agendaDepois: [depois("alterado", "2099-01-01T11:00:00.000Z"), depois("removido", "2099-01-02T10:00:00.000Z", "CANCELADO"), depois("preservado", "2099-01-04T10:00:00.000Z"), depois(null, "2099-01-03T10:00:00.000Z")],
    }, payload: { propostaId: "proposta", decisaoId: "decisao", aplicacaoId: "aplicacao", encontros: [{ turmaId: "turma", encontroId: "alterado" }, { turmaId: "turma", encontroId: "removido" }, { turmaId: "turma", encontroId: "adicionado" }, { turmaId: "turma", encontroId: "preservado" }] } });
    expect(await validarFonteQuantidadeAulasTx(db, { eventoId: "evento" })).toBeNull();
  });

  it("recusa evento que omite encontro afetado", async () => {
    const db = fonte({ payload: { propostaId: "proposta", decisaoId: "decisao", aplicacaoId: "aplicacao", encontros: [{ turmaId: "turma", encontroId: "alterado" }, { turmaId: "turma", encontroId: "removido" }] } });
    expect(await validarFonteQuantidadeAulasTx(db, { eventoId: "evento" })).toBeNull();
  });

  it("recusa fotografia malformada", async () => {
    expect(await validarFonteQuantidadeAulasTx(fonte({ foto: { agendaAntes: [{ id: "x", inicio: "ontem" }], agendaDepois: [] } }), { eventoId: "evento" })).toBeNull();
  });

  it("recusa encontro cujo horário atual divergiu da fotografia posterior", async () => {
    const db = fonte();
    db.encontroAgenda.findMany = async () => [
      { id: "alterado", turmaId: "turma", inicio: new Date("2099-01-01T13:00:00.000Z"), fim: new Date("2099-01-01T14:00:00.000Z"), status: "PREVISTO", chaveIdempotencia: "antiga" },
      { id: "removido", turmaId: "turma", inicio: new Date("2099-01-02T10:00:00.000Z"), fim: new Date("2099-01-02T11:00:00.000Z"), status: "CANCELADO", chaveIdempotencia: "antiga-2" },
      { id: "adicionado", turmaId: "turma", inicio: new Date("2099-01-03T10:00:00.000Z"), fim: new Date("2099-01-03T11:00:00.000Z"), status: "PREVISTO", chaveIdempotencia: "quantidade:proposta:turma:0" },
    ];
    expect(await validarFonteQuantidadeAulasTx(db, { eventoId: "evento" })).toBeNull();
  });

  it("recusa professor ou grade atuais diferentes da fotografia aprovada", async () => {
    const db = fonte();
    db.encontroAgenda.findMany = async () => [{ id: "alterado", turmaId: "turma", inicio: new Date("2099-01-01T11:00:00.000Z"), fim: new Date("2099-01-01T12:00:00.000Z"), status: "PREVISTO", professorId: "outro-professor", propostaGradeId: "outra-grade", preparadorId: "secretaria", chaveIdempotencia: "antiga" }];
    expect(await validarFonteQuantidadeAulasTx(db, { eventoId: "evento" })).toBeNull();
  });

  it("recusa decisão sem independência do preparador ou autoria divergente da aplicação", async () => {
    const db = fonte();
    const original = db.propostaQuantidadeAulasModalidade.findUnique;
    db.propostaQuantidadeAulasModalidade.findUnique = async () => ({ ...(await original()), decisao: { id: "decisao", aprovada: true, decisorId: "secretaria" } });
    expect(await validarFonteQuantidadeAulasTx(db, { eventoId: "evento" })).toBeNull();
    db.propostaQuantidadeAulasModalidade.findUnique = original;
    db.evento.findUnique = async () => ({ tipo: "QuantidadeAulasModalidadeAplicada", agregadoTipo: "Modalidade", agregadoId: "modalidade", autorId: "outra-pessoa", payload: { propostaId: "proposta", decisaoId: "decisao", aplicacaoId: "aplicacao", encontros: [] } });
    expect(await validarFonteQuantidadeAulasTx(db, { eventoId: "evento" })).toBeNull();
  });

  it("recusa encontro adicionado por outro processo", async () => {
    const db = fonte();
    db.encontroAgenda.findMany = async () => [
      { id: "alterado", turmaId: "turma", inicio: new Date("2099-01-01T11:00:00.000Z"), fim: new Date("2099-01-01T12:00:00.000Z"), status: "PREVISTO", chaveIdempotencia: "antiga" },
      { id: "removido", turmaId: "turma", inicio: new Date("2099-01-02T10:00:00.000Z"), fim: new Date("2099-01-02T11:00:00.000Z"), status: "CANCELADO", chaveIdempotencia: "antiga-2" },
      { id: "adicionado", turmaId: "turma", inicio: new Date("2099-01-03T10:00:00.000Z"), fim: new Date("2099-01-03T11:00:00.000Z"), status: "PREVISTO", chaveIdempotencia: "outro-processo" },
    ];
    expect(await validarFonteQuantidadeAulasTx(db, { eventoId: "evento" })).toBeNull();
  });

  it("filtra adição pela autoria e aceita a legítima quando a chave também existe para outro preparador", async () => {
    const db = fonte();
    const atuais = await db.encontroAgenda.findMany();
    db.encontroAgenda.findMany = async (consulta: any) => {
      expect(consulta.where.OR[1]).toEqual({ chaveIdempotencia: { in: ["quantidade:proposta:turma:0"] }, preparadorId: "secretaria" });
      return [{ id: "adicao-de-outro", turmaId: "turma", inicio: new Date("2099-01-03T10:00:00.000Z"), fim: new Date("2099-01-03T11:00:00.000Z"), status: "PREVISTO", professorId: "professor", propostaGradeId: "grade", preparadorId: "outro-preparador", chaveIdempotencia: "quantidade:proposta:turma:0" }, ...atuais];
    };
    expect(await validarFonteQuantidadeAulasTx(db, { eventoId: "evento" })).not.toBeNull();
    db.encontroAgenda.findMany = async () => [{ id: "adicao-de-outro", turmaId: "turma", inicio: new Date("2099-01-03T10:00:00.000Z"), fim: new Date("2099-01-03T11:00:00.000Z"), status: "PREVISTO", professorId: "professor", propostaGradeId: "grade", preparadorId: "outro-preparador", chaveIdempotencia: "quantidade:proposta:turma:0" }];
    expect(await validarFonteQuantidadeAulasTx(db, { eventoId: "evento" })).toBeNull();
  });
});
