import { AcaoOrcamentoIA, Papel, type OrigemChamadaIA } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessaoComPapel, registrarEvento, type Resultado } from "@/server/_shared";
import { modeloPermitido } from "@/server/aria/provedor/custo";
import { chaveConfigurada } from "@/server/aria/provedor";
import { estadoOrcamento } from "@/server/aria/uso";

// Provedor de IA, modelos por tarefa, orçamento e triagem: só ADMINISTRADOR. A chave vive apenas em
// ANTHROPIC_API_KEY; aqui sai só "configurada"/"ausente". O orquestrador e a triagem leem ConfigIA a
// cada turno, então a troca vale no próximo turno.

export interface ConfigIAInput {
  modeloConversa: string;
  modeloClassificacao: string;
  orcamentoMensalUsd: number;
  acaoAoEstourar: AcaoOrcamentoIA;
  triagemAtiva: boolean;
  limiarTriagem: number;
}

// Mesma regra que o provedor aplica antes de chamar a API (#227): MODELOS_PERMITIDOS via modeloPermitido().
const Modelo = z.string().refine(modeloPermitido, "Modelo não permitido. Use Sonnet 5.5 ou Haiku 5.5.");

const Schema = z.object({
  modeloConversa: Modelo,
  modeloClassificacao: Modelo,
  orcamentoMensalUsd: z
    .number()
    .refine((n) => Number.isFinite(n) && n > 0, "O orçamento mensal precisa ser maior que zero.")
    .refine((n) => n <= 99_999_999, "Orçamento acima do máximo."),
  acaoAoEstourar: z.nativeEnum(AcaoOrcamentoIA, { message: "Ação ao estourar inválida." }),
  triagemAtiva: z.boolean(),
  limiarTriagem: z.number().int("O limiar da triagem precisa ser inteiro.").min(50, "O limiar da triagem fica entre 50 e 100.").max(100, "O limiar da triagem fica entre 50 e 100."),
});

const resumo = (c: { modeloConversa: string; modeloClassificacao: string; orcamentoMensalUsd: unknown; acaoAoEstourar: AcaoOrcamentoIA; triagemAtiva: boolean; limiarTriagem: number }) => ({
  modeloConversa: c.modeloConversa,
  modeloClassificacao: c.modeloClassificacao,
  orcamentoMensalUsd: Number(c.orcamentoMensalUsd),
  acaoAoEstourar: c.acaoAoEstourar,
  triagemAtiva: c.triagemAtiva,
  limiarTriagem: c.limiarTriagem,
});

export async function salvarConfigIA(i: ConfigIAInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const parsed = Schema.safeParse(i);
    if (!parsed.success) throw new ErroRegra(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    const d = parsed.data;
    await prisma.$transaction(async (tx) => {
      const antes = await tx.configIA.upsert({ where: { id: "ia" }, create: { id: "ia" }, update: {} });
      // Nada mudou (ex.: reenvio após resultado incerto): sem update nem Evento, como aplicarSlaSetor.
      // O orçamento é comparado já em centavos, como a coluna Decimal(10, 2) guarda.
      const alvo = resumo({ ...d, orcamentoMensalUsd: Math.round(d.orcamentoMensalUsd * 100) / 100 });
      if (JSON.stringify(resumo(antes)) === JSON.stringify(alvo)) return;
      const depois = await tx.configIA.update({ where: { id: "ia" }, data: { ...d, alteradaPorId: autor.id } });
      await registrarEvento(tx, {
        tipo: "ConfigIAAlterada", agregadoTipo: "ConfigIA", agregadoId: "ia", autorId: autor.id,
        payload: { de: resumo(antes), para: resumo(depois) },
      });
    });
    return undefined;
  });
}

export async function painelIA(): Promise<{
  chave: "configurada" | "ausente";
  config: Awaited<ReturnType<typeof prisma.configIA.upsert>>;
  orcamento: Awaited<ReturnType<typeof estadoOrcamento>>;
  chamadas: { quando: string; origem: OrigemChamadaIA; modelo: string; latenciaMs: number; tokens: number; resultado: string }[];
}> {
  await exigirSessaoComPapel(Papel.ADMINISTRADOR);
  const config = await prisma.configIA.upsert({ where: { id: "ia" }, create: { id: "ia" }, update: {} });
  const orcamento = await estadoOrcamento();
  const cs = await prisma.chamadaIA.findMany({ orderBy: { criadoEm: "desc" }, take: 50 });
  return {
    chave: chaveConfigurada() ? "configurada" : "ausente",
    config,
    orcamento,
    chamadas: cs.map((c) => ({
      quando: c.criadoEm.toISOString(), origem: c.origem, modelo: c.modelo, latenciaMs: c.latenciaMs,
      tokens: c.tokensEntrada + c.tokensSaida + c.tokensCache, resultado: c.resultado,
    })),
  };
}
