import { describe, it, expect, beforeAll } from "vitest";
import { EtapaLead, OrigemCanal, Papel, Temperatura } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo, configurarFusoDaEscola } from "@/test/integracao";
import { carregarCarteiraLegado, carregarFunilLegado } from "@/test/legado-funil-carteira";
import { TIPOS_MUDAM_ETAPA } from "@/server/comercial/schema";
import { carregarFunil, lerFiltrosFunil, CARTOES_POR_COLUNA, type FiltrosFunil } from "./funil";
import { carregarCarteira, EVENTOS_DE_CONTATO_SEM_INTERACAO, type FiltrosCarteira } from "./carteira";

// B19 (#196 C3, #198 C2): o funil e a carteira passaram a ordenar, filtrar e cortar no banco. Esta suíte monta
// uma base de ~200 oportunidades (etapas, donos, datas e empates variados) e confere, filtro a filtro, que o
// resultado novo é IGUAL ao da implementação anterior em memória (copiada em src/test/legado-funil-carteira.ts),
// inclusive a ordem e os cortes. Também trava o escopo de visibilidade de cada papel.

type U = Awaited<ReturnType<typeof criarUsuario>>;
const sessaoDe = (u: { id: string; nome: string; papeis: Papel[] }) => ({ id: u.id, nome: u.nome, papeis: u.papeis });

// PRNG determinístico: a mesma base em toda execução.
function gerador(semente: number) {
  let s = semente >>> 0;
  const prox = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const de = <T,>(xs: readonly T[]): T => xs[Math.floor(prox() * xs.length)];
  return { prox, de, int: (a: number, b: number) => a + Math.floor(prox() * (b - a + 1)) };
}

const DIA = 86_400_000;
const HORA = 3_600_000;
let admin: U, g1: U, g2: U, v1: U, v2: U, v3: U, v4: U, financeiro: U;
let tagIds: string[] = [];

async function montarBase() {
  await truncarBanco();
  await configurarFusoDaEscola("America/Sao_Paulo");
  const r = gerador(19);
  // Instante fixo da semeadura; os horários ficam longe dos cortes de 30/90 dias e da virada do dia.
  const agora = Date.now();
  const antes = (dias: number, horas = 0) => new Date(agora - dias * DIA - horas * HORA - 17 * 60_000);

  admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  g1 = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente 1");
  g2 = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente 2");
  v1 = await criarUsuario([Papel.VENDEDOR], "V1");
  v2 = await criarUsuario([Papel.VENDEDOR], "V2");
  v3 = await criarUsuario([Papel.VENDEDOR], "V3");
  v4 = await criarUsuario([Papel.VENDEDOR], "V4");
  financeiro = await criarUsuario([Papel.FINANCEIRO], "Financeiro");
  await prisma.usuario.updateMany({ where: { id: { in: [v1.id, v2.id] } }, data: { gerenteComercialId: g1.id } });
  await prisma.usuario.update({ where: { id: v3.id }, data: { gerenteComercialId: g2.id } });
  // V3 cobre V1 agora; a cobertura de V2 por V4 já venceu.
  await prisma.coberturaCarteira.create({
    data: { titularId: v1.id, substitutoId: v3.id, inicio: new Date(agora - DIA), fim: new Date(agora + 10 * DIA), motivo: "Férias de V1", concedenteId: g1.id },
  });
  await prisma.coberturaCarteira.create({
    data: { titularId: v2.id, substitutoId: v4.id, inicio: new Date(agora - 20 * DIA), fim: new Date(agora - 10 * DIA), motivo: "Férias de V2", concedenteId: g1.id },
  });

  const cat = await seedCatalogoMinimo();
  const br = await prisma.pais.create({ data: { nome: "Brasil", codigoISO: "BR", moedaLocal: "BRL", ddi: "+55" } });
  const us = await prisma.pais.create({ data: { nome: "Estados Unidos", codigoISO: "US", moedaLocal: "USD", ddi: "+1" } });
  const paises = [cat.pais.id, br.id, us.id, null];
  tagIds = [];
  for (const [nome, cor] of [["VIP", "MARCA"], ["Indicação", "SUCESSO"], ["Frio", "NEUTRA"]] as const) {
    tagIds.push((await prisma.tag.create({ data: { nome, cor } })).id);
  }
  const pessoas: string[] = [];
  for (let i = 0; i < 40; i += 1) {
    const p = await prisma.pessoa.create({ data: { nome: `Pessoa ${i}` } });
    for (const t of tagIds) if (r.prox() < 0.35) await prisma.pessoaTag.create({ data: { pessoaId: p.id, tagId: t } });
    pessoas.push(p.id);
  }

  const donos = [v1.id, v2.id, v3.id, v4.id, null];
  const etapas: EtapaLead[] = [
    ...Array<EtapaLead>(14).fill(EtapaLead.NOVO),
    EtapaLead.EM_ATENDIMENTO, EtapaLead.EM_ATENDIMENTO, EtapaLead.QUALIFICADO, EtapaLead.EXPERIMENTAL_AGENDADA,
    EtapaLead.EXPERIMENTAL_REALIZADA, EtapaLead.NO_SHOW, EtapaLead.PROPOSTA, EtapaLead.AGUARDANDO_MATRICULA,
    EtapaLead.MATRICULADO, EtapaLead.MATRICULADO, EtapaLead.PERDIDO, EtapaLead.PERDIDO, EtapaLead.PERDIDO,
  ];
  const nomes = ["Ana Silva", "Bruno Costa", "Carla Souza", "Diego Lima", "Ana Paula", "Eva_Lima", "Fábio Silva", "Gabi 50%"];
  const valores = [null, null, "100.00", "250.50", "250.50", "1000.00", "85000.00"];
  // Poucos instantes distintos de criação: muitos empates, para travar o desempate por id.
  const criacoes = Array.from({ length: 12 }, (_, i) => antes(i * 11, i % 5));
  const followUps = [null, null, antes(-3), antes(-3), antes(2), antes(-10, 4)];
  const ids: { id: string; etapa: EtapaLead }[] = [];
  for (let i = 0; i < 200; i += 1) {
    const etapa = r.de(etapas);
    const o = await prisma.oportunidade.create({
      data: {
        nome: `${r.de(nomes)} ${i}`,
        codigo: r.prox() < 0.5 ? `L-${String(i).padStart(6, "0")}` : null,
        vendedorDonoId: r.de(donos),
        etapa,
        b2b: r.prox() < 0.2,
        temperatura: r.de(Object.values(Temperatura)),
        origemCanal: r.prox() < 0.3 ? null : r.de(Object.values(OrigemCanal)),
        paisId: r.de(paises),
        valorPrevisto: r.de(valores),
        proximoFollowUp: r.de(followUps),
        pessoaId: r.prox() < 0.6 ? r.de(pessoas) : null,
        criadoEm: r.de(criacoes),
      },
    });
    ids.push({ id: o.id, etapa });
  }

  // Eventos: mudanças de etapa, contatos reais e administrativos, com instantes repetidos entre oportunidades.
  const tipos = [...TIPOS_MUDAM_ETAPA, ...EVENTOS_DE_CONTATO_SEM_INTERACAO, "NotaInterna", "LeadAtribuido", "TagAtribuida"];
  const instantes = Array.from({ length: 15 }, (_, i) => antes(i * 9 + (i % 3), i % 7));
  const eventos = [];
  for (const { id } of ids) {
    for (let k = r.int(0, 4); k > 0; k -= 1) {
      eventos.push({ tipo: r.de(tipos), agregadoTipo: "Lead", agregadoId: id, payload: {}, criadoEm: r.de(instantes) });
    }
  }
  await prisma.evento.createMany({ data: eventos });

  // Mensagens: só entrada e saída humana entregue contam para a carteira.
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511955559001", rotulo: "Vendas", driver: "MOTOR", finalidade: "VENDAS" } });
  for (let i = 0; i < 40; i += 1) {
    const leadId = ids[i * 5].id;
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: `+5068888${String(7000 + i)}`, leadId } });
    const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
    const at = await prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: `COMERCIAL:${leadId}`, finalidade: "COMERCIAL", leadId } });
    for (let k = r.int(1, 3); k > 0; k -= 1) {
      const entrada = r.prox() < 0.4;
      await prisma.mensagemWhatsApp.create({
        data: {
          conversaId: conversa.id, atendimentoId: at.id, numeroId: numero.id, driver: "MOTOR", corpo: "oi",
          direcao: entrada ? "ENTRADA" : "SAIDA",
          status: entrada ? "LIDA" : r.de(["ENVIADA", "ENTREGUE", "LIDA", "FALHOU", "NA_FILA"] as const),
          origem: entrada ? null : r.de(["HUMANO", "CELULAR", "CRON", "IA", "LOTE", "GESTAO", null] as const),
          criadoEm: antes(r.int(0, 60), r.int(0, 20)),
        },
      });
    }
  }

  // Turmas ativas (e uma alocação encerrada) para o filtro "em turma".
  const nivel = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "A1", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { nome: "Turma Norte", modalidadeId: cat.modalidade.id, nivelId: nivel.id } });
  const abertas = ids.filter((x) => x.etapa !== EtapaLead.PERDIDO);
  for (let i = 0; i < 12; i += 1) {
    const aluno = await prisma.aluno.create({ data: { primeiroNome: `Aluno ${i}`, paisId: cat.pais.id, status: "ATIVO" } });
    const matricula = await prisma.matricula.create({
      data: { alunoId: aluno.id, leadId: abertas[i * 3].id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: new Date() },
    });
    await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId: matricula.id, turmaId: turma.id, ativa: i % 4 !== 0 } });
  }
}

beforeAll(montarBase, 120_000);

const funilBase = lerFiltrosFunil({});
const carteiraBase: FiltrosCarteira = { donoId: "", busca: "", semInteracaoDias: "", emTurma: false, tipo: "todos" };
const sessoes = () => ({ admin, g1, g2, v1, v3, v4, financeiro });

describe("funil: resultado igual ao da versão em memória", () => {
  it("a base exercita o corte de cartões por coluna", async () => {
    const novo = (await carregarFunil(sessaoDe(admin), funilBase)).find((c) => c.etapa === EtapaLead.NOVO)!;
    expect(novo.total).toBeGreaterThan(CARTOES_POR_COLUNA);
    expect(novo.possuiMais).toBe(true);
  });

  for (const ordem of ["recentes", "valor", "proxima", "tempo"] as const) {
    for (const perdidosDias of ["todos", "30", "90"] as const) {
      it(`ordem ${ordem}, perdidos ${perdidosDias}: todas as sessões`, async () => {
        const f: FiltrosFunil = { ...funilBase, ordem, perdidosDias };
        for (const [nome, u] of Object.entries(sessoes())) {
          const [novo, antigo] = [await carregarFunil(sessaoDe(u), f), await carregarFunilLegado(sessaoDe(u), f)];
          expect(novo, `${nome}`).toEqual(antigo);
        }
      });
    }
  }

  const filtros: [string, Record<string, string>][] = [
    ["tipo pf", { tipo: "pf" }],
    ["tipo b2b", { tipo: "b2b" }],
    ["dono", { donoId: "@v1" }],
    ["temperatura", { temperatura: "QUENTE" }],
    ["origem", { origem: "WHATSAPP" }],
    ["tag", { tagId: "@tag0" }],
    ["busca de duas palavras", { busca: "ana silva" }],
    ["busca por código", { busca: "L-00001" }],
    ["busca com curinga do ILIKE", { busca: "eva_lima" }],
    ["busca com %", { busca: "50%" }],
    ["combinados", { tipo: "pf", temperatura: "FRIO", busca: "a" }],
  ];
  for (const [rotulo, p] of filtros) {
    it(`filtro ${rotulo} (ordens tempo e recentes, perdidos 30)`, async () => {
      const valor = (v: string) => (v === "@v1" ? v1.id : v === "@tag0" ? tagIds[0] : v);
      const params = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, valor(v)]));
      for (const ordem of ["tempo", "recentes"]) {
        const f = lerFiltrosFunil({ ...params, ordem, perdidosDias: "30" });
        for (const u of [admin, g1, v3]) {
          expect(await carregarFunil(sessaoDe(u), f), `${rotulo} ${ordem} ${u.nome}`).toEqual(await carregarFunilLegado(sessaoDe(u), f));
        }
      }
    });
  }
});

describe("funil: escopo de visibilidade", () => {
  const donosVistos = async (u: U, f = funilBase) =>
    new Set((await carregarFunil(sessaoDe(u), f)).flatMap((c) => c.cartoes.map((x) => x.dono?.id ?? null)));

  it("vendedor vê a própria carteira e a que cobre; a cobertura vencida não conta", async () => {
    for (const ordem of ["tempo", "recentes"] as const) {
      const f = { ...funilBase, ordem, perdidosDias: "30" as const };
      expect(await donosVistos(v3, f)).toEqual(new Set([v3.id, v1.id]));
      expect(await donosVistos(v4, f)).toEqual(new Set([v4.id]));
    }
  });
  it("gerente vê só a equipe; sem papel comercial não vê nada; admin vê tudo, inclusive sem dono", async () => {
    const tempo = { ...funilBase, ordem: "tempo" as const, perdidosDias: "90" as const };
    expect(await donosVistos(g1, tempo)).toEqual(new Set([v1.id, v2.id]));
    expect((await carregarFunil(sessaoDe(financeiro), tempo)).every((c) => c.total === 0 && c.cartoes.length === 0)).toBe(true);
    expect(await donosVistos(admin, tempo)).toEqual(new Set([v1.id, v2.id, v3.id, v4.id, null]));
  });
  it("filtro de dono fora do escopo não abre a carteira alheia", async () => {
    const f = lerFiltrosFunil({ donoId: v2.id, ordem: "tempo", perdidosDias: "30" });
    expect((await carregarFunil(sessaoDe(v3), f)).every((c) => c.total === 0)).toBe(true);
    expect((await carregarFunil(sessaoDe(g2), f)).every((c) => c.total === 0)).toBe(true);
  });
});

describe("carteira: resultado igual ao da versão em memória", () => {
  const casos: [string, Partial<FiltrosCarteira>][] = [
    ["sem filtro", {}],
    ["sem interação 7", { semInteracaoDias: "7" }],
    ["sem interação 15", { semInteracaoDias: "15" }],
    ["sem interação 30", { semInteracaoDias: "30" }],
    ["em turma", { emTurma: true }],
    ["pf", { tipo: "pf" }],
    ["pj", { tipo: "pj" }],
    ["busca", { busca: "silva" }],
    ["busca com curinga", { busca: "eva_lima" }],
    ["combinados", { tipo: "pf", semInteracaoDias: "15", busca: "a" }],
  ];
  for (const [rotulo, extra] of casos) {
    it(`${rotulo}: todas as sessões`, async () => {
      const f = { ...carteiraBase, ...extra };
      for (const [nome, u] of Object.entries(sessoes())) {
        const novo = await carregarCarteira(sessaoDe(u), f);
        const antigo = await carregarCarteiraLegado(sessaoDe(u), f);
        expect({ linhas: novo.linhas, total: novo.total }, `${rotulo} ${nome}`).toEqual(antigo);
      }
    });
  }
  it("filtro de dono e corte menor que a base (mesmo corte, mesma ordem, total completo)", async () => {
    for (const limite of [1, 7, 40]) {
      for (const f of [carteiraBase, { ...carteiraBase, donoId: v1.id }, { ...carteiraBase, semInteracaoDias: "7" as const }]) {
        const novo = await carregarCarteira(sessaoDe(admin), f, limite);
        expect(novo.linhas).toHaveLength(Math.min(limite, novo.total));
        expect({ linhas: novo.linhas, total: novo.total }).toEqual(await carregarCarteiraLegado(sessaoDe(admin), f, limite));
      }
    }
  });
  it("o dia civil segue o fuso da escola (outro fuso, mesmo resultado)", async () => {
    for (const fuso of ["Asia/Tokyo", "Pacific/Honolulu"]) {
      await configurarFusoDaEscola(fuso);
      for (const semInteracaoDias of ["", "7", "30"] as const) {
        const f = { ...carteiraBase, semInteracaoDias };
        const novo = await carregarCarteira(sessaoDe(admin), f);
        expect({ linhas: novo.linhas, total: novo.total }, `${fuso} ${semInteracaoDias}`).toEqual(await carregarCarteiraLegado(sessaoDe(admin), f));
      }
    }
    await configurarFusoDaEscola("America/Sao_Paulo");
  });
});

describe("carteira: escopo de visibilidade", () => {
  const donos = async (u: U, f = carteiraBase) => new Set((await carregarCarteira(sessaoDe(u), f)).linhas.map((l) => l.dono?.id ?? null));
  it("vendedor: própria + coberta; gerente: equipe; sem papel: nada; perdidas nunca entram", async () => {
    expect(await donos(v3)).toEqual(new Set([v3.id, v1.id]));
    expect(await donos(v4)).toEqual(new Set([v4.id]));
    expect(await donos(g1)).toEqual(new Set([v1.id, v2.id]));
    expect(await carregarCarteira(sessaoDe(financeiro), carteiraBase)).toMatchObject({ linhas: [], total: 0 });
    const todas = await carregarCarteira(sessaoDe(admin), carteiraBase);
    expect(todas.linhas.some((l) => l.etapa === EtapaLead.PERDIDO)).toBe(false);
    expect(await donos(v3, { ...carteiraBase, donoId: v2.id })).toEqual(new Set());
  });
});
