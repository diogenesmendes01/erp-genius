import { expect, it } from "vitest";
import { HABILIDADES, calcularNotasNivel } from "./calculo";
import { avaliarElegibilidadeFechamento } from "./fechamento-elegibilidade";

const contexto = { matriculaId: "matricula-1", nivelId: "nivel-1", regraVersao: "regra-1" };
const fonteHash = "a".repeat(64);
const semPendencias = {
  correcoesRegulares: 0, correcoesRecuperacao: 0, planosAguardandoDecisao: 0, planosSemDisponibilizacao: 0,
  tentativasAguardandoRealizacao: 0, habilidadesSemTentativa: 0, extrasRecuperacaoAguardandoDecisao: 0,
};
const semPendenciasSegundaChamada = {
  propostasAguardandoDecisao: 0, autorizacoesAguardandoAgenda: 0, reservasAguardandoRealizacao: 0,
  ocorrenciasAguardandoEscola: 0, realizacoesSemNotaOficial: 0, extrasAguardandoDecisao: 0,
};

function notas(nota = "8", oficial = true) {
  return calcularNotasNivel({
    ...contexto, escala: { minimo: "0", maximo: "10" }, minimoGeral: "7",
    habilidades: HABILIDADES.map((habilidade) => ({ habilidade, peso: "1", minimo: "6" })),
    avaliacoes: [
      { id: "I1", etapa: "INTERMEDIARIA", peso: "1", notas: [{ habilidade: "FALA", nota, oficial }] },
      { id: "F1", etapa: "FINAL", peso: "3", notas: HABILIDADES.map((habilidade) => ({ habilidade, nota, oficial })) },
    ],
    recuperacoes: [],
  });
}

function entrada(notasCalculadas = notas(), frequencia: boolean | null = true) {
  return {
    notas: notasCalculadas,
    frequencia: { ...contexto, fonteHash, atendeMinimo: frequencia, pendenciasHistoricas: 0, pendenciasChamada: 0 },
    equivalencia: "NAO_NECESSARIA" as const,
    pendenciasOperacionais: semPendencias,
    pendenciasSegundaChamada: semPendenciasSegundaChamada,
  };
}

it("permite fechar e progredir somente quando o cálculo institucional e a frequência real são suficientes", () => {
  expect(avaliarElegibilidadeFechamento(entrada())).toMatchObject({
    situacao: "SUFICIENTE", podeFechar: true, podeProgredir: true,
    pendencias: [], insuficiencias: [], frequencia: { atendeMinimoReal: true, excecaoAplicada: false },
  });
});

it("confirma resultado insuficiente sem liberar progressão quando falha mínimo individual e geral", () => {
  const resultado = avaliarElegibilidadeFechamento(entrada(notas("5")));
  expect(resultado).toMatchObject({ situacao: "INSUFICIENTE", podeFechar: true, podeProgredir: false });
  expect(resultado.insuficiencias).toEqual(expect.arrayContaining(["MINIMO_POR_HABILIDADE", "MINIMO_GERAL"]));
});

it("aplica somente exceção de frequência aprovada por outra pessoa no mesmo snapshot", () => {
  const comExcecao = avaliarElegibilidadeFechamento({
    ...entrada(notas(), false),
    excecaoFrequencia: { ...contexto, fonteHash, aprovada: true, proponenteId: "gestor-1", decisorId: "admin-2" },
  });
  expect(comExcecao).toMatchObject({ situacao: "SUFICIENTE", podeFechar: true, podeProgredir: true, frequencia: { atendeMinimoReal: false, excecaoAplicada: true } });

  const autoaprovada = avaliarElegibilidadeFechamento({
    ...entrada(notas(), false),
    excecaoFrequencia: { ...contexto, fonteHash, aprovada: true, proponenteId: "gestor-1", decisorId: "gestor-1" },
  });
  expect(autoaprovada).toMatchObject({ situacao: "INSUFICIENTE", podeFechar: true, podeProgredir: false, frequencia: { excecaoAplicada: false } });
  expect(autoaprovada.insuficiencias).toContain("FREQUENCIA_MINIMA");
});

it("bloqueia o fechamento por nota não oficial, frequência não apurada, pendências ou equivalência", () => {
  const resultado = avaliarElegibilidadeFechamento({
    ...entrada(notas("8", false), null), equivalencia: "PENDENTE",
    pendenciasOperacionais: { ...semPendencias, correcoesRegulares: 1, tentativasAguardandoRealizacao: 1 },
  });
  expect(resultado).toMatchObject({ situacao: "PENDENTE", podeFechar: false, podeProgredir: false });
  expect(resultado.pendencias).toEqual(expect.arrayContaining([
    "NOTAS_INCOMPLETAS", "FREQUENCIA_NAO_APURADA", "EQUIVALENCIA_PENDENTE", "CORRECAO_PENDENTE", "TENTATIVA_PENDENTE",
  ]));
});

it("bloqueia pendências históricas, de chamada, segunda chamada e oportunidades extras com motivos distintos", () => {
  const base = entrada();
  const resultado = avaliarElegibilidadeFechamento({
    ...base,
    frequencia: { ...base.frequencia, pendenciasHistoricas: 1, pendenciasChamada: 2 },
    pendenciasOperacionais: { ...semPendencias, extrasRecuperacaoAguardandoDecisao: 1 },
    pendenciasSegundaChamada: {
      ...semPendenciasSegundaChamada, autorizacoesAguardandoAgenda: 1, realizacoesSemNotaOficial: 1, extrasAguardandoDecisao: 1,
    },
  });
  expect(resultado).toMatchObject({ situacao: "PENDENTE", podeFechar: false, podeProgredir: false });
  expect(resultado.pendencias).toEqual(expect.arrayContaining([
    "FREQUENCIA_HISTORICA_PENDENTE", "CHAMADA_PENDENTE", "SEGUNDA_CHAMADA_PENDENTE",
    "OPORTUNIDADE_EXTRA_PENDENTE", "EXTRA_SEGUNDA_CHAMADA_PENDENTE",
  ]));
});

it("recusa snapshots contraditórios mesmo quando originados do motor institucional", () => {
  const calculado = notas();
  const habilidadeNula = {
    ...calculado,
    habilidades: calculado.habilidades.map((habilidade, indice) => indice === 0
      ? { ...habilidade, resultado: null, atendeMinimo: null }
      : habilidade),
  };
  expect(() => avaliarElegibilidadeFechamento(entrada(habilidadeNula))).toThrow("completo é contraditório");

  expect(() => avaliarElegibilidadeFechamento(entrada({
    ...calculado,
    atendeRequisitosNotas: false,
  }))).toThrow("não possui mínimo não atendido");

  const comHabilidadeRepetida = {
    ...calculado,
    habilidades: [
      calculado.habilidades[0], { ...calculado.habilidades[0] },
      calculado.habilidades[2], calculado.habilidades[3],
    ],
  };
  expect(() => avaliarElegibilidadeFechamento(entrada(comHabilidadeRepetida))).toThrow("quatro habilidades únicas");
});

it("recusa misturar frequência ou exceção de outro contrato, nível ou regra", () => {
  expect(() => avaliarElegibilidadeFechamento({ ...entrada(), frequencia: { ...contexto, matriculaId: "outra-matricula", fonteHash, atendeMinimo: true, pendenciasHistoricas: 0, pendenciasChamada: 0 } })).toThrow("outro contexto");
  expect(() => avaliarElegibilidadeFechamento({
    ...entrada(notas(), false),
    excecaoFrequencia: { ...contexto, regraVersao: "outra-regra", fonteHash, aprovada: true, proponenteId: "gestor-1", decisorId: "admin-2" },
  })).toThrow("outro contexto");
});
