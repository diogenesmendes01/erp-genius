// Manifesto da trava do Campo (src/app/campos.test.ts). Gerado a partir das telas; qualquer mudança
// aqui aparece no diff da revisão.
//
// EXCECOES_CAMPO: casos que a trava acusaria e que ficam como estão, ancorados em arquivo + trecho
// (a tag de abertura exata, espaços normalizados) + motivo não vazio. Cada um tem de casar com
// exatamente um caso. Nas áreas migradas até aqui (/matriculas/nova e /alunos/[id]) nenhum controle
// precisou de exceção: a lista começa vazia e só recebe o que uma migração justificar.
//
// MAPA_CAMPOS: cada <Campo> de cada tela, na ordem do fonte — rótulo · obrigatoriedade · controle
// ligado, mais "dica" quando há dica e "erro: <expressão>" com a expressão que alimenta o erro. Trocar
// um Campo por um controle solto, apagá-lo, tirar o `obrigatorio` ou religar o `erro` a outra expressão
// muda o mapa e falha a trava. Erro constante (`erro={undefined}`, `erro="…"`) e dica/rótulo vazios
// a própria trava recusa, com ou sem mudança aqui. Que a expressão do erro vem da validação certa, os
// testes de interação das telas conferem (FichaAluno.interacao.test.ts e
// MatriculaFormulario.interacao.test.ts).

export type ExcecaoCampo = { arquivo: string; trecho: string; motivo: string };

export const EXCECOES_CAMPO: readonly ExcecaoCampo[] = [];

export const MAPA_CAMPOS: Record<string, string[]> = {
  "src/app/(app)/alunos/[id]/FichaAluno.tsx": [
    "Nome · obrigatório · input · erro: errosEdicao.primeiroNome",
    "Sobrenome(s) · obrigatório · input · erro: errosEdicao.sobrenome",
    "Nome preferido · opcional · input",
    "Nascimento · opcional · input",
    "Gênero · opcional · select",
    "País · obrigatório · select · erro: errosEdicao.paisId",
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
    "Fuso horário · opcional · CampoFuso",
    "Observações · opcional · CampoTexto",
    "Motivo da edição · obrigatório · CampoTexto · dica · erro: errosEdicao.motivo",
    'Motivo da pausa · obrigatório · input · erro: tentou && !motivoPausa.trim() ? "Informe o motivo da pausa." : null',
    "Retorno previsto (opcional) · opcional · input",
    "Motivo do encerramento · obrigatório · select",
    'Observação · obrigatório se motivoEnc === "Outro" · input · dica · erro: erroObsEnc',
  ],
  "src/app/(app)/matriculas/nova/MatriculaFormulario.tsx": [
    "Nome · obrigatório · input · erro: errosPasso1.primeiroNome",
    "Sobrenome(s) · obrigatório · input · erro: errosPasso1.sobrenome",
    "Nome preferido · opcional · input",
    "Data de nascimento · obrigatório · input · erro: errosPasso1.nascimento",
    "Gênero · obrigatório · select · erro: errosPasso1.genero",
    "País · obrigatório · select · erro: errosPasso1.alunoPaisId",
    "Tipo de documento · obrigatório · select · erro: errosPasso1.tipoDocumentoId",
    "Número do documento · obrigatório · input · erro: errosPasso1.documento",
    "País emissor · opcional · SelectISO",
    "Nacionalidade · obrigatório · SelectISO · erro: errosPasso1.nacionalidade",
    "Segunda nacionalidade · opcional · SelectISO",
    "E-mail · obrigatório · input · erro: errosPasso1.email",
    "Telefone principal · obrigatório · input · erro: errosPasso1.telefone",
    "País de residência · obrigatório · SelectISO · erro: errosPasso1.paisResidencia",
    "CEP / Código postal · opcional · input",
    "Região / Estado / Província · opcional · input",
    "Cidade · opcional · input",
    "Bairro / Distrito · opcional · input",
    "Rua · opcional · input",
    "Número · opcional · input",
    "Complemento · opcional · input",
    "Escolaridade · opcional · select",
    "Idioma nativo · opcional · input",
    "Fuso horário · opcional · CampoFuso",
    "Nome do contato · opcional · input",
    "Parentesco · opcional · input",
    "Telefone · opcional · input",
    "Observações · opcional · CampoTexto",
    '{pagador === "EMPRESA" ? "Nome da empresa" : "Nome do responsável"} · obrigatório · input · erro: errosPasso1.respNome',
    "Parentesco · opcional · input",
    "Telefone · opcional · input",
    "E-mail · opcional · input",
    "Produto · opcional · select",
    "Turma (aberta com vaga) · opcional · select",
    "Nível inicial · opcional · select",
    "Origem do nível · opcional · select",
    "Data da avaliação · opcional · input",
    "Taxa de matrícula · obrigatório · CampoMoeda · dica · erro: errosPasso2.taxa",
    "Mensalidade · obrigatório · CampoMoeda · dica · erro: errosPasso2.mensalidade",
    "Dia de vencimento · opcional · select",
    "Meses do plano · opcional · input",
    "Cobertura prevista no contrato · obrigatório · select · dica · erro: errosPasso2.referenciaCobertura",
    "Vencimento da primeira mensalidade · obrigatório · input · dica · erro: errosPasso2.primeiroVencimento",
    "Início do primeiro período coberto · obrigatório · input · dica · erro: errosPasso2.inicioCobertura",
    "Certificado (só Costa Rica) · opcional · CampoMoeda · erro: errosPasso2.certificado",
    "Justificativa da exceção (sem tabela de preço) · obrigatório · CampoTexto",
  ],
};
