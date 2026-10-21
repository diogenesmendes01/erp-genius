-- Integração 270: a competência é um rótulo, não a identidade do serviço.
-- Q101 admite emissões complementares por hora no mesmo mês; Q66/Q162/Q169
-- identificam a continuidade pela cobertura/âncora aprovada. As unicidades de
-- EmissaoFechamentoHoras e EmissaoContinuidadeMensal continuam preservadas.
-- Não alterar a migração histórica da main nem apagar cobranças existentes.
DROP INDEX IF EXISTS "Cobranca_matricula_tipo_competencia_viva";
