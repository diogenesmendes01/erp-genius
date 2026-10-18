import type { AcaoAgenteIATipo, EtapaLead } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroRegra, executarAcao, exigirSessao, type Resultado } from "../_shared";
import { ConfigAriaSchema, configPadrao, modoDaAcao, type ConfigAria } from "./config-schema";
import { situacaoAria } from "./estado";
import { capacidadesAria } from "./permissoes-tela";
import { ErroProvedorIA, escolherProvedor, type ProvedorIA, type RespostaIA } from "./provedor";
import { montarSistema, ocultarDadosPessoais, type ContextoTurno } from "./turno/contexto";
import { destinoDaAcao } from "./turno/decisao";
import { permitidos } from "./turno/executor";
import { gatilhoDeHandoff } from "./turno/gatilhos";
import { precosDoPais } from "./turno/precos";
import { ESQUEMA_SAIDA_CONVERSA, normalizarSaida, type MotivoHandoff, type SaidaModelo } from "./turno/tipos";
import { valoresNaoAutorizados } from "./turno/valores";
import { buscarTrechos } from "./conhecimento/busca";
import { estadoOrcamento, registrarChamadaIA } from "./uso";

// Playground (Task 28): roda a Aria contra uma conversa digitada, sem efeito. Não cria turno, ação,
// intenção, mensagem nem Evento; a única escrita é o registro da chamada ao provedor (origem
// PLAYGROUND), que entra no orçamento do mês.

const MAX_MENSAGENS = 30;
const MAX_TEXTO = 2000;
const MAX_TOKENS_CONVERSA = 1024;

export type DestinoPlayground = "Executaria" | "Pediria aprovação" | "Sem permissão";

export interface EntradaPlayground {
  mensagens: { papel: "usuario" | "assistente"; texto: string }[];
  etapa: EtapaLead;
  usarRascunho: boolean;
  paisId?: string;
}

export interface ResultadoPlayground {
  resposta: string | null;
  confianca: number;
  handoff: MotivoHandoff | null;
  acoes: { acao: AcaoAgenteIATipo; destino: DestinoPlayground }[];
  fontes: SaidaModelo["fontes"];
  bloqueio: string | null;
}

const DESTINO: Record<ReturnType<typeof destinoDaAcao>, DestinoPlayground> = {
  EXECUTAR: "Executaria",
  SUGERIR: "Pediria aprovação",
  NEGAR: "Sem permissão",
};

async function configEscolhida(usarRascunho: boolean): Promise<ConfigAria> {
  if (usarRascunho) {
    const r = await prisma.versaoAgenteIA.findFirst({ where: { status: "RASCUNHO" } });
    if (r) return ConfigAriaSchema.parse(r.config);
  }
  return (await situacaoAria()).versao?.config ?? configPadrao();
}

export async function testarAria(i: EntradaPlayground): Promise<Resultado<ResultadoPlayground>> {
  return executarAcao(async () => {
    const u = await exigirSessao();
    if (!capacidadesAria(u).has("ver")) throw new ErroRegra("Sem acesso à Aria.");

    const mensagens = i.mensagens
      .map((m) => ({ papel: m.papel, texto: ocultarDadosPessoais(m.texto).trim() }))
      .filter((m) => m.texto);
    if (mensagens.length === 0 || mensagens.length > MAX_MENSAGENS) {
      throw new ErroRegra(`Informe de 1 a ${MAX_MENSAGENS} mensagens.`);
    }
    if (mensagens.some((m) => m.texto.length > MAX_TEXTO)) throw new ErroRegra(`Cada mensagem aceita até ${MAX_TEXTO} caracteres.`);
    if (mensagens[mensagens.length - 1].papel !== "usuario") throw new ErroRegra("A última mensagem deve ser do cliente.");
    const ultimaFala = mensagens[mensagens.length - 1].texto;

    const orcamento = await estadoOrcamento();
    if (orcamento.situacao === "ESTOURADO") throw new ErroRegra("Orçamento do mês atingido");

    const [config, sit, cfgIA] = await Promise.all([
      configEscolhida(i.usarRascunho),
      situacaoAria(),
      prisma.configIA.upsert({ where: { id: "ia" }, create: { id: "ia" }, update: {} }),
    ]);

    const pais = i.paisId
      ? await prisma.pais.findUnique({ where: { id: i.paisId }, select: { id: true } })
      : await prisma.pais.findFirst({ where: { status: "ATIVO" }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }], select: { id: true } });
    if (i.paisId && !pais) throw new ErroRegra("País não encontrado.");

    const ctx: ContextoTurno = {
      atendimentoId: "playground",
      conversaId: "playground",
      numeroId: "playground",
      contatoId: "playground",
      oportunidade: { id: "playground", nome: "Contato de teste", etapa: i.etapa, vendedorDonoId: null, valorPrevisto: null, paisId: pais?.id ?? null },
      mensagens: mensagens.map((m) => ({ direcao: m.papel === "usuario" ? ("ENTRADA" as const) : ("SAIDA" as const), texto: m.texto, origem: null, quando: new Date() })),
      precos: await precosDoPais(pais?.id ?? null),
      trechos: (await buscarTrechos(ultimaFala, config.fontesAtivas)).map((t) => ({ id: t.id, texto: t.texto })),
      faq: config.faq.filter((f) => f.ativa),
      respostasRapidas: [],
      primeiraDaAria: !mensagens.some((m) => m.papel === "assistente"),
      trocasSemAvanco: 0,
    };

    const provedor: ProvedorIA = escolherProvedor({ conversa: cfgIA.modeloConversa, classificacao: cfgIA.modeloClassificacao });
    let resposta: RespostaIA | null = null;
    let falha: string | null = null;
    const inicio = Date.now();
    try {
      resposta = await provedor.gerar({
        tarefa: "conversa",
        sistema: montarSistema(config, ctx),
        mensagens,
        maxTokens: MAX_TOKENS_CONVERSA,
        esquemaSaida: ESQUEMA_SAIDA_CONVERSA,
      });
      await registrarChamadaIA("PLAYGROUND", resposta);
    } catch (e) {
      falha = e instanceof ErroProvedorIA ? e.codigo : "DESCONHECIDO";
      await registrarChamadaIA("PLAYGROUND", {
        erro: falha,
        modelo: provedor.nome === "simulado" ? "simulado" : cfgIA.modeloConversa,
        latenciaMs: Date.now() - inicio,
      });
    }

    const recusa = resposta?.recusa ?? false;
    const saida = resposta && !recusa ? normalizarSaida(resposta.texto) : null;
    const handoff = gatilhoDeHandoff({
      saida,
      recusa,
      ultimaFala,
      etapa: i.etapa,
      valorPrevisto: null,
      trocasSemAvanco: 0,
      config,
    });
    if (!saida) {
      return {
        resposta: null,
        confianca: 0,
        handoff,
        acoes: [],
        fontes: [],
        bloqueio: falha ? `Falha do provedor: ${falha}` : recusa ? "O modelo recusou responder." : "Resposta do modelo inválida.",
      };
    }

    const acoes = saida.acoes.map((a) => ({
      acao: a.acao,
      destino: DESTINO[
        destinoDaAcao({
          modo: modoDaAcao(config, i.etapa, a.acao),
          confianca: saida.confianca,
          config,
          supervisao: sit.supervisao,
          soSugerir: false,
        })
      ],
    }));
    const texto = saida.resposta?.trim() || null;
    const fora = texto ? valoresNaoAutorizados(texto, permitidos(ctx, config.politicas)) : [];
    return {
      resposta: texto,
      confianca: saida.confianca,
      handoff,
      acoes,
      fontes: saida.fontes,
      bloqueio: fora.length ? `Valor não autorizado na resposta: ${fora.join(", ")}` : null,
    };
  });
}
