import { EtapaLead } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { proximaAcaoAncora } from "@/server/cobrancas/regua";
import {
  carregarPoliticaComercial,
  type PoliticaComercialCarregada,
} from "@/server/comercial/regua-comercial";
import {
  CHAVE_CONTRATO,
  CHAVE_LEAD_NOVO,
  CHAVE_LINK_PAGAMENTO,
  CHAVE_NO_SHOW,
  CHAVE_PRE_EXPERIMENTAL,
} from "@/server/comercial/regua-fabrica";
import { enfileirarIntencaoComercial } from "./fila";
import { renderizarTemplate } from "./render";

// ENFILEIRADORES das réguas COMERCIAIS (doc 27 C1/C2). "Um motor, N políticas": o núcleo
// (`processarCadencia`) é UM só — cada cenário só resolve seus CANDIDATOS (âncora +
// stop-conditions). Reusa o cérebro `proximaAcaoAncora` com a ORDEM CANÔNICA imutável
// (corte de progresso forward-only) e a fila/despachante compartilhados (doc 29 regra 1).
//
// Cenários:
//  - LEAD_NOVO_SEM_RESPOSTA: âncora = 1º inbound do lead (ConversaWhatsApp.capturadaEm);
//  - PRE_EXPERIMENTAL: âncora = horário da aula (offsets NEGATIVOS: 24h e 2h ANTES);
//  - NO_SHOW: âncora = horário da aula perdida (check-in do professor marcou NO_SHOW);
//  - CONTRATO_SEM_ASSINATURA (C4): âncora = envio do contrato (Matricula.contratoEnviadoEm);
//  - LINK_PAGAMENTO_SEM_PAGAMENTO (C4): âncora = envio do link (Cobranca.linkEnviadoEm da taxa).

// Etapa em que o lead ainda é "novo sem resposta". Sair dela ENCERRA a cadência (regra
// transversal do doc 27: mudança de etapa encerra a política). Só NOVO permanece frio —
// EM_ATENDIMENTO significa que o vendedor JÁ assumiu, e a automação não pode falar por cima
// dele antes de existir uma mensagem HUMANO na conversa (review PR #55 P1).
const ETAPAS_FRIAS: EtapaLead[] = [EtapaLead.NOVO];

export interface ResultadoCronComercial {
  executou: boolean;
  motivoParada: string | null;
  leadsAvaliados: number;
  acoesDevidas: number;
  enfileiradas: number;
  reabertas: number;
  jaExistentes: number;
  encerrados: number;
  /** B1 (doc 32): candidatos elegíveis pela regra, mas FORA da allowlist do piloto. */
  foraDoPiloto: number;
}

const zerado = (motivo: string): ResultadoCronComercial => ({
  executou: false,
  motivoParada: motivo,
  leadsAvaliados: 0,
  acoesDevidas: 0,
  enfileiradas: 0,
  reabertas: 0,
  jaExistentes: 0,
  encerrados: 0,
  foraDoPiloto: 0,
});

/** Um lead pronto para o motor: âncora resolvida + stop-conditions já avaliadas. */
interface CandidatoCadencia {
  leadId: string;
  contatoId: string;
  nome: string;
  idioma: string;
  ancoraEm: Date;
  encerrada: boolean;
}

/**
 * Identidade da OCORRÊNCIA (review PR #56): a âncora em ISO. A cadência pertence ao CICLO,
 * não ao lead — uma experimental reagendada e um segundo no-show são ocorrências NOVAS, e
 * precisam nascer com a cadência limpa. Sem isto o histórico do lead é eterno: os `-24h`/
 * `-2h` do compromisso anterior já marcariam os passos do novo como cumpridos.
 */
const ocorrenciaDe = (ancoraEm: Date): string => ancoraEm.toISOString();

/**
 * NÚCLEO compartilhado: roda o motor para cada candidato e enfileira o passo devido.
 * Cada cenário entrega os candidatos; daqui para frente tudo é igual.
 */
async function processarCadencia(
  chave: string,
  resolverCandidatos: (politica: PoliticaComercialCarregada, numeroId: string) => Promise<CandidatoCadencia[]>,
  agora: Date,
): Promise<ResultadoCronComercial> {
  const politica = await carregarPoliticaComercial(chave);

  // Toda automação nasce desligada (doc 27). DESLIGADA não gera nem intenção; SHADOW gera
  // intenções que o despachante marcará como SIMULADA (ensaio observável).
  if (politica.estado === "DESLIGADA") return zerado("politica_desligada");
  // Sem registro no banco (fábrica) não há identidade de política — e a identidade é parte
  // da chave de idempotência da intenção (review PR #55). Nada é enfileirado.
  const politicaId = politica.id;
  if (!politicaId) return zerado("politica_nao_persistida");
  if (!politica.numeroRemetenteId) return zerado("sem_numero_remetente");
  if (politica.degraus.length === 0) return zerado("sem_degraus_ativos");

  const numero = await prisma.numeroWhatsApp.findUnique({ where: { id: politica.numeroRemetenteId } });
  if (!numero || !numero.ativo) return zerado("numero_remetente_inativo");
  // Trava S1 LIBERADA para o comercial no Baileys (decisão de produto — a cadência roda no
  // número de vendas; o risco de ban é contido por teto/janela/pacing, não pela trava).

  const candidatos = await resolverCandidatos(politica, numero.id);
  const r: ResultadoCronComercial = { ...zerado(""), executou: true, motivoParada: null, leadsAvaliados: candidatos.length };

  // B1 (doc 32): COHORT REAL. Em modo piloto, só a allowlist explícita da política é
  // elegível — lista vazia = ninguém. Ligar a régua nunca alcança "todos os leads do
  // número" por acidente; o go-live geral é desligar o modo piloto (decisão explícita).
  const allowlist = politica.modoPiloto ? new Set(politica.pilotoLeadIds) : null;

  for (const c of candidatos) {
    if (allowlist && !allowlist.has(c.leadId)) {
      r.foraDoPiloto += 1;
      continue;
    }
    const ocorrencia = ocorrenciaDe(c.ancoraEm);
    const passosFeitos = await passosComerciaisFeitos(c.leadId, chave, ocorrencia);
    const acao = proximaAcaoAncora(
      { ancoraEm: c.ancoraEm, encerrada: c.encerrada, passosFeitos },
      agora,
      politica.degraus,
      politica.ordem,
    );

    if (acao.estado === "encerrada") {
      r.encerrados += 1;
      continue;
    }
    if (acao.estado !== "acao_devida" || !acao.passo) continue;
    r.acoesDevidas += 1;

    const degrau = politica.degraus.find((d) => d.passo === acao.passo);
    if (!degrau) continue;

    // B3 (doc 32): VALIDADE do disparo. Degrau pré-evento (offset negativo) tem a AULA como
    // teto duro — lembrete "antes" jamais sai depois dela, nem quando a intenção ficou
    // ADIADA por janela/silêncio/kill switch. A tolerância por degrau (B4) limita também o
    // atraso dos degraus pós-âncora: além dela, o disparo perde sentido e é cancelado.
    const devidoEm = new Date(c.ancoraEm.getTime() + degrau.offsetMinutos * 60_000);
    const limiteTolerancia =
      degrau.toleranciaMinutos != null
        ? new Date(devidoEm.getTime() + degrau.toleranciaMinutos * 60_000)
        : null;
    const validaAte =
      degrau.offsetMinutos < 0
        ? new Date(Math.min(c.ancoraEm.getTime(), limiteTolerancia?.getTime() ?? Infinity))
        : limiteTolerancia;

    const { corpo, variaveis } = renderizarTemplate(degrau.templateCorpo, {
      nome: c.nome,
      valor: 0,
      moeda: "USD", // cadências comerciais não usam {valor} — dummy p/ a assinatura do render
      vencimento: agora,
      idioma: c.idioma,
    });

    const resultado = await prisma.$transaction((tx) =>
      enfileirarIntencaoComercial(tx, {
        leadId: c.leadId,
        passoComercial: acao.passo!,
        ocorrenciaComercial: ocorrencia,
        numeroId: numero.id,
        contatoId: c.contatoId,
        corpoRenderizado: corpo,
        variaveis,
        templateId: degrau.templateId,
        politicaComercialId: politicaId,
        validaAte,
      }),
    );
    if (resultado === "criada") r.enfileiradas += 1;
    else if (resultado === "reaberta") r.reabertas += 1;
    else r.jaExistentes += 1;
  }

  return r;
}

// ── Cenário 1 (C1): lead novo sem resposta ───────────────────────────────────
export async function rodarLeadNovoSemResposta(agora: Date = new Date()): Promise<ResultadoCronComercial> {
  return processarCadencia(CHAVE_LEAD_NOVO, async (_politica, numeroId) => {
    const conversas = await prisma.conversaWhatsApp.findMany({
      where: {
        numeroId,
        capturadaEm: { not: null },
        contato: { leadId: { not: null }, optOutEm: null },
      },
      include: { contato: { include: { lead: { include: { pais: true } } } } },
    });

    const candidatos: CandidatoCadencia[] = [];
    for (const conversa of conversas) {
      const lead = conversa.contato.lead;
      if (!lead || !conversa.capturadaEm) continue;

      // STOP-CONDITIONS (doc 27 §regras transversais): etapa avançou, lead respondeu
      // (inbound DEPOIS da âncora) ou vendedor assumiu. B2 (doc 32): "assumiu" é TODA
      // saída manual após a âncora — origem HUMANO (inbox) E origem null (fromMe: app do
      // celular/outro aparelho, gap 16). Só as automáticas (CRON/LOTE) não contam.
      const [respostas, humanas] = await Promise.all([
        prisma.mensagemWhatsApp.count({
          where: { conversaId: conversa.id, direcao: "ENTRADA", criadoEm: { gt: conversa.capturadaEm } },
        }),
        prisma.mensagemWhatsApp.count({
          where: {
            conversaId: conversa.id,
            direcao: "SAIDA",
            OR: [{ origem: "HUMANO" }, { origem: null }],
            criadoEm: { gt: conversa.capturadaEm },
          },
        }),
      ]);
      candidatos.push({
        leadId: lead.id,
        contatoId: conversa.contatoId,
        nome: lead.nome,
        idioma: lead.pais?.idioma ?? "es",
        ancoraEm: conversa.capturadaEm,
        encerrada: !ETAPAS_FRIAS.includes(lead.etapa) || respostas > 0 || humanas > 0,
      });
    }
    return candidatos;
  }, agora);
}

// ── Cenário 2 (C2): pré-experimental (confirmação 24h/2h ANTES) ──────────────
export async function rodarPreExperimental(agora: Date = new Date()): Promise<ResultadoCronComercial> {
  return processarCadencia(CHAVE_PRE_EXPERIMENTAL, async (_politica, numeroId) => {
    const conversas = await prisma.conversaWhatsApp.findMany({
      where: {
        numeroId,
        contato: {
          optOutEm: null,
          lead: { etapa: EtapaLead.EXPERIMENTAL_AGENDADA, dataExperimental: { not: null } },
        },
      },
      include: { contato: { include: { lead: { include: { pais: true } } } } },
    });

    return conversas.flatMap((conversa) => {
      const lead = conversa.contato.lead;
      if (!lead?.dataExperimental) return [];
      // ENCERRADA quando a aula JÁ COMEÇOU: lembrete "2h antes" não pode chegar depois da
      // aula (o backlog do motor é certo para cobrança, errado para lembrete pré-evento).
      // B8 (doc 32): pedido de REAGENDAR pausa a cadência até a ação humana — o cron honra
      // o estado persistido (`aguardandoReagendamentoEm`); remarcar limpa o campo e abre
      // uma ocorrência nova.
      const jaComecou = agora >= lead.dataExperimental;
      const aguardandoReagendamento = lead.aguardandoReagendamentoEm != null;
      return [{
        leadId: lead.id,
        contatoId: conversa.contatoId,
        nome: lead.nome,
        idioma: lead.pais?.idioma ?? "es",
        ancoraEm: lead.dataExperimental,
        encerrada: jaComecou || aguardandoReagendamento,
      }];
    });
  }, agora);
}

// ── Cenário 3 (C2): recuperação de no-show ───────────────────────────────────
export async function rodarNoShow(agora: Date = new Date()): Promise<ResultadoCronComercial> {
  return processarCadencia(CHAVE_NO_SHOW, async (_politica, numeroId) => {
    const conversas = await prisma.conversaWhatsApp.findMany({
      where: {
        numeroId,
        contato: {
          optOutEm: null,
          lead: { etapa: EtapaLead.NO_SHOW, dataExperimental: { not: null } },
        },
      },
      include: { contato: { include: { lead: { include: { pais: true } } } } },
    });

    return conversas.flatMap((conversa) => {
      const lead = conversa.contato.lead;
      if (!lead?.dataExperimental) return [];
      // A etapa NO_SHOW é a própria condição (o check-in do professor a define). Sair dela
      // — remarcou, virou proposta, perdeu — encerra a recuperação no próximo tick.
      return [{
        leadId: lead.id,
        contatoId: conversa.contatoId,
        nome: lead.nome,
        idioma: lead.pais?.idioma ?? "es",
        ancoraEm: lead.dataExperimental,
        encerrada: false,
      }];
    });
  }, agora);
}

// ── Cenário 4 (C4): contrato enviado sem assinatura ──────────────────────────
export async function rodarContratoSemAssinatura(agora: Date = new Date()): Promise<ResultadoCronComercial> {
  return processarCadencia(CHAVE_CONTRATO, async (_politica, numeroId) => {
    const conversas = await prisma.conversaWhatsApp.findMany({
      where: {
        numeroId,
        contato: {
          optOutEm: null,
          lead: {
            etapa: { not: EtapaLead.PERDIDO },
            matricula: { status: "AGUARDANDO", contratoOk: false, contratoEnviadoEm: { not: null } },
          },
        },
      },
      include: {
        contato: { include: { lead: { include: { pais: true, matricula: { select: { contratoEnviadoEm: true } } } } } },
      },
    });

    return conversas.flatMap((conversa) => {
      const lead = conversa.contato.lead;
      const enviadoEm = lead?.matricula?.contratoEnviadoEm;
      if (!lead || !enviadoEm) return [];
      return [{
        leadId: lead.id,
        contatoId: conversa.contatoId,
        nome: lead.nome,
        idioma: lead.pais?.idioma ?? "es",
        ancoraEm: enviadoEm,
        // O filtro do WHERE já é a stop-condition (assinou/ativou/cancelou = sai da query);
        // o despachante revalida no despacho (B7).
        encerrada: false,
      }];
    });
  }, agora);
}

// ── Cenário 5 (C4): link de pagamento sem pagamento ──────────────────────────
export async function rodarLinkPagamentoSemPagamento(agora: Date = new Date()): Promise<ResultadoCronComercial> {
  return processarCadencia(CHAVE_LINK_PAGAMENTO, async (_politica, numeroId) => {
    const conversas = await prisma.conversaWhatsApp.findMany({
      where: {
        numeroId,
        contato: {
          optOutEm: null,
          lead: {
            etapa: { not: EtapaLead.PERDIDO },
            matricula: {
              status: "AGUARDANDO",
              cobrancas: { some: { tipo: "MATRICULA", status: "PENDENTE", linkEnviadoEm: { not: null } } },
            },
          },
        },
      },
      include: {
        contato: {
          include: {
            lead: {
              include: {
                pais: true,
                matricula: {
                  include: { cobrancas: { where: { tipo: "MATRICULA" }, select: { linkEnviadoEm: true, status: true } } },
                },
              },
            },
          },
        },
      },
    });

    return conversas.flatMap((conversa) => {
      const lead = conversa.contato.lead;
      const taxa = lead?.matricula?.cobrancas.find((c) => c.status === "PENDENTE" && c.linkEnviadoEm);
      if (!lead || !taxa?.linkEnviadoEm) return [];
      return [{
        leadId: lead.id,
        contatoId: conversa.contatoId,
        nome: lead.nome,
        idioma: lead.pais?.idioma ?? "es",
        ancoraEm: taxa.linkEnviadoEm,
        encerrada: false,
      }];
    });
  }, agora);
}

/**
 * Passos já cumpridos DESTA ocorrência (eventos `ReguaComercialEnviada
 * { chave, passo, ocorrencia }`). O filtro por `ocorrencia` é o que impede o histórico
 * eterno do lead de matar a cadência do ciclo novo (review PR #56).
 */
async function passosComerciaisFeitos(leadId: string, chave: string, ocorrencia: string): Promise<string[]> {
  const eventos = await prisma.evento.findMany({
    where: { agregadoTipo: "Lead", agregadoId: leadId, tipo: "ReguaComercialEnviada" },
    select: { payload: true },
  });
  const passos: string[] = [];
  for (const e of eventos) {
    const p = e.payload as { chave?: string; passo?: string; ocorrencia?: string } | null;
    if (!p || p.chave !== chave || typeof p.passo !== "string") continue;
    if (p.ocorrencia !== ocorrencia) continue;
    passos.push(p.passo);
  }
  return passos;
}

// ── B9 (doc 32): alerta de check-in vencido da experimental ──────────────────
//
// A recuperação de no-show (C2) SÓ começa após o check-in do professor — sem cobrar o
// check-in atrasado, o cenário nunca dispara de forma confiável. Definições do bloqueador:
//  - RESPONSÁVEL: o professor atribuído à experimental (fallback: o vendedor dono do lead);
//  - TOLERÂNCIA: ConfigComercial.checkInToleranciaMinutos após o horário da aula (default 30);
//  - CANAL: alerta nas Homes (professor vê o "check-in vencido" em vermelho; o gerente vê o
//    total pendente) + evento `ExperimentalCheckInVencido` no log (auditável/notificável).
// O evento é IDEMPOTENTE por ocorrência (1 por aula vencida) e roda no MESMO tick do cron —
// não depende de política ligada: é alerta operacional, não mensagem ao lead.

export interface ResultadoCheckInVencido {
  avaliados: number;
  alertados: number;
  jaAlertados: number;
}

export async function rodarCheckInVencido(agora: Date = new Date()): Promise<ResultadoCheckInVencido> {
  const config = await prisma.configComercial.findUnique({ where: { id: "comercial" } });
  const toleranciaMin = config?.checkInToleranciaMinutos ?? 30;
  const limite = new Date(agora.getTime() - toleranciaMin * 60_000);

  // Aula já passou (além da tolerância) e o lead segue EXPERIMENTAL_AGENDADA = o professor
  // não registrou Compareceu/Faltou. O check-in é o que move a etapa (doc 27 C2).
  const vencidos = await prisma.lead.findMany({
    where: { etapa: EtapaLead.EXPERIMENTAL_AGENDADA, dataExperimental: { not: null, lt: limite } },
    select: { id: true, dataExperimental: true, professorExperimentalId: true, vendedorDonoId: true },
  });

  const r: ResultadoCheckInVencido = { avaliados: vencidos.length, alertados: 0, jaAlertados: 0 };
  for (const lead of vencidos) {
    const ocorrencia = lead.dataExperimental!.toISOString();
    const ja = await prisma.evento.count({
      where: {
        agregadoTipo: "Lead",
        agregadoId: lead.id,
        tipo: "ExperimentalCheckInVencido",
        payload: { path: ["ocorrencia"], equals: ocorrencia },
      },
    });
    if (ja > 0) {
      r.jaAlertados += 1;
      continue;
    }
    await prisma.evento.create({
      data: {
        tipo: "ExperimentalCheckInVencido",
        agregadoTipo: "Lead",
        agregadoId: lead.id,
        autorId: null, // sistema (cron)
        payload: {
          ocorrencia,
          toleranciaMinutos: toleranciaMin,
          responsavelId: lead.professorExperimentalId ?? lead.vendedorDonoId,
        },
      },
    });
    r.alertados += 1;
  }
  return r;
}
