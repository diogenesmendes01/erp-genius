import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
// A consulta chamada numa transação não pode pedir o cliente global (pool1 real).
vi.hoisted(() => {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "3");
  process.env.DATABASE_URL = url.toString();
  (globalThis as { prisma?: unknown }).prisma = undefined;
});
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { pessoaDoAtendimento, carregarCabecalhoPainel, carregarDetalhesPainel } from "./painel-detalhes";
import { carregarPainel } from "./paineis";
import { capacidadesCrm } from "@/server/crm/permissoes";

type U = Awaited<ReturnType<typeof criarUsuario>>;
let seq = 0;
beforeEach(truncarBanco);
afterAll(() => prisma.$disconnect());
async function cenario() {
  const dono = await criarUsuario([Papel.VENDEDOR]);
  const pessoa = await prisma.pessoa.create({ data: { nome: "Principal fictícia", email: "principal@example.test", cargo: "Diretora" } });
  const op = await prisma.oportunidade.create({ data: { nome: "Curso fictício", vendedorDonoId: dono.id, pessoaId: pessoa.id, etapa: "PROPOSTA", valorPrevisto: 650, planoPrevisto: "Intensivo" } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+550000000" + (++seq), pessoaId: pessoa.id } });
  const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+550000001" + seq, rotulo: "Linha fictícia", driver: "MOTOR", finalidade: "VENDAS", donoId: dono.id } });
  const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: contato.id } });
  const a = await prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: "COMERCIAL::" + seq, finalidade: "COMERCIAL", leadId: op.id } });
  return { dono, pessoa, op, contato, numero, a };
}
async function convidar(a: string, dono: U, convidado: U) {
  return prisma.participanteAtendimentoWhatsApp.create({ data: { atendimentoId: a, usuarioId: convidado.id, concedenteId: dono.id, inicio: new Date(Date.now() - 60_000), fim: new Date(Date.now() + 3_600_000), motivo: "Leitura fictícia" } });
}

describe("consultas autorizadas da ficha por atendimento", () => {
  it("carteira: DTO mínimo, valor decimal e moeda do país; cabeçalho e agregado usam a mesma pessoa", async () => {
    const c = await cenario(), cat = await seedCatalogoMinimo();
    await prisma.oportunidade.update({ where: { id: c.op.id }, data: { paisId: cat.pais.id } });
    const d = await carregarDetalhesPainel(c.dono, c.a.id);
    expect(d).toEqual({ pessoa: { id: c.pessoa.id, nome: c.pessoa.nome, email: "principal@example.test", cidade: null, cargo: "Diretora", linkedin: null, origemCanal: null, telefone: c.contato.telefoneE164, empresa: null }, oportunidade: { id: c.op.id, titulo: "Curso fictício", produto: "Intensivo", valor: "650.00", moeda: "CRC", etapa: "PROPOSTA", b2b: false }, b2b: null, campos: [] });
    expect(await carregarCabecalhoPainel(c.dono, c.a.id)).toMatchObject({ pessoaId: c.pessoa.id, subtitulo: "Pessoa física · Intensivo", quadrado: false, semNome: false, capacidades: { veLead: true } });
    expect(await carregarPainel(c.dono, c.a.id)).toMatchObject({ pessoaId: c.pessoa.id, cabecalho: { pessoaId: c.pessoa.id } });
  });
  it("linha alheia autoriza conversa mas não lead nem fallback pelo contato; fora do escopo é null", async () => {
    const c = await cenario(), linha = await criarUsuario([Papel.VENDEDOR]), fora = await criarUsuario([Papel.VENDEDOR]);
    await prisma.numeroWhatsApp.update({ where: { id: c.numero.id }, data: { donoId: linha.id } });
    expect(await carregarDetalhesPainel(linha, c.a.id)).toEqual({ pessoa: null, oportunidade: null, b2b: null, campos: [] });
    expect(await carregarCabecalhoPainel(linha, c.a.id)).toMatchObject({ pessoaId: null, tagsDisponiveis: [], capacidades: { veLead: false } });
    expect(await pessoaDoAtendimento(linha, c.a.id)).toBeNull();
    expect(await carregarDetalhesPainel(fora, c.a.id)).toBeNull();
    expect(await carregarCabecalhoPainel(fora, c.a.id)).toBeNull();
  });
  it("lead sem pessoa ou responsável legal não usa pessoa do contato", async () => {
    const c = await cenario();
    await prisma.oportunidade.update({ where: { id: c.op.id }, data: { pessoaId: null } });
    expect(await pessoaDoAtendimento(c.dono, c.a.id)).toBeNull();
    expect(await carregarDetalhesPainel(c.dono, c.a.id)).toMatchObject({ pessoa: null, oportunidade: { id: c.op.id, moeda: null }, campos: [] });
    await prisma.oportunidade.update({ where: { id: c.op.id }, data: { pessoaId: c.pessoa.id } });
    await prisma.responsavel.create({ data: { nome: "Responsável fictícia", pessoaId: c.pessoa.id } });
    expect(await pessoaDoAtendimento(c.dono, c.a.id)).toBeNull();
    expect(await carregarDetalhesPainel(c.dono, c.a.id)).toMatchObject({ pessoa: null, oportunidade: { id: c.op.id }, campos: [] });
  });
  it.each(["sem pessoa", "responsável legal"] as const)("catálogo de tags exige identidade autorizada: %s, mesmo com editarTags", async caso => {
    const c = await cenario();
    const tag = await prisma.tag.create({ data: { nome: "Catálogo ativo fictício", cor: "NEUTRA" } });
    expect(await prisma.tag.count({ where: { id: tag.id, ativo: true } })).toBe(1);
    if (caso === "sem pessoa") await prisma.oportunidade.update({ where: { id: c.op.id }, data: { pessoaId: null } });
    else await prisma.responsavel.create({ data: { nome: "Responsável fictícia", pessoaId: c.pessoa.id } });
    const cabecalho = await carregarCabecalhoPainel(c.dono, c.a.id);
    expect(cabecalho).toMatchObject({ pessoaId: null, capacidades: { veLead: true, editarTags: true } });
    expect(cabecalho?.tagsDisponiveis).toEqual([]);
  });
  it("sem lead: fallback somente à pessoa do contato dentro do escopo, não por telefone", async () => {
    const c = await cenario();
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { leadId: null } });
    expect(await pessoaDoAtendimento(c.dono, c.a.id)).toEqual({ pessoaId: c.pessoa.id, leadId: null });
    expect(await carregarPainel(c.dono, c.a.id)).toMatchObject({ pessoaId: c.pessoa.id, cabecalho: { pessoaId: c.pessoa.id } });
    await prisma.contatoWhatsApp.update({ where: { id: c.contato.id }, data: { pessoaId: null } });
    expect(await pessoaDoAtendimento(c.dono, c.a.id)).toBeNull();
    await prisma.contatoWhatsApp.update({ where: { id: c.contato.id }, data: { pessoaId: c.pessoa.id } });
    await prisma.oportunidade.update({ where: { id: c.op.id }, data: { vendedorDonoId: (await criarUsuario([Papel.VENDEDOR])).id } });
    expect(await pessoaDoAtendimento(c.dono, c.a.id)).toBeNull();
    await prisma.oportunidade.update({ where: { id: c.op.id }, data: { vendedorDonoId: c.dono.id } });
    const destino = await prisma.pessoa.create({ data: { nome: "Destino fictício" } });
    await prisma.pessoa.update({ where: { id: c.pessoa.id }, data: { mescladaEmId: destino.id } });
    expect(await pessoaDoAtendimento(c.dono, c.a.id)).toBeNull();
    await prisma.pessoa.update({ where: { id: c.pessoa.id }, data: { mescladaEmId: null } });
    await prisma.responsavel.create({ data: { nome: "Responsável fictícia", pessoaId: c.pessoa.id } });
    expect(await pessoaDoAtendimento(c.dono, c.a.id)).toBeNull();
  });
  it("B2B: ficha principal difere do interlocutor efetivo, empresa contextual não amplia capacidade global", async () => {
    const c = await cenario();
    const empresa = await prisma.empresa.create({ data: { nome: "Empresa fictícia", documento: "FICTICIO", site: "https://example.test" } });
    const interlocutor = await prisma.pessoa.create({ data: { nome: "Interlocutor fictício", cargo: "RH" } });
    await prisma.oportunidade.update({ where: { id: c.op.id }, data: { b2b: true, empresaId: empresa.id } });
    await prisma.pessoa.update({ where: { id: c.pessoa.id }, data: { empresaId: empresa.id } });
    await prisma.participanteOportunidade.createMany({ data: [{ oportunidadeId: c.op.id, pessoaId: c.pessoa.id, papel: "INFLUENCIADOR" }, { oportunidadeId: c.op.id, pessoaId: interlocutor.id, papel: "DECISOR" }] });
    await prisma.contatoWhatsApp.update({ where: { id: c.contato.id }, data: { pessoaId: interlocutor.id } });
    const d = await carregarDetalhesPainel(c.dono, c.a.id);
    expect(d?.pessoa).toMatchObject({ id: c.pessoa.id, empresa: { id: empresa.id, nome: empresa.nome } });
    expect(d?.b2b).toMatchObject({ empresa: { id: empresa.id }, decisor: true });
    expect(d?.b2b?.participantes.find(p => p.pessoaId === interlocutor.id)).toEqual({ pessoaId: interlocutor.id, nome: interlocutor.nome, papel: "DECISOR", cargo: "RH", naConversa: true, hrefConversa: null });
    expect(d?.b2b?.participantes.find(p => p.pessoaId === c.pessoa.id)?.naConversa).toBe(false);
    expect(await carregarCabecalhoPainel(c.dono, c.a.id)).toMatchObject({ pessoaId: c.pessoa.id, quadrado: true, subtitulo: "Falando com Interlocutor fictício · Decisor", capacidades: { verEmpresa: false } });
    await prisma.contatoWhatsApp.update({ where: { id: c.contato.id }, data: { pessoaId: null } });
    expect((await carregarDetalhesPainel(c.dono, c.a.id))?.b2b).toMatchObject({ decisor: null });
    expect((await carregarDetalhesPainel(c.dono, c.a.id))?.b2b?.participantes.every(p => !p.naConversa)).toBe(true);
  });
  it("B2B sem empresa mantém quadrado, bloco null e subtítulo sem dado inventado", async () => {
    const c = await cenario();
    await prisma.oportunidade.update({ where: { id: c.op.id }, data: { b2b: true } });
    await prisma.pessoa.update({ where: { id: c.pessoa.id }, data: { cargo: null } });
    expect((await carregarDetalhesPainel(c.dono, c.a.id))?.b2b).toBeNull();
    expect(await carregarCabecalhoPainel(c.dono, c.a.id)).toMatchObject({ quadrado: true, subtitulo: "" });
  });
  it("semNome segue fonte real com trim, incluindo lead sem Pessoa", async () => {
    const c = await cenario();
    expect((await carregarCabecalhoPainel(c.dono, c.a.id))?.semNome).toBe(false);
    await prisma.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { leadId: null } });
    expect((await carregarCabecalhoPainel(c.dono, c.a.id))?.semNome).toBe(true);
    await prisma.contatoWhatsApp.update({ where: { id: c.contato.id }, data: { nomeExibicao: "  ", nomePerfil: "  " } });
    expect((await carregarCabecalhoPainel(c.dono, c.a.id))?.semNome).toBe(true);
    await prisma.contatoWhatsApp.update({ where: { id: c.contato.id }, data: { nomePerfil: " Perfil fictício " } });
    expect((await carregarCabecalhoPainel(c.dono, c.a.id))?.semNome).toBe(false);
  });
  it("D13 filtra pela finalidade mesmo em multirrole e não retorna telefone", async () => {
    const c = await cenario(), admin = await criarUsuario([Papel.ADMINISTRADOR, Papel.VENDEDOR]);
    const cat = await seedCatalogoMinimo();
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno fictício", paisId: cat.pais.id, telefoneE164: "+550000002" + seq, whatsapp: true } });
    const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC" } });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+550000002" + seq, alunoId: aluno.id } });
    const conversa = await prisma.conversaWhatsApp.create({ data: { numeroId: c.numero.id, contatoId: contato.id } });
    for (const finalidade of ["PEDAGOGICO", "SECRETARIA", "FINANCEIRO"] as const) {
      const a = await prisma.atendimentoWhatsApp.create({ data: { conversaId: conversa.id, contextoChave: finalidade + "::323", finalidade, leadId: c.op.id, alunoId: aluno.id, matriculaId: matricula.id } });
      expect(await carregarDetalhesPainel(admin, a.id)).toEqual({ pessoa: null, oportunidade: null, b2b: null, campos: [] });
      expect(await carregarCabecalhoPainel(admin, a.id)).toMatchObject({ pessoaId: null, subtitulo: null, quadrado: false, tagsDisponiveis: [], capacidades: { editarTags: false } });
    }
  });
  it("campos: último evento por pessoa/campo e desempate id, sem dados de empresa/payload no DTO", async () => {
    const c = await cenario();
    const campos = await Promise.all(["IA", "Humano", "Sem evento"].map((nome, i) => prisma.campoPersonalizado.create({ data: { nome, tipo: "TEXTO", alvo: "PESSOA", criadoEm: new Date(Date.UTC(2026, 9, 22, 12, i)) } })));
    await prisma.campoPersonalizado.create({ data: { nome: "Privado empresa", tipo: "TEXTO", alvo: "EMPRESA" } });
    await prisma.valorCampoPersonalizado.create({ data: { campoId: campos[0].id, pessoaId: c.pessoa.id, valor: "Valor fictício" } });
    const data = new Date("2026-10-22T12:00:00Z");
    const eventos = [
      { id: "a-ia", campo: campos[0].id, autorId: c.dono.id }, { id: "z-ia", campo: campos[0].id, autorId: null },
      { id: "a-humano", campo: campos[1].id, autorId: null }, { id: "z-humano", campo: campos[1].id, autorId: c.dono.id },
    ];
    for (const e of eventos) await prisma.evento.create({ data: { id: e.id, tipo: "CampoPersonalizadoAlterado", agregadoTipo: "Pessoa", agregadoId: c.pessoa.id, autorId: e.autorId, criadoEm: data, payload: { campoId: e.campo, de: "segredo", para: "segredo", acaoId: "privada" } } });
    await prisma.evento.create({ data: { tipo: "CampoPersonalizadoAlterado", agregadoTipo: "Pessoa", agregadoId: "outra-pessoa", payload: { campoId: campos[1].id }, criadoEm: new Date("2030-01-01") } });
    const d = await carregarDetalhesPainel(c.dono, c.a.id);
    expect(d?.campos.find(x => x.id === campos[0].id)?.valor).toBe("Valor fictício");
    expect(d?.campos.map(x => [x.nome, x.ia])).toEqual([["IA", true], ["Humano", false], ["Sem evento", false]]);
    expect(JSON.stringify(d)).not.toMatch(/segredo|acaoId|Privado empresa/);
    await prisma.evento.create({ data: { tipo: "CampoPersonalizadoAlterado", agregadoTipo: "Pessoa", agregadoId: c.pessoa.id, autorId: c.dono.id, criadoEm: new Date("2031-01-01"), payload: { campoId: campos[0].id, de: "segredo", para: "novo segredo" } } });
    for (const payload of [{ campoId: 123 }, { campoId: null }, { campoId: [campos[0].id] }]) await prisma.evento.create({ data: { tipo: "CampoPersonalizadoAlterado", agregadoTipo: "Pessoa", agregadoId: c.pessoa.id, criadoEm: new Date("2032-01-01"), payload } });
    expect((await carregarDetalhesPainel(c.dono, c.a.id))?.campos.find(x => x.id === campos[0].id)?.ia).toBe(false);
  });
  it("tags disponíveis só ativas e edição autorizada; vínculos históricos E1 preservados", async () => {
    const c = await cenario();
    const tag = await prisma.tag.create({ data: { nome: "Ativa", cor: "NEUTRA" } });
    const inativa = await prisma.tag.create({ data: { nome: "Histórica", cor: "NEUTRA", ativo: false } });
    await prisma.pessoaTag.create({ data: { pessoaId: c.pessoa.id, tagId: inativa.id } });
    expect((await carregarCabecalhoPainel(c.dono, c.a.id))?.tagsDisponiveis).toEqual([{ id: tag.id, nome: tag.nome }]);
    expect((await carregarPainel(c.dono, c.a.id))?.tags).toEqual([{ rotulo: "Histórica", ia: true }]);
  });
  it.each([Papel.FINANCEIRO, Papel.PROFESSOR, Papel.GERENTE_PEDAGOGICO])("D13 aprovado: %s convidado comercial recebe Pessoa/empresa/B2B sem contatos.ver; ausência, revogação, expiração e outro setor não ampliam acesso", async papel => {
    const c = await cenario(), convidado = await criarUsuario([papel]);
    expect(capacidadesCrm(convidado.papeis).has("contatos.ver")).toBe(false);
    const empresa = await prisma.empresa.create({ data: { nome: "Empresa autorizada fictícia409", documento: "DOC-FICTICIO-409", segmentoMercado: "Educação fictícia", porte: "Pequena fictícia", site: "https://empresa.example.test" } });
    const pessoa = await prisma.pessoa.update({ where: { id: c.pessoa.id }, data: { email: "pessoa409@example.test", cidade: "Cidade fictícia", cargo: "Diretora fictícia", linkedin: "https://linkedin.example.test/pessoa409", origemCanal: "WHATSAPP", empresaId: empresa.id } });
    const interlocutor = await prisma.pessoa.create({ data: { nome: "Interlocutor autorizado fictício409", cargo: "RH fictício" } });
    await prisma.oportunidade.update({ where: { id: c.op.id }, data: { b2b: true, empresaId: empresa.id } });
    await prisma.contatoWhatsApp.update({ where: { id: c.contato.id }, data: { pessoaId: interlocutor.id } });
    await prisma.participanteOportunidade.createMany({ data: [{ oportunidadeId: c.op.id, pessoaId: pessoa.id, papel: "INFLUENCIADOR" }, { oportunidadeId: c.op.id, pessoaId: interlocutor.id, papel: "DECISOR" }] });
    const campo = await prisma.campoPersonalizado.create({ data: { nome: "Campo CRM fictício409", tipo: "TEXTO", alvo: "PESSOA" } });
    await prisma.valorCampoPersonalizado.create({ data: { campoId: campo.id, pessoaId: pessoa.id, valor: "Valor privado CRM fictício409" } });
    const tag = await prisma.tag.create({ data: { nome: "Catálogo ativo fictício409", cor: "NEUTRA" } });
    expect((await carregarDetalhesPainel(c.dono, c.a.id))?.campos).toHaveLength(1);
    expect((await carregarCabecalhoPainel(c.dono, c.a.id))?.tagsDisponiveis).toEqual([{ id: tag.id, nome: tag.nome }]);
    const negar = async () => {
      expect(await carregarDetalhesPainel(convidado, c.a.id)).toBeNull();
      expect(await carregarCabecalhoPainel(convidado, c.a.id)).toBeNull();
      expect(await pessoaDoAtendimento(convidado, c.a.id)).toBeNull();
    };
    await negar(); // Sem convite: a fixture contém PII, mas o papel não alcança este atendimento comercial.
    const convite = await convidar(c.a.id, c.dono, convidado);
    const detalhes = await carregarDetalhesPainel(convidado, c.a.id);
    expect(detalhes?.pessoa).toEqual({ id: pessoa.id, nome: pessoa.nome, email: pessoa.email, cidade: pessoa.cidade, cargo: pessoa.cargo, linkedin: pessoa.linkedin, origemCanal: "WHATSAPP", telefone: c.contato.telefoneE164,
      empresa: { id: empresa.id, nome: empresa.nome, documento: empresa.documento, segmentoMercado: empresa.segmentoMercado, porte: empresa.porte, site: empresa.site } });
    expect(detalhes?.oportunidade).toMatchObject({ id: c.op.id, b2b: true });
    expect(detalhes?.b2b).toEqual({ empresa: { id: empresa.id, nome: empresa.nome }, decisor: true, participantes: expect.arrayContaining([
      { pessoaId: pessoa.id, nome: pessoa.nome, papel: "INFLUENCIADOR", cargo: pessoa.cargo, naConversa: false, hrefConversa: null },
      { pessoaId: interlocutor.id, nome: interlocutor.nome, papel: "DECISOR", cargo: interlocutor.cargo, naConversa: true, hrefConversa: null },
    ]) });
    expect(detalhes?.b2b?.participantes).toHaveLength(2);
    expect(detalhes?.campos).toEqual([]); // A exceção contextual não libera os campos personalizados do CRM.
    expect(await carregarCabecalhoPainel(convidado, c.a.id)).toMatchObject({ pessoaId: pessoa.id, subtitulo: "Falando com Interlocutor autorizado fictício409 · Decisor", tagsDisponiveis: [], capacidades: { veLead: true, verContato: false, editarContato: false, editarTags: false } });
    await prisma.participanteAtendimentoWhatsApp.update({ where: { id: convite.id }, data: { revogadoEm: new Date() } });
    await negar();
    await prisma.participanteAtendimentoWhatsApp.update({ where: { id: convite.id }, data: { revogadoEm: null, inicio: new Date(Date.now() - 120_000), fim: new Date(Date.now() - 60_000) } });
    await negar();
    const cat = await seedCatalogoMinimo();
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno setorial fictício409", paisId: cat.pais.id, telefoneE164: "+550000004" + seq, whatsapp: true } });
    const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC" } });
    const contatoAluno = await prisma.contatoWhatsApp.create({ data: { telefoneE164: aluno.telefoneE164!, alunoId: aluno.id } });
    const conversaAluno = await prisma.conversaWhatsApp.create({ data: { numeroId: c.numero.id, contatoId: contatoAluno.id } });
    for (const finalidade of ["PEDAGOGICO", "SECRETARIA", "FINANCEIRO"] as const) {
      const setorial = await prisma.atendimentoWhatsApp.create({ data: { conversaId: conversaAluno.id, contextoChave: finalidade + "::409", finalidade, leadId: c.op.id, alunoId: aluno.id, matriculaId: matricula.id } });
      await convidar(setorial.id, c.dono, convidado);
      expect(await carregarDetalhesPainel(convidado, setorial.id)).toEqual({ pessoa: null, oportunidade: null, b2b: null, campos: [] });
      expect(await carregarCabecalhoPainel(convidado, setorial.id)).toMatchObject({ pessoaId: null, subtitulo: null, tagsDisponiveis: [] });
    }
  });
  it("pool1: autorização carteira/cobertura/equipe/convite na MESMA tx e revogação imediata", async () => {
    const c = await cenario();
    const gc = await criarUsuario([Papel.GERENTE_COMERCIAL]);
    await prisma.usuario.update({ where: { id: c.dono.id }, data: { gerenteComercialId: gc.id } });
    const convidado = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
    const convite = await convidar(c.a.id, c.dono, convidado);
    const substituto = await criarUsuario([Papel.VENDEDOR]);
    const cobertura = await prisma.coberturaCarteira.create({ data: { titularId: c.dono.id, substitutoId: substituto.id, concedenteId: gc.id, inicio: new Date(Date.now() - 60_000), fim: new Date(Date.now() + 3_600_000), motivo: "Cobertura fictícia" } });
    for (const u of [c.dono, gc, convidado, substituto]) expect(await prisma.$transaction(tx => pessoaDoAtendimento(u, c.a.id, tx))).toEqual({ pessoaId: c.pessoa.id, leadId: c.op.id });
    await prisma.$transaction(async tx => {
      await tx.coberturaCarteira.update({ where: { id: cobertura.id }, data: { revogadaEm: new Date() } });
      expect(await pessoaDoAtendimento(substituto, c.a.id, tx)).toBeNull();
      await tx.participanteAtendimentoWhatsApp.update({ where: { id: convite.id }, data: { revogadoEm: new Date() } });
      expect(await pessoaDoAtendimento(convidado, c.a.id, tx)).toBeNull();
      await tx.atendimentoWhatsApp.update({ where: { id: c.a.id }, data: { leadId: null } });
      expect(await pessoaDoAtendimento(c.dono, c.a.id, tx)).toEqual({ pessoaId: c.pessoa.id, leadId: null });
    });
  });
});
