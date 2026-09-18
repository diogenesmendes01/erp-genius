import type { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { hashSubstituicao } from "./substituicao-estado";
import { validarValorAlteracaoAditivo } from "./aditivo-valores";

const campos = ["ALUNO_NOME", "ALUNO_DOCUMENTO", "ALUNO_EMAIL", "ALUNO_ENDERECO", "PAGADOR_NOME", "PAGADOR_DOCUMENTO", "PAGADOR_EMAIL", "PAGADOR_ENDERECO"] as const;
type Campo = typeof campos[number];
type Versao = {
  matriculaId: string; versao: number; vigenciaInicio: Date; condicoes: Prisma.JsonValue; condicoesHash: string;
  aplicacao: { id: string; condicoesHash: string } | null;
};

/** Projeção contratual: nunca altera Aluno, identidade do portal ou outro contrato. */
export function projetarCadastroContratual(matriculaId: string, versao: Versao, em: Date) {
  if (versao.matriculaId !== matriculaId || !Number.isFinite(em.getTime()) || !Number.isFinite(versao.vigenciaInicio.getTime())) {
    throw new ErroRegra("Referência inválida para o cadastro contratual.");
  }
  if (hashSubstituicao(versao.condicoes) !== versao.condicoesHash) throw new ErroRegra("Cadastro contratual diverge da versão preservada.");
  if (!versao.aplicacao) return null;
  if (versao.aplicacao.condicoesHash !== versao.condicoesHash) throw new ErroRegra("Aplicação não corresponde ao cadastro contratual.");
  if (!versao.condicoes || Array.isArray(versao.condicoes) || typeof versao.condicoes !== "object") throw new ErroRegra("Condições cadastrais inválidas.");
  const valores: Partial<Record<Campo, string>> = {};
  for (const campo of campos) {
    const origem = versao.condicoes[campo];
    if (origem === undefined) continue;
    const valor = validarValorAlteracaoAditivo(campo, origem);
    if (valor.tipo === "TEXT") valores[campo] = valor.texto;
    else if (valor.tipo === "EMAIL") valores[campo] = valor.email;
  }
  return {
    matriculaId, versao: versao.versao, aplicacaoId: versao.aplicacao.id,
    vigenciaInicio: versao.vigenciaInicio.toISOString(),
    estado: versao.vigenciaInicio > em ? "PROGRAMADO" as const : "VIGENCIA_INICIADA" as const,
    campos: valores,
  };
}
