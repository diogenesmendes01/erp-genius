import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ATRIBUTOS_DE_TEXTO_NATIVO, FABRICAS_DE_ELEMENTO, FUNCOES_TRANSPARENTES, ITERADORES_DE_ELEMENTO, ITERADORES_DE_VALOR, METODOS_DE_BUSCA,
  METODOS_TRANSPARENTES, NOME_DE_ID, PROP_DE_DESTINO, PROPS_LIVRES, idsCrusNaTela, sinaisDeIdentificacao,
  type AchadoId, type SinaisDeIdentificacao, type TipoAchadoId,
} from "@/test/identificacao-registro";

// Trava da identificação do registro (docs/43-medicao-auditoria-ux.md §6 item 7; docs/42-auditoria-frontend-ux.md
// L798, L1399, L1492, L1989, L268, L279). Duas regras, pelo AST do TypeScript (leitura em src/test/identificacao-registro.ts):
//
// 1. NENHUMA TELA IMPRIME ID CRU. Em todo arquivo de produção de src/app e src/components, um id interno de
//    registro (`.id`, `*Id`, `ids`) não chega a texto JSX, a atributo de texto de elemento nativo nem a prop de
//    componente que não seja de id/destino/valor — seguindo `??`, `||`, ternário, template, `+`, `String()`,
//    `.slice()`/`.join()`…, `.map`, constante, `let`, desestruturação, parâmetro de iteração e função local; id
//    passado a função que a leitura não segue (importada) é achado `opaco` (falha fechada). O id que precisa
//    aparecer vai como texto secundário no `title` (é prop livre); o texto principal é código, nome, data ou
//    rótulo curto.
// 2. TELA DE DETALHE IDENTIFICA O REGISTRO. Toda página de src/app/(app) com segmento dinâmico, fora de
//    /matriculas/[id] (que tem o cabeçalho no layout), usa um componente Identificacao* (IdentificacaoRegistro,
//    IdentificacaoAvaliacao — também renomeado no import) ou um <h1> que nomeia o registro com um valor que não
//    é id cru — na página ou num componente local que ela importa (import relativo, um nível).
//
// Exceções: arquivo + tipo + trecho EXATO (espaços normalizados) + alvo + categoria + motivo; cada uma casa com
// exatamente `vezes` achados (1 por padrão), e a lista é comparada com uma cópia literal (acrescentar exceção
// exige mexer nos dois lugares). As de identificação: página + trecho exato de um elemento JSX dela (ou de um
// componente local) + categoria + motivo; a de categoria "identifica" ancora o elemento que diz de quem é o
// registro (e ele tem de ter um valor). Arquivo que não analisa falha fechado nas duas regras.
//
// Categorias de id: "externo" (identificador de outro sistema que o operador confere lá: Drive, origem da
// migração), "codigo" (o campo tem nome de id mas guarda um código humano), "nao-registro" (valor de controle ou
// chave de campo, não registro), "pendente" (id cru de verdade, fora desta entrega — listado nas pendências da PR;
// a lista só diminui). Categorias de identificação: "identifica", "sem-aluno" (o registro não é de um aluno; a
// âncora é o que o identifica) e "pendente".

const RAIZES = ["src/app", "src/components"];
const normaliza = (t: string) => t.replace(/\s+/g, " ").trim();

function arquivosDeProducao() {
  const saida: { arquivo: string; fonte: string }[] = [];
  for (const raiz of RAIZES) for (const f of readdirSync(raiz, { recursive: true }) as string[]) {
    if (!/\.tsx?$/.test(f) || /\.test\.tsx?$/.test(f)) continue;
    const arquivo = join(raiz, f).split("\\").join("/");
    saida.push({ arquivo, fonte: readFileSync(arquivo, "utf8") });
  }
  return saida;
}

// ---------------------------------------------------------------------------------------------------
// 1. Id cru — exceções
// ---------------------------------------------------------------------------------------------------
export type CategoriaId = "externo" | "codigo" | "nao-registro" | "pendente";
export type ExcecaoId = { arquivo: string; tipo: TipoAchadoId; trecho: string; alvo: string; vezes?: number; categoria: CategoriaId; motivo: string };

const MOTIVO_DRIVE = "identificador do arquivo e da revisão no Google Drive (fonte externa) que a gestão confere no próprio Drive ao regularizar a gravação; não é id interno do ERP";
const MOTIVO_ORIGEM_MIGRACAO = "identificador do registro no sistema de origem da migração, que o operador confere na planilha de origem; não é id interno do ERP";
const MOTIVO_CLAUSULA = "referência da cláusula digitada pela Secretaria na regra de encerramento (ex.: \"7.2\"): é o número da cláusula no contrato, não id de registro";
const MOTIVO_CODIGO_AVALIACAO = "código da avaliação (o mesmo de `fontes[].codigo`, ex.: P1), usado quando a fonte não tem título; não é id de registro";
const MOTIVO_CHAVE_DE_ERRO = "mensagem de validação do campo do formulário: o nome é a chave do campo (paisId, tipoDocumentoId) no objeto de erros, não o id";
const MOTIVO_VALOR_DE_CONTROLE = "valor do controle de seleção (ids marcados no formulário ou o professor escolhido na prévia); o componente mostra o nome, não o id";
const PENDENTE_MOVIMENTACOES = "pendente (fora do item 7): os painéis de pausa, retomada, compensação e encerramento do aluno ainda imprimem ids de cobrança, matrícula e proposta; exigem os rótulos no servidor";
const PENDENTE_PR158 = "pendente: arquivo em revisão na #158 (paginação), que esta entrega não toca; a troca do id pelo código vem depois do merge dela";
const PENDENTE_MIGRACAO = "pendente: id interno do registro de destino na conferência da migração (aluno, pagador, cobrança, matrícula); exige o código na consulta";
const PENDENTE_MEMORIA = "pendente: referência interna guardada na memória (reserva, compra, documento, calendário) em /matriculas/[id]; exige o rótulo na fotografia da memória";
const PENDENTE_LISTAS_ACERTO = "pendente (docs/42 L2030): a lista não traz aluno nem código da matrícula; exige os dois no select da consulta da lista";
const PENDENTE_RECEBIMENTOS = "pendente: o histórico de recebimentos não traz o código da matrícula nem o da cobrança destinada; exige a consulta";
const PENDENTE_REMARCACAO = "pendente: a conferência da remarcação lista a reserva pelo id; aluno e matrícula já estão na identificação logo acima";

export const EXCECOES_ID: ExcecaoId[] = [
  { arquivo: "src/app/(app)/secretaria/CondicoesEncerramento.tsx", tipo: "texto", trecho: "{r.multa.clausulaId}", alvo: "r.multa.clausulaId", categoria: "codigo", motivo: MOTIVO_CLAUSULA },
  { arquivo: "src/app/(app)/secretaria/CondicoesEncerramento.tsx", tipo: "texto", trecho: "{acerto.clausulaId}", alvo: "acerto.clausulaId", categoria: "codigo", motivo: MOTIVO_CLAUSULA },
  { arquivo: "src/app/(app)/alunos/[id]/FichaAluno.tsx", tipo: "prop", trecho: "erro={errosEdicao.paisId}", alvo: "errosEdicao.paisId", categoria: "nao-registro", motivo: MOTIVO_CHAVE_DE_ERRO },
  { arquivo: "src/app/(app)/configuracao/paises/page.tsx", tipo: "prop", trecho: "paises={rows}", alvo: "pp.produtoId", categoria: "nao-registro", motivo: MOTIVO_VALOR_DE_CONTROLE },
  { arquivo: "src/app/(app)/diario/regularizacoes-gravacao/page.tsx", tipo: "prop", trecho: "fontes={fontes}", alvo: "p.encontroId", categoria: "pendente", motivo: PENDENTE_PR158 },
  { arquivo: "src/app/(app)/diario/regularizacoes-gravacao/page.tsx", tipo: "prop", trecho: "fontes={fontes}", alvo: "m.reposicaoId", categoria: "pendente", motivo: PENDENTE_PR158 },
  { arquivo: "src/app/(app)/diario/regularizacoes-gravacao/page.tsx", tipo: "prop", trecho: "propostas={propostas}", alvo: "p.publicacaoAulaId", categoria: "pendente", motivo: PENDENTE_PR158 },
  { arquivo: "src/app/(app)/diario/regularizacoes-gravacao/page.tsx", tipo: "prop", trecho: "propostas={propostas}", alvo: "p.materialReposicaoId", categoria: "pendente", motivo: PENDENTE_PR158 },
  { arquivo: "src/app/(app)/diario/regularizacoes-gravacao/RegularizacoesGravacao.tsx", tipo: "texto", trecho: "{p.arquivoOficialId}", alvo: "p.arquivoOficialId", categoria: "externo", motivo: MOTIVO_DRIVE },
  { arquivo: "src/app/(app)/diario/regularizacoes-gravacao/RegularizacoesGravacao.tsx", tipo: "texto", trecho: "{p.driveRevisionId}", alvo: "p.driveRevisionId", categoria: "externo", motivo: MOTIVO_DRIVE },
  { arquivo: "src/app/(app)/financeiro/acertos-cobertura/page.tsx", tipo: "texto", trecho: "{item.matriculaId}", alvo: "item.matriculaId", categoria: "pendente", motivo: PENDENTE_LISTAS_ACERTO },
  { arquivo: "src/app/(app)/financeiro/acertos-taxa/page.tsx", tipo: "texto", trecho: "{v.matriculaId}", alvo: "v.matriculaId", categoria: "pendente", motivo: PENDENTE_LISTAS_ACERTO },
  { arquivo: "src/app/(app)/financeiro/migracao/page.tsx", tipo: "texto", trecho: "{linha.matriculaOrigemId ?? \"não informado\"}", alvo: "linha.matriculaOrigemId", categoria: "externo", motivo: MOTIVO_ORIGEM_MIGRACAO },
  { arquivo: "src/app/(app)/financeiro/migracao/page.tsx", tipo: "texto", trecho: "{linha.financeiroOrigemId ?? \"não informado\"}", alvo: "linha.financeiroOrigemId", categoria: "externo", motivo: MOTIVO_ORIGEM_MIGRACAO },
  { arquivo: "src/app/(app)/financeiro/recebimentos/page.tsx", tipo: "texto", trecho: "{r.matriculaId}", alvo: "r.matriculaId", categoria: "pendente", motivo: PENDENTE_RECEBIMENTOS },
  { arquivo: "src/app/(app)/financeiro/recebimentos/page.tsx", tipo: "texto", trecho: "{v.tipo === \"CREDITO_SEM_DESTINO\" ? \"Crédito sem destino\" : `Cobrança ${v.cobrancaId}`}", alvo: "v.cobrancaId", categoria: "pendente", motivo: PENDENTE_RECEBIMENTOS },
  { arquivo: "src/app/(app)/matriculas/nova/MatriculaFormulario.tsx", tipo: "prop", trecho: "erro={errosPasso1.alunoPaisId}", alvo: "errosPasso1.alunoPaisId", categoria: "nao-registro", motivo: MOTIVO_CHAVE_DE_ERRO },
  { arquivo: "src/app/(app)/matriculas/nova/MatriculaFormulario.tsx", tipo: "prop", trecho: "erro={errosPasso1.tipoDocumentoId}", alvo: "errosPasso1.tipoDocumentoId", categoria: "nao-registro", motivo: MOTIVO_CHAVE_DE_ERRO },
  { arquivo: "src/app/(app)/academico/avaliacoes/[alocacaoId]/page.tsx", tipo: "texto", trecho: "{consolidado.dado!.fontes.find(f => f.codigo === m.avaliacaoId)?.titulo ?? m.avaliacaoId}", alvo: "m.avaliacaoId", categoria: "codigo", motivo: MOTIVO_CODIGO_AVALIACAO },
  { arquivo: "src/app/(app)/academico/grades/nova/page.tsx", tipo: "prop", trecho: "turmas={turmas.slice(0, 30).map((t) => ({ id: t.id, codigo: t.codigo ?? `Turma sem código (${t.id})`, versao: t.propostasGrade[0]?.versao ?? 0, dataInicio: t.dataInicio?.toISOString().slice(0, 10) ?? null, horario: t.horarioInicio, dias: t.diasSemana, quantidade: t.modalidade.aulasPorNivel, duracao: t.modalidade.horasAula * 60, frequencia: t.modalidade.frequencia, professor: t.professor?.nome ?? null }))}", alvo: "t.id", categoria: "pendente", motivo: PENDENTE_PR158 },
  { arquivo: "src/app/(app)/academico/recuperacoes/designadas/page.tsx", tipo: "texto", trecho: "{i.matriculaCodigo ?? i.matriculaId}", alvo: "i.matriculaId", categoria: "pendente", motivo: PENDENTE_PR158 },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/AcertoEncerramento.tsx", tipo: "texto", trecho: "{c.matriculaId}", alvo: "c.matriculaId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/AcertoEncerramento.tsx", tipo: "texto", trecho: "{p.cobrancaId}", alvo: "p.cobrancaId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/AcertoEncerramento.tsx", tipo: "texto", trecho: "{a.cobrancaId}", alvo: "a.cobrancaId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/AcertoEncerramento.tsx", tipo: "texto", trecho: "{c.calculo.matriculaId}", alvo: "c.calculo.matriculaId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/AcertoEncerramento.tsx", tipo: "opaco", trecho: "{identificacaoContrato(matriculas.find((m) => m.id === c.matriculaId)?.codigo, c.matriculaId)}", alvo: "identificacaoContrato(matriculas.find((m) => m.id === c.matriculaId)?.codigo, c.matriculaId)", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/AcertoEncerramento.tsx", tipo: "texto", trecho: "{p.id}", alvo: "p.id", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/AcertoEncerramento.tsx", tipo: "texto", trecho: "{c.condicoes.regras.multa.clausulaId}", alvo: "c.condicoes.regras.multa.clausulaId", categoria: "codigo", motivo: MOTIVO_CLAUSULA },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/CompensacoesEncerramento.tsx", tipo: "texto", trecho: "{comp.cobrancaOrigemId}", alvo: "comp.cobrancaOrigemId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/CompensacoesEncerramento.tsx", tipo: "texto", trecho: "{comp.documentoOrigemId ?? \"não registrado\"}", alvo: "comp.documentoOrigemId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/CompensacoesPainel.tsx", tipo: "texto", trecho: "{proposta.id}", alvo: "proposta.id", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/CompensacoesPainel.tsx", tipo: "texto", trecho: "{proposta.cobrancaOrigemId}", alvo: "proposta.cobrancaOrigemId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/CompensacoesPainel.tsx", tipo: "texto", trecho: "{c.codigo ?? c.id}", alvo: "c.id", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/CompensacoesPainel.tsx", tipo: "texto", trecho: "{c.id}", alvo: "c.id", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/ComprasHorasPainel.tsx", tipo: "texto", trecho: "{c.cobrancaId}", alvo: "c.cobrancaId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/ComprasHorasPainel.tsx", tipo: "texto", trecho: "{r.encontroId}", alvo: "r.encontroId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/ComprasHorasPainel.tsx", tipo: "texto", trecho: "{c.id}", alvo: "c.id", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/ComprasHorasPainel.tsx", tipo: "texto", trecho: "{c.codigo ?? c.id}", alvo: "c.id", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/ImpactosAcademicosAcerto.tsx", tipo: "texto", trecho: "{v.turmaId}", alvo: "v.turmaId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/LancamentosEncerramento.tsx", tipo: "texto", trecho: "{a.cobrancaId}", alvo: "a.cobrancaId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/LancamentosEncerramento.tsx", tipo: "texto", trecho: "{cr.origemId}", alvo: "cr.origemId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/MovimentacoesPainel.tsx", tipo: "opaco", trecho: "{p.matriculas.map((m) => identificacaoContrato(m.codigo, m.id)).join(\", \")}", alvo: "identificacaoContrato(m.codigo, m.id)", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/MovimentacoesPainel.tsx", tipo: "opaco", trecho: "{identificacaoContrato(m.codigo, m.matriculaId)}", alvo: "identificacaoContrato(m.codigo, m.matriculaId)", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/NovaPausa.tsx", tipo: "opaco", trecho: "{identificacaoContrato(m.codigo, m.matriculaId)}", alvo: "identificacaoContrato(m.codigo, m.matriculaId)", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/NovaRetomada.tsx", tipo: "opaco", trecho: "{identificacaoContrato(m.codigo, m.matriculaId)}", alvo: "identificacaoContrato(m.codigo, m.matriculaId)", vezes: 2, categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx", tipo: "texto", trecho: "{c.calculo.matriculaId}", alvo: "c.calculo.matriculaId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx", tipo: "texto", trecho: "{p.cobrancaId}", alvo: "p.cobrancaId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx", tipo: "texto", trecho: "{p.origemFaturamentoHoras.emissaoId}", alvo: "p.origemFaturamentoHoras.emissaoId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx", tipo: "texto", trecho: "{p.origemFaturamentoHoras.decisaoId}", alvo: "p.origemFaturamentoHoras.decisaoId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx", tipo: "texto", trecho: "{item.conferenciaId}", alvo: "item.conferenciaId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx", tipo: "texto", trecho: "{recebimento.id}", alvo: "recebimento.id", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx", tipo: "texto", trecho: "{uso.creditoId}", alvo: "uso.creditoId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx", tipo: "texto", trecho: "{uso.decisaoId}", alvo: "uso.decisaoId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/page.tsx", tipo: "opaco", trecho: "{p.itens.map((i) => identificacaoContrato(i.matricula.codigo, i.matricula.id)).join(\", \")}", alvo: "identificacaoContrato(i.matricula.codigo, i.matricula.id)", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/RecomposicaoPainel.tsx", tipo: "texto", trecho: "{p.cobrancaId}", alvo: "p.cobrancaId", categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/alunos/[id]/movimentacoes/RecomposicaoPainel.tsx", tipo: "texto", trecho: "{c.id}", alvo: "c.id", vezes: 3, categoria: "pendente", motivo: PENDENTE_MOVIMENTACOES },
  { arquivo: "src/app/(app)/configuracao/migracao/[loteId]/AplicarCadastroMigracao.tsx", tipo: "texto", trecho: "{linha.alunoId ? ` · destino ${linha.alunoId}` : \"\"}", alvo: "linha.alunoId", categoria: "pendente", motivo: PENDENTE_MIGRACAO },
  { arquivo: "src/app/(app)/configuracao/migracao/[loteId]/EnsaioVinculoMigracao.tsx", tipo: "texto", trecho: "{produtoOrigemId}", alvo: "produtoOrigemId", categoria: "externo", motivo: MOTIVO_ORIGEM_MIGRACAO },
  { arquivo: "src/app/(app)/configuracao/migracao/[loteId]/EnsaioVinculoMigracao.tsx", tipo: "texto", trecho: "{turmaOrigemId}", alvo: "turmaOrigemId", categoria: "externo", motivo: MOTIVO_ORIGEM_MIGRACAO },
  { arquivo: "src/app/(app)/configuracao/migracao/[loteId]/page.tsx", tipo: "texto", trecho: "{linha.alunoOrigemId ?? \"não identificado\"}", alvo: "linha.alunoOrigemId", categoria: "externo", motivo: MOTIVO_ORIGEM_MIGRACAO },
  { arquivo: "src/app/(app)/configuracao/migracao/[loteId]/page.tsx", tipo: "texto", trecho: "{linha.turmaOrigemId ?? \"não identificada\"}", alvo: "linha.turmaOrigemId", categoria: "externo", motivo: MOTIVO_ORIGEM_MIGRACAO },
  { arquivo: "src/app/(app)/configuracao/migracao/[loteId]/page.tsx", tipo: "texto", trecho: "{linha.matriculaOrigemId ?? \"não identificada\"}", alvo: "linha.matriculaOrigemId", categoria: "externo", motivo: MOTIVO_ORIGEM_MIGRACAO },
  { arquivo: "src/app/(app)/configuracao/migracao/[loteId]/page.tsx", tipo: "texto", trecho: "{linha.financeiroOrigemId ?? \"não identificado\"}", alvo: "linha.financeiroOrigemId", categoria: "externo", motivo: MOTIVO_ORIGEM_MIGRACAO },
  { arquivo: "src/app/(app)/configuracao/migracao/[loteId]/page.tsx", tipo: "texto", trecho: "{a.alunoId ?? \"sem destino\"}", alvo: "a.alunoId", categoria: "pendente", motivo: PENDENTE_MIGRACAO },
  { arquivo: "src/app/(app)/financeiro/migracao/[linhaId]/ConferenciaFinanceiraMigracao.tsx", tipo: "texto", trecho: "{campo === \"tipo\" ? rotular(TIPO_COBRANCA_LABEL, cobranca?.tipo) : campo === \"situacao\" ? \"Pagamento comprovado\" : campo === \"dataPagamento\" ? (dataHistoricaComOffset(formulario.dataLocal, formulario.offset) ?? \"\") : campo === \"pagadorId\" ? (dados.pagadores.find((pagador) => pagador.id === formulario.pagadorId) ? `${identificarPagador(dados.pagadores.find((pagador) => pagador.id === formulario.pagadorId)!)} · registro ${formulario.pagadorId}` : \"\") : campo === \"valor\" ? formulario.valor : campo === \"moeda\" ? formulario.moeda : rotular(FORMA_PAGAMENTO_LABEL, formulario.forma)}", alvo: "formulario.pagadorId", categoria: "pendente", motivo: PENDENTE_MIGRACAO },
  { arquivo: "src/app/(app)/financeiro/migracao/[linhaId]/EntradaFinanceiraHistorica.tsx", tipo: "texto", trecho: "{p.pagadorId}", alvo: "p.pagadorId", categoria: "pendente", motivo: PENDENTE_MIGRACAO },
  { arquivo: "src/app/(app)/financeiro/migracao/[linhaId]/EntradaFinanceiraHistorica.tsx", tipo: "texto", trecho: "{p.cobrancaId}", alvo: "p.cobrancaId", categoria: "pendente", motivo: PENDENTE_MIGRACAO },
  { arquivo: "src/app/(app)/matriculas/[id]/condicoes-horas/CondicoesHoras.tsx", tipo: "texto", trecho: "{v.documentoId}", alvo: "v.documentoId", categoria: "pendente", motivo: PENDENTE_MEMORIA },
  { arquivo: "src/app/(app)/matriculas/[id]/continuidade-mensal/CondicoesContinuidadeMensal.tsx", tipo: "texto", trecho: "{versao.regras.ajusteVencimento.calendario.id}", alvo: "versao.regras.ajusteVencimento.calendario.id", categoria: "pendente", motivo: PENDENTE_MEMORIA },
  { arquivo: "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/ConferenciaHoras.tsx", tipo: "texto", trecho: "{e.conferencia.consumoAntecipacao.reservaId}", alvo: "e.conferencia.consumoAntecipacao.reservaId", categoria: "pendente", motivo: PENDENTE_MEMORIA },
  { arquivo: "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/ConferenciaHoras.tsx", tipo: "texto", trecho: "{e.conferencia.consumoAntecipacao.reserva.compraId}", alvo: "e.conferencia.consumoAntecipacao.reserva.compraId", categoria: "pendente", motivo: PENDENTE_MEMORIA },
  { arquivo: "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/ConferenciaHoras.tsx", tipo: "texto", trecho: "{previa.reservaAntecipada.reservaId}", alvo: "previa.reservaAntecipada.reservaId", categoria: "pendente", motivo: PENDENTE_MEMORIA },
  { arquivo: "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/ConferenciaHoras.tsx", tipo: "texto", trecho: "{previa.reservaAntecipada.compraId}", alvo: "previa.reservaAntecipada.compraId", categoria: "pendente", motivo: PENDENTE_MEMORIA },
  { arquivo: "src/app/(app)/configuracao/migracao/presenca/[linhaId]/PresencaHistorica.tsx", tipo: "texto", trecho: "{p.matriculaId}", alvo: "p.matriculaId", categoria: "pendente", motivo: PENDENTE_MIGRACAO },
  { arquivo: "src/app/(app)/configuracao/migracao/presenca/[linhaId]/PresencaHistorica.tsx", tipo: "texto", trecho: "{p.registroExistenteId}", alvo: "p.registroExistenteId", categoria: "pendente", motivo: PENDENTE_MIGRACAO },
  { arquivo: "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/RevisoesCorrecaoAula.tsx", tipo: "texto", trecho: "{foto.data.reservaConsumida.id}", alvo: "foto.data.reservaConsumida.id", categoria: "pendente", motivo: PENDENTE_MEMORIA },
  { arquivo: "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/RevisoesCorrecaoAula.tsx", tipo: "texto", trecho: "{foto.data.reservaConsumida.consumoId}", alvo: "foto.data.reservaConsumida.consumoId", categoria: "pendente", motivo: PENDENTE_MEMORIA },
  { arquivo: "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/RevisoesCorrecaoAula.tsx", tipo: "texto", trecho: "{foto.data.compraAntecipada.id}", alvo: "foto.data.compraAntecipada.id", categoria: "pendente", motivo: PENDENTE_MEMORIA },
  { arquivo: "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/RevisoesCorrecaoAula.tsx", tipo: "texto", trecho: "{foto.data.condicoes.documentoId}", alvo: "foto.data.condicoes.documentoId", categoria: "pendente", motivo: PENDENTE_MEMORIA },
  { arquivo: "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/remarcacao/page.tsx", tipo: "texto", trecho: "{d.conferencia.reservaId}", alvo: "d.conferencia.reservaId", categoria: "pendente", motivo: PENDENTE_REMARCACAO },
  { arquivo: "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/substituicao/page.tsx", tipo: "prop", trecho: "selecionado={substitutoId}", alvo: "substitutoId", categoria: "nao-registro", motivo: MOTIVO_VALOR_DE_CONTROLE },
];

/** Casa por arquivo + tipo + trecho exato + alvo; cada exceção casa com exatamente `vezes` achados (1 por padrão). */
export function conferirExcecoesId(achados: AchadoId[], excecoes: ExcecaoId[]): { semExcecao: string[]; soltas: string[] } {
  const casa = (a: AchadoId, e: ExcecaoId) => a.arquivo === e.arquivo && a.tipo === e.tipo && a.trecho === normaliza(e.trecho) && a.alvo === e.alvo;
  return {
    semExcecao: achados.filter((a) => !excecoes.some((e) => casa(a, e))).map((a) => `${a.arquivo}: [${a.tipo}] ${a.trecho} — id ${a.alvo}`),
    soltas: excecoes.filter((e) => achados.filter((a) => casa(a, e)).length !== (e.vezes ?? 1)).map((e) => `${e.arquivo}: [${e.tipo}] ${e.trecho} (${e.alvo})`),
  };
}

// ---------------------------------------------------------------------------------------------------
// 2. Identificação — exceções e varredura das telas de detalhe
// ---------------------------------------------------------------------------------------------------
export type CategoriaIdentificacao = "identifica" | "sem-aluno" | "pendente";
export type ExcecaoIdentificacao = { pagina: string; categoria: CategoriaIdentificacao; trecho: string; motivo: string };

const IDENTIFICA_PARAGRAFO = "a tela identifica o registro num parágrafo próprio (aluno, matrícula pelo código, turma), escrito antes do componente IdentificacaoRegistro";
const IDENTIFICA_PRESENCA = "a conferência da presença migrada identifica o aluno pelo nome na lista de dados (o id da matrícula ao lado é pendência da regra 1)";
const SEM_ALUNO_MODELO = "o registro é o modelo de contrato, identificado pelo código na URL e no título da seção; não é registro de aluno";
const SEM_ALUNO_LOTE = "o registro é o lote de migração, identificado pela origem e pela chave do lote; não é registro de aluno";
const SEM_ALUNO_TURMA = "o registro é a regra da turma, identificada pelo idioma e nível; as conferências trazem o nome da turma; não é registro de aluno";
const PENDENTE_IDENT_SEM_ALUNO = "pendente (docs/42 L1424): mostra o código da matrícula e o trajeto entre turmas, mas não o nome do aluno";
const PENDENTE_IDENT_MOVIMENTACOES = "pendente: a ficha de pausa, retomada e encerramento do aluno não diz o nome dele no corpo (só no título da aba, pelo layout)";
const PENDENTE_IDENT_ENCONTRO = "pendente: a tela do encontro não diz turma nem data da aula no corpo; exige a identificação do encontro na consulta";
const PENDENTE_IDENT_RESERVA = "pendente (docs/42 L408): a resolução da reserva não diz o aluno nem a matrícula; exige a identificação na consulta";
const PENDENTE_IDENT_AVALIACAO = "pendente: a tela da avaliação da matrícula não diz o aluno no corpo; a identificação da avaliação existe e não é usada aqui";
const PENDENTE_IDENT_CALENDARIO = "pendente: a prévia de replanejamento não diz qual versão do calendário está sendo replanejada";
const PENDENTE_IDENT_REPOSICAO = "pendente: as correções da conclusão de reposição não dizem o aluno nem a matrícula no corpo";

export const EXCECOES_IDENTIFICACAO: ExcecaoIdentificacao[] = [
  { pagina: "src/app/(app)/academico/equivalencias/[propostaId]/page.tsx", categoria: "pendente", trecho: "<p>{proposta.matricula.codigo ?? \"Matrícula sem código\"} · {textoTurma(proposta.turmaOrigem)} → {textoTurma(proposta.turmaDestino)}</p>", motivo: PENDENTE_IDENT_SEM_ALUNO },
  { pagina: "src/app/(app)/alunos/[id]/movimentacoes/page.tsx", categoria: "pendente", trecho: "<h1 className=\"text-2xl font-medium\">Pausa, retomada e encerramento</h1>", motivo: PENDENTE_IDENT_MOVIMENTACOES },
  { pagina: "src/app/(app)/configuracao/contratos/[codigo]/page.tsx", categoria: "sem-aluno", trecho: "<h2 className=\"text-xl font-medium\">Modelo {codigo}</h2>", motivo: SEM_ALUNO_MODELO },
  { pagina: "src/app/(app)/configuracao/migracao/[loteId]/page.tsx", categoria: "sem-aluno", trecho: "<h2 className=\"text-lg font-medium\">{lote.origem} · {lote.chaveLote}</h2>", motivo: SEM_ALUNO_LOTE },
  { pagina: "src/app/(app)/diario/encontros/[id]/page.tsx", categoria: "pendente", trecho: "<h1 className=\"text-2xl font-medium\">Diário do encontro</h1>", motivo: PENDENTE_IDENT_ENCONTRO },
  { pagina: "src/app/(app)/financeiro/migracao/[linhaId]/page.tsx", categoria: "identifica", trecho: "<p className=\"text-sm text-gray-600\">Linha {dados.linha.linhaOrigem} · origem {dados.linha.lote.origem} · contrato {dados.linha.mapa.codigo ?? \"sem código\"} de {dados.linha.mapa.aluno}.</p>", motivo: IDENTIFICA_PARAGRAFO },
  { pagina: "src/app/(app)/secretaria/reservas/[id]/page.tsx", categoria: "pendente", trecho: "<h1 className=\"text-2xl font-medium\">Resolução da reserva</h1>", motivo: PENDENTE_IDENT_RESERVA },
  { pagina: "src/app/(app)/academico/admissoes/excecoes/[reservaId]/page.tsx", categoria: "identifica", trecho: "<p>{p.data.identificacao.aluno} · {p.data.identificacao.matricula ?? \"Matrícula em preparação\"} · {p.data.identificacao.turma ?? \"Turma sem código\"}</p>", motivo: IDENTIFICA_PARAGRAFO },
  { pagina: "src/app/(app)/academico/avaliacoes/[alocacaoId]/equivalencia/page.tsx", categoria: "pendente", trecho: "<h1 className=\"text-2xl font-medium\">Preparar aproveitamento para transferência equivalente</h1>", motivo: PENDENTE_IDENT_AVALIACAO },
  { pagina: "src/app/(app)/academico/avaliacoes/[alocacaoId]/extras/page.tsx", categoria: "identifica", trecho: "<p>{d.identificacao.aluno} · matrícula {d.identificacao.matriculaCodigo ?? \"sem código\"} · {d.identificacao.oferta} · {d.identificacao.nivel}</p>", motivo: IDENTIFICA_PARAGRAFO },
  { pagina: "src/app/(app)/academico/avaliacoes/[alocacaoId]/fechamento/page.tsx", categoria: "pendente", trecho: "<h1 className=\"text-2xl font-medium\">Fechamento acadêmico do nível</h1>", motivo: PENDENTE_IDENT_AVALIACAO },
  { pagina: "src/app/(app)/academico/calendario/[id]/replanejamento/page.tsx", categoria: "pendente", trecho: "<h1 className=\"text-2xl font-medium\">Prévia de replanejamento</h1>", motivo: PENDENTE_IDENT_CALENDARIO },
  { pagina: "src/app/(app)/academico/correcoes/revisoes/[casoId]/page.tsx", categoria: "identifica", trecho: "<p>{nomeCompleto(caso.matricula.aluno)} · {caso.matricula.codigo ?? \"Matrícula sem código\"}</p>", motivo: IDENTIFICA_PARAGRAFO },
  { pagina: "src/app/(app)/academico/reposicoes/correcoes/[reposicaoId]/page.tsx", categoria: "pendente", trecho: "<h1 className=\"text-2xl font-medium\">Correções da conclusão de reposição</h1>", motivo: PENDENTE_IDENT_REPOSICAO },
  { pagina: "src/app/(app)/configuracao/migracao/presenca/[linhaId]/page.tsx", categoria: "identifica", trecho: "<dd>{p.alunoNome} · {p.matriculaId}</dd>", motivo: IDENTIFICA_PRESENCA },
  { pagina: "src/app/(app)/diario/encontros/[id]/cancelamento/page.tsx", categoria: "pendente", trecho: "<h1 className=\"text-2xl font-medium\">Cancelamento de particular</h1>", motivo: PENDENTE_IDENT_ENCONTRO },
  { pagina: "src/app/(app)/diario/encontros/[id]/gravacao/page.tsx", categoria: "pendente", trecho: "<h1 className=\"text-2xl font-medium\">Gravação da aula</h1>", motivo: PENDENTE_IDENT_ENCONTRO },
  { pagina: "src/app/(app)/diario/encontros/[id]/remarcacao/page.tsx", categoria: "pendente", trecho: "<h1 className=\"text-2xl font-medium\">Remarcar particular cancelada pela escola</h1>", motivo: PENDENTE_IDENT_ENCONTRO },
  { pagina: "src/app/(app)/secretaria/reservas/particulares/[id]/page.tsx", categoria: "pendente", trecho: "<h1 className=\"text-2xl font-medium\">Resolução da reserva particular</h1>", motivo: PENDENTE_IDENT_RESERVA },
  { pagina: "src/app/(app)/academico/regras/turmas/[turmaId]/historica/page.tsx", categoria: "sem-aluno", trecho: "<p>{d.turma.nivel.idioma.nome} — {d.turma.nivel.codigo}. {d.turma.regraAvaliacaoId ? \"A regra já foi vinculada; o histórico permanece disponível.\" : \"A turma não possui regra vinculada.\"}</p>", motivo: SEM_ALUNO_TURMA },
  { pagina: "src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/agenda/page.tsx", categoria: "identifica", trecho: "<p>{d.identificacao.aluno} · Matrícula {d.identificacao.matriculaCodigo ?? \"sem código\"} · {d.identificacao.turma} · {d.identificacao.nivel}</p>", motivo: IDENTIFICA_PARAGRAFO },
  { pagina: "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/cancelamento/page.tsx", categoria: "identifica", trecho: "<p>{d.identificacao.aluno} · Matrícula {d.identificacao.matriculaCodigo ?? \"sem código\"} · {d.identificacao.turma} · {d.identificacao.nivel}</p>", motivo: IDENTIFICA_PARAGRAFO },
  { pagina: "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/remarcacao/page.tsx", categoria: "identifica", trecho: "<p>{d.identificacao.aluno} · Matrícula {d.identificacao.matriculaCodigo ?? \"sem código\"} · {d.identificacao.turma} · {d.identificacao.nivel}</p>", motivo: IDENTIFICA_PARAGRAFO },
  { pagina: "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/substituicao/page.tsx", categoria: "identifica", trecho: "<p>{d.identificacao.aluno} · Matrícula {d.identificacao.matriculaCodigo ?? \"sem código\"} · {d.identificacao.turma} · avaliação {d.identificacao.codigoAvaliacao}.</p>", motivo: IDENTIFICA_PARAGRAFO },
];

/** Telas de detalhe: página de src/app/(app) com segmento dinâmico, fora de /matriculas/[id] (o layout identifica). */
export const ehTelaDeDetalhe = (arquivo: string) => arquivo.startsWith("src/app/(app)/") && arquivo.endsWith("/page.tsx") && /\/\[[^\]]+\]\//.test(arquivo) && !arquivo.startsWith("src/app/(app)/matriculas/[id]/");

/** Sinais da página e dos componentes locais que ela importa (import relativo, um nível). */
export function sinaisDaTela(arquivo: string, ler: (caminho: string) => string | null): SinaisDeIdentificacao & { fontes: string[] } {
  const fonte = ler(arquivo);
  if (fonte === null) throw new Error(`${arquivo}: página não encontrada`);
  const proprio = sinaisDeIdentificacao(fonte, arquivo);
  const saida = { ...proprio, componentes: [...proprio.componentes], h1: [...proprio.h1], elementos: [...proprio.elementos], fontes: [arquivo] };
  for (const local of proprio.locais) {
    const base = posix.normalize(posix.join(posix.dirname(arquivo), local));
    const alvo = [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`].find((c) => ler(c) !== null);
    if (!alvo) continue;
    const s = sinaisDeIdentificacao(ler(alvo)!, alvo);
    saida.componentes.push(...s.componentes); saida.h1.push(...s.h1); saida.elementos.push(...s.elementos); saida.fontes.push(alvo);
    saida.quebrado ||= s.quebrado;
  }
  return saida;
}

const identifica = (s: SinaisDeIdentificacao) => s.componentes.length > 0 || s.h1.some((h) => h.dinamico);

/** Cada tela sem identificação precisa de exatamente uma exceção, ancorada num elemento que existe; a que sobra fica solta. */
export function conferirIdentificacao(telas: { pagina: string; sinais: SinaisDeIdentificacao }[], excecoes: ExcecaoIdentificacao[]): { semIdentificacao: string[]; soltas: string[] } {
  const semIdentificacao: string[] = [], soltas: string[] = [];
  for (const { pagina, sinais } of telas) {
    const minhas = excecoes.filter((e) => e.pagina === pagina);
    if (sinais.quebrado) { semIdentificacao.push(`${pagina}: arquivo não analisa`); continue; }
    if (identifica(sinais)) { for (const e of minhas) soltas.push(`${e.pagina}: a tela já identifica o registro — a exceção sobra`); continue; }
    if (minhas.length !== 1) { semIdentificacao.push(`${pagina}: sem Identificacao* nem <h1> com o registro (${minhas.length} exceções)`); continue; }
    const e = minhas[0]!;
    if (!sinais.elementos.includes(normaliza(e.trecho))) soltas.push(`${pagina}: âncora não encontrada — ${e.trecho.slice(0, 80)}`);
    else if (e.categoria === "identifica" && !/\{[^}]+\}/.test(e.trecho)) soltas.push(`${pagina}: âncora "identifica" sem valor — ${e.trecho.slice(0, 80)}`);
  }
  for (const e of excecoes) if (!telas.some((t) => t.pagina === e.pagina)) soltas.push(`${e.pagina}: não é tela de detalhe`);
  return { semIdentificacao, soltas };
}

// ---------------------------------------------------------------------------------------------------
// Varredura
// ---------------------------------------------------------------------------------------------------
describe("id cru fora da tela (docs/43 §6 item 7)", () => {
  const arquivos = arquivosDeProducao();
  const achados = arquivos.flatMap(({ arquivo, fonte }) => idsCrusNaTela(fonte, arquivo));

  it("a varredura acha os arquivos (não passa vazia por erro de caminho) e inclui src/components", () => {
    expect(arquivos.length).toBeGreaterThan(400);
    expect(arquivos.map((a) => a.arquivo)).toEqual(expect.arrayContaining(["src/components/IdentificacaoRegistro.tsx", "src/app/(app)/matriculas/[id]/desistencia/financeiro/page.tsx"]));
  });

  it("nenhum id cru chega a texto, atributo de texto ou prop de componente — exceções ancoradas", () => {
    expect(conferirExcecoesId(achados, EXCECOES_ID)).toEqual({ semExcecao: [], soltas: [] });
  });

  it("cada exceção tem motivo de verdade", () => {
    for (const e of EXCECOES_ID) expect(e.motivo.trim().length, `${e.arquivo}: ${e.trecho}`).toBeGreaterThan(30);
  });

  it("a lista de exceções é a combinada (cópia literal: acrescentar exceção exige mexer aqui também)", () => {
    expect(EXCECOES_ID.map((e) => `${e.arquivo} :: ${e.tipo} :: ${e.alvo} :: ${e.categoria}${e.vezes ? ` ×${e.vezes}` : ""}`)).toEqual([
      "src/app/(app)/secretaria/CondicoesEncerramento.tsx :: texto :: r.multa.clausulaId :: codigo",
      "src/app/(app)/secretaria/CondicoesEncerramento.tsx :: texto :: acerto.clausulaId :: codigo",
      "src/app/(app)/alunos/[id]/FichaAluno.tsx :: prop :: errosEdicao.paisId :: nao-registro",
      "src/app/(app)/configuracao/paises/page.tsx :: prop :: pp.produtoId :: nao-registro",
      "src/app/(app)/diario/regularizacoes-gravacao/page.tsx :: prop :: p.encontroId :: pendente",
      "src/app/(app)/diario/regularizacoes-gravacao/page.tsx :: prop :: m.reposicaoId :: pendente",
      "src/app/(app)/diario/regularizacoes-gravacao/page.tsx :: prop :: p.publicacaoAulaId :: pendente",
      "src/app/(app)/diario/regularizacoes-gravacao/page.tsx :: prop :: p.materialReposicaoId :: pendente",
      "src/app/(app)/diario/regularizacoes-gravacao/RegularizacoesGravacao.tsx :: texto :: p.arquivoOficialId :: externo",
      "src/app/(app)/diario/regularizacoes-gravacao/RegularizacoesGravacao.tsx :: texto :: p.driveRevisionId :: externo",
      "src/app/(app)/financeiro/acertos-cobertura/page.tsx :: texto :: item.matriculaId :: pendente",
      "src/app/(app)/financeiro/acertos-taxa/page.tsx :: texto :: v.matriculaId :: pendente",
      "src/app/(app)/financeiro/migracao/page.tsx :: texto :: linha.matriculaOrigemId :: externo",
      "src/app/(app)/financeiro/migracao/page.tsx :: texto :: linha.financeiroOrigemId :: externo",
      "src/app/(app)/financeiro/recebimentos/page.tsx :: texto :: r.matriculaId :: pendente",
      "src/app/(app)/financeiro/recebimentos/page.tsx :: texto :: v.cobrancaId :: pendente",
      "src/app/(app)/matriculas/nova/MatriculaFormulario.tsx :: prop :: errosPasso1.alunoPaisId :: nao-registro",
      "src/app/(app)/matriculas/nova/MatriculaFormulario.tsx :: prop :: errosPasso1.tipoDocumentoId :: nao-registro",
      "src/app/(app)/academico/avaliacoes/[alocacaoId]/page.tsx :: texto :: m.avaliacaoId :: codigo",
      "src/app/(app)/academico/grades/nova/page.tsx :: prop :: t.id :: pendente",
      "src/app/(app)/academico/recuperacoes/designadas/page.tsx :: texto :: i.matriculaId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/AcertoEncerramento.tsx :: texto :: c.matriculaId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/AcertoEncerramento.tsx :: texto :: p.cobrancaId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/AcertoEncerramento.tsx :: texto :: a.cobrancaId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/AcertoEncerramento.tsx :: texto :: c.calculo.matriculaId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/AcertoEncerramento.tsx :: opaco :: identificacaoContrato(matriculas.find((m) => m.id === c.matriculaId)?.codigo, c.matriculaId) :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/AcertoEncerramento.tsx :: texto :: p.id :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/AcertoEncerramento.tsx :: texto :: c.condicoes.regras.multa.clausulaId :: codigo",
      "src/app/(app)/alunos/[id]/movimentacoes/CompensacoesEncerramento.tsx :: texto :: comp.cobrancaOrigemId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/CompensacoesEncerramento.tsx :: texto :: comp.documentoOrigemId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/CompensacoesPainel.tsx :: texto :: proposta.id :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/CompensacoesPainel.tsx :: texto :: proposta.cobrancaOrigemId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/CompensacoesPainel.tsx :: texto :: c.id :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/CompensacoesPainel.tsx :: texto :: c.id :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/ComprasHorasPainel.tsx :: texto :: c.cobrancaId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/ComprasHorasPainel.tsx :: texto :: r.encontroId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/ComprasHorasPainel.tsx :: texto :: c.id :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/ComprasHorasPainel.tsx :: texto :: c.id :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/ImpactosAcademicosAcerto.tsx :: texto :: v.turmaId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/LancamentosEncerramento.tsx :: texto :: a.cobrancaId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/LancamentosEncerramento.tsx :: texto :: cr.origemId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/MovimentacoesPainel.tsx :: opaco :: identificacaoContrato(m.codigo, m.id) :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/MovimentacoesPainel.tsx :: opaco :: identificacaoContrato(m.codigo, m.matriculaId) :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/NovaPausa.tsx :: opaco :: identificacaoContrato(m.codigo, m.matriculaId) :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/NovaRetomada.tsx :: opaco :: identificacaoContrato(m.codigo, m.matriculaId) :: pendente ×2",
      "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx :: texto :: c.calculo.matriculaId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx :: texto :: p.cobrancaId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx :: texto :: p.origemFaturamentoHoras.emissaoId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx :: texto :: p.origemFaturamentoHoras.decisaoId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx :: texto :: item.conferenciaId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx :: texto :: recebimento.id :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx :: texto :: uso.creditoId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx :: texto :: uso.decisaoId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/page.tsx :: opaco :: identificacaoContrato(i.matricula.codigo, i.matricula.id) :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/RecomposicaoPainel.tsx :: texto :: p.cobrancaId :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/RecomposicaoPainel.tsx :: texto :: c.id :: pendente ×3",
      "src/app/(app)/configuracao/migracao/[loteId]/AplicarCadastroMigracao.tsx :: texto :: linha.alunoId :: pendente",
      "src/app/(app)/configuracao/migracao/[loteId]/EnsaioVinculoMigracao.tsx :: texto :: produtoOrigemId :: externo",
      "src/app/(app)/configuracao/migracao/[loteId]/EnsaioVinculoMigracao.tsx :: texto :: turmaOrigemId :: externo",
      "src/app/(app)/configuracao/migracao/[loteId]/page.tsx :: texto :: linha.alunoOrigemId :: externo",
      "src/app/(app)/configuracao/migracao/[loteId]/page.tsx :: texto :: linha.turmaOrigemId :: externo",
      "src/app/(app)/configuracao/migracao/[loteId]/page.tsx :: texto :: linha.matriculaOrigemId :: externo",
      "src/app/(app)/configuracao/migracao/[loteId]/page.tsx :: texto :: linha.financeiroOrigemId :: externo",
      "src/app/(app)/configuracao/migracao/[loteId]/page.tsx :: texto :: a.alunoId :: pendente",
      "src/app/(app)/financeiro/migracao/[linhaId]/ConferenciaFinanceiraMigracao.tsx :: texto :: formulario.pagadorId :: pendente",
      "src/app/(app)/financeiro/migracao/[linhaId]/EntradaFinanceiraHistorica.tsx :: texto :: p.pagadorId :: pendente",
      "src/app/(app)/financeiro/migracao/[linhaId]/EntradaFinanceiraHistorica.tsx :: texto :: p.cobrancaId :: pendente",
      "src/app/(app)/matriculas/[id]/condicoes-horas/CondicoesHoras.tsx :: texto :: v.documentoId :: pendente",
      "src/app/(app)/matriculas/[id]/continuidade-mensal/CondicoesContinuidadeMensal.tsx :: texto :: versao.regras.ajusteVencimento.calendario.id :: pendente",
      "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/ConferenciaHoras.tsx :: texto :: e.conferencia.consumoAntecipacao.reservaId :: pendente",
      "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/ConferenciaHoras.tsx :: texto :: e.conferencia.consumoAntecipacao.reserva.compraId :: pendente",
      "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/ConferenciaHoras.tsx :: texto :: previa.reservaAntecipada.reservaId :: pendente",
      "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/ConferenciaHoras.tsx :: texto :: previa.reservaAntecipada.compraId :: pendente",
      "src/app/(app)/configuracao/migracao/presenca/[linhaId]/PresencaHistorica.tsx :: texto :: p.matriculaId :: pendente",
      "src/app/(app)/configuracao/migracao/presenca/[linhaId]/PresencaHistorica.tsx :: texto :: p.registroExistenteId :: pendente",
      "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/RevisoesCorrecaoAula.tsx :: texto :: foto.data.reservaConsumida.id :: pendente",
      "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/RevisoesCorrecaoAula.tsx :: texto :: foto.data.reservaConsumida.consumoId :: pendente",
      "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/RevisoesCorrecaoAula.tsx :: texto :: foto.data.compraAntecipada.id :: pendente",
      "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/RevisoesCorrecaoAula.tsx :: texto :: foto.data.condicoes.documentoId :: pendente",
      "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/remarcacao/page.tsx :: texto :: d.conferencia.reservaId :: pendente",
      "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/substituicao/page.tsx :: prop :: substitutoId :: nao-registro",
    ]);
  });

  it("as telas corrigidas no item 7 não têm exceção nenhuma (lista fechada)", () => {
    const CORRIGIDAS = [
      "src/app/(app)/matriculas/[id]/desistencia/financeiro/page.tsx",
      "src/app/(app)/alunos/[id]/creditos/[creditoId]/page.tsx",
      "src/app/(app)/alunos/[id]/creditos/[creditoId]/PropostaUsoCredito.tsx",
      "src/app/(app)/academico/correcoes/[lancamentoId]/[propostaId]/page.tsx",
      "src/app/(app)/academico/recuperacoes/correcoes/[notaId]/Formularios.tsx",
      "src/app/(app)/diario/reposicoes/[id]/troca-fonte/TrocaFonteReposicao.tsx",
      "src/app/(app)/matriculas/[id]/fechamentos-horas/page.tsx",
      "src/app/(app)/matriculas/[id]/entrada-particular/page.tsx",
      "src/app/(app)/matriculas/[id]/contrato/aditivos/[propostaId]/page.tsx",
      "src/app/(app)/financeiro/acertos-vencimento/[matriculaId]/[propostaId]/page.tsx",
      "src/app/(app)/financeiro/acertos-cobertura/[matriculaId]/[propostaId]/page.tsx",
      "src/app/(app)/financeiro/acertos-taxa/[matriculaId]/[propostaId]/page.tsx",
      "src/app/(app)/academico/avaliacoes/Identificacao.tsx",
      "src/components/IdentificacaoRegistro.tsx",
    ];
    for (const arquivo of CORRIGIDAS) {
      expect(existsSync(arquivo), arquivo).toBe(true);
      expect(achados.filter((a) => a.arquivo === arquivo), arquivo).toEqual([]);
    }
  });

  it("só pendente, externo, código e não-registro (e a pendência só diminui: hoje 66)", () => {
    expect([...new Set(EXCECOES_ID.map((e) => e.categoria))].sort()).toEqual(["codigo", "externo", "nao-registro", "pendente"]);
    expect(EXCECOES_ID.filter((e) => e.categoria === "pendente").reduce((n, e) => n + (e.vezes ?? 1), 0)).toBeLessThanOrEqual(66);
  });
});

describe("identificação do registro nas telas de detalhe fora de /matriculas/[id] (docs/43 §6 item 7)", () => {
  const ler = (caminho: string) => (existsSync(caminho) ? readFileSync(caminho, "utf8") : null);
  const paginas = (readdirSync("src/app", { recursive: true }) as string[]).map((f) => join("src/app", f).split("\\").join("/")).filter(ehTelaDeDetalhe);
  const telas = paginas.map((pagina) => ({ pagina, sinais: sinaisDaTela(pagina, ler) }));

  it("a varredura acha as telas de detalhe e deixa /matriculas/[id] de fora (o layout identifica)", () => {
    expect(paginas.length).toBeGreaterThan(60);
    expect(paginas).toEqual(expect.arrayContaining(["src/app/(app)/alunos/[id]/creditos/[creditoId]/page.tsx", "src/app/(app)/diario/reposicoes/[id]/troca-fonte/page.tsx"]));
    expect(paginas.some((p) => p.startsWith("src/app/(app)/matriculas/[id]/"))).toBe(false);
    // O cabeçalho do layout de /matriculas/[id] é a identificação dessas telas: código, aluno e estado.
    const layout = readFileSync("src/app/(app)/matriculas/[id]/layout.tsx", "utf8");
    expect(layout).toContain('aria-label="Matrícula"');
    expect(layout).toContain("{cabecalho.aluno}");
    expect(layout).toContain('{cabecalho.codigo ?? "Matrícula sem código"}');
  });

  it("toda tela de detalhe identifica o registro (Identificacao* ou <h1> com o registro) — exceções ancoradas", () => {
    expect(conferirIdentificacao(telas, EXCECOES_IDENTIFICACAO)).toEqual({ semIdentificacao: [], soltas: [] });
  });

  it("as telas do item 7 usam o componente de identificação (lista fechada)", () => {
    const COM_COMPONENTE = [
      "src/app/(app)/alunos/[id]/creditos/[creditoId]/page.tsx",
      "src/app/(app)/alunos/[id]/agenda-aditivo/page.tsx",
      "src/app/(app)/diario/reposicoes/[id]/troca-fonte/page.tsx",
      "src/app/(app)/academico/correcoes/[lancamentoId]/[propostaId]/page.tsx",
      "src/app/(app)/financeiro/acertos-vencimento/[matriculaId]/[propostaId]/page.tsx",
      "src/app/(app)/financeiro/acertos-cobertura/[matriculaId]/[propostaId]/page.tsx",
      "src/app/(app)/financeiro/acertos-taxa/[matriculaId]/[propostaId]/page.tsx",
    ];
    for (const pagina of COM_COMPONENTE) {
      const t = telas.find((x) => x.pagina === pagina);
      expect(t, pagina).toBeDefined();
      expect(t!.sinais.componentes.some((c) => c === "IdentificacaoRegistro" || c === "IdentificacaoAvaliacao"), pagina).toBe(true);
    }
  });

  it("cada exceção tem motivo de verdade e a lista é a combinada (cópia literal; a pendência só diminui: hoje 12)", () => {
    for (const e of EXCECOES_IDENTIFICACAO) expect(e.motivo.trim().length, e.pagina).toBeGreaterThan(30);
    expect(EXCECOES_IDENTIFICACAO.filter((e) => e.categoria === "pendente").length).toBeLessThanOrEqual(12);
    expect(EXCECOES_IDENTIFICACAO.map((e) => `${e.pagina} :: ${e.categoria}`)).toEqual([
      "src/app/(app)/academico/equivalencias/[propostaId]/page.tsx :: pendente",
      "src/app/(app)/alunos/[id]/movimentacoes/page.tsx :: pendente",
      "src/app/(app)/configuracao/contratos/[codigo]/page.tsx :: sem-aluno",
      "src/app/(app)/configuracao/migracao/[loteId]/page.tsx :: sem-aluno",
      "src/app/(app)/diario/encontros/[id]/page.tsx :: pendente",
      "src/app/(app)/financeiro/migracao/[linhaId]/page.tsx :: identifica",
      "src/app/(app)/secretaria/reservas/[id]/page.tsx :: pendente",
      "src/app/(app)/academico/admissoes/excecoes/[reservaId]/page.tsx :: identifica",
      "src/app/(app)/academico/avaliacoes/[alocacaoId]/equivalencia/page.tsx :: pendente",
      "src/app/(app)/academico/avaliacoes/[alocacaoId]/extras/page.tsx :: identifica",
      "src/app/(app)/academico/avaliacoes/[alocacaoId]/fechamento/page.tsx :: pendente",
      "src/app/(app)/academico/calendario/[id]/replanejamento/page.tsx :: pendente",
      "src/app/(app)/academico/correcoes/revisoes/[casoId]/page.tsx :: identifica",
      "src/app/(app)/academico/reposicoes/correcoes/[reposicaoId]/page.tsx :: pendente",
      "src/app/(app)/configuracao/migracao/presenca/[linhaId]/page.tsx :: identifica",
      "src/app/(app)/diario/encontros/[id]/cancelamento/page.tsx :: pendente",
      "src/app/(app)/diario/encontros/[id]/gravacao/page.tsx :: pendente",
      "src/app/(app)/diario/encontros/[id]/remarcacao/page.tsx :: pendente",
      "src/app/(app)/secretaria/reservas/particulares/[id]/page.tsx :: pendente",
      "src/app/(app)/academico/regras/turmas/[turmaId]/historica/page.tsx :: sem-aluno",
      "src/app/(app)/academico/segundas-chamadas/propostas/[propostaId]/agenda/page.tsx :: identifica",
      "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/cancelamento/page.tsx :: identifica",
      "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/remarcacao/page.tsx :: identifica",
      "src/app/(app)/academico/segundas-chamadas/reservas/[reservaId]/substituicao/page.tsx :: identifica",
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------
// Autoteste em fonte virtual: cada evasão acusa; as formas certas passam.
// ---------------------------------------------------------------------------------------------------
const ids = (fonte: string) => idsCrusNaTela(fonte).map((a) => `${a.tipo}:${a.alvo}`);

describe("autoteste: id cru", () => {
  it("I1 — direto no texto: `.id`, `*Id`, `ids` e identificador com nome de id", () => {
    expect(ids("<td>{item.cobrancaId}</td>")).toEqual(["texto:item.cobrancaId"]);
    expect(ids("<p>Solicitação {i.id}</p>")).toEqual(["texto:i.id"]);
    expect(ids("<p>{matriculaId}</p>")).toEqual(["texto:matriculaId"]);
    expect(ids("<p>{d.creditoIds}</p>")).toEqual(["texto:d.creditoIds"]);
    expect(ids("<p>{c?.id}</p>")).toEqual(["texto:c?.id"]);
    expect(ids('<p>{c["id"]}</p>')).toEqual(['texto:c["id"]']);
  });

  it("I2 — fallback e operadores: `??`, `||`, ternário, `&&` (lado direito), `+`, template, array", () => {
    expect(ids("<p>{c.codigo ?? c.id}</p>")).toEqual(["texto:c.id"]);
    expect(ids("<p>{c.codigo || c.id}</p>")).toEqual(["texto:c.id"]);
    expect(ids('<p>{ok ? "A" : c.cobrancaId}</p>')).toEqual(["texto:c.cobrancaId"]);
    expect(ids("<p>{mostrar && c.id}</p>")).toEqual(["texto:c.id"]);
    expect(ids('<p>{"Cobrança " + c.id}</p>')).toEqual(["texto:c.id"]);
    expect(ids("<p>{`Cobrança ${c.id}`}</p>")).toEqual(["texto:c.id"]);
    expect(ids('<p>{[c.codigo, " ", c.id]}</p>')).toEqual(["texto:c.id"]);
    expect(ids("<p>{(c.id as string)!}</p>")).toEqual(["texto:c.id"]);
  });

  it("I3 — conversões que não lavam: String(), toString, slice, toUpperCase, split()[0], join, concat", () => {
    expect(ids("<p>{String(c.id)}</p>")).toEqual(["texto:c.id"]);
    expect(ids("<p>{c.id.toString()}</p>")).toEqual(["texto:c.id"]);
    expect(ids("<p>{c.id.slice(0, 8)}</p>")).toEqual(["texto:c.id"]);
    expect(ids("<p>{c.id.toUpperCase()}</p>")).toEqual(["texto:c.id"]);
    expect(ids('<p>{c.id.split("-")[0]}</p>')).toEqual(["texto:c.id"]);
    expect(ids('<p>{[c.codigo, c.id].join(" ")}</p>')).toEqual(["texto:c.id"]);
    expect(ids('<p>{"Ref ".concat(c.id)}</p>')).toEqual(["texto:c.id"]);
  });

  it("I4 — por variável: constante, let com atribuição e desestruturação renomeada", () => {
    expect(ids("const ref = c.id; const x = <p>{ref}</p>;")).toEqual(["texto:c.id"]);
    expect(ids('let ref = ""; ref = c.cobrancaId; const x = <p>{ref}</p>;')).toEqual(["texto:c.cobrancaId"]);
    expect(ids("const { cobrancaId: ref } = item; const x = <p>{ref}</p>;")).toEqual(["texto:ref"]);
    expect(ids("function L({ matriculaId: m }: P) { return <p>{m}</p>; }")).toEqual(["texto:m"]);
    expect(ids("const { id } = c; const x = <p>{id}</p>;")).toEqual(["texto:id"]);
  });

  it("I5 — por lista: .map devolvendo o id e parâmetro de iteração de lista de ids", () => {
    expect(ids('<p>{lista.map(c => c.id).join(", ")}</p>')).toEqual(["texto:c.id"]);
    expect(ids("<p>{lista.map(c => { return c.cobrancaId; })}</p>")).toEqual(["texto:c.cobrancaId"]);
    expect(ids("<ul>{creditoIds.map(x => <li key={x}>{x}</li>)}</ul>")).toEqual(["texto:creditoIds"]);
  });

  it("I6 — por função local: o que ela devolve, com o parâmetro ligado ao argumento (e ao valor padrão)", () => {
    expect(ids("const rotulo = (x: string) => x; const y = <p>{rotulo(c.id)}</p>;")).toEqual(["texto:c.id"]);
    expect(ids('function rotulo(id: string) { const k = lista.find(c => c.id === id); return k ? k.codigo : id; } const y = <p>{rotulo(c.cobrancaId)}</p>;')).toEqual(["texto:id"]);
    expect(ids("const rotulo = (x = item.id) => x; const y = <p>{rotulo()}</p>;")).toEqual(["texto:item.id"]);
  });

  it("I7 — função de fora (importada) recebendo id falha fechado (`opaco`)", () => {
    expect(ids("<p>{identificacaoContrato(m.codigo, m.id)}</p>")).toEqual(["opaco:identificacaoContrato(m.codigo, m.id)"]);
    expect(ids("<p>{encodeURIComponent(c.id)}</p>")).toEqual(["opaco:encodeURIComponent(c.id)"]);
    expect(ids("<p>{new Rotulo(c.id)}</p>")).toEqual(["opaco:new Rotulo(c.id)"]);
    expect(ids("<p>{fmt`ref ${c.id}`}</p>")).toEqual(["opaco:fmt`ref ${c.id}`"]);
  });

  it("I8 — atributos de texto de elemento nativo, children e createElement", () => {
    expect(ids("<button aria-label={`Cobrança ${c.id}`} />")).toEqual(["texto:c.id"]);
    expect(ids("<input placeholder={c.id} />")).toEqual(["texto:c.id"]);
    expect(ids("<img alt={c.id} />")).toEqual(["texto:c.id"]);
    expect(ids("<p children={c.id} />")).toEqual(["texto:c.id"]);
    expect(ids("<Celula children={c.id} />")).toEqual(["texto:c.id"]);
    expect(ids('createElement("p", null, c.id)')).toEqual(["texto:c.id"]);
    expect(ids('createElement("button", { "aria-label": c.id })')).toEqual(["texto:c.id"]);
    expect(ids("<p {...{ children: c.id }} />")).toEqual(["texto:c.id"]);
  });

  it("I9 — prop de componente que leva o id com outro nome (inclusive dentro de objeto)", () => {
    expect(ids("<Condicoes codigo={m.codigo ?? m.id} />")).toEqual(["prop:m.id"]);
    expect(ids("<Identificacao dados={{ registro: [c.cobrancaId] }} />")).toEqual(["prop:c.cobrancaId"]);
    expect(ids("<X {...{ rotulo: c.id }} />")).toEqual(["prop:c.id"]);
    expect(ids('createElement(X, { rotulo: c.id })')).toEqual(["prop:c.id"]);
  });

  it("I10 — arquivo que não analisa falha fechado", () => {
    expect(idsCrusNaTela("const x = <p>{</p>;").map((a) => `${a.tipo}:${a.trecho}`)).toEqual(["opaco:arquivo não analisa"]);
  });

  it("controle: as formas certas passam (id em key/href/value/title, prop de id, rótulo legível, busca por id)", () => {
    expect(ids('<Link key={c.id} href={`/x/${c.id}`} title={c.id}>{c.codigo ?? "sem código"}</Link>')).toEqual([]);
    expect(ids("<option value={c.id}>{c.codigo}</option>")).toEqual([]);
    expect(ids("<Formulario propostaId={p.id} matriculaIds={ids} reprepararHref={`/a/${p.id}`} dados={{ alunoId: a.id, alunoHref: `/alunos/${a.id}` }} />")).toEqual([]);
    expect(ids("<p>{lista.find(c => c.id === p.cobrancaId)?.codigo ?? \"Cobrança fora da lista\"}</p>")).toEqual([]);
    expect(ids("<p>{nomes.get(p.matriculaId) ?? \"aluno\"}</p>")).toEqual([]);
    expect(ids("const r = await consultar({ matriculaId: id }); const x = <p>{r.total}</p>;")).toEqual([]);
    expect(ids("let t = \"\"; t = t + nome; const x = <p>{t}</p>;")).toEqual([]);
    expect(ids("const rotulo = (id: string) => lista.find(c => c.id === id)?.codigo ?? \"sem código\"; const y = <p>{rotulo(c.id)}</p>;")).toEqual([]);
    expect(ids("<p>{formatarMoeda(c.valor, c.moeda)} · {c.codigo}</p>")).toEqual([]);
    expect(ids("<p>{pago} {valid} {idioma.nome}</p>")).toEqual([]);
  });
});

describe("autoteste: identificação", () => {
  const sinais = (fonte: string) => sinaisDeIdentificacao(fonte);
  it("J1 — componente Identificacao* conta, também renomeado no import", () => {
    expect(sinais('import { IdentificacaoRegistro } from "@/components/IdentificacaoRegistro"; const x = <IdentificacaoRegistro rotulo="a" dados={d} />;').componentes).toEqual(["IdentificacaoRegistro"]);
    expect(sinais('import { IdentificacaoRegistro as Quem } from "@/components/IdentificacaoRegistro"; const x = <Quem rotulo="a" dados={d} />;').componentes).toEqual(["IdentificacaoRegistro"]);
    expect(sinais("const x = <Identidade />;").componentes).toEqual([]);
  });

  it("J2 — <h1> dinâmico conta; estático, só com literal ou com id cru não conta", () => {
    expect(sinais("const x = <h1>Créditos · {aluno.nome}</h1>;").h1).toEqual([{ texto: "<h1>Créditos · {aluno.nome}</h1>", dinamico: true }]);
    expect(sinais("const x = <h1>Proposta de utilização de crédito</h1>;").h1[0]!.dinamico).toBe(false);
    expect(sinais('const x = <h1>Proposta {"de crédito"}</h1>;').h1[0]!.dinamico).toBe(false);
    expect(sinais("const x = <h1>Acerto · matrícula {d.matriculaId}</h1>;").h1[0]!.dinamico).toBe(false);
    expect(sinais("const x = <h1>Acerto · {rotulo(d.matriculaId)}</h1>;").h1[0]!.dinamico).toBe(false);
  });

  it("J3 — a tela soma os componentes locais (import relativo); exceção solta, sobrando, sem âncora ou de tela que já identifica", () => {
    const fontes: Record<string, string> = {
      "src/app/(app)/x/[id]/page.tsx": 'import { Painel } from "./Painel"; export default function P() { return <section><h1>Detalhe</h1><Painel /></section>; }',
      "src/app/(app)/x/[id]/Painel.tsx": "export function Painel() { return <p>{d.aluno} · {d.codigo}</p>; }",
      "src/app/(app)/y/[id]/page.tsx": 'import { IdentificacaoRegistro } from "@/components/IdentificacaoRegistro"; export default function P() { return <IdentificacaoRegistro rotulo="r" dados={d} />; }',
    };
    const ler = (c: string) => fontes[c] ?? null;
    const telas = Object.keys(fontes).filter(ehTelaDeDetalhe).map((pagina) => ({ pagina, sinais: sinaisDaTela(pagina, ler) }));
    expect(telas.map((t) => t.pagina)).toEqual(["src/app/(app)/x/[id]/page.tsx", "src/app/(app)/y/[id]/page.tsx"]);
    expect(telas[0]!.sinais.fontes).toEqual(["src/app/(app)/x/[id]/page.tsx", "src/app/(app)/x/[id]/Painel.tsx"]);
    expect(conferirIdentificacao(telas, [])).toEqual({ semIdentificacao: ["src/app/(app)/x/[id]/page.tsx: sem Identificacao* nem <h1> com o registro (0 exceções)"], soltas: [] });
    const ancorada: ExcecaoIdentificacao = { pagina: "src/app/(app)/x/[id]/page.tsx", categoria: "identifica", trecho: "<p>{d.aluno}  ·  {d.codigo}</p>", motivo: "o painel local identifica o aluno e a matrícula" };
    expect(conferirIdentificacao(telas, [ancorada])).toEqual({ semIdentificacao: [], soltas: [] });
    expect(conferirIdentificacao(telas, [{ ...ancorada, trecho: "<p>{d.aluno}</p>" }]).soltas).toEqual(["src/app/(app)/x/[id]/page.tsx: âncora não encontrada — <p>{d.aluno}</p>"]);
    expect(conferirIdentificacao(telas, [{ ...ancorada, trecho: "<h1>Detalhe</h1>" }]).soltas).toEqual(["src/app/(app)/x/[id]/page.tsx: âncora \"identifica\" sem valor — <h1>Detalhe</h1>"]);
    expect(conferirIdentificacao(telas, [ancorada, { ...ancorada, pagina: "src/app/(app)/y/[id]/page.tsx" }]).soltas).toEqual(["src/app/(app)/y/[id]/page.tsx: a tela já identifica o registro — a exceção sobra"]);
    expect(conferirIdentificacao(telas, [ancorada, ancorada]).semIdentificacao).toEqual(["src/app/(app)/x/[id]/page.tsx: sem Identificacao* nem <h1> com o registro (2 exceções)"]);
    expect(conferirIdentificacao(telas, [ancorada, { ...ancorada, pagina: "src/app/(app)/z/page.tsx" }]).soltas).toEqual(["src/app/(app)/z/page.tsx: não é tela de detalhe"]);
  });

  it("J4 — tela de detalhe: (app) com segmento dinâmico, fora de /matriculas/[id]; arquivo que não analisa falha fechado", () => {
    expect(ehTelaDeDetalhe("src/app/(app)/alunos/[id]/creditos/[creditoId]/page.tsx")).toBe(true);
    expect(ehTelaDeDetalhe("src/app/(app)/matriculas/[id]/desistencia/page.tsx")).toBe(false);
    expect(ehTelaDeDetalhe("src/app/(app)/academico/reposicoes/page.tsx")).toBe(false);
    expect(ehTelaDeDetalhe("src/app/portal-aluno/reposicoes/[id]/page.tsx")).toBe(false);
    const quebrada = { pagina: "src/app/(app)/q/[id]/page.tsx", sinais: sinaisDeIdentificacao("const x = <h1>{a.nome</h1>;") };
    expect(conferirIdentificacao([quebrada], []).semIdentificacao).toEqual(["src/app/(app)/q/[id]/page.tsx: arquivo não analisa"]);
  });

  it("conferirExcecoesId: achado sem exceção acusa; exceção sem alvo, com outro trecho ou outra contagem fica solta", () => {
    const achados = idsCrusNaTela("<p>{c.id}</p>", "a.tsx");
    const e: ExcecaoId = { arquivo: "a.tsx", tipo: "texto", trecho: "{c.id}", alvo: "c.id", categoria: "pendente", motivo: "motivo longo o bastante para valer" };
    expect(conferirExcecoesId(achados, [e])).toEqual({ semExcecao: [], soltas: [] });
    expect(conferirExcecoesId(achados, [])).toEqual({ semExcecao: ["a.tsx: [texto] {c.id} — id c.id"], soltas: [] });
    expect(conferirExcecoesId(achados, [{ ...e, trecho: "  {c.id}\n" }]).soltas).toEqual([]);
    expect(conferirExcecoesId(achados, [{ ...e, trecho: "{x.id}" }]).soltas).toEqual(["a.tsx: [texto] {x.id} (c.id)"]);
    expect(conferirExcecoesId(achados, [{ ...e, vezes: 2 }]).soltas).toEqual(["a.tsx: [texto] {c.id} (c.id)"]);
    expect(conferirExcecoesId(achados, [{ ...e, tipo: "opaco" }]).semExcecao).toHaveLength(1);
  });
});

describe("listas fechadas da leitura (cópia literal: mudar a leitura exige mexer aqui)", () => {
  it("nome de id, métodos e funções transparentes, iteradores, atributos de texto, props livres e fábricas", () => {
    for (const nome of ["id", "ids", "cobrancaId", "creditoIds", "matriculaOrigemId"]) expect(NOME_DE_ID.test(nome), nome).toBe(true);
    for (const nome of ["idioma", "pago", "valid", "identificacao", "codigo", "idade"]) expect(NOME_DE_ID.test(nome), nome).toBe(false);
    expect(METODOS_TRANSPARENTES).toEqual(["toString", "toUpperCase", "toLowerCase", "toLocaleUpperCase", "toLocaleLowerCase", "trim", "trimStart", "trimEnd", "slice", "substring", "substr", "padStart", "padEnd", "split", "at", "concat", "join", "replace", "replaceAll", "normalize", "repeat", "valueOf"]);
    expect(FUNCOES_TRANSPARENTES).toEqual(["String"]);
    expect(ITERADORES_DE_VALOR).toEqual(["map", "flatMap"]);
    expect(ITERADORES_DE_ELEMENTO).toEqual(["map", "flatMap", "filter", "find", "findLast", "some", "every", "forEach", "reduce", "sort", "toSorted"]);
    expect(ATRIBUTOS_DE_TEXTO_NATIVO).toEqual(["children", "aria-label", "aria-description", "aria-valuetext", "placeholder", "alt"]);
    expect(PROPS_LIVRES).toEqual(["key", "href", "value", "defaultValue", "name", "htmlFor", "className", "title", "action", "formAction", "type", "target", "rel", "src"]);
    expect(PROP_DE_DESTINO.source).toBe("(?:^h|H)ref$");
    expect(METODOS_DE_BUSCA).toEqual(["get", "has"]);
    expect(FABRICAS_DE_ELEMENTO).toEqual(["createElement", "jsx", "jsxs", "jsxDEV"]);
  });

  it("cada método transparente e cada atributo de texto acusa (a lista é a que a leitura usa)", () => {
    // Map, não objeto literal: `objeto["toString"]` seria o método herdado de Object.prototype.
    const comArgumento = new Map<string, string>([["slice", "0"], ["substring", "0"], ["substr", "0"], ["padStart", "9"], ["padEnd", "9"], ["split", "\"-\""], ["at", "0"], ["concat", "\"x\""], ["join", "\" \""], ["replace", "\"a\", \"b\""], ["replaceAll", "\"a\", \"b\""], ["repeat", "2"]]);
    for (const m of METODOS_TRANSPARENTES) expect(ids(`<p>{c.id.${m}(${comArgumento.get(m) ?? ""})}</p>`), m).toEqual(["texto:c.id"]);
    for (const a of ATRIBUTOS_DE_TEXTO_NATIVO) expect(ids(`<div ${a}={c.id} />`), a).toEqual(["texto:c.id"]);
    for (const p of PROPS_LIVRES) expect(ids(`<X ${p}={c.id} />`), p).toEqual([]);
    for (const f of FABRICAS_DE_ELEMENTO) expect(ids(`${f}("p", null, c.id)`), f).toEqual(["texto:c.id"]);
    for (const m of METODOS_DE_BUSCA) expect(ids(`<p>{mapa.${m}(c.id)}</p>`), m).toEqual([]);
  });
});

// Garante que o caminho de leitura dos componentes locais é o mesmo do disco (posix, como no Next).
it("sinaisDaTela resolve o import local pelo caminho do arquivo (posix)", () => {
  const pagina = "src/app/(app)/diario/reposicoes/[id]/troca-fonte/page.tsx";
  const s = sinaisDaTela(pagina, (c) => (existsSync(c) ? readFileSync(c, "utf8") : null));
  expect(s.fontes).toEqual([pagina, posix.join(dirname(pagina).split("\\").join("/"), "TrocaFonteReposicao.tsx")]);
});
