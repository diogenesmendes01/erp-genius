import { expect, it } from "vitest";
import { aprovarSubstituicao, autorizarInicioCancelamentoSubstituicao, confirmarCancelamentoParaSubstituicao, prepararSubstituicao, type AtorSubstituicao, type ProcessoFonteSubstituicao } from "./substituicao-regras";

const secretaria: AtorSubstituicao = { id: "secretaria", ativo: true, papeis: ["SECRETARIA_ACADEMICA"] };
const admin: AtorSubstituicao = { id: "admin", ativo: true, papeis: ["ADMINISTRADOR"] };
const fonte: ProcessoFonteSubstituicao = { id: "processo-antigo", matriculaId: "matricula-1", artefatoId: "original-antigo", estado: "ENVIADO", revisaoHash: "fonte-v1", referenciaExterna: "envio-externo-1" };
const base = { processoFonte: fonte, conclusaoFonte: null, revisaoFonteAtual: "fonte-v1", revisaoSubstitutoAtual: "novo-v1" } as const;

function proposta() { return prepararSubstituicao({ propostaId: "proposta-1", preparador: secretaria, ...base, matriculaSubstitutoId: "matricula-1", artefatoSubstitutoId: "original-novo" }); }
function aprovada() { return aprovarSubstituicao({ proposta: proposta(), aprovador: admin, ...base }); }
function autorizacao() { return autorizarInicioCancelamentoSubstituicao({ proposta: aprovada(), executor: secretaria, tentativaId: "tentativa-1", ...base }); }
function prova(tentativaId = "tentativa-1", referenciaExterna = "envio-externo-1") { return { resultado: "CONFIRMADO" as const, propostaId: "proposta-1", processoFonteId: "processo-antigo", tentativaId, referenciaExterna, evidenciaHash: "a".repeat(64) }; }

it("libera somente após aprovação independente e cancelamento comprovado, sem herdar assinaturas", () => {
  const liberada = confirmarCancelamentoParaSubstituicao({ proposta: aprovada(), autorizacao: autorizacao(), ...base, prova: prova() });
  expect(liberada).toEqual({ liberada: true, processoFonteId: "processo-antigo", artefatoSubstitutoId: "original-novo", revisaoSubstitutoHash: "novo-v1", assinaturasHerdadas: [] });
  expect(confirmarCancelamentoParaSubstituicao({ proposta: aprovada(), autorizacao: autorizacao(), ...base, prova: prova() })).toEqual(liberada);
});

it("exige mesma matrícula, original novo, papéis corretos e fonte/revisão atuais", () => {
  expect(() => prepararSubstituicao({ propostaId: "p", preparador: { id: "v", ativo: true, papeis: ["VENDEDOR"] }, ...base, matriculaSubstitutoId: "matricula-1", artefatoSubstitutoId: "novo" })).toThrow(/Secretaria/i);
  expect(() => prepararSubstituicao({ propostaId: "p", preparador: secretaria, ...base, matriculaSubstitutoId: "outra", artefatoSubstitutoId: "novo" })).toThrow(/mesma matrícula/i);
  expect(() => prepararSubstituicao({ propostaId: "p", preparador: secretaria, ...base, matriculaSubstitutoId: "matricula-1", artefatoSubstitutoId: fonte.artefatoId })).toThrow(/original diferente/i);
  expect(() => aprovarSubstituicao({ proposta: proposta(), aprovador: { ...admin, id: secretaria.id }, ...base })).toThrow(/outro administrador/i);
  expect(() => aprovarSubstituicao({ proposta: proposta(), aprovador: admin, ...base, revisaoSubstitutoAtual: "novo-v2" })).toThrow(/mudou/i);
  expect(() => prepararSubstituicao({ propostaId: "p", preparador: secretaria, ...base, processoFonte: { ...fonte, estado: "ENVIO_INCERTO" }, matriculaSubstitutoId: "matricula-1", artefatoSubstitutoId: "novo" })).toThrow(/incerto/i);
  expect(() => prepararSubstituicao({ propostaId: "p", preparador: secretaria, ...base, conclusaoFonte: { processoId: fonte.id, matriculaId: fonte.matriculaId, artefatoId: fonte.artefatoId }, matriculaSubstitutoId: "matricula-1", artefatoSubstitutoId: "novo" })).toThrow(/Q117/);
});

it("não inicia sem aprovação exata e mantém resultado incerto conciliável", () => {
  expect(() => autorizarInicioCancelamentoSubstituicao({ proposta: proposta(), executor: secretaria, tentativaId: "t", ...base })).toThrow(/aprovação independente/i);
  const incerta = confirmarCancelamentoParaSubstituicao({ proposta: aprovada(), autorizacao: autorizacao(), ...base, prova: { resultado: "INCERTO", propostaId: "proposta-1", processoFonteId: "processo-antigo", tentativaId: "tentativa-1" } });
  expect(incerta).toEqual({ liberada: false, motivo: "CANCELAMENTO_INCERTO", tentativaId: "tentativa-1" });
});

it("vincula prova externa à tentativa e à referência do processo", () => {
  expect(() => confirmarCancelamentoParaSubstituicao({ proposta: aprovada(), autorizacao: autorizacao(), ...base, prova: prova("tentativa-outra") })).toThrow(/tentativa/i);
  expect(() => confirmarCancelamentoParaSubstituicao({ proposta: aprovada(), autorizacao: autorizacao(), ...base, prova: prova("tentativa-1", "referencia-outra") })).toThrow(/referência/i);
});
