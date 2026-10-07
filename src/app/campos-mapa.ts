// Manifesto da trava do Campo (src/app/campos.test.ts). Gerado a partir das telas; qualquer mudança
// aqui aparece no diff da revisão.
//
// EXCECOES_CAMPO: casos que a trava acusaria e que ficam como estão, ancorados em arquivo + trecho
// (a tag de abertura exata, espaços normalizados) + motivo. Cada um tem de casar com exatamente um caso.
// Nas áreas migradas até aqui (/matriculas/nova e /alunos/[id]) nenhum controle precisou de exceção:
// a lista começa vazia e só recebe o que uma migração justificar.
//
// MAPA_CAMPOS: cada <Campo> de cada tela, na ordem do fonte — rótulo · obrigatoriedade · controle
// ligado, mais "dica" e "erro" quando o Campo os recebe. Trocar um Campo por um controle solto,
// apagá-lo, tirar o `obrigatorio` ou deixar de ligar o `erro` da validação muda o mapa e falha a trava.

export type ExcecaoCampo = { arquivo: string; trecho: string; motivo: string };

export const EXCECOES_CAMPO: readonly ExcecaoCampo[] = [];

export const MAPA_CAMPOS: Record<string, string[]> = {
  "src/app/(app)/alunos/[id]/FichaAluno.tsx": [
    "Nome · obrigatório · input · erro",
    "Sobrenome(s) · obrigatório · input · erro",
    "Nome preferido · opcional · input",
    "Nascimento · opcional · input",
    "Gênero · opcional · select",
    "País · obrigatório · select · erro",
    "Tipo de documento · opcional · select",
    "Número do documento · opcional · input · dica",
    "País emissor · opcional · SelectISO",
    "Nacionalidade · opcional · SelectISO",
    "Segunda nacionalidade · opcional · SelectISO",
    "E-mail · opcional · input",
    "Telefone · opcional · input",
    "País de residência · opcional · SelectISO",
    "CEP / Código postal · opcional · input",
    "Região / Estado / Província · opcional · input",
    "Cidade · opcional · input",
    "Bairro / Distrito · opcional · input",
    "Rua · opcional · input",
    "Número · opcional · input",
    "Complemento · opcional · input",
    "Escolaridade · opcional · select",
    "Idioma nativo · opcional · input",
    "Fuso horário · opcional · input",
    "Observações · opcional · CampoTexto",
    "Motivo da edição · obrigatório · CampoTexto · dica · erro",
    "Motivo da pausa · obrigatório · input · erro",
    "Retorno previsto (opcional) · opcional · input",
    "Motivo do encerramento · obrigatório · select",
    'Observação · obrigatório se motivoEnc === "Outro" · input · dica · erro',
  ],
  "src/app/(app)/matriculas/nova/MatriculaFormulario.tsx": [
    "Nome · obrigatório · input · erro",
    "Sobrenome(s) · obrigatório · input · erro",
    "Nome preferido · opcional · input",
    "Data de nascimento · obrigatório · input · erro",
    "Gênero · obrigatório · select · erro",
    "País · obrigatório · select · erro",
    "Tipo de documento · obrigatório · select · erro",
    "Número do documento · obrigatório · input · erro",
    "País emissor · opcional · SelectISO",
    "Nacionalidade · obrigatório · SelectISO · erro",
    "Segunda nacionalidade · opcional · SelectISO",
    "E-mail · obrigatório · input · erro",
    "Telefone principal · obrigatório · input · erro",
    "País de residência · obrigatório · SelectISO · erro",
    "CEP / Código postal · opcional · input",
    "Região / Estado / Província · opcional · input",
    "Cidade · opcional · input",
    "Bairro / Distrito · opcional · input",
    "Rua · opcional · input",
    "Número · opcional · input",
    "Complemento · opcional · input",
    "Escolaridade · opcional · select",
    "Idioma nativo · opcional · input",
    "Fuso horário · opcional · input",
    "Nome do contato · opcional · input",
    "Parentesco · opcional · input",
    "Telefone · opcional · input",
    "Observações · opcional · CampoTexto",
    '{pagador === "EMPRESA" ? "Nome da empresa" : "Nome do responsável"} · obrigatório · input · erro',
    "Parentesco · opcional · input",
    "Telefone · opcional · input",
    "E-mail · opcional · input",
    "Produto · opcional · select",
    "Turma (aberta com vaga) · opcional · select",
    "Nível inicial · opcional · select",
    "Origem do nível · opcional · select",
    "Data da avaliação · opcional · input",
    "Taxa de matrícula · obrigatório · CampoMoeda · dica · erro",
    "Mensalidade · obrigatório · CampoMoeda · dica · erro",
    "Dia de vencimento · opcional · select",
    "Meses do plano · opcional · input",
    "Cobertura prevista no contrato · obrigatório · select · dica · erro",
    "Vencimento da primeira mensalidade · obrigatório · input · dica · erro",
    "Início do primeiro período coberto · obrigatório · input · dica · erro",
    "Certificado (só Costa Rica) · opcional · CampoMoeda · erro",
    "Justificativa da exceção (sem tabela de preço) · obrigatório · CampoTexto",
  ],
};
