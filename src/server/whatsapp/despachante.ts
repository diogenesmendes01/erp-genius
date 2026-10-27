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

const DRIVERS: Partial<Record<DriverWhatsApp, CanalWhatsApp>> = {
  MOTOR: driverMotor,
};

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
  pendentes: number;
  retidasAgenda: number;
}

export type { JanelaEnvio };

export function retornoAposTeto(inicioAmanhaEscola: Date, janela: JanelaEnvio, fuso: string): Date {
  try {
    if (dentroDaJanelaEnvio(inicioAmanhaEscola, fuso, janela)) return inicioAmanhaEscola;
    const primeiroDia = Date.parse(`${dataCivilInstitucional(inicioAmanhaEscola, fuso)}T00:00:00Z`);
    for (let dias = 0; dias <= 7; dias++) {
      const data = new Date(primeiroDia + dias * 86_400_000).toISOString().slice(0, 10);
      for (let hora = Math.max(0, janela.janelaInicio); hora < Math.min(24, janela.janelaFim); hora++) {
        const [abertura] = candidatosDaGrade(data, `${String(hora).padStart(2, "0")}:00`, fuso);
        if (!abertura) continue;
        if (abertura >= inicioAmanhaEscola && dentroDaJanelaEnvio(abertura, fuso, janela)) return abertura;
        break;
      }
    }
  } catch {
  }
  return inicioAmanhaEscola;
}

export interface EntradaShadow {
  live: boolean;
  agenda: boolean;
  automatica: boolean;
  reativa: boolean;
  gestao: boolean;
  politicaEstado: EstadoPolitica;
  ia: boolean;
  ariaEstado: EstadoPolitica;
}

export function intencaoEmShadow(e: EntradaShadow): boolean {
  return (
    !e.live ||
    e.gestao ||
    (!e.agenda && e.automatica && !e.reativa && e.politicaEstado !== "ATIVA") ||
    (e.ia ? e.ariaEstado !== "ATIVA" : e.reativa)
  );
}

export type DecisaoEnvio = "RETER_AGENDA" | "SIMULAR" | "ENVIAR";

export function decidirEnvio(e: EntradaShadow & { envioAgendaHabilitado: boolean }): DecisaoEnvio {
  if (e.agenda && !e.envioAgendaHabilitado) return "RETER_AGENDA";
  return intencaoEmShadow(e) ? "SIMULAR" : "ENVIAR";
}

const CLAIM_STALE_MS = 15 * 60_000;

export interface OpcoesDespacho {
  intencaoId?: string;
  somenteAvisosAgenda?: boolean;
}

export async function despacharFila(
  agora: Date = new Date(),
  opts: OpcoesDespacho = {},
): Promise<ResultadoDespacho> {
  const politicaPadrao = await carregarPoliticaRegua();
  const ariaEstado = (await prisma.agenteIA.findUnique({ where: { id: "aria" }, select: { estado: true } }))?.estado ?? "DESLIGADA";
  const live = process.env.WHATSAPP_LIVE === "1";
  const fusoEscola = await fusoDaEscola();
  const inicioDiaEscola = inicioDoDiaInstitucional(agora, fusoEscola);
  const inicioAmanhaEscola = inicioDoDiaSeguinteInstitucional(agora, fusoEscola);

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
        { status: "PENDENTE", OR: [{ agendadaPara: null }, { agendadaPara: { lte: agora } }] },
        { status: "ADIADA", despacharAposEm: { lte: agora }, OR: [{ agendadaPara: null }, { agendadaPara: { lte: agora } }] },
        { status: "ADIADA", motivoFalha: "comprovante_em_conferencia" },
      ],
    },
    orderBy: { criadaEm: "asc" },
    include: {
      numero: true,
      contato: true,
      template: true,
      politica: true,
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
    const agenda = it.avisoAlteracaoAgendaId != null;
    const politica: PoliticaCarregada = it.politica ? { ...politicaPadrao, ...configDe(it.politica) } : politicaPadrao;
    const automatica = it.origem !== "HUMANO";
    const reativa = it.reativa;

    if (!agenda && politica.killSwitch && automatica) {
      r.pendentes += 1;
      continue;
    }

    if (it.origem === "CRON" && !reativa && !driverAceitaAutomacao(it.numero.driver)) {
      await marcar(it.id, "CANCELADA", "trava_driver_oficial");
      r.canceladas += 1;
      continue;
    }

    if (it.contato.optOutEm) {
      await marcar(it.id, "CANCELADA", "opt_out");
      r.canceladas += 1;
      continue;
    }

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

    if (automatica && conversa?.ultimoInboundEm && conversa.ultimoInboundEm > it.criadaEm) {
      await marcar(it.id, "CANCELADA", "conversa_viva");
      r.canceladas += 1;
      continue;
    }

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
        if (await adiar(it.id, retornoAposTeto(inicioAmanhaEscola, politica, fusoDoDestino(it)), "teto_contato_dia")) r.adiadas += 1;
        else r.canceladas += 1;
        continue;
      }
    }

    if (automatica && !reativa) {
      if (!dentroDaJanelaEnvio(agora, fusoDoDestino(it), politica)) {
        if (await adiar(it.id, new Date(agora.getTime() + 3600_000), "fora_da_janela")) r.adiadas += 1;
        else r.canceladas += 1;
        continue;
      }
    }

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
        where: { id: it.id, status: it.status },
        data: { status: "SIMULADA", despachadaEm: agora, motivoFalha: live ? null : "ambiente_sem_live" },
      });
      r.simuladas += 1;
      continue;
    }

    if (!DRIVERS[it.numero.driver]) {
      await marcar(it.id, "FALHOU", "driver_indisponivel");
      r.falhas += 1;
      continue;
    }

    let claimCount = 0;
    const clientMessageId = it.clientMessageId ?? randomUUID();
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
    if (claimCount === 0) continue;

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
            autorId: it.autorId,
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
      const limite = it.origem === "HUMANO" ? LIMITE_REPROCESSO_MS.HUMANO : LIMITE_REPROCESSO_MS.AUTOMACAO;
      if (e instanceof ErroDriver && e.reprocessavel && !it.avisoAlteracaoAgendaId
        && agora.getTime() - it.criadaEm.getTime() <= limite) {
        await adiarReprocessavel(it.id, new Date(agora.getTime() + e.adiarMs), e.motivo);
        r.adiadas += 1;
        continue;
      }
      const motivo = e instanceof ErroDriver ? e.motivo : "resultado_incerto";
      await falharClaim(it.id, motivo);
      r.falhas += 1;
    }
  }

  return r;
}

export const LIMITE_REPROCESSO_MS = { HUMANO: 30 * 60_000, AUTOMACAO: 24 * 3_600_000 } as const;

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
  const tipoConteudo = (it.conteudo as { tipo?: string } | null | undefined)?.tipo;
  if (it.origem === "IA" && (tipoConteudo === "FIGURINHA" || tipoConteudo === "GIF")) return "ia_conteudo_nao_permitido";
  const motivoAgenda = await motivoAvisoAgendaInvalido(it);
  if (motivoAgenda) return motivoAgenda;
  if (it.origem === "GESTAO") return "configuracao_gestao_alterada";
  if (it.passoComercial) return "politica_comercial_alterada";
  if (it.origem === "IA") {
    if (it.autorId || !it.atendimentoId || !it.acaoAgenteIAId || it.cobrancaId || it.passoComercial || it.avisoAlteracaoAgendaId) return "contexto_ia_invalido";
    if (await pessoaAssumiuDepois(it.atendimentoId, it.criadaEm)) return MOTIVO_ARIA_PAUSADA;
  } else if (it.origem !== "CRON") {
    const autor = it.autorId ? await prisma.usuario.findUnique({ where: { id: it.autorId }, select: { id: true, nome: true, papeis: true, ativo: true } }) : null;
    if (!autor?.ativo) return "autor_sem_acesso";
    if (it.cobrancaId && !autor.papeis.some((p) => [Papel.ADMINISTRADOR, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA].includes(p as "ADMINISTRADOR" | "FINANCEIRO" | "SECRETARIA_ACADEMICA"))) return "autor_sem_acesso";
    if (!it.atendimentoId) {
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
  lead: { pais: { fuso: string } | null } | null;
};

function fusoDoDestino(it: IntencaoComDestino): string {
  const aluno = it.cobranca?.matricula.aluno;
  return (
    aluno?.fuso ??
    aluno?.pais?.fuso ??
    it.cobranca?.matricula.pais?.fuso ??
    it.lead?.pais?.fuso ??
    "America/Sao_Paulo"
  );
}

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

async function adiarReprocessavel(id: string, ate: Date, motivo: string): Promise<void> {
  await prisma.intencaoMensagem.updateMany({
    where: { id, status: "ENVIANDO" },
    data: { status: "ADIADA", despacharAposEm: ate, motivoFalha: motivo },
  });
}

async function falharClaim(id: string, motivo: string): Promise<void> {
  await prisma.intencaoMensagem.updateMany({
    where: { id, status: "ENVIANDO" },
    data: { status: "FALHOU", motivoFalha: motivo },
  });
}

export async function despacharMensagemGrupo(mensagemId: string, agora: Date = new Date()): Promise<"ENVIADA" | "FALHOU" | "SIMULADA"> {
  const m = await prisma.mensagemWhatsApp.findUnique({
    where: { id: mensagemId },
    include: { numero: true, conversa: { include: { grupo: true } } },
  });
  if (!m || m.direcao !== "SAIDA" || m.status !== "NA_FILA" || !m.clientMessageId || !m.conversa.grupo || m.origem !== "HUMANO") {
    throw new Error("Mensagem de grupo inválida para despacho.");
  }
  if (process.env.WHATSAPP_LIVE !== "1") return "SIMULADA";

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
    await prisma.mensagemWhatsApp.updateMany({
      where: { id: m.id, status: "NA_FILA" },
      data: { status: "ENVIADA", statusEm: agora, enviadaEm: agora, providerMessageId: r.providerMessageId, mensagemIdMotor: r.mensagemIdMotor ?? null },
    });
    return "ENVIADA";
  } catch (e) {
    return falhar(e instanceof ErroDriver ? e.motivo : "erro_desconhecido");
  }
}
