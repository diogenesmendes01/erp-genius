import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// E5 (docs/42-auditoria-frontend-ux.md): fonte única de rótulos e de moeda na UI.
// - Dinheiro sai por formatarMoeda/formatarValores (src/lib/dinheiro.ts) — nunca "1250.00 CRC" nem
//   um toLocaleString ao lado do código da moeda, nem um campo de dinheiro impresso cru.
// - Arquivo que usa `rotular` não volta a imprimir o enum cru (status, forma, situação…).
// - Rótulo que falta não vira frase de negócio (`?? "… em conferência …"` inventava um estado).
// As listas de exceção são explícitas e CONTADAS (arquivo#expressão → ocorrências permitidas): uma
// impressão crua nova no mesmo arquivo ainda falha. Só podem diminuir.

const PENDENTES_MOEDA = new Set<string>([]);

/** Campos com nome de dinheiro que não são dinheiro cru (já formatados, contagens, texto). */
const NAO_E_DINHEIRO_CRU: Record<string, number> = {
  "src/app/(app)/financeiro/FilaCobranca.tsx#d.valor": 1, // indicador já formatado pelo painel
  "src/app/(app)/secretaria/CondicoesEncerramento.tsx#acerto.valor": 1, // texto montado por descreverAcerto
  "src/app/(app)/configuracao/catalogo/ProdutosPainel.tsx#p._count.precos": 1, // contagem de preços
  "src/app/(app)/diario/reposicoes/ReposicoesEquipe.tsx#previa.saldo": 1, // saldo de reposições (quantidade)
  "src/app/(app)/academico/segundas-chamadas/[alocacaoId]/[codigoAvaliacao]/page.tsx#estado.saldo": 1, // tentativas
  "src/app/(app)/matriculas/[id]/contrato/TextoPrevia.tsx#c.valor": 1, // valor de campo do contrato (texto)
  "src/app/(app)/alunos/[id]/movimentacoes/OutrasCobrancasResumo.tsx#uso.creditoId": 1, // identificador
};

/** Enums crus em arquivos que já usam `rotular`: ainda sem mapa de rótulo (E5b) ou fora de texto. */
const ENUM_SEM_MAPA: Record<string, number> = {
  "src/app/(app)/financeiro/FinanceiroPainel.tsx#c.status": 1, // key da linha, não texto
  "src/app/(app)/financeiro/acertos-taxa/ImpactosTaxaOperacao.tsx#conjunto.status": 1, // situação da proposta (E5b)
  "src/app/(app)/financeiro/acertos-taxa/ImpactosTaxaOperacao.tsx#a.status": 1, // situação do acerto (E5b)
  "src/app/(app)/financeiro/acertos-taxa/[matriculaId]/[propostaId]/page.tsx#p.status": 1, // situação da proposta (E5b)
  "src/app/(app)/financeiro/migracao/[linhaId]/ConferenciaFinanceiraMigracao.tsx#dados.linha.mapa.status": 1, // situação da linha (E5b)
  "src/app/(app)/financeiro/migracao/[linhaId]/ConferenciaFinanceiraMigracao.tsx#proposta.status": 1, // situação da proposta (E5b)
  "src/app/(app)/financeiro/migracao/[linhaId]/EntradaFinanceiraHistorica.tsx#p.status": 1, // situação da proposta (E5b)
  "src/app/(app)/secretaria/SecretariaPainel.tsx#c.status": 1, // situação da correção cadastral (E5b)
  "src/app/(app)/inbox/InboxCliente.tsx#d.status": 1, // fallback de status de envio fora de NOTA_POR_STATUS
  "src/app/(app)/alunos/[id]/movimentacoes/AcertoEncerramento.tsx#a.tipo": 1, // tipo do ajuste anterior (E5b)
  "src/app/(app)/financeiro/migracao/[linhaId]/ConferenciaFinanceiraMigracao.tsx#pagador.tipo": 1, // tipo de pagador (E5b)
  "src/app/(app)/matriculas/[id]/nova-reserva/Formulario.tsx#revisao.pagador.tipo": 1, // tipo de pagador (E5b)
  "src/app/(app)/financeiro/acertos-taxa/[matriculaId]/[propostaId]/page.tsx#c.tipo": 1, // tipo de comissão (E5b)
  "src/app/(app)/matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/RevisoesCorrecaoAula.tsx#d.tipo": 1, // tipo de destinação (E5b)
};

const telas = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

const VALOR = String.raw`[\w.?!\[\]()]*\b(?:valor|saldo|total|preco|montante|diferenca|delta|credito|debito|estorno|multa)\w*[\w.?!()]*(?:\s*\?\?\s*(?:"[^"]*"|'[^']*'|\w+))?`;
const MOEDA = String.raw`[\w.?!]*\bmoeda\b[\w.?!]*`;
/** Até 3 caracteres fora de chaves entre os dois: " ", ": ", " · ". */
const SEP = String.raw`[^{}\n]{0,3}`;
/** Valor e código da moeda lado a lado, em JSX ({v} {m}) ou em template (${v} ${m}), nas duas ordens. */
const DINHEIRO_CRU = new RegExp(
  [
    String.raw`\{\s*${VALOR}\s*\}${SEP}\{\s*${MOEDA}\s*\}`,
    String.raw`\{\s*${MOEDA}\s*\}${SEP}\{\s*${VALOR}\s*\}`,
    String.raw`\$\{\s*${VALOR}\s*\}${SEP}\$\{\s*${MOEDA}\s*\}`,
    String.raw`\$\{\s*${MOEDA}\s*\}${SEP}\$\{\s*${VALOR}\s*\}`,
    String.raw`\{\s*${MOEDA}\s*\}${SEP}\{[^{}\n]*toLocaleString\(`,
    String.raw`\$\{\s*${MOEDA}\s*\}${SEP}\$\{[^{}\n]*toLocaleString\(`,
  ].join("|"),
);
/** Campo de dinheiro de um objeto impresso direto ({x.valor}, ${x.saldoDevido}), sem formatarMoeda. */
const DINHEIRO_SEM_FORMATO = new RegExp(
  String.raw`(?<![=\w])(?:\{|\$\{)\s*([\w?!\[\]]+(?:\??\.[\w\[\]]+)*\??\.(?:valor|saldo|preco|montante|multa|credito|debito|estorno|totalServico|totalPago|totalDevido)\w*)\s*(?:\?\?\s*(?:"[^"]*"|'[^']*'|\w+)\s*)?\}`,
  "g",
);
/** Campo de enum de um objeto impresso direto ({x.status}, ${x.forma}). */
const ENUM_CRU = new RegExp(
  String.raw`(?<![=\w(,])(?:\{|\$\{)\s*([\w?!\[\]]+(?:\??\.[\w\[\]]+)*\??\.(?:status|forma|situacao|etapa|temperatura|segmento|statusMatricula|tipo))\s*\}`,
  "g",
);
const INVENTA_ESTADO = /(?:\?\?|\|\|)\s*["'`][^"'`\n]*em conferência/i;
/** Valor ausente formatado como zero: `formatarMoeda(x ?? 0, …)` mostra "₡ 0" onde não há registro. */
const ZERO_FALSO = /formatarMoeda\([^,()]*\?\?\s*0(?:\.0+)?\s*,/;

const linhasCom = (conteudo: string, re: RegExp) =>
  conteudo.split("\n").map((l, i) => (re.test(l) ? i + 1 : 0)).filter(Boolean);

/** Ocorrências por arquivo#expressão, comparadas com as permitidas. */
function excedentes(re: RegExp, permitidas: Record<string, number>, filtro: (t: { conteudo: string }) => boolean = () => true) {
  const contagem = new Map<string, { n: number; linhas: number[] }>();
  for (const t of telas.filter(filtro)) {
    t.conteudo.split("\n").forEach((l, i) => {
      for (const m of l.matchAll(re)) {
        const chave = `${t.arquivo}#${m[1]}`;
        const atual = contagem.get(chave) ?? { n: 0, linhas: [] };
        contagem.set(chave, { n: atual.n + 1, linhas: [...atual.linhas, i + 1] });
      }
    });
  }
  const ofensores = [...contagem].filter(([chave, { n }]) => n > (permitidas[chave] ?? 0)).map(([chave, { linhas }]) => `${chave} (linhas ${linhas.join(",")})`);
  const sobrando = Object.keys(permitidas).filter((chave) => (contagem.get(chave)?.n ?? 0) < permitidas[chave]);
  return { ofensores, sobrando };
}

describe("rótulos e moeda de domínio", () => {
  it("dinheiro passa por formatarMoeda — nenhum arquivo imprime valor cru ao lado da moeda", () => {
    const novos = telas
      .filter(({ arquivo, conteudo }) => !PENDENTES_MOEDA.has(arquivo) && linhasCom(conteudo, DINHEIRO_CRU).length)
      .map(({ arquivo, conteudo }) => `${arquivo}:${linhasCom(conteudo, DINHEIRO_CRU).join(",")}`);
    expect(novos).toEqual([]);
  });

  it("a lista de pendentes de moeda só diminui: arquivo migrado sai dela", () => {
    const migrados = [...PENDENTES_MOEDA].filter((p) => !telas.some((t) => t.arquivo === p && linhasCom(t.conteudo, DINHEIRO_CRU).length));
    expect(migrados).toEqual([]);
  });

  it("campo de dinheiro não é impresso cru, nem sem o código da moeda ao lado (exceções contadas)", () => {
    const { ofensores, sobrando } = excedentes(DINHEIRO_SEM_FORMATO, NAO_E_DINHEIRO_CRU);
    expect(ofensores).toEqual([]);
    expect(sobrando).toEqual([]); // exceção que não existe mais sai da lista
  });

  it("arquivo que importa os rótulos (@/lib/labels) não imprime enum cru (exceções contadas, sem mapa ainda)", () => {
    // Pelo import, não pelo uso de `rotular`: desfazer a única chamada não pode tirar o arquivo da trava.
    const { ofensores, sobrando } = excedentes(ENUM_CRU, ENUM_SEM_MAPA, ({ conteudo }) => conteudo.includes('from "@/lib/labels"'));
    expect(ofensores).toEqual([]);
    expect(sobrando).toEqual([]);
  });

  it("valor ausente não vira zero monetário (formatarMoeda(x ?? 0, …))", () => {
    const ofensores = telas.flatMap(({ arquivo, conteudo }) => linhasCom(conteudo, ZERO_FALSO).map((l) => `${arquivo}:${l}`));
    expect(ofensores).toEqual([]);
    expect(ZERO_FALSO.test("formatarMoeda(c.saldo ?? 0, c.moeda)")).toBe(true);
    expect(ZERO_FALSO.test("c.saldo != null ? formatarMoeda(c.saldo, c.moeda) : \"—\"")).toBe(false);
  });

  it("rótulo ausente não vira estado inventado (`?? \"… em conferência …\"`, também com || e outras aspas)", () => {
    const ofensores = telas.flatMap(({ arquivo, conteudo }) => linhasCom(conteudo, INVENTA_ESTADO).map((l) => `${arquivo}:${l}`));
    expect(ofensores).toEqual([]);
  });

  it("os detectores reconhecem as formas conhecidas (e não acusam formatarMoeda/rotular)", () => {
    for (const cru of [
      "<td>{c.valor} {c.moeda}</td>", "`${p.saldo} ${p.moeda}`", "{moeda} {valorTotal.toLocaleString(\"pt-BR\")}",
      "<p>{f.moeda} {f.valorTotal}</p>", "{r.moeda}: {r.valor}", "{r.moeda} · {r.valor}",
      "{c.plano.multa?.valorProposto ?? \"conferir\"} {c.plano.moeda}", "{cr.valor} {c.lancamentos!.plano!.moeda}",
    ]) expect(DINHEIRO_CRU.test(cru), cru).toBe(true);
    for (const certo of ["{formatarMoeda(c.valor, c.moeda)}", "`${formatarMoeda(p.saldo, p.moeda)}`", "<span>{c.moeda}</span>"]) {
      expect(DINHEIRO_CRU.test(certo), certo).toBe(false);
    }
    const semFormato = (s: string) => [...s.matchAll(DINHEIRO_SEM_FORMATO)].map((m) => m[1]);
    expect(semFormato("Serviço: {c.totalServico}")).toEqual(["c.totalServico"]);
    expect(semFormato("Valor proposto: {p.valorCredito}.")).toEqual(["p.valorCredito"]);
    expect(semFormato("`${acerto.valor} fixo`")).toEqual(["acerto.valor"]);
    expect(semFormato('recebido {p.valorRecebido ?? "não registrado"}')).toEqual(["p.valorRecebido"]);
    expect(semFormato("{formatarMoeda(p.valorCredito, m)} value={x.valor}")).toEqual([]);
    const enumCru = (s: string) => [...s.matchAll(ENUM_CRU)].map((m) => m[1]);
    expect(enumCru("<p>{relato.situacao} em …</p> {r.forma} `Cobrança ${c.status}`")).toEqual(["relato.situacao", "r.forma", "c.status"]);
    expect(enumCru("{rotular(STATUS_COBRANCA_LABEL, c.status)} {STATUS_COMISSAO_LABEL[c.status]}")).toEqual([]);
    for (const inventa of [
      'rotulo ?? "Habilidade em conferência"', "habilidades[v] || \"Habilidade em conferência\"",
      "?? 'Habilidade em conferência'", "|| `Pendência em conferência`",
    ]) expect(INVENTA_ESTADO.test(inventa), inventa).toBe(true);
  });
});
