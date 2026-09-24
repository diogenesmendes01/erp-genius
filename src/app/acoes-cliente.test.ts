import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// E3 (docs/42-auditoria-frontend-ux.md): componente cliente que chama server action precisa tratar
// falha de transporte — senão o botão fica em "Salvando…" para sempre, ou a falha passa calada.
// O caminho padrão é useAcaoCliente/executarAcaoCliente (src/lib/acao-cliente.ts); um `catch` próprio
// também serve. A lista abaixo é o passivo herdado: só pode diminuir. Arquivo novo sem tratamento
// falha; arquivo da lista que passou a tratar também falha, até ser retirado dela.

const PENDENTES = new Set<string>([
  "src/app/(app)/academico/admissoes/excecoes/[reservaId]/FormularioExcecao.tsx",
  "src/app/(app)/academico/avaliacoes/[alocacaoId]/extras/Formularios.tsx",
  "src/app/(app)/academico/avaliacoes/[alocacaoId]/fechamento/ConfirmarFechamento.tsx",
  "src/app/(app)/academico/calendario/[id]/revisoes/[revisaoId]/DecidirReplanejamento.tsx",
  "src/app/(app)/academico/modalidades/[id]/quantidade/propostas/[propostaId]/DecidirQuantidadeAulas.tsx",
  "src/app/(app)/academico/recuperacoes/planos/[propostaId]/prorrogacoes/Formularios.tsx",
  "src/app/(app)/academico/recuperacoes/reservas/[reservaId]/cancelamento/Formularios.tsx",
  "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/agenda/Formulario.tsx",
  "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/Formulario.tsx",
  "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/PreviaSubstituicao.tsx",
  "src/app/(app)/academico/recuperacoes/tentativas/[itemReservaId]/designacao/ProporSubstituicao.tsx",
  "src/app/(app)/alunos/[id]/FichaAluno.tsx",
  "src/app/(app)/alunos/[id]/portal/painel.tsx",
  "src/app/(app)/diario/encontros/[id]/cancelamento/CancelamentoParticular.tsx",
  "src/app/(app)/empresas/EmpresasCliente.tsx",
  "src/app/(app)/financeiro/AcessoAulasPainel.tsx",
  "src/app/(app)/financeiro/InformesPagamento.tsx",
  "src/app/(app)/financeiro/PoliticasComissao.tsx",
  "src/app/(app)/financeiro/RetomadasPainel.tsx",
  "src/app/(app)/home/HomeProfessor.tsx",
  "src/app/(app)/inbox/AtendimentosPainel.tsx",
  "src/app/(app)/leads/LeadFormulario.tsx",
  "src/app/(app)/leads/[id]/FichaLead.tsx",
  "src/app/(app)/matriculas/[id]/contrato/ConferirAssinatura.tsx",
  "src/app/(app)/matriculas/[id]/contrato/PreservarOriginal.tsx",
  "src/app/(app)/matriculas/[id]/contrato/substituicoes/Formularios.tsx",
  "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/RevisoesCorrecaoAula.tsx",
  "src/app/(app)/matriculas/nova/MatriculaFormulario.tsx",
  "src/app/(app)/pipeline/KanbanBoard.tsx",
  "src/components/CopilotoSugestoes.tsx",
]);

const clientesComAction = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") }))
    .filter(({ conteudo }) => /^\s*["']use client["']/.test(conteudo))
    .filter(({ conteudo }) => /^import\s+(?!type\b)[^;]*from\s+["']@\/server\//m.test(conteudo)),
);

/**
 * Só código: strings e comentários saem (numa passada só, para `"https://…"` não virar comentário).
 * `// } catch {` ou `"useAcaoCliente("` num texto não contam como tratamento.
 */
const soCodigo = (fonte: string) =>
  fonte.replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => (m[0] === "/" ? "" : '""'));

/** Sintaxe de verdade: `} catch {`, `} catch (e) {`, `.catch(` — ou a chamada dos helpers do E3. */
const trataFalha = (conteudo: string) =>
  /\}\s*catch\s*[({]|\.catch\(|\buseAcaoCliente\(|\bexecutarAcaoCliente\(/.test(soCodigo(conteudo));

describe("ações no cliente tratam falha de transporte", () => {
  it("nenhum componente novo chama server action sem catch ou useAcaoCliente", () => {
    const novos = clientesComAction.filter(({ arquivo, conteudo }) => !trataFalha(conteudo) && !PENDENTES.has(arquivo)).map((c) => c.arquivo);
    expect(novos).toEqual([]);
  });

  it("a lista de pendentes só diminui: arquivo migrado sai dela", () => {
    const migrados = clientesComAction.filter(({ arquivo, conteudo }) => PENDENTES.has(arquivo) && trataFalha(conteudo)).map((c) => c.arquivo);
    const inexistentes = [...PENDENTES].filter((p) => !clientesComAction.some((c) => c.arquivo === p));
    expect({ migrados, inexistentes }).toEqual({ migrados: [], inexistentes: [] });
  });
});
