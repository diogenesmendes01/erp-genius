import { z } from "zod";

export const HABILIDADES = ["FALA", "COMPREENSAO_ORAL", "LEITURA", "ESCRITA"] as const;
type Habilidade = typeof HABILIDADES[number];
// Decimais textuais preservam o valor informado, sem conversão por ponto flutuante.
const decimal = z.string().regex(/^-?\d+(\.\d+)?$/).max(100);
const habilidade = z.enum(HABILIDADES);
const esquema = z.object({
  matriculaId: z.string().min(1),
  nivelId: z.string().min(1),
  regraVersao: z.string().min(1),
  escala: z.object({ minimo: decimal, maximo: decimal }).strict(),
  minimoGeral: decimal,
  habilidades: z.array(z.object({ habilidade, peso: decimal, minimo: decimal }).strict()).length(4),
  avaliacoes: z.array(z.object({
    id: z.string().min(1), etapa: z.enum(["INTERMEDIARIA", "FINAL"]), peso: decimal,
    notas: z.array(z.object({
      habilidade, nota: decimal.nullable(), oficial: z.boolean(),
    }).strict()).min(1).max(4),
  }).strict()).min(1),
  recuperacoes: z.array(z.object({
    id: z.string().min(1), planoAprovadoId: z.string().min(1),
    matriculaId: z.string().min(1), nivelId: z.string().min(1), regraVersao: z.string().min(1),
    ordem: z.number().int().positive().safe(),
    habilidadesDoPlano: z.array(habilidade).min(1).max(4),
    notas: z.array(z.object({ habilidade, nota: decimal.nullable(), oficial: z.boolean() }).strict()).min(1).max(4),
  }).strict()).default([]),
}).strict();

type Fracao = { n: bigint; d: bigint };
function fracao(n: bigint, d = 1n): Fracao {
  let a = n < 0n ? -n : n;
  let b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / (a || 1n), d: d / (a || 1n) };
}
function numero(s: string): Fracao {
  const casas = s.split(".")[1]?.length ?? 0;
  return fracao(BigInt(s.replace(".", "")), 10n ** BigInt(casas));
}
const soma = (a: Fracao, b: Fracao) => fracao(a.n * b.d + b.n * a.d, a.d * b.d);
const produto = (a: Fracao, b: Fracao) => fracao(a.n * b.n, a.d * b.d);
const comparar = (a: Fracao, b: Fracao) => a.n * b.d - b.n * a.d;
const serializar = (a: Fracao) => ({ numerador: String(a.n), denominador: String(a.d) });
function media(itens: { nota: Fracao; peso: Fracao }[]): Fracao {
  const numerador = itens.reduce((s, i) => soma(s, produto(i.nota, i.peso)), fracao(0n));
  const denominador = itens.reduce((s, i) => soma(s, i.peso), fracao(0n));
  return fracao(numerador.n * denominador.d, numerador.d * denominador.n);
}
function unicos(valores: string[]) {
  if (new Set(valores).size !== valores.length) throw new Error("Identificadores duplicados na regra de avaliação.");
}

/** Núcleo interno puro: o chamador deve carregar a versão e as notas do contexto autorizado.
 * Recuperações recebidas devem pertencer a planos aprovados e ser ordenadas pelo
 * histórico persistido. IDs declarados aqui não comprovam autorização.
 * Não oficializa notas, fecha resultado, calcula frequência ou autoriza progressão.
 */
export function calcularNotasNivel(entrada: unknown) {
  const dados = esquema.parse(entrada);
  const minimo = numero(dados.escala.minimo);
  const maximo = numero(dados.escala.maximo);
  if (comparar(minimo, maximo) >= 0n) throw new Error("Escala inválida.");
  const naEscala = (valor: string) => {
    const n = numero(valor);
    if (comparar(n, minimo) < 0n || comparar(n, maximo) > 0n) throw new Error("Nota ou mínimo fora da escala.");
    return n;
  };
  const peso = (valor: string) => {
    const n = numero(valor);
    if (n.n <= 0n) throw new Error("Peso deve ser positivo.");
    return n;
  };
  naEscala(dados.minimoGeral);
  unicos(dados.habilidades.map(h => h.habilidade));
  unicos(dados.avaliacoes.map(a => a.id));
  for (const h of dados.habilidades) { peso(h.peso); naEscala(h.minimo); }
  const finais = new Set<Habilidade>();
  for (const a of dados.avaliacoes) {
    peso(a.peso);
    unicos(a.notas.map(n => n.habilidade));
    for (const n of a.notas) {
      if (n.nota !== null) naEscala(n.nota);
      if (a.etapa === "FINAL") finais.add(n.habilidade);
    }
  }
  if (finais.size !== 4) throw new Error("A etapa final deve cobrir as quatro habilidades.");
  unicos([...dados.avaliacoes.map(a => a.id), ...dados.recuperacoes.map(r => r.id)]);
  unicos(dados.recuperacoes.map(r => String(r.ordem)));
  const recuperacoes = [...dados.recuperacoes].sort((a, b) => a.ordem - b.ordem);
  for (const r of recuperacoes) {
    if (r.matriculaId !== dados.matriculaId || r.nivelId !== dados.nivelId || r.regraVersao !== dados.regraVersao) {
      throw new Error("Recuperação pertence a outro contexto acadêmico.");
    }
    unicos(r.habilidadesDoPlano);
    unicos(r.notas.map(n => n.habilidade));
    for (const n of r.notas) {
      if (!r.habilidadesDoPlano.includes(n.habilidade)) throw new Error("Habilidade fora do plano de recuperação.");
      if (n.nota !== null) naEscala(n.nota);
    }
  }
  const resultados = dados.habilidades.map(h => {
    const memoria = dados.avaliacoes.flatMap(a => a.notas
      .filter(n => n.habilidade === h.habilidade)
      .map(n => ({ avaliacaoId: a.id, etapa: a.etapa, peso: a.peso,
        nota: n.oficial ? n.nota : null,
        pendencia: n.nota === null ? "NOTA_AUSENTE" : !n.oficial ? "AGUARDANDO_OFICIALIZACAO" : null })));
    const pendente = memoria.some(n => n.pendencia !== null);
    const original = pendente ? null : media(memoria.map(n => ({ nota: numero(n.nota!), peso: peso(n.peso) })));
    let valor = original;
    const memoriaRecuperacao = recuperacoes.flatMap(r => {
      const n = r.notas.find(n => n.habilidade === h.habilidade);
      if (!n) return [];
      const antes = valor === null ? null : serializar(valor);
      const motivo = n.nota === null ? "NOTA_AUSENTE" : !n.oficial ? "AGUARDANDO_OFICIALIZACAO"
        : valor === null ? "RESULTADO_ORIGINAL_PENDENTE" : null;
      let melhorou = false;
      if (motivo === null && valor !== null && n.nota !== null) {
        const nova = numero(n.nota);
        if (comparar(nova, valor) > 0n) { valor = nova; melhorou = true; }
      }
      return [{ tentativaId: r.id, planoAprovadoId: r.planoAprovadoId, ordem: r.ordem,
        nota: n.oficial ? n.nota : null, antes, depois: valor === null ? null : serializar(valor),
        melhorou, pendencia: motivo }];
    });
    return { habilidade: h.habilidade, peso: h.peso, minimo: h.minimo, memoria,
      resultadoOriginal: original === null ? null : serializar(original), memoriaRecuperacao, valor,
      atendeMinimo: valor === null ? null : comparar(valor, numero(h.minimo)) >= 0n };
  });
  const completa = resultados.every(r => r.valor !== null);
  const geral = completa ? media(resultados.map(r => ({ nota: r.valor!, peso: peso(r.peso) }))) : null;
  const atendeGeral = geral === null ? null : comparar(geral, numero(dados.minimoGeral)) >= 0n;
  return {
    matriculaId: dados.matriculaId, nivelId: dados.nivelId, regraVersao: dados.regraVersao,
    escala: dados.escala, completa,
    recuperacoesPendentes: resultados.some(r => r.memoriaRecuperacao.some(m => m.pendencia !== null)),
    habilidades: resultados.map(({ valor, ...r }) => ({ ...r, resultado: valor === null ? null : serializar(valor) })),
    geral: geral === null ? null : serializar(geral), minimoGeral: dados.minimoGeral, atendeGeral,
    atendeRequisitosNotas: completa ? atendeGeral && resultados.every(r => r.atendeMinimo) : null,
  };
}
