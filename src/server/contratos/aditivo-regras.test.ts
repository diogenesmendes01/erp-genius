import { expect, it } from "vitest";
import { aprovarAditivo, liberarAplicacaoAditivo, prepararAditivo, type AtorAditivo, type BaseAditivo, type ConclusaoOriginalAditivo, type PropostaAditivo } from "./aditivo-regras";

const hash = (letra: string) => letra.repeat(64);
const secretaria: AtorAditivo = { id: "secretaria", ativo: true, papeis: ["SECRETARIA_ACADEMICA"] };
const admin: AtorAditivo = { id: "admin", ativo: true, papeis: ["ADMINISTRADOR"] };
const conclusao: ConclusaoOriginalAditivo = { id: "conclusao-1", matriculaId: "matricula-1", artefatoId: "original-1" };
const base: BaseAditivo = { matriculaId: "matricula-1", originalId: "original-1", conclusaoOriginalId: "conclusao-1", aditivosAnterioresIds: ["aditivo-anterior"], versao: "base-v1", hash: hash("a") };
function proposta() { return prepararAditivo({ propostaId: "proposta-1", versaoProposta: "v1", preparador: secretaria, conclusaoOriginal: conclusao, base, modeloVersaoId: "modelo-v2", alteracoesHash: hash("b"), motivo: "Alteração acordada", vigencia: "2026-10-01T00:00:00-03:00" }); }
function aprovada(): PropostaAditivo { return aprovarAditivo({ proposta: proposta(), aprovador: admin, conclusaoOriginal: conclusao, baseAtual: base }); }
function formalizacao() { return { propostaId: "proposta-1", versaoProposta: "v1", matriculaId: "matricula-1", originalId: "original-1", conclusaoOriginalId: "conclusao-1", aditivoId: "aditivo-2", modeloVersaoId: "modelo-v2", alteracoesHash: hash("b"), vigencia: "2026-10-01T00:00:00-03:00", modeloAprovado: true, pdfHash: hash("c"), assinaturasCompletas: true } as const; }
function conferencia() { return { propostaId: "proposta-1", versaoProposta: "v1", aditivoId: "aditivo-2", conclusaoOriginalId: "conclusao-1", pdfHash: hash("c"), conferente: secretaria, conferida: true } as const; }
function entrada() { return { proposta: aprovada(), conclusaoOriginal: conclusao, baseAtual: base, contextoAlcadasServidor: { aprovacoesNecessariasIds: ["comercial-1"] }, aprovacoesAplicaveis: [{ id: "comercial-1", propostaId: "proposta-1", versaoProposta: "v1", estado: "APROVADA" }] as const, formalizacao: formalizacao(), conferenciaSecretaria: conferencia(), jaAplicada: false }; }

it("prepara e aprova somente com Secretaria/Administração e outro administrador ativo", () => {
  expect(() => aprovarAditivo({ proposta: proposta(), aprovador: { ...admin, id: " " }, conclusaoOriginal: conclusao, baseAtual: base })).toThrow(/outro administrador/i);
  expect(() => prepararAditivo({ propostaId: "p", versaoProposta: "v1", preparador: { id: "v", ativo: true, papeis: ["VENDEDOR"] }, conclusaoOriginal: conclusao, base, modeloVersaoId: "m", alteracoesHash: hash("b"), motivo: "x", vigencia: "2026-10-01T00:00:00-03:00" })).toThrow(/Secretaria/i);
  expect(() => aprovarAditivo({ proposta: proposta(), aprovador: { ...admin, id: secretaria.id }, conclusaoOriginal: conclusao, baseAtual: base })).toThrow(/outro administrador/i);
  expect(aprovada()).toMatchObject({ estado: "APROVADA", aprovadaPorId: "admin", baseHash: hash("a") });
});
it("aprovação interna isolada não aplica nem libera condições", () => {
  expect(() => liberarAplicacaoAditivo({ ...entrada(), formalizacao: { ...formalizacao(), assinaturasCompletas: false } })).toThrow(/formalização completa/i);
});
it("libera somente autorização futura, com vigência e alterações exatas", () => {
  expect(liberarAplicacaoAditivo(entrada())).toEqual({ liberada: true, propostaId: "proposta-1", aditivoId: "aditivo-2", matriculaId: "matricula-1", alteracoesHash: hash("b"), vigencia: "2026-10-01T00:00:00-03:00", criaMatricula: false, emiteTaxa: false });
});
it("bloqueia pendência, alçada ausente, extra e duplicada", () => {
  expect(() => liberarAplicacaoAditivo({ ...entrada(), aprovacoesAplicaveis: [{ ...entrada().aprovacoesAplicaveis[0], estado: "PENDENTE" }] })).toThrow(/pendente/i);
  expect(() => liberarAplicacaoAditivo({ ...entrada(), aprovacoesAplicaveis: [] })).toThrow(/Falta aprovação/i);
  expect(() => liberarAplicacaoAditivo({ ...entrada(), aprovacoesAplicaveis: [...entrada().aprovacoesAplicaveis, { id: "extra", propostaId: "proposta-1", versaoProposta: "v1", estado: "APROVADA" }] })).toThrow(/Falta aprovação/i);
  expect(() => liberarAplicacaoAditivo({ ...entrada(), aprovacoesAplicaveis: [entrada().aprovacoesAplicaveis[0], entrada().aprovacoesAplicaveis[0]] })).toThrow(/duplicada/i);
});
it("preserva vigência, alterações, PDF e conclusão na formalização e conferência", () => {
  expect(() => liberarAplicacaoAditivo({ ...entrada(), formalizacao: { ...formalizacao(), vigencia: "2026-10-02T00:00:00-03:00" } })).toThrow(/formalização/i);
  expect(() => liberarAplicacaoAditivo({ ...entrada(), formalizacao: { ...formalizacao(), alteracoesHash: hash("d") } })).toThrow(/formalização/i);
  expect(() => liberarAplicacaoAditivo({ ...entrada(), conferenciaSecretaria: { ...conferencia(), pdfHash: hash("d") } })).toThrow(/PDF formalizado/i);
  expect(() => liberarAplicacaoAditivo({ ...entrada(), conferenciaSecretaria: { ...conferencia(), conclusaoOriginalId: "outra" } })).toThrow(/PDF formalizado/i);
});
it("valida hashes, vigência, cadeia, identidade e permite Admin conferir", () => {
  expect(() => liberarAplicacaoAditivo({ ...entrada(), conferenciaSecretaria: { ...conferencia(), conferente: { ...secretaria, id: " " } } })).toThrow(/Secretaria/i);
  const baseComOriginal = { ...base, aditivosAnterioresIds: [base.originalId] };
  expect(() => liberarAplicacaoAditivo({ ...entrada(), baseAtual: baseComOriginal })).toThrow(/original não pode/i);
  expect(() => prepararAditivo({ propostaId: "p", versaoProposta: "v", preparador: secretaria, conclusaoOriginal: conclusao, base, modeloVersaoId: "m", alteracoesHash: "curto", motivo: "x", vigencia: "2026-10-01T00:00:00-03:00" })).toThrow(/SHA-256/i);
  expect(() => prepararAditivo({ propostaId: "p", versaoProposta: "v", preparador: secretaria, conclusaoOriginal: conclusao, base, modeloVersaoId: "m", alteracoesHash: hash("a"), motivo: "x", vigencia: "2026-02-30T00:00:00-03:00" })).toThrow(/ISO com offset/i);
  expect(() => prepararAditivo({ propostaId: "p", versaoProposta: "v", preparador: secretaria, conclusaoOriginal: conclusao, base: { ...base, aditivosAnterioresIds: ["a", "a"] }, modeloVersaoId: "m", alteracoesHash: hash("b"), motivo: "x", vigencia: "2026-10-01T00:00:00-03:00" })).toThrow(/cadeia.*duplicada/i);
  expect(() => liberarAplicacaoAditivo({ ...entrada(), baseAtual: { ...base, hash: hash("d") } })).toThrow(/base atual/i);
  expect(() => liberarAplicacaoAditivo({ ...entrada(), jaAplicada: true })).toThrow(/já foi aplicado/i);
  expect(liberarAplicacaoAditivo({ ...entrada(), conferenciaSecretaria: { ...conferencia(), conferente: admin } }).liberada).toBe(true);
});
