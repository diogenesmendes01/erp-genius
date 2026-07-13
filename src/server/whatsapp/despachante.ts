import { prisma } from "@/lib/prisma";
import { registrarEventoCobrancaEnviada } from "@/server/cobrancas/eventos";
import { carregarPoliticaRegua, type PoliticaCarregada } from "@/server/cobrancas/politica";
import type { PassoRegua } from "@/server/cobrancas/regua";
import { ErroDriver, type CanalWhatsApp, type NumeroCanal } from "./canal";
import { driverEvolution } from "./drivers/evolution";
import { driverMetaCloud } from "./drivers/meta-cloud";

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

export async function despacharFila(agora: Date = new Date()): Promise<ResultadoDespacho> {
  const politicaPadrao = await carregarPoliticaRegua();
  const live = process.env.WHATSAPP_LIVE === "1";

  const intencoes = await prisma.intencaoMensagem.findMany({
    where: {
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
    const politica: PoliticaCarregada = it.politica
      ? { ...politicaPadrao, ...configDe(it.politica) }
      : politicaPadrao;
    const automatica = it.origem !== "HUMANO"; // guard-rails de automação valem p/ CRON e LOTE

    // 1. Kill switch: congela a fila (nada é perdido nem cancelado).
    if (politica.killSwitch) {
      r.pendentes += 1;
      continue;
    }

    // 2. TRAVA S1 (lei): disparo do CRON exige driver oficial — Baileys nunca recebe
    //    automação desassistida (padrão de ban, doc 26 §Em aberto → decidido no doc 30).
    if (it.origem === "CRON" && it.numero.driver !== "META_CLOUD") {
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

    const conversa = await prisma.conversaWhatsApp.findUnique({
      where: { numeroId_contatoId: { numeroId: it.numeroId, contatoId: it.contatoId } },
      select: { id: true, ultimoInboundEm: true },
    });

    // 4. LEI DO DESPACHANTE: automação nunca fala por cima de conversa viva — inbound do
    //    contato posterior à criação da intenção cancela a intenção automática.
    if (automatica && conversa?.ultimoInboundEm && conversa.ultimoInboundEm > it.criadaEm) {
      await marcar(it.id, "CANCELADA", "conversa_viva");
      r.canceladas += 1;
      continue;
    }

    // 5. Silêncio pós-inbound (S4): inbound recente (mesmo anterior à intenção) suspende o
    //    CRON até o humano tratar ou a janela de silêncio expirar.
    if (it.origem === "CRON" && conversa?.ultimoInboundEm) {
      const limite = new Date(conversa.ultimoInboundEm.getTime() + politica.silencioPosInboundHoras * 3600_000);
      if (agora < limite) {
        await adiar(it.id, limite, "silencio_pos_inbound");
        r.adiadas += 1;
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

    // 7. Teto por contato/dia (S5): soma mensagens AUTOMÁTICAS de hoje; suprimida = ADIADA,
    //    nunca descartada em silêncio (doc 27 §regra de ouro).
    if (automatica) {
      const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      const enviadasHoje = await prisma.mensagemWhatsApp.count({
        where: {
          conversa: { contatoId: it.contatoId },
          direcao: "SAIDA",
          origem: { in: ["CRON", "LOTE"] },
          criadoEm: { gte: inicioDia },
        },
      });
      if (enviadasHoje >= politica.tetoPorContatoDia) {
        await adiar(it.id, new Date(agora.getTime() + 24 * 3600_000), "teto_contato_dia");
        r.adiadas += 1;
        continue;
      }
    }

    // 8. Janela de horário + dias da semana (S3), no FUSO DO CONTATO (Aluno.fuso ?? Pais.fuso).
    if (automatica) {
      const fuso = fusoDoDestino(it);
      const hora = horaLocal(agora, fuso);
      const dia = diaSemanaLocal(agora, fuso);
      if (hora < politica.janelaInicio || hora >= politica.janelaFim || !politica.diasSemana.includes(dia)) {
        await adiar(it.id, new Date(agora.getTime() + 3600_000), "fora_da_janela"); // re-checa a cada hora
        r.adiadas += 1;
        continue;
      }
    }

    // 9. SHADOW (S8): política em ensaio (cron) ou ambiente sem WHATSAPP_LIVE=1 →
    //    registra o que TERIA sido enviado, sem chamar driver.
    const shadow = !live || (it.origem === "CRON" && politica.estado !== "ATIVA");
    if (shadow) {
      await prisma.intencaoMensagem.update({
        where: { id: it.id },
        data: { status: "SIMULADA", despachadaEm: agora, motivoFalha: live ? null : "ambiente_sem_live" },
      });
      r.simuladas += 1;
      continue;
    }

    // 10. Driver oficial fora da janela de 24h exige template APROVADO na Meta (Camada 2).
    if (it.numero.driver === "META_CLOUD" && automatica && it.template?.statusMeta !== "APROVADO") {
      await marcar(it.id, "FALHOU", "template_nao_aprovado_meta");
      r.falhas += 1;
      continue;
    }

    // 11. Envio real + gravação em transação (mensagem + evento de domínio + intenção).
    try {
      const numeroCanal: NumeroCanal = {
        id: it.numero.id,
        telefoneE164: it.numero.telefoneE164,
        driver: it.numero.driver,
        providerRef: it.numero.providerRef,
      };
      const driver = DRIVERS[it.numero.driver];
      const envio =
        it.numero.driver === "META_CLOUD" && it.template
          ? await driver.enviarTemplate(numeroCanal, it.contato.telefoneE164, {
              nome: it.template.nome,
              idioma: it.template.idioma,
              variaveis: (it.variaveis as string[] | null) ?? [],
              corpoRenderizado: it.corpoRenderizado,
            })
          : await driver.enviarTexto(numeroCanal, it.contato.telefoneE164, it.corpoRenderizado);

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
            tipo: "TEXTO",
            corpo: it.corpoRenderizado,
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
        }
        await tx.intencaoMensagem.update({
          where: { id: it.id },
          data: { status: "DESPACHADA", despachadaEm: agora, mensagemId: msg.id, motivoFalha: null },
        });
      });
      r.despachadas += 1;
    } catch (e) {
      const motivo = e instanceof ErroDriver ? e.motivo : "erro_inesperado";
      await marcar(it.id, "FALHOU", motivo);
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
};

function fusoDoDestino(it: IntencaoComDestino): string {
  const aluno = it.cobranca?.matricula.aluno;
  return aluno?.fuso ?? aluno?.pais?.fuso ?? it.cobranca?.matricula.pais?.fuso ?? "America/Sao_Paulo";
}

async function marcar(id: string, status: "CANCELADA" | "FALHOU", motivo: string): Promise<void> {
  await prisma.intencaoMensagem.update({ where: { id }, data: { status, motivoFalha: motivo } });
}

async function adiar(id: string, ate: Date, motivo: string): Promise<void> {
  await prisma.intencaoMensagem.update({
    where: { id },
    data: { status: "ADIADA", despacharAposEm: ate, motivoFalha: motivo },
  });
}
