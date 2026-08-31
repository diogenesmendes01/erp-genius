import { prisma } from "@/lib/prisma";
import { registrarEventoCobrancaEnviada, registrarEventoReguaComercialEnviada } from "@/server/cobrancas/eventos";
import {
  CHAVE_CONTRATO,
  CHAVE_LEAD_NOVO,
  CHAVE_LINK_PAGAMENTO,
  CHAVE_NO_SHOW,
  CHAVE_PRE_EXPERIMENTAL,
} from "@/server/comercial/regua-fabrica";
import { carregarPoliticaRegua, type PoliticaCarregada } from "@/server/cobrancas/politica";
import type { PassoRegua } from "@/server/cobrancas/regua";
import { ErroDriver, type CanalWhatsApp, type NumeroCanal } from "./canal";
import { driverEvolution } from "./drivers/evolution";
import { driverMetaCloud } from "./drivers/meta-cloud";
import { lerMidiaParaEnvio } from "./midia";

// DESPACHANTE ÚNICO (doc 26 §fila única · doc 30 §contratos): drena a outbox aplicando os
// guard-rails UMA vez para os dois motores, na ordem da spec. Cada decisão deixa motivo
// auditável na intenção. É o ÚNICO arquivo que importa drivers (doc 29 §fronteiras).
//
// SEGURANÇA DE AMBIENTE (gap A5 do doc 28): sem WHATSAPP_LIVE=1 no env, NENHUMA mensagem
// real sai — tudo que passaria vira SIMULADA. Dev contra o banco compartilhado não dispara.

const DRIVERS: Record<"META_CLOUD" | "BAILEYS", CanalWhatsApp> = {
  META_CLOUD: driverMetaCloud,
  BAILEYS: driverEvolution,
};

export interface ResultadoDespacho {
  avaliadas: number;
  despachadas: number;
  simuladas: number;
  canceladas: number;
  adiadas: number;
  falhas: number;
  pendentes: number; // deixadas na fila (kill switch / política desligada)
}

function horaLocal(data: Date, fuso: string): number {
  try {
    return parseInt(
      new Intl.DateTimeFormat("en-GB", { timeZone: fuso, hour: "2-digit", hour12: false }).format(data),
      10,
    );
  } catch {
    return data.getHours(); // fuso inválido no cadastro → hora do servidor (não trava a fila)
  }
}

const DIA_POR_NOME: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function diaSemanaLocal(data: Date, fuso: string): number {
  try {
    const nome = new Intl.DateTimeFormat("en-US", { timeZone: fuso, weekday: "short" }).format(data);
    return DIA_POR_NOME[nome] ?? data.getDay();
  } catch {
    return data.getDay();
  }
}

/** Prazo do claim: intenção ENVIANDO além disto = worker morreu no meio do envio. */
const CLAIM_STALE_MS = 15 * 60_000;

export interface OpcoesDespacho {
  /** Limita o dreno a UMA intenção (review PR #53 P2): o webhook despacha só a saudação
   *  reativa recém-criada, nunca a fila global de cobrança/lotes a partir de um inbound. */
  intencaoId?: string;
}

export async function despacharFila(
  agora: Date = new Date(),
  opts: OpcoesDespacho = {},
): Promise<ResultadoDespacho> {
  const politicaPadrao = await carregarPoliticaRegua();
  // Shadow PRÓPRIO da saudação (review PR #53 · doc 27): a classe reativa não olha o estado
  // da política de COBRANÇA — o ensaio dela é o saudacaoEstado da ConfigComercial.
  const saudacaoEstado = (await prisma.configComercial.findUnique({ where: { id: "comercial" } }))?.saudacaoEstado ?? "DESLIGADA";
  const live = process.env.WHATSAPP_LIVE === "1";

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
      OR: [
        { status: "PENDENTE" },
        { status: "ADIADA", despacharAposEm: { lte: agora } },
      ],
    },
    orderBy: { criadaEm: "asc" },
    include: {
      numero: true,
      contato: true,
      template: true,
      politica: true,
      politicaComercial: true, // estado (shadow) + chave (evento) da cadência comercial
      // Fuso do destino no caminho comercial (S3) + estado de FECHAMENTO (B7 nas cadências C4).
      lead: { include: { pais: true, matricula: { include: { cobrancas: { where: { tipo: "MATRICULA" } } } } } },
      cobranca: { include: { matricula: { include: { pais: true, aluno: { include: { pais: true } } } } } },
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
  };

  for (const it of intencoes) {
    // Config de guard-rails: cadência comercial usa a SUA política (janela/teto/silêncio/
    // estado próprios); cobrança usa a dela; o kill switch é sempre o global (da cobrança).
    const comercialPol = it.leadId != null && it.politicaComercial;
    const politica: PoliticaCarregada = comercialPol
      ? {
          ...politicaPadrao, // killSwitch global + defaults
          estado: it.politicaComercial!.estado,
          janelaInicio: it.politicaComercial!.janelaInicio,
          janelaFim: it.politicaComercial!.janelaFim,
          diasSemana: it.politicaComercial!.diasSemana,
          tetoPorContatoDia: it.politicaComercial!.tetoPorContatoDia,
          silencioPosInboundHoras: it.politicaComercial!.silencioPosInboundHoras,
        }
      : it.politica
        ? { ...politicaPadrao, ...configDe(it.politica) }
        : politicaPadrao;
    const automatica = it.origem !== "HUMANO"; // guard-rails de automação valem p/ CRON e LOTE
    // Classe REATIVA (doc 27 · gap C20): saudação/resposta automática a um inbound. É isenta
    // dos guard-rails de HORÁRIO (janela/teto/silêncio) e da trava S1 — a janela de 24h está
    // aberta (o contato acabou de falar), então até o oficial aceita texto livre. Continua
    // sujeita a opt-out, conversa-viva (um inbound MAIS novo a cancela), shadow (WHATSAPP_LIVE)
    // e ao KILL SWITCH (freio de emergência de TODA automação — review PR #53 P1).
    const reativa = it.reativa;
    // Cadência COMERCIAL (doc 27): vínculo Lead + passo. Isenta da trava S1 (liberada no
    // Baileys por decisão de produto); shadow pela SUA política (não a de cobrança); janela/
    // teto/silêncio VALEM (é disparo proativo). Kill switch de cobrança a congela também.
    const comercial = it.leadId != null && it.passoComercial != null;

    // 1. Kill switch: freio de emergência — congela TODA automação, reativa inclusive
    //    (nada é perdido nem cancelado). Só origem HUMANO passa: resposta na inbox/fila é
    //    decisão humana explícita, não automação (S13, E3).
    if (politica.killSwitch && automatica) {
      r.pendentes += 1;
      continue;
    }

    // 2. TRAVA S1 (lei): disparo do CRON exige driver oficial — Baileys nunca recebe
    //    automação desassistida (padrão de ban, doc 26 §Em aberto → decidido no doc 30).
    //    Reativa e cadência comercial são isentas: rodam no número de vendas (Baileys).
    if (it.origem === "CRON" && !reativa && !comercial && it.numero.driver !== "META_CLOUD") {
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

    const conversa = await prisma.conversaWhatsApp.findUnique({
      where: { numeroId_contatoId: { numeroId: it.numeroId, contatoId: it.contatoId } },
      select: { id: true, ultimoInboundEm: true, inboundTratadoEm: true, capturadaEm: true },
    });

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
    //    A cadência COMERCIAL ancora NO 1º inbound (`capturadaEm`, gravado no mesmo instante
    //    que `ultimoInboundEm`): aplicar o silêncio sobre a PRÓPRIA âncora adiaria a cadência
    //    inteira por 72h e faria +30min/+4h/+24h vencerem todos juntos depois (review PR #55
    //    P1). O inbound que a ancorou é ignorado; um inbound POSTERIOR continua silenciando
    //    (e, de todo modo, encerra a cadência no enfileirador e na regra 4).
    const ancoraComercial = comercial ? conversa?.capturadaEm ?? null : null;
    const inboundSilenciador =
      ancoraComercial && conversa?.ultimoInboundEm && conversa.ultimoInboundEm <= ancoraComercial
        ? null
        : conversa?.ultimoInboundEm ?? null;
    const inboundNaoTratado =
      !!inboundSilenciador &&
      (!conversa?.inboundTratadoEm || conversa.inboundTratadoEm < inboundSilenciador);
    if (it.origem === "CRON" && !reativa && inboundSilenciador && inboundNaoTratado) {
      const limite = new Date(inboundSilenciador.getTime() + politica.silencioPosInboundHoras * 3600_000);
      if (agora < limite) {
        await adiar(it.id, limite, "silencio_pos_inbound");
        r.adiadas += 1;
        continue;
      }
    }

    // 5b. REVALIDAÇÃO NO DESPACHO (B7, doc 32): o despacho não pode confiar no snapshot do
    //     enqueue. Uma intenção PENDENTE/ADIADA dispararia mesmo que, DEPOIS do enqueue, o
    //     lead tenha avançado de etapa, o vendedor assumido (B2) ou a experimental sido
    //     reagendada — aqui a etapa + a ocorrência + o takeover são conferidos de novo, e a
    //     intenção obsoleta é CANCELADA em vez de enviada.
    if (comercial && it.lead) {
      const chave = chaveComercial(it);
      const lead = it.lead;
      let motivoObsoleta: string | null = null;

      if (chave === CHAVE_LEAD_NOVO) {
        if (lead.etapa !== "NOVO") motivoObsoleta = "etapa_mudou";
        else if (conversa && it.ocorrenciaComercial) {
          // Takeover (B2): TODA saída manual após a âncora — origem HUMANO (inbox) e
          // origem null (fromMe: app do celular) — significa "vendedor assumiu".
          const manuais = await prisma.mensagemWhatsApp.count({
            where: {
              conversaId: conversa.id,
              direcao: "SAIDA",
              OR: [{ origem: "HUMANO" }, { origem: null }],
              criadoEm: { gt: new Date(it.ocorrenciaComercial) },
            },
          });
          if (manuais > 0) motivoObsoleta = "vendedor_assumiu";
        }
      } else if (chave === CHAVE_PRE_EXPERIMENTAL) {
        if (lead.etapa !== "EXPERIMENTAL_AGENDADA") motivoObsoleta = "etapa_mudou";
        else if (lead.dataExperimental?.toISOString() !== it.ocorrenciaComercial)
          motivoObsoleta = "ocorrencia_mudou"; // aula reagendada: o lembrete era da anterior
        else if (lead.aguardandoReagendamentoEm) motivoObsoleta = "aguardando_reagendamento"; // B8
      } else if (chave === CHAVE_NO_SHOW) {
        if (lead.etapa !== "NO_SHOW") motivoObsoleta = "etapa_mudou";
        else if (lead.dataExperimental?.toISOString() !== it.ocorrenciaComercial)
          motivoObsoleta = "ocorrencia_mudou"; // já remarcou: a recuperação era da falta anterior
      } else if (chave === CHAVE_CONTRATO) {
        const m = lead.matricula;
        if (!m || m.status !== "AGUARDANDO" || m.contratoOk) motivoObsoleta = "estado_mudou";
        else if (m.contratoEnviadoEm?.toISOString() !== it.ocorrenciaComercial)
          motivoObsoleta = "ocorrencia_mudou"; // contrato reenviado: cadência é do envio novo
      } else if (chave === CHAVE_LINK_PAGAMENTO) {
        const m = lead.matricula;
        const taxa = m?.cobrancas.find((c) => c.linkEnviadoEm?.toISOString() === it.ocorrenciaComercial);
        if (!m || m.status !== "AGUARDANDO" || !taxa) motivoObsoleta = "estado_mudou";
        else if (taxa.status !== "PENDENTE") motivoObsoleta = "estado_mudou"; // pagou/cancelou
      }

      if (motivoObsoleta) {
        await marcar(it.id, "CANCELADA", motivoObsoleta);
        r.canceladas += 1;
        continue;
      }
    }

    // 6. Idempotência dupla (além do @@unique): o degrau pode ter sido cumprido MANUALMENTE
    //    depois que a intenção nasceu — re-checa o evento antes de enviar.
    if (it.cobrancaId && it.passo) {
      const jaCumprido = await prisma.evento.count({
        where: {
          agregadoTipo: "Cobranca",
          agregadoId: it.cobrancaId,
          tipo: "CobrancaEnviadaWhatsApp",
          payload: { path: ["passo"], equals: it.passo },
        },
      });
      if (jaCumprido > 0) {
        await marcar(it.id, "CANCELADA", "degrau_ja_cumprido");
        r.canceladas += 1;
        continue;
      }
    }
    // 6b. Idempotência da cadência comercial: o passo pode já ter sido enviado (evento).
    //     Confere CHAVE + passo (review PR #55 P2): cadências diferentes compartilham nomes
    //     de passo (+30min/+3d/+7d), então só o passo não identifica o degrau cumprido.
    if (comercial && it.leadId && it.passoComercial) {
      const jaCumprido = await prisma.evento.count({
        where: {
          agregadoTipo: "Lead",
          agregadoId: it.leadId,
          tipo: "ReguaComercialEnviada",
          AND: [
            { payload: { path: ["chave"], equals: chaveComercial(it) } },
            { payload: { path: ["passo"], equals: it.passoComercial } },
            // ...e da MESMA ocorrência (review PR #56): o degrau homônimo de um ciclo
            // anterior (experimental reagendada, segundo no-show) não cumpre este.
            { payload: { path: ["ocorrencia"], equals: it.ocorrenciaComercial ?? "" } },
          ],
        },
      });
      if (jaCumprido > 0) {
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
    if (automatica && !reativa) {
      const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      const enviadasHoje = await prisma.mensagemWhatsApp.count({
        where: {
          conversa: { contatoId: it.contatoId },
          direcao: "SAIDA",
          origem: { in: ["CRON", "LOTE"] },
          criadoEm: { gte: inicioDia },
          NOT: { intencao: { is: { reativa: true } } },
        },
      });
      if (enviadasHoje >= politica.tetoPorContatoDia) {
        await adiar(it.id, new Date(agora.getTime() + 24 * 3600_000), "teto_contato_dia");
        r.adiadas += 1;
        continue;
      }
    }

    // 8. Janela de horário + dias da semana (S3), no FUSO DO CONTATO (Aluno.fuso ?? Pais.fuso).
    //    Reativa é isenta: uma saudação "em segundos" não pode esperar o horário comercial.
    if (automatica && !reativa) {
      const fuso = fusoDoDestino(it);
      const hora = horaLocal(agora, fuso);
      const dia = diaSemanaLocal(agora, fuso);
      if (hora < politica.janelaInicio || hora >= politica.janelaFim || !politica.diasSemana.includes(dia)) {
        await adiar(it.id, new Date(agora.getTime() + 3600_000), "fora_da_janela"); // re-checa a cada hora
        r.adiadas += 1;
        continue;
      }
    }

    // 9. SHADOW (S8): política em ensaio ou ambiente sem WHATSAPP_LIVE=1 → registra o que
    //    TERIA sido enviado, sem chamar driver. Vale para TODA automação (CRON e LOTE —
    //    review PR #51 P1-3: lote aprovado durante o ensaio não pode disparar de verdade);
    //    origem HUMANO (resposta na inbox/fila) é decisão humana e envia mesmo em ensaio.
    //    SIMULADA não é terminal: a fila reabre quando o canal sair do ensaio (review PR #49).
    // SHADOW (S8): ensaio da automação. Cobrança olha o estado da SUA política; a saudação
    // reativa olha o seu shadow PRÓPRIO (saudacaoEstado — review PR #53). Ambiente sem
    // WHATSAPP_LIVE simula tudo. SHADOW registra o que TERIA sido enviado, sem chamar driver.
    const shadow =
      !live ||
      (automatica && !reativa && politica.estado !== "ATIVA") ||
      (reativa && saudacaoEstado !== "ATIVA");
    if (shadow) {
      await prisma.intencaoMensagem.updateMany({
        where: { id: it.id, status: it.status }, // não clobbera claim concorrente
        data: { status: "SIMULADA", despachadaEm: agora, motivoFalha: live ? null : "ambiente_sem_live" },
      });
      r.simuladas += 1;
      continue;
    }

    // 10. Driver oficial fora da janela de 24h exige template APROVADO na Meta (Camada 2).
    //     Só a REATIVA é isenta (ela responde DENTRO da janela de 24h, texto livre vale). A
    //     cadência comercial NÃO é: +3d e +7d caem fora da janela e, sem template aprovado, o
    //     envio ou falha na API ou tenta texto livre indevido (review PR #55 P1). Falhar aqui
    //     é o comportamento correto — a fila humana mostra o motivo.
    if (it.numero.driver === "META_CLOUD" && automatica && !reativa && it.template?.statusMeta !== "APROVADO") {
      await marcar(it.id, "FALHOU", "template_nao_aprovado_meta");
      r.falhas += 1;
      continue;
    }

    // 11. CLAIM ATÔMICO (review PR #49): só quem mover a intenção para ENVIANDO chama o
    //     driver — cron, lote e clique rodando em paralelo nunca enviam a mesma intenção
    //     duas vezes. `despacharAposEm` vira o prazo do claim (stale = recuperação acima).
    const claim = await prisma.intencaoMensagem.updateMany({
      where: { id: it.id, status: it.status },
      data: { status: "ENVIANDO", despacharAposEm: new Date(agora.getTime() + CLAIM_STALE_MS) },
    });
    if (claim.count === 0) continue; // outro worker levou — não conta em nada

    // 12. Envio real + gravação em transação (mensagem + evento de domínio + intenção).
    try {
      const numeroCanal: NumeroCanal = {
        id: it.numero.id,
        telefoneE164: it.numero.telefoneE164,
        driver: it.numero.driver,
        providerRef: it.numero.providerRef,
      };
      const driver = DRIVERS[it.numero.driver];
      let envio;
      if (it.tipo !== "TEXTO" && it.tipo !== "OUTRO" && it.midiaPath) {
        // Mídia da inbox (E3): lê do storage privado e entrega ao driver do número.
        const midia = await lerMidiaParaEnvio(it.midiaPath);
        envio = await driver.enviarMidia(numeroCanal, it.contato.telefoneE164, {
          tipo: it.tipo,
          mime: midia.mime,
          nomeArquivo: midia.nomeArquivo,
          dadosBase64: midia.dadosBase64,
          legenda: it.corpoRenderizado || null,
        });
      } else if (it.numero.driver === "META_CLOUD" && it.template) {
        envio = await driver.enviarTemplate(numeroCanal, it.contato.telefoneE164, {
          nome: it.template.nome,
          idioma: it.template.idioma,
          variaveis: (it.variaveis as string[] | null) ?? [],
          corpoRenderizado: it.corpoRenderizado,
        });
      } else {
        envio = await driver.enviarTexto(numeroCanal, it.contato.telefoneE164, it.corpoRenderizado);
      }

      await prisma.$transaction(async (tx) => {
        const conv =
          conversa ??
          (await tx.conversaWhatsApp.create({
            data: { numeroId: it.numeroId, contatoId: it.contatoId },
            select: { id: true, ultimoInboundEm: true },
          }));
        const msg = await tx.mensagemWhatsApp.create({
          data: {
            conversaId: conv.id,
            numeroId: it.numeroId,
            direcao: "SAIDA",
            tipo: it.tipo,
            corpo: it.corpoRenderizado || null,
            midiaPath: it.midiaPath,
            status: "ENVIADA",
            statusEm: agora,
            driver: it.numero.driver,
            origem: it.origem,
            providerMessageId: envio.providerMessageId,
            autorId: it.autorId,
            templateId: it.templateId,
          },
        });
        await tx.conversaWhatsApp.update({ where: { id: conv.id }, data: { ultimaMensagemEm: agora } });
        if (it.cobrancaId && it.passo) {
          await registrarEventoCobrancaEnviada(tx, {
            cobrancaId: it.cobrancaId,
            modelo: it.template?.nome ?? "texto",
            passo: it.passo as PassoRegua,
            canal: "api",
            autorId: it.autorId, // humano que aprovou (LOTE/HUMANO) ou null (CRON)
          });
        } else if (comercial && it.leadId && it.passoComercial) {
          // Evento de domínio da cadência comercial — o motor conta como passo cumprido.
          await registrarEventoReguaComercialEnviada(tx, {
            leadId: it.leadId,
            chave: chaveComercial(it),
            passo: it.passoComercial,
            ocorrencia: it.ocorrenciaComercial ?? "",
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
      });
      r.despachadas += 1;
    } catch (e) {
      const motivo = e instanceof ErroDriver ? e.motivo : "erro_inesperado";
      await falharClaim(it.id, motivo);
      r.falhas += 1;
    }
  }

  return r;
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
    it.lead?.pais?.fuso ?? // cadência comercial: janela no fuso LOCAL do lead
    "America/Sao_Paulo"
  );
}

/** Chave da cadência que gerou a intenção comercial (identidade do degrau no evento). */
function chaveComercial(it: { politicaComercial: { chave: string } | null }): string {
  return it.politicaComercial?.chave ?? "COMERCIAL";
}

// Marks dos guard-rails só transitam de estados "na fila" — nunca clobberam um claim
// ENVIANDO de outro worker nem estados terminais (review PR #49).
async function marcar(id: string, status: "CANCELADA" | "FALHOU", motivo: string): Promise<void> {
  await prisma.intencaoMensagem.updateMany({
    where: { id, status: { in: ["PENDENTE", "ADIADA"] } },
    data: { status, motivoFalha: motivo },
  });
}

async function adiar(id: string, ate: Date, motivo: string): Promise<void> {
  await prisma.intencaoMensagem.updateMany({
    where: { id, status: { in: ["PENDENTE", "ADIADA"] } },
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
