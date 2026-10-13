import { referenciaDestinoCobranca } from "./elegibilidade";
import { prisma } from "@/lib/prisma";
import { carregarPoliticaRegua } from "@/server/cobrancas/politica";
import { despacharFila, type ResultadoDespacho } from "./despachante";
import { enfileirarIntencaoCobranca, ErroCobrancaAlterada } from "./fila";
import { garantirContato } from "./identidade";
import { carregarCobrancasDaRegua, decidirEnvioCron } from "./alcance-regua";
import { renderizarTemplate, TEXTOS_FABRICA } from "./render";
import type { ModeloWhatsapp } from "@/server/financeiro/schema";

// CRON DA RÉGUA (doc 26 §Camada 1): reusa o MESMO cérebro e a MESMA projeção da fila
// humana (montarReguaPorCobranca + proximaAcao) — nunca recalcula "quem dispara" com
// lógica própria (doc 29 regra 1). Só grava INTENÇÕES; quem envia é o despachante. A regra de quem recebe é
// decidirEnvioCron (alcance-regua.ts), a mesma que conta o alcance na ativação da régua (docs/42 L2517).

export interface ResultadoCron {
  executou: boolean;
  motivoParada: string | null;
  cobrancasAvaliadas: number;
  cobrancasAlteradas: number;
  acoesDevidas: number;
  enfileiradas: number;
  reabertas: number;
  jaExistentes: number;
  semDestino: number;
  degrausNaoAutomaticos: number;
  despacho: ResultadoDespacho | null;
}

const zerado = (motivo: string): ResultadoCron => ({
  executou: false,
  motivoParada: motivo,
  cobrancasAvaliadas: 0,
  cobrancasAlteradas: 0,
  acoesDevidas: 0,
  enfileiradas: 0,
  reabertas: 0,
  jaExistentes: 0,
  semDestino: 0,
  degrausNaoAutomaticos: 0,
  despacho: null,
});

export async function rodarCronRegua(agora: Date = new Date()): Promise<ResultadoCron> {
  const politica = await carregarPoliticaRegua();

  // Toda automação nasce desligada (doc 27): DESLIGADA não gera nem intenção.
  // SHADOW gera intenções que o despachante marcará como SIMULADA (ensaio, S8).
  if (politica.estado === "DESLIGADA") return zerado("politica_desligada");
  if (politica.killSwitch) return zerado("kill_switch");
  if (!politica.numeroRemetenteId) return zerado("sem_numero_remetente");

  const numero = await prisma.numeroWhatsApp.findUnique({ where: { id: politica.numeroRemetenteId } });
  if (!numero || !numero.ativo) return zerado("numero_remetente_inativo");
  // TRAVA S1 (lei): régua automática exige driver oficial — o cron nem enfileira em Baileys.
  if (numero.driver !== "META_CLOUD") return zerado("trava_driver_oficial");

  const { cobrancas, regua } = await carregarCobrancasDaRegua(agora, politica.degraus);

  const templates = await prisma.templateWhatsApp.findMany();
  const templatePorId = new Map(templates.map((t) => [t.id, t]));
  const templatePorNome = new Map(templates.map((t) => [t.nome, t]));

  const r: ResultadoCron = { ...zerado(""), executou: true, motivoParada: null, cobrancasAvaliadas: cobrancas.length };

  for (const cobranca of cobrancas) {
    const calc = regua.get(cobranca.id);
    const decisao = decidirEnvioCron(cobranca, calc, politica.modoPorPasso);
    if (decisao.tipo === "sem_acao" || !calc) continue;
    r.acoesDevidas += 1;

    // D+15 (bloquear) e degrau manual/lote nunca viram intenção automática — aprovação humana sempre (lei).
    if (decisao.tipo === "nao_automatico") {
      r.degrausNaoAutomaticos += 1;
      continue;
    }
    if (decisao.tipo === "sem_destino") {
      r.semDestino += 1; // S2: sem destino → intenção não nasce; item segue na fila humana
      continue;
    }
    const { passo, destino } = decisao;

    // Template do degrau: config da política → por nome (modelo de fábrica) → texto de fábrica.
    const templateId = politica.templateIdPorPasso.get(passo) ?? null;
    const template =
      (templateId ? templatePorId.get(templateId) : undefined) ??
      templatePorNome.get(calc.template ?? "") ??
      null;
    const corpoTemplate = template?.corpo ?? TEXTOS_FABRICA[(calc.template ?? "dados") as ModeloWhatsapp];
    const idioma = template?.idioma ?? cobranca.matricula.aluno.pais?.idioma ?? "es";

    const valorDevido = Number(cobranca.saldo ?? cobranca.valorNegociado);
    const { corpo, variaveis } = renderizarTemplate(corpoTemplate, {
      nome: destino.nome,
      valor: valorDevido > 0 ? valorDevido : Number(cobranca.valorNegociado),
      moeda: cobranca.moeda,
      vencimento: cobranca.vencimento,
      idioma,
    });

    let resultado;
    try {
      resultado = await prisma.$transaction(async (tx) => {
        const contato = await garantirContato(tx, {
          telefoneE164: destino.telefoneE164,
          alunoId: destino.contatoAlunoId,
          responsavelId: destino.responsavelId,
          nomeExibicao: destino.nome,
        });
        return enfileirarIntencaoCobranca(tx, {
          cobrancaId: cobranca.id,
          referenciaCalendario: { versao: cobranca.versao, vencimento: cobranca.vencimento.toISOString(), cicloRegua: cobranca.cicloRegua },
          referenciaDestino: referenciaDestinoCobranca(destino),
          passo,
          numeroId: numero.id,
          contatoId: contato.id,
          origem: "CRON",
          corpoRenderizado: corpo,
          variaveis,
          templateId: template?.id ?? null,
          politicaId: politica.id,
          autorId: null,
        });
      });
    } catch (erro) {
      // Outro pagamento/ajuste/retomada mudou esta cobrança. A próxima rodada
      // recalcula seu degrau e texto; as demais cobranças continuam nesta rodada.
      if (!(erro instanceof ErroCobrancaAlterada)) throw erro;
      r.cobrancasAlteradas += 1;
      continue;
    }
    if (resultado === "criada") r.enfileiradas += 1;
    else if (resultado === "reaberta") r.reabertas += 1;
    else r.jaExistentes += 1;
  }

  r.despacho = await despacharFila(agora);
  return r;
}
