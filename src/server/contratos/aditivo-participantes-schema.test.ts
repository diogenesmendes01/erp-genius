import { expect, it } from "vitest";
import { z } from "zod";
import { ConferirParticipantesAditivoSchema, conferirParticipantesAditivo } from "./aditivo-participantes-schema";
import { RegraAssinaturaSchema } from "./modelo-schema";

const aluno = { nome: "Aluno Conferido", email: "aluno@example.test", documento: "ALUNO-1" };
const pagador = { nome: "Pagador Conferido", email: "pagador@example.test", documento: "PAGADOR-1" };
const regras = [{ papel: "ALUNO", condicao: "ALUNO_MAIOR" }, { papel: "RESPONSAVEL_FINANCEIRO", condicao: "PAGADOR_DISTINTO" }, { papel: "REPRESENTANTE_ESCOLA", condicao: "SEMPRE" }] as const;
const representante = (papel: z.infer<typeof RegraAssinaturaSchema>["papel"], id = "doc-representacao") => ({ papel, identidade: { nome: "Representante", email: "representante@example.test", documento: "REP-1" }, representacao: { descricao: "Poder de representação conferido", evidenciaDocumentoId: id } });
type Entrada = Parameters<typeof conferirParticipantesAditivo>[0];
const base = (): Entrada => ({ regras, contexto: { maioridade: "MAIOR" as const, pagador: "RESPONSAVEL" as const }, participantes: [
  { papel: "ALUNO", identidade: aluno }, { papel: "RESPONSAVEL_FINANCEIRO", identidade: pagador }, representante("REPRESENTANTE_ESCOLA"),
], identidadesEsperadas: { aluno, pagador }, evidenciasDisponiveisIds: ["doc-maioridade", "doc-representacao"], maioridade: { classificacao: "MAIOR" as const, criterio: "Maioridade conferida pela Secretaria", evidenciaDocumentoId: "doc-maioridade" } });

it("espelha a entrada estrita da conferência sem aceitar autoria ou prévia", () => {
  const valido = { propostaId: "proposta-1", propostaHashEsperado: "a".repeat(64), versaoEsperada: 0, maioridade: base().maioridade, participantes: base().participantes,
    identificacoesConferidas: true, motivo: "Participantes do aditivo conferidos", chaveIdempotencia: "aditivo-participantes-1" };
  expect(ConferirParticipantesAditivoSchema.safeParse(valido).success).toBe(true);
  expect(ConferirParticipantesAditivoSchema.safeParse({ ...valido, previaId: "indevida" }).success).toBe(false);
  expect(ConferirParticipantesAditivoSchema.safeParse({ ...valido, participantes: [valido.participantes[0], valido.participantes[0]] }).success).toBe(false);
});

it("resolve etapas cliente/escola, exige identidades canônicas e não herda assinaturas", () => {
  const r = conferirParticipantesAditivo(base());
  expect(r.participantes.map(p => [p.papel, p.etapa])).toEqual([["ALUNO", "CLIENTE"], ["RESPONSAVEL_FINANCEIRO", "CLIENTE"], ["REPRESENTANTE_ESCOLA", "ESCOLA"]]);
  expect(r.assinaturasHerdadas).toEqual([]);
  expect(() => conferirParticipantesAditivo({ ...base(), participantes: [{ papel: "ALUNO", identidade: { ...aluno, nome: "Outro" } }, ...base().participantes.slice(1)] })).toThrow(/difere/);
  expect(() => conferirParticipantesAditivo({ ...base(), assinaturasHerdadas: ["assinatura-original"] })).toThrow(/herdar/);
});

it("empresa não concede responsável financeiro automaticamente e representação continua obrigatória", () => {
  const regrasEmpresa = [{ papel: "RESPONSAVEL_FINANCEIRO", condicao: "PAGADOR_DISTINTO" }, { papel: "REPRESENTANTE_EMPRESA", condicao: "PAGADOR_EMPRESA" }, { papel: "REPRESENTANTE_ESCOLA", condicao: "SEMPRE" }] as const;
  const entrada = { ...base(), regras: regrasEmpresa, contexto: { maioridade: null, pagador: "EMPRESA" as const }, maioridade: null, identidadesEsperadas: { aluno, pagador: null }, participantes: [representante("RESPONSAVEL_FINANCEIRO"), representante("REPRESENTANTE_EMPRESA"), representante("REPRESENTANTE_ESCOLA")] };
  expect(conferirParticipantesAditivo(entrada).participantes.map(p => p.papel)).toEqual(["REPRESENTANTE_EMPRESA", "RESPONSAVEL_FINANCEIRO", "REPRESENTANTE_ESCOLA"]);
  expect(() => conferirParticipantesAditivo({ ...entrada, participantes: entrada.participantes.filter(p => p.papel !== "RESPONSAVEL_FINANCEIRO") })).toThrow(/exatamente/);
  expect(() => conferirParticipantesAditivo({ ...entrada, participantes: [{ ...entrada.participantes[0], representacao: undefined }, ...entrada.participantes.slice(1)] })).toThrow(/representação/i);
});

it("bloqueia papéis faltantes ou repetidos, pendência de maioridade e documento indisponível", () => {
  expect(() => conferirParticipantesAditivo({ ...base(), participantes: base().participantes.slice(0, 2) })).toThrow(/exatamente/);
  expect(() => conferirParticipantesAditivo({ ...base(), participantes: [base().participantes[0], base().participantes[0], base().participantes[2]] })).toThrow(/exatamente/);
  expect(() => conferirParticipantesAditivo({ ...base(), contexto: { maioridade: null, pagador: "RESPONSAVEL" } })).toThrow(/maioridade/i);
  expect(() => conferirParticipantesAditivo({ ...base(), evidenciasDisponiveisIds: ["doc-maioridade"] })).toThrow(/documento disponível/i);
  expect(() => conferirParticipantesAditivo({ ...base(), contexto: { maioridade: null, pagador: "RESPONSAVEL" } })).toThrow(/maioridade/i);
});

it("não exige dados completos de aluno ou pagador quando seus papéis não participam", () => {
  const semFinanceiro = { ...base(), regras: [{ papel: "ALUNO", condicao: "SEMPRE" }, { papel: "REPRESENTANTE_ESCOLA", condicao: "SEMPRE" }] as const,
    participantes: [{ papel: "ALUNO" as const, identidade: aluno }, representante("REPRESENTANTE_ESCOLA")], identidadesEsperadas: { aluno, pagador: { nome: "", email: "", documento: "" } } };
  expect(conferirParticipantesAditivo(semFinanceiro).participantes.map(p => p.papel)).toEqual(["ALUNO", "REPRESENTANTE_ESCOLA"]);
  const soRepresentacao = { ...base(), regras: [{ papel: "REPRESENTANTE_LEGAL", condicao: "SEMPRE" }, { papel: "REPRESENTANTE_ESCOLA", condicao: "SEMPRE" }] as const,
    contexto: { maioridade: null, pagador: "EMPRESA" as const }, maioridade: null, participantes: [representante("REPRESENTANTE_LEGAL"), representante("REPRESENTANTE_ESCOLA")], identidadesEsperadas: { aluno: { nome: "Aluno", email: "", documento: "" }, pagador: null } };
  expect(conferirParticipantesAditivo(soRepresentacao).participantes.map(p => p.papel)).toEqual(["REPRESENTANTE_LEGAL", "REPRESENTANTE_ESCOLA"]);
});
