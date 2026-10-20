import { prisma } from "@/lib/prisma";
import { confirmarTransacao } from "@/lib/transacao-confirmada";
import { cicloDoEventoCobranca, registrarEventoCobrancaEnviada } from "@/server/cobrancas/eventos";
import { carregarPoliticaRegua, type PoliticaCarregada } from "@/server/cobrancas/politica";
import type { PassoRegua } from "@/server/cobrancas/regua";
import { randomUUID } from "node:crypto";
import { driverAceitaAutomacao, ErroDriver, type CanalWhatsApp, type ConteudoEspecial, type EnvioMidia, type NumeroCanal, type OpcoesEnvio } from "./canal";
import { driverMotor } from "./drivers/motor";
import { lerMidiaParaEnvio } from "./midia";
import { snapshotCobranca } from "./elegibilidade";
import { atendimentoVisivel } from "./atendimentos";
import { DriverWhatsApp, Papel, type EstadoPolitica } from "@prisma/client";
import { destinatarioAtualDoAtendimento } from "./destinatario-atual";
import { suspensaoPorConferencia } from "@/server/cobrancas/conferencia";
import { claimAvisoAgendaTx, motivoAvisoAgendaInvalido, registrarResultadoAvisoAgendaTx } from "@/server/comunicacoes-agenda/whatsapp";
import { envioAvisosAgendaHabilitado, MOTIVO_ENVIO_AGENDA_DESLIGADO } from "@/server/comunicacoes-agenda/envio-gate";
import { aplicarResposta } from "./status-atendimento";
import { aoGravarSaidaHumana, MOTIVO_ARIA_PAUSADA } from "@/server/aria/pausa";
import { comContatoIndividual } from "./grupos";
import { dataCivilInstitucional, inicioDoDiaInstitucional, inicioDoDiaSeguinteInstitucional } from "@/server/operacao/fuso";
import { candidatosDaGrade } from "@/server/agenda/grade";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { dentroDaJanelaEnvio, type JanelaEnvio } from "./janela-envio";
import { abrirAtendimentoDaAgendada, autorAindaPodeEnviarAgendada, esperaAtendimento } from "@/server/crm/mensagens-agendadas";

// DESPACHANTE ÚNICO (doc 26 §fila única · doc 30 §contratos): drena a outbox aplicando os
// guard-rails UMA vez para os dois motores, na ordem da spec. Cada decisão deixa motivo
// auditável na intenção. É o ÚNICO arquivo que importa drivers (doc 29 §fronteiras).
//
// SEGURANÇA DE AMBIENTE (gap A5 do doc 28): sem WHATSAPP_LIVE=1 no env, NENHUMA mensagem
// real sai — tudo que passaria vira SIMULADA. Dev contra o banco compartilhado não dispara.

// Só o motor próprio envia. Número com outro driver (legado) falha com driver_indisponivel no passo 10,
// antes do claim; `driverDoNumero` é a defesa tipada (ErroDriver driver_sem_implementacao, sem I/O e
// nunca `resultado_incerto`) caso um driver sem registro chegue ao envio.
const DRIVERS: Partial<Record<DriverWhatsApp, CanalWhatsApp>> = {
  MOTOR: driverMotor,
};

/** Driver registrado para o número; sem registro, falha tipada antes de qualquer envio. */
export function driverDoNumero(driver: DriverWhatsApp): CanalWhatsApp {
  const canal = DRIVERS[driver];
  if (!canal) throw new ErroDriver("driver_sem_implementacao", `Driver ${driver} sem implementação no despachante.`);
  return canal;
}

export interface ResultadoDespacho {
  avaliadas: number;
  despachadas: number;
  simuladas: number;
  canceladas: number;
  adiadas: number;
  falhas: number;
  pendentes: number; // deixadas na fila (kill switch / política desligada)
  /** Avisos de agenda retidos com COMUNICACOES_AGENDA_ENVIO_ENABLED desligado (R1 do #209, C2):
   *  contados à parte para não se misturarem ao kill switch em `pendentes`. */
  retidasAgenda: number;
}

// A janela (S3) é a de janela-envio.ts: a mesma regra decide o passo 8, o retorno após o teto e a recusa do
// agendamento fora do horário (D12). Reexportada para quem a importava daqui.
export type { JanelaEnvio };

/**
 * Quando a mensagem barrada pelo teto diário volta (C3 da revisão do #247): no primeiro instante permitido, o
 * maior entre `inicioAmanhaEscola` e a abertura da janela do contato. Sem isso ela voltava à 00h da escola e era
 * adiada de hora em hora até a janela abrir. A abertura é a primeira hora existente da janela num dia permitido
 * (o horário de verão pode pular a hora cheia). Sem janela possível em uma semana, ou com fuso inválido no
 * cadastro, fica no início do dia seguinte da escola, e o passo da janela segue adiando como antes.
 */
export function retornoAposTeto(inicioAmanhaEscola: Date, janela: JanelaEnvio, fuso: string): Date {
  try {
    if (dentroDaJanelaEnvio(inicioAmanhaEscola, fuso, janela)) return inicioAmanhaEscola;
    const primeiroDia = Date.parse(`${dataCivilInstitucional(inicioAmanhaEscola, fuso)}T00:00:00Z`);
    for (let dias = 0; dias <= 7; dias++) {
      const data = new Date(primeiroDia + dias * 86_400_000).toISOString().slice(0, 10);
      for (let hora = Math.max(0, janela.janelaInicio); hora < Math.min(24, janela.janelaFim); hora++) {
        const [abertura] = candidatosDaGrade(data, `${String(hora).padStart(2, "0")}:00`, fuso);
        if (!abertura) continue; // hora pulada pelo horário de verão
        if (abertura >= inicioAmanhaEscola && dentroDaJanelaEnvio(abertura, fuso, janela)) return abertura;
        break; // a janela deste dia já passou (ou o dia não é permitido): tenta o próximo
      }
    }
  } catch {
    // fuso inválido no cadastro: mesmo critério de `dentroDaJanelaEnvio`, não trava a fila
  }
  return inicioAmanhaEscola;
}

export interface EntradaShadow {
  /** WHATSAPP_LIVE=1 no ambiente. */
  live: boolean;
  /** Intenção de aviso de alteração de agenda (avisoAlteracaoAgendaId preenchido). */
  agenda: boolean;
  /** origem !== HUMANO (CRON, LOTE, GESTAO). */
  automatica: boolean;
  reativa: boolean;
  /** origem === GESTAO (legado do CRM antigo, sem produtor: nunca envia). */
  gestao: boolean;
  /** Estado da política de cobrança que rege a intenção. */
  politicaEstado: EstadoPolitica;
  /** origem === IA (resposta, handoff ou encaminhamento da Aria). */
  ia: boolean;
  /** Estado da própria Aria (AgenteIA.estado): o ensaio dela. */
  ariaEstado: EstadoPolitica;
}

/**
 * SHADOW (S8): decide se a intenção vira SIMULADA em vez de chamar o driver. Função pura
 * para ter trava unitária no CI (revisão R1 do #208, C1): a isenção `!agenda` já caiu uma
 * vez num merge (#161) sem nenhum teste unitário perceber.
 *
 * - Sem WHATSAPP_LIVE tudo é simulado, inclusive origem HUMANO.
 * - Gestão e a saudação reativa do CRM antigo (sem produtor desde a remoção do CRM antigo, sem
 *   configuração) só simulam; a gestão já é cancelada antes, em `motivoIntencaoInvalida`.
 * - Origem IA (reativa) olha só o estado da Aria: em SHADOW a intenção já nasce SIMULADA na
 *   origem, e uma PENDENTE só sai com a Aria ATIVA no momento do despacho.
 * - O resto da automação (cobrança, lote) olha o estado da sua política.
 * - Aviso de agenda NÃO usa o ensaio da política de cobrança: o gate dele é
 *   COMUNICACOES_AGENDA_ENVIO_ENABLED (conferido antes do shadow, em `decidirEnvio`) mais
 *   número e template AGENDA (`motivoAvisoAgendaInvalido`).
 */
export function intencaoEmShadow(e: EntradaShadow): boolean {
  return (
    !e.live ||
    e.gestao ||
    (!e.agenda && e.automatica && !e.reativa && e.politicaEstado !== "ATIVA") ||
    (e.ia ? e.ariaEstado !== "ATIVA" : e.reativa)
  );
}

export type DecisaoEnvio = "RETER_AGENDA" | "SIMULAR" | "ENVIAR";

/**
 * Última decisão antes do driver (revisão R1 do #208, C2). O cron geral do WhatsApp drena a
 * MESMA fila que o worker de agenda (`despacharFila` sem `somenteAvisosAgenda`), então o
 * despachante confere COMUNICACOES_AGENDA_ENVIO_ENABLED por conta própria: com o envio de
 * agenda desligado, a intenção de aviso fica no mesmo status (PENDENTE/ADIADA), como no kill
 * switch — não é enviada, nem vira SIMULADA, e volta a ser avaliada quando o envio for
 * religado. Vale também sem WHATSAPP_LIVE: o aviso retido não é "ensaiado". O motivo
 * `envio_agenda_desligado` fica gravado na intenção e o resultado conta em `retidasAgenda`.
 */
export function decidirEnvio(e: EntradaShadow & { envioAgendaHabilitado: boolean }): DecisaoEnvio {
  if (e.agenda && !e.envioAgendaHabilitado) return "RETER_AGENDA";
  return intencaoEmShadow(e) ? "SIMULAR" : "ENVIAR";
}

/** Prazo do claim: intenção ENVIANDO além disto = worker morreu no meio do envio. */
const CLAIM_STALE_MS = 15 * 60_000;

export interface OpcoesDespacho {
  /** Limita o dreno a UMA intenção (review PR #53 P2): o webhook despacha só a saudação
   *  reativa recém-criada, nunca a fila global de cobrança/lotes a partir de um inbound. */
  intencaoId?: string;
  /** Cron de agenda nunca pode drenar cobrança/comercial por acidente. */
  somenteAvisosAgenda?: boolean;
}

export async function despacharFila(
  agora: Date = new Date(),
  opts: OpcoesDespacho = {},
): Promise<ResultadoDespacho> {
  const politicaPadrao = await carregarPoliticaRegua();
  // Shadow PRÓPRIO da Aria (origem IA): o estado do agente, não o da política de cobrança.
  const ariaEstado = (await prisma.agenteIA.findUnique({ where: { id: "aria" }, select: { estado: true } }))?.estado ?? "DESLIGADA";
  const live = process.env.WHATSAPP_LIVE === "1";
  // Q176 (#164): o teto por contato/dia (passo 7) conta no dia civil da escola, não no relógio do servidor (UTC).
  const fusoEscola = await fusoDaEscola();
  const inicioDiaEscola = inicioDoDiaInstitucional(agora, fusoEscola);
  // A mensagem barrada pelo teto volta quando o dia da escola vira (1º instante válido do dia seguinte), ou
  // depois, na abertura da janela do contato (`retornoAposTeto`).
  const inicioAmanhaEscola = inicioDoDiaSeguinteInstitucional(agora, fusoEscola);

  // RECUPERAÇÃO (review PR #49): claim órfão (worker caiu entre o claim e a confirmação)
  // vira FALHOU com motivo — o item volta à fila humana; nunca re-tenta sozinho, porque o
  // driver PODE ter enviado antes da queda (só o humano decide se repete). A recuperação é
  // global (do cron); um despacho escopado (webhook) não a executa — é trabalho do tick.
  if (!opts.intencaoId) {
    await prisma.intencaoMensagem.updateMany({
      where: { status: "ENVIANDO", despacharAposEm: { lt: agora } },
      data: { status: "FALHOU", motivoFalha: "envio_interrompido" },
    });
  }

  const intencoes = await prisma.intencaoMensagem.findMany({
    where: {
      ...(opts.intencaoId ? { id: opts.intencaoId } : {}),
      ...(opts.somenteAvisosAgenda ? { avisoAlteracaoAgendaId: { not: null } } : {}),
      OR: [
        // Mensagem agendada pelo atendente (Tarefas): só entra na fila a partir de `agendadaPara`.
        { status: "PENDENTE", OR: [{ agendadaPara: null }, { agendadaPara: { lte: agora } }] },
        { status: "ADIADA", despacharAposEm: { lte: agora }, OR: [{ agendadaPara: null }, { agendadaPara: { lte: agora } }] },
        // Conferência pode terminar antes do prazo: revalidar a cada execução.
        { status: "ADIADA", motivoFalha: "comprovante_em_conferencia" },
      ],
    },
    orderBy: { criadaEm: "asc" },
    include: {
      numero: true,
      contato: true,
      template: true,
      politica: true,
      // Fuso do destino quando a intenção tem lead e não tem cobrança (S3).
      lead: { include: { pais: true } },
      cobranca: { include: { matricula: { include: { pais: true, aluno: { include: { pais: true } } } } } },
      avisoAlteracaoAgenda: true,
    },
  });

  const r: ResultadoDespacho = {
    avaliadas: intencoes.length,
    despachadas: 0,
    simuladas: 0,
    canceladas: 0,
    adiadas: 0,
    falhas: 0,
    pendentes: 0,
    retidasAgenda: 0,
  };

  for (const it of intencoes) {
    const invalida = await motivoIntencaoInvalida(it);
    if (invalida) {
      await marcar(it.id, "CANCELADA", invalida);
      r.canceladas += 1;
      continue;
    }
    const conferirAte = it.cobrancaId ? await suspensaoPorConferencia(it.cobrancaId, agora) : null;
    if (conferirAte) {
      if (await adiar(it.id, conferirAte, "comprovante_em_conferencia")) r.adiadas += 1;
      else r.canceladas += 1;
      continue;
    }
    // Config de guard-rails: cobrança usa a sua política; o kill switch é sempre o global (da cobrança).
    const agenda = it.avisoAlteracaoAgendaId != null;
    const politica: PoliticaCarregada = it.politica ? { ...politicaPadrao, ...configDe(it.politica) } : politicaPadrao;
    const automatica = it.origem !== "HUMANO"; // guard-rails de automação valem p/ CRON e LOTE
    // Classe REATIVA (doc 27 · gap C20): saudação/resposta automática a um inbound. É isenta
    // dos guard-rails de HORÁRIO (janela/teto/silêncio) e da trava S1 — a janela de 24h está
    // aberta (o contato acabou de falar), então até o oficial aceita texto livre. Continua
    // sujeita a opt-out, conversa-viva (um inbound MAIS novo a cancela), shadow (WHATSAPP_LIVE)
    // e ao KILL SWITCH (freio de emergência de TODA automação — review PR #53 P1).
    const reativa = it.reativa;
    // A cadência comercial e a gestão do CRM antigo (passoComercial, origem GESTAO) não têm mais produtor:
    // `motivoIntencaoInvalida` cancela as que sobraram na fila antes de chegar aqui.

    // 1. Kill switch: freio de emergência — congela TODA automação, reativa inclusive
    //    (nada é perdido nem cancelado). Só origem HUMANO passa: resposta na inbox/fila é
    //    decisão humana explícita, não automação (S13, E3).
    if (!agenda && politica.killSwitch && automatica) {
      r.pendentes += 1;
      continue;
    }

    // 2. Trava de driver (S1 revogada para MOTOR, D38): disparo do CRON exige driver que aceite
    //    automação: hoje só MOTOR (META_CLOUD não tem driver em DRIVERS — R1 do #213, C1);
    //    BAILEYS legado nunca recebe automação desassistida.
    //    Reativa é isenta (D34).
    if (it.origem === "CRON" && !reativa && !driverAceitaAutomacao(it.numero.driver)) {
      await marcar(it.id, "CANCELADA", "trava_driver_oficial");
      r.canceladas += 1;
      continue;
    }

    // 3. Opt-out: LEI — sempre respeitado. Item de cobrança segue vivo na fila humana
    //    (o cobrador usa o wa.me manual — doc 26: item vira manual-only).
    if (it.contato.optOutEm) {
      await marcar(it.id, "CANCELADA", "opt_out");
      r.canceladas += 1;
      continue;
    }

    // 3b. VALIDADE (B3, doc 32): intenção com prazo vencido é CANCELADA, nunca enviada —
    //     inclusive as ADIADAS por janela/silêncio/kill switch. É o que impede o lembrete
    //     "-2h" de sair DEPOIS da aula e o degrau "+30min" de sair no dia seguinte.
    if (it.validaAte && agora > it.validaAte) {
      await marcar(it.id, "CANCELADA", "validade_expirada");
      r.canceladas += 1;
      continue;
    }

    const transporte = await prisma.conversaWhatsApp.findUnique({
      where: { numeroId_contatoId: { numeroId: it.numeroId, contatoId: it.contatoId } },
      select: { id: true, ultimoInboundEm: true, inboundTratadoEm: true },
    });
    const estadoAtendimento = it.atendimentoId ? await prisma.atendimentoWhatsApp.findUnique({
      where: { id: it.atendimentoId }, select: { ultimoInboundEm: true, inboundTratadoEm: true },
    }) : null;
    const conversa = transporte ? { ...transporte,
      ultimoInboundEm: estadoAtendimento?.ultimoInboundEm ?? transporte.ultimoInboundEm,
      inboundTratadoEm: estadoAtendimento?.inboundTratadoEm ?? transporte.inboundTratadoEm,
    } : null;

    // 4. LEI DO DESPACHANTE: automação nunca fala por cima de conversa viva — inbound do
    //    contato posterior à criação da intenção cancela a intenção automática.
    if (automatica && conversa?.ultimoInboundEm && conversa.ultimoInboundEm > it.criadaEm) {
      await marcar(it.id, "CANCELADA", "conversa_viva");
      r.canceladas += 1;
      continue;
    }

    // 5. Silêncio pós-inbound (S4): inbound recente (mesmo anterior à intenção) suspende o
    //    CRON até o humano TRATAR (promessa/pagamento/"retomar régua" marcam
    //    inboundTratadoEm — E3) ou a janela de silêncio expirar.
    const inboundSilenciador = conversa?.ultimoInboundEm ?? null;
    const inboundNaoTratado =
      !!inboundSilenciador &&
      (!conversa?.inboundTratadoEm || conversa.inboundTratadoEm < inboundSilenciador);
    if (it.origem === "CRON" && !reativa && inboundSilenciador && inboundNaoTratado) {
      const limite = new Date(inboundSilenciador.getTime() + politica.silencioPosInboundHoras * 3600_000);
      if (agora < limite) {
        if (await adiar(it.id, limite, "silencio_pos_inbound")) r.adiadas += 1;
        else r.canceladas += 1;
        continue;
      }
    }

    // 6. Idempotência dupla (além do @@unique): o degrau pode ter sido cumprido MANUALMENTE
    //    depois que a intenção nasceu — re-checa o evento antes de enviar.
    if (it.cobrancaId && it.passo) {
      const enviosDoPasso = await prisma.evento.findMany({
        where: {
          agregadoTipo: "Cobranca",
          agregadoId: it.cobrancaId,
          tipo: "CobrancaEnviadaWhatsApp",
          payload: { path: ["passo"], equals: it.passo },
        },
        select: { payload: true },
      });
      if (enviosDoPasso.some((e) => cicloDoEventoCobranca(e.payload) === it.cicloCobranca)) {
        await marcar(it.id, "CANCELADA", "degrau_ja_cumprido");
        r.canceladas += 1;
        continue;
      }
    }

    // 7. Teto por contato/dia (S5): soma mensagens AUTOMÁTICAS de hoje; suprimida = ADIADA,
    //    nunca descartada em silêncio (doc 27 §regra de ouro). Reativa não conta no teto —
    //    e a saudação é persistida como CRON, então a contagem precisa EXCLUIR pela intenção
    //    reativa que a originou (review PR #55 P2): sem isso, a própria saudação comia o teto
    //    e o 1º follow-up da cadência não saía no mesmo dia.
    if (!agenda && automatica && !reativa) {
      const enviadasHoje = await prisma.mensagemWhatsApp.count({
        where: {
          conversa: { contatoId: it.contatoId },
          direcao: "SAIDA",
          origem: { in: ["CRON", "LOTE"] },
          criadoEm: { gte: inicioDiaEscola },
          NOT: { intencao: { is: { reativa: true } } },
        },
      });
      if (enviadasHoje >= politica.tetoPorContatoDia) {
        // Volta direto no 1º instante permitido: início do dia seguinte da escola ou abertura da janela do contato
        // (o passo 8 vale para toda mensagem que chega aqui).
        if (await adiar(it.id, retornoAposTeto(inicioAmanhaEscola, politica, fusoDoDestino(it)), "teto_contato_dia")) r.adiadas += 1;
        else r.canceladas += 1;
        continue;
      }
    }

    // 8. Janela de horário + dias da semana (S3), no FUSO DO CONTATO (Aluno.fuso ?? Pais.fuso).
    //    Reativa é isenta: uma saudação "em segundos" não pode esperar o horário comercial.
    if (automatica && !reativa) {
      // Mesma regra que recusa o agendamento fora do horário (janela-envio.ts, D12).
      if (!dentroDaJanelaEnvio(agora, fusoDoDestino(it), politica)) {
        if (await adiar(it.id, new Date(agora.getTime() + 3600_000), "fora_da_janela")) r.adiadas += 1;
        else r.canceladas += 1; // re-checa a cada hora
        continue;
      }
    }

    // 9. SHADOW (S8): política em ensaio ou ambiente sem WHATSAPP_LIVE=1 → registra o que
    //    TERIA sido enviado, sem chamar driver. Vale para TODA automação (CRON e LOTE —
    //    review PR #51 P1-3: lote aprovado durante o ensaio não pode disparar de verdade);
    //    origem HUMANO (resposta na inbox/fila) é decisão humana e envia mesmo em ensaio.
    //    SIMULADA não é terminal: a fila reabre quando o canal sair do ensaio (review PR #49).
    // SHADOW (S8): ensaio da automação. Cobrança olha o estado da SUA política; a Aria, o estado
    // dela (`intencaoEmShadow`). Ambiente sem WHATSAPP_LIVE simula tudo. SHADOW registra o que TERIA sido enviado, sem chamar driver.
    // Aviso de agenda com COMUNICACOES_AGENDA_ENVIO_ENABLED desligado fica retido (C2 do #208).
    const decisao = decidirEnvio({
      live, agenda, automatica, reativa, gestao: it.origem === "GESTAO",
      politicaEstado: politica.estado,
      ia: it.origem === "IA", ariaEstado,
      envioAgendaHabilitado: envioAvisosAgendaHabilitado(),
    });
    if (decisao === "RETER_AGENDA") {
      await reterAvisoAgenda(it.id);
      r.retidasAgenda += 1;
      continue;
    }
    if (decisao === "SIMULAR") {
      await prisma.intencaoMensagem.updateMany({
        where: { id: it.id, status: it.status }, // não clobbera claim concorrente
        data: { status: "SIMULADA", despachadaEm: agora, motivoFalha: live ? null : "ambiente_sem_live" },
      });
      r.simuladas += 1;
      continue;
    }

    // 10. Número sem driver implementado (legado META_CLOUD/BAILEYS) falha sem qualquer I/O.
    if (!DRIVERS[it.numero.driver]) {
      await marcar(it.id, "FALHOU", "driver_indisponivel");
      r.falhas += 1;
      continue;
    }

    // 11. CLAIM ATÔMICO (review PR #49): só quem mover a intenção para ENVIANDO chama o
    //     driver — cron, lote e clique rodando em paralelo nunca enviam a mesma intenção
    //     duas vezes. `despacharAposEm` vira o prazo do claim (stale = recuperação acima).
    let claimCount = 0;
    const clientMessageId = it.clientMessageId ?? randomUUID(); // mantido entre tentativas
    try {
      await prisma.$transaction(confirmarTransacao(async (tx) => {
        const claim = await tx.intencaoMensagem.updateMany({
          where: { id: it.id, status: it.status },
          data: { status: "ENVIANDO", despacharAposEm: new Date(agora.getTime() + CLAIM_STALE_MS), clientMessageId },
        });
        if (claim.count !== 1) return;
        if (it.avisoAlteracaoAgendaId && !await claimAvisoAgendaTx(tx, it.avisoAlteracaoAgendaId)) {
          await tx.intencaoMensagem.update({ where: { id: it.id }, data: { status: it.status, despacharAposEm: it.despacharAposEm } });
          return;
        }
        // D12 (#202 C3): a mensagem agendada pelo CRM só abre o atendimento agora, no envio. Sem acesso do
        // autor ou com o destinatário divergente, a transação inteira é desfeita (nem claim nem atendimento) e a
        // intenção é cancelada abaixo com o motivo.
        if (esperaAtendimento(it)) {
          const autor = it.autorId ? await tx.usuario.findUnique({ where: { id: it.autorId }, select: { id: true, nome: true, papeis: true, ativo: true } }) : null;
          if (!autor?.ativo) throw new AgendadaSemAcesso("atendimento_sem_acesso");
          const aberto = await abrirAtendimentoDaAgendada(tx, autor, it.id, it);
          if ("recusa" in aberto) throw new AgendadaSemAcesso(aberto.recusa);
        }
        claimCount = 1;
      }));
    } catch (erro) {
      if (erro instanceof AgendadaSemAcesso) {
        await marcar(it.id, "CANCELADA", erro.message);
        r.canceladas += 1;
        continue;
      }
      if (!erroGuardaPedagogica(erro)) throw erro;
      await marcar(it.id, "CANCELADA", "autorizacao_academica_revogada");
      r.canceladas += 1;
      continue;
    }
    if (claimCount === 0) continue; // outro worker levou — não conta em nada

    // A autorização do momento do enfileiramento não vale para sempre. Releitura após
    // o claim evita despachar com autor revogado, destinatário alterado ou saldo antigo.
    const atual = await prisma.intencaoMensagem.findUnique({
      where: { id: it.id }, include: { numero: true, contato: true, avisoAlteracaoAgenda: true },
    });
    const invalidaAgora = atual ? await motivoIntencaoInvalida(atual) : "intencao_ausente";
    const conferirAgora = atual?.cobrancaId ? await suspensaoPorConferencia(atual.cobrancaId, agora) : null;
    if (!invalidaAgora && conferirAgora) {
      if (await adiarClaim(it.id, conferirAgora)) r.adiadas += 1;
      else r.canceladas += 1;
      continue;
    }
    if (invalidaAgora || !atual) {
      await prisma.intencaoMensagem.updateMany({ where: { id: it.id, status: "ENVIANDO" },
        data: { status: "CANCELADA", motivoFalha: invalidaAgora, despacharAposEm: null } });
      if (it.avisoAlteracaoAgendaId) await prisma.$transaction(confirmarTransacao((tx) => registrarResultadoAvisoAgendaTx(tx, it.avisoAlteracaoAgendaId!, "FALHOU")));
      r.canceladas += 1;
      continue;
    }

    // 12. Envio real + gravação em transação (mensagem + evento de domínio + intenção).
    // Relido após o claim: a agendada do CRM ganha o atendimento só no claim (D12).
    const atendimentoId = atual.atendimentoId;
    try {
      const numeroCanal: NumeroCanal = {
        id: it.numero.id,
        telefoneE164: it.numero.telefoneE164,
        driver: it.numero.driver,
        providerRef: it.numero.providerRef,
      };
      const driver = driverDoNumero(it.numero.driver);
      const opcoesEnvio: OpcoesEnvio = { clientMessageId, origem: it.origem };
      let envio;
      if (it.conteudo) {
        // Conteúdo especial (enquete, figurinha, GIF, localização, contato): só drivers que o suportam.
        if (!driver.enviarConteudo) throw new ErroDriver("conteudo_nao_suportado");
        const conteudo = it.conteudo as unknown as ConteudoEspecial;
        let midiaConteudo: EnvioMidia | null = null;
        if (conteudo.tipo === "FIGURINHA" || conteudo.tipo === "GIF") {
          if (!it.midiaPath) throw new ErroDriver("midia_ausente");
          const lida = await lerMidiaParaEnvio(it.midiaPath);
          midiaConteudo = { tipo: it.tipo === "FIGURINHA" ? "IMAGEM" : "VIDEO", mime: lida.mime, nomeArquivo: lida.nomeArquivo, dadosBase64: lida.dadosBase64, legenda: null };
        }
        envio = await driver.enviarConteudo(numeroCanal, it.contato.telefoneE164, conteudo, midiaConteudo, opcoesEnvio);
      } else if ((it.tipo === "IMAGEM" || it.tipo === "AUDIO" || it.tipo === "VIDEO" || it.tipo === "DOCUMENTO") && it.midiaPath) {
        // Mídia da inbox (E3): lê do storage privado e entrega ao driver do número.
        const midia = await lerMidiaParaEnvio(it.midiaPath);
        envio = await driver.enviarMidia(numeroCanal, it.contato.telefoneE164, {
          tipo: it.tipo,
          mime: midia.mime,
          nomeArquivo: midia.nomeArquivo,
          dadosBase64: midia.dadosBase64,
          legenda: it.corpoRenderizado || null,
        }, opcoesEnvio);
      } else if (it.template) {
        envio = await driver.enviarTemplate(numeroCanal, it.contato.telefoneE164, {
          nome: it.template.nome,
          idioma: it.template.idioma,
          variaveis: (it.variaveis as string[] | null) ?? [],
          corpoRenderizado: it.corpoRenderizado,
        }, opcoesEnvio);
      } else {
        envio = await driver.enviarTexto(numeroCanal, it.contato.telefoneE164, it.corpoRenderizado, opcoesEnvio);
      }

      await prisma.$transaction(confirmarTransacao(async (tx) => {
        const conv =
          conversa ??
          (await tx.conversaWhatsApp.upsert({
            // A agendada pode ter aberto a conversa no claim (D12): upsert, não create.
            where: { numeroId_contatoId: { numeroId: it.numeroId, contatoId: it.contatoId } },
            create: { numeroId: it.numeroId, contatoId: it.contatoId }, update: {},
            select: { id: true, ultimoInboundEm: true },
          }));
        const msg = await tx.mensagemWhatsApp.create({
          data: {
            conversaId: conv.id,
            atendimentoId,
            numeroId: it.numeroId,
            direcao: "SAIDA",
            tipo: it.tipo,
            corpo: it.corpoRenderizado || null,
            midiaPath: it.midiaPath,
            status: "ENVIADA",
            statusEm: agora,
            enviadaEm: agora,
            driver: "MOTOR",
            origem: it.origem,
            clientMessageId,
            providerMessageId: envio.providerMessageId,
            mensagemIdMotor: envio.mensagemIdMotor ?? null,
            autorId: it.autorId,
            templateId: it.templateId,
          },
        });
        await tx.conversaWhatsApp.update({ where: { id: conv.id }, data: { ultimaMensagemEm: agora } });
        if (atendimentoId) {
          await tx.atendimentoWhatsApp.update({ where: { id: atendimentoId }, data: { ultimaMensagemEm: agora } });
          if (it.origem === "HUMANO") await aplicarResposta(tx, atendimentoId, agora);
          await aoGravarSaidaHumana(tx, { atendimentoId, origem: it.origem, autorId: it.autorId });
        }
        if (it.cobrancaId && it.passo) {
          await registrarEventoCobrancaEnviada(tx, {
            cobrancaId: it.cobrancaId,
            modelo: it.template?.nome ?? "texto",
            passo: it.passo as PassoRegua,
            cicloRegua: it.cicloCobranca,
            canal: "api",
            autorId: it.autorId, // humano que aprovou (LOTE/HUMANO) ou null (CRON)
          });
        }
        await tx.intencaoMensagem.update({
          where: { id: it.id },
          data: {
            status: "DESPACHADA",
            despachadaEm: agora,
            despacharAposEm: null,
            mensagemId: msg.id,
            motivoFalha: null,
          },
        });
        if (it.avisoAlteracaoAgendaId) await registrarResultadoAvisoAgendaTx(tx, it.avisoAlteracaoAgendaId, "ENVIADO", envio.providerMessageId);
      }));
      r.despachadas += 1;
    } catch (e) {
      // Uma resposta perdida, timeout ou falha de persistência pode ocorrer DEPOIS de
      // o provedor receber a mensagem. Toda falha pós-claim exige revisão humana, salvo
      // falha que o driver declarou reprocessável (nada saiu): adia com o mesmo
      // clientMessageId, dentro do limite de vida da intenção. Aviso de agenda não adia.
      const limite = it.origem === "HUMANO" ? LIMITE_REPROCESSO_MS.HUMANO : LIMITE_REPROCESSO_MS.AUTOMACAO;
      if (e instanceof ErroDriver && e.reprocessavel && !it.avisoAlteracaoAgendaId
        && agora.getTime() - it.criadaEm.getTime() <= limite) {
        await adiarReprocessavel(it.id, new Date(agora.getTime() + e.adiarMs), e.motivo);
        r.adiadas += 1;
        continue;
      }
      const motivo = e instanceof ErroDriver ? e.motivo : "resultado_incerto";
      await falharClaim(it.id, motivo);
      // A falha pode ter ocorrido após a Meta aceitar a requisição. O aviso já
      // recebeu claim INCERTO antes do I/O e não é reaberto automaticamente.
      r.falhas += 1;
    }
  }

  return r;
}

/** Vida máxima (desde criadaEm) para reenviar automaticamente uma falha reprocessável. */
export const LIMITE_REPROCESSO_MS = { HUMANO: 30 * 60_000, AUTOMACAO: 24 * 3_600_000 } as const;

/** Desfaz o claim da agendada que não pode abrir o atendimento (D12); a mensagem é o motivo do cancelamento. */
class AgendadaSemAcesso extends Error {}

type IntencaoParaValidar = {
  id: string; numeroId: string; contatoId: string; origem: string; autorId: string | null;
  atendimentoId: string | null; cobrancaId: string | null; referenciaCobranca: string | null; cicloCobranca: number;
  templateId: string | null; corpoRenderizado: string; variaveis: unknown;
  leadId: string | null; passoComercial: string | null;
  avisoAlteracaoAgendaId: string | null;
  acaoAgenteIAId: string | null;
  conteudo?: unknown;
  criadaEm: Date;
  agendadaPara: Date | null;
  numero: { ativo: boolean }; contato: { optOutEm: Date | null; telefoneE164: string };
};

/**
 * Defesa em profundidade da pausa (a pausa já cancela as intenções da Aria na mesma transação):
 * a fala da Aria não sai com a Aria pausada no atendimento (salvo a pausa do próprio handoff,
 * cuja mensagem precisa sair) nem se uma pessoa falou, ou enfileirou fala, depois dela.
 */
async function pessoaAssumiuDepois(atendimentoId: string, criadaEm: Date): Promise<boolean> {
  const a = await prisma.atendimentoWhatsApp.findUnique({ where: { id: atendimentoId }, select: { iaPausadaEm: true, iaPausaMotivo: true } });
  if (a?.iaPausadaEm && a.iaPausaMotivo !== "HANDOFF") return true;
  const [saidas, filas] = await Promise.all([
    prisma.mensagemWhatsApp.count({ where: { atendimentoId, direcao: "SAIDA", origem: { in: ["HUMANO", "CELULAR"] }, criadoEm: { gt: criadaEm } } }),
    prisma.intencaoMensagem.count({ where: { atendimentoId, origem: "HUMANO", criadaEm: { gt: criadaEm }, status: { notIn: ["CANCELADA", "FALHOU"] } } }),
  ]);
  return saidas + filas > 0;
}

async function motivoIntencaoInvalida(it: IntencaoParaValidar): Promise<string | null> {
  if (!it.numero.ativo) return "numero_remetente_inativo";
  if (it.contato.optOutEm) return "opt_out";
  // A Aria (IA) não manda figurinha nem GIF; vale antes do ensaio (SHADOW), que não pode simular o que é proibido.
  const tipoConteudo = (it.conteudo as { tipo?: string } | null | undefined)?.tipo;
  if (it.origem === "IA" && (tipoConteudo === "FIGURINHA" || tipoConteudo === "GIF")) return "ia_conteudo_nao_permitido";
  const motivoAgenda = await motivoAvisoAgendaInvalido(it);
  if (motivoAgenda) return motivoAgenda;
  // Gestão (C5) e cadência comercial do CRM antigo: a configuração e a política foram removidas e nada mais as
  // enfileira. Uma intenção que tenha sobrado na fila é cancelada com o mesmo motivo de quando a configuração mudava.
  if (it.origem === "GESTAO") return "configuracao_gestao_alterada";
  if (it.passoComercial) return "politica_comercial_alterada";
  if (it.origem === "IA") {
    // A Aria não tem usuário autor: a intenção vale só ligada à ação da Aria e a um atendimento.
    if (it.autorId || !it.atendimentoId || !it.acaoAgenteIAId || it.cobrancaId || it.passoComercial || it.avisoAlteracaoAgendaId) return "contexto_ia_invalido";
    if (await pessoaAssumiuDepois(it.atendimentoId, it.criadaEm)) return MOTIVO_ARIA_PAUSADA;
  } else if (it.origem !== "CRON") {
    const autor = it.autorId ? await prisma.usuario.findUnique({ where: { id: it.autorId }, select: { id: true, nome: true, papeis: true, ativo: true } }) : null;
    if (!autor?.ativo) return "autor_sem_acesso";
    if (it.cobrancaId && !autor.papeis.some((p) => [Papel.ADMINISTRADOR, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA].includes(p as "ADMINISTRADOR" | "FINANCEIRO" | "SECRETARIA_ACADEMICA"))) return "autor_sem_acesso";
    if (!it.atendimentoId) {
      // Agendada pelo CRM: o atendimento nasce no claim (D12); até lá vale o acesso que o agendamento exigiu.
      if (!esperaAtendimento(it) || !await autorAindaPodeEnviarAgendada(autor, it)) return "atendimento_sem_acesso";
    } else if (!await atendimentoVisivel(autor, it.atendimentoId, true)) return "atendimento_sem_acesso";
  }
  let matriculaAtendimento: string | null = null;
  let finalidadeAtendimento: string | null = null;
  if (it.atendimentoId) {
    const a = await prisma.atendimentoWhatsApp.findUnique({ where: { id: it.atendimentoId }, include: { conversa: { include: { contato: true } } } });
    if (!a || a.encerradoEm || a.conversa.numeroId !== it.numeroId || a.conversa.contatoId !== it.contatoId) return "atendimento_alterado";
    matriculaAtendimento = a.matriculaId;
    finalidadeAtendimento = a.finalidade;
    // Aviso de agenda revalida sua identidade congelada (aluno ou responsável)
    // no helper próprio; a regra genérica prefere responsável quando existe um.
    if (!it.avisoAlteracaoAgendaId && !await destinatarioAtualDoAtendimento(comContatoIndividual(a))) return "destinatario_alterado";
  }
  if (it.cobrancaId) {
    const snapshot = await snapshotCobranca(it.cobrancaId);
    if (!snapshot) return "cobranca_encerrada";
    if (finalidadeAtendimento !== "FINANCEIRO" || !matriculaAtendimento || matriculaAtendimento !== snapshot.c.matriculaId) return "contrato_atendimento_divergente";
    if (snapshot.c.cicloRegua !== it.cicloCobranca) return "ciclo_cobranca_alterado";
    if (!["PENDENTE", "ATRASADO"].includes(snapshot.c.status) || snapshot.saldo.lte(0)) return "cobranca_encerrada";
    if (!snapshot.destino || snapshot.destino.telefoneE164 !== it.contato.telefoneE164) return "destinatario_alterado";
    if (!it.referenciaCobranca || snapshot.assinatura !== it.referenciaCobranca) return "cobranca_alterada_revisar";
  }
  return null;
}

function configDe(p: {
  killSwitch: boolean;
  estado: PoliticaCarregada["estado"];
  janelaInicio: number;
  janelaFim: number;
  diasSemana: number[];
  tetoPorContatoDia: number;
  silencioPosInboundHoras: number;
}): Partial<PoliticaCarregada> {
  return {
    killSwitch: p.killSwitch,
    estado: p.estado,
    janelaInicio: p.janelaInicio,
    janelaFim: p.janelaFim,
    diasSemana: p.diasSemana,
    tetoPorContatoDia: p.tetoPorContatoDia,
    silencioPosInboundHoras: p.silencioPosInboundHoras,
  };
}

type IntencaoComDestino = {
  cobranca: {
    matricula: { pais: { fuso: string } | null; aluno: { fuso: string | null; pais: { fuso: string } | null } };
  } | null;
  /** Caminho COMERCIAL: `cobranca` é null, o destino é o lead (review PR #55 P1). */
  lead: { pais: { fuso: string } | null } | null;
};

function fusoDoDestino(it: IntencaoComDestino): string {
  const aluno = it.cobranca?.matricula.aluno;
  return (
    aluno?.fuso ??
    aluno?.pais?.fuso ??
    it.cobranca?.matricula.pais?.fuso ??
    it.lead?.pais?.fuso ?? // intenção com lead e sem cobrança: janela no fuso LOCAL do lead
    "America/Sao_Paulo"
  );
}

// Marks dos guard-rails só transitam de estados "na fila" — nunca clobberam um claim
// ENVIANDO de outro worker nem estados terminais (review PR #49).
/**
 * Aviso de agenda retido com o envio de agenda desligado (R1 do #209, C2): grava só o motivo,
 * sem mudar o status (PENDENTE/ADIADA) nem o `despacharAposEm`, para a fila operacional mostrar
 * por que o aviso não sai. Só escreve quando o motivo ainda não é este: o cron reavalia a
 * intenção a cada tick e não precisa reescrevê-la (nem tocar `atualizadoEm`) toda vez.
 */
async function reterAvisoAgenda(id: string): Promise<void> {
  await prisma.intencaoMensagem.updateMany({
    where: {
      id,
      status: { in: ["PENDENTE", "ADIADA"] },
      OR: [{ motivoFalha: null }, { motivoFalha: { not: MOTIVO_ENVIO_AGENDA_DESLIGADO } }],
    },
    data: { motivoFalha: MOTIVO_ENVIO_AGENDA_DESLIGADO },
  });
}

async function marcar(id: string, status: "CANCELADA" | "FALHOU", motivo: string): Promise<void> {
  await prisma.intencaoMensagem.updateMany({
    where: { id, status: { in: ["PENDENTE", "ADIADA"] } },
    data: { status, motivoFalha: motivo },
  });
}

function erroGuardaPedagogica(erro: unknown): boolean {
  return erro instanceof Error && /Inten..o pedag.gica|Atendimento pedag.gico/i.test(erro.message);
}

/** Retorna falso quando a revalidação SQL cancelou o novo envio sem I/O. */
async function adiar(id: string, ate: Date, motivo: string): Promise<boolean> {
  try {
    await prisma.intencaoMensagem.updateMany({
      where: { id, status: { in: ["PENDENTE", "ADIADA"] } },
      data: { status: "ADIADA", despacharAposEm: ate, motivoFalha: motivo },
    });
    return true;
  } catch (erro) {
    if (!erroGuardaPedagogica(erro)) throw erro;
    await marcar(id, "CANCELADA", "autorizacao_academica_revogada");
    return false;
  }
}

async function adiarClaim(id: string, ate: Date): Promise<boolean> {
  try {
    await prisma.intencaoMensagem.updateMany({ where: { id, status: "ENVIANDO" }, data: {
      status: "ADIADA", motivoFalha: "comprovante_em_conferencia", despacharAposEm: ate,
    } });
    return true;
  } catch (erro) {
    if (!erroGuardaPedagogica(erro)) throw erro;
    await prisma.intencaoMensagem.updateMany({ where: { id, status: "ENVIANDO" }, data: {
      status: "CANCELADA", motivoFalha: "autorizacao_academica_revogada", despacharAposEm: null,
    } });
    return false;
  }
}

/** Falha reprocessável do driver: ENVIANDO → ADIADA, mantendo o clientMessageId já gravado. */
async function adiarReprocessavel(id: string, ate: Date, motivo: string): Promise<void> {
  await prisma.intencaoMensagem.updateMany({
    where: { id, status: "ENVIANDO" },
    data: { status: "ADIADA", despacharAposEm: ate, motivoFalha: motivo },
  });
}

/** Falha pós-claim: transita exclusivamente de ENVIANDO (o claim é deste worker). */
async function falharClaim(id: string, motivo: string): Promise<void> {
  await prisma.intencaoMensagem.updateMany({
    where: { id, status: "ENVIANDO" },
    data: { status: "FALHOU", motivoFalha: motivo },
  });
}

/**
 * Envio humano para GRUPO (E3.5): grupo não tem atendimento nem intenção, então a mensagem `NA_FILA`
 * com `clientMessageId` é despachada direto, pelo mesmo driver. Sem `WHATSAPP_LIVE=1` nada sai
 * (`SIMULADA`, a mensagem continua `NA_FILA`). Grupo não recebe automação: só origem HUMANO.
 */
export async function despacharMensagemGrupo(mensagemId: string, agora: Date = new Date()): Promise<"ENVIADA" | "FALHOU" | "SIMULADA"> {
  const m = await prisma.mensagemWhatsApp.findUnique({
    where: { id: mensagemId },
    include: { numero: true, conversa: { include: { grupo: true } } },
  });
  if (!m || m.direcao !== "SAIDA" || m.status !== "NA_FILA" || !m.clientMessageId || !m.conversa.grupo || m.origem !== "HUMANO") {
    throw new Error("Mensagem de grupo inválida para despacho.");
  }
  if (process.env.WHATSAPP_LIVE !== "1") return "SIMULADA";

  // Mensagem é tabela operacional, não agregado de Evento (evento.ts); o motivo da falha fica no log do servidor.
  const falhar = async (motivo: string) => {
    await prisma.mensagemWhatsApp.updateMany({ where: { id: m.id, status: "NA_FILA" }, data: { status: "FALHOU", statusEm: agora } });
    console.warn(`[whatsapp] envio ao grupo ${m.conversa.grupo!.id} falhou: ${motivo}`);
    return "FALHOU" as const;
  };

  if (!m.numero.ativo) return falhar("numero_remetente_inativo");
  if (!DRIVERS[m.numero.driver]) return falhar("driver_indisponivel");
  try {
    const canal = driverDoNumero(m.numero.driver);
    const r = await canal.enviarTexto(
      { id: m.numero.id, telefoneE164: m.numero.telefoneE164, driver: m.numero.driver, providerRef: m.numero.providerRef },
      m.conversa.grupo.grupoJid, m.corpo ?? "", { clientMessageId: m.clientMessageId, origem: "HUMANO" },
    );
    // O eco `origem: "erp"` pode ter chegado antes: só completa o que falta.
    await prisma.mensagemWhatsApp.updateMany({
      where: { id: m.id, status: "NA_FILA" },
      data: { status: "ENVIADA", statusEm: agora, enviadaEm: agora, providerMessageId: r.providerMessageId, mensagemIdMotor: r.mensagemIdMotor ?? null },
    });
    return "ENVIADA";
  } catch (e) {
    return falhar(e instanceof ErroDriver ? e.motivo : "erro_desconhecido");
  }
}
