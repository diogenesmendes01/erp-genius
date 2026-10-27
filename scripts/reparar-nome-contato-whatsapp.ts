import { PrismaClient } from "@prisma/client";
import { registrarEvento } from "../src/server/_shared/evento";

function argumentos(argv: string[]) {
  const nomes: string[] = [], manter: string[] = [];
  let aplicar = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--nome" && argv[i + 1]) nomes.push(argv[++i].trim());
    else if (argv[i] === "--manter" && argv[i + 1]) manter.push(argv[++i].replace(/\D/g, ""));
    else if (argv[i] === "--aplicar") aplicar = true;
    else throw new Error(`Argumento desconhecido: ${argv[i]}`);
  }
  if (!nomes.length) throw new Error('Informe ao menos um --nome "Perfil da linha".');
  return { nomes, manter, aplicar };
}

const mascarar = (t: string) => `${t.slice(0, 5)}…${t.slice(-4)}`;

async function main() {
  const { nomes, manter, aplicar } = argumentos(process.argv.slice(2));
  const igual = (v: string | null) => !!v && nomes.some((n) => n.localeCompare(v.trim(), "pt-BR", { sensitivity: "accent" }) === 0);
  const prisma = new PrismaClient();
  try {
    const linhas = new Set((await prisma.numeroWhatsApp.findMany({ select: { telefoneE164: true } })).map((n) => n.telefoneE164));
    const porNome = (campo: "nomeExibicao" | "nomePerfil") => nomes.map((nome) => ({ [campo]: { equals: nome, mode: "insensitive" as const } }));
    const candidatos = await prisma.contatoWhatsApp.findMany({
      where: { OR: [...porNome("nomeExibicao"), ...porNome("nomePerfil")], conversas: { some: { numero: { driver: "BAILEYS" } } } },
      select: { id: true, telefoneE164: true, nomeExibicao: true, nomePerfil: true, alunoId: true, responsavelId: true, leadId: true },
    });
    const mantido = (t: string) => manter.some((d) => !!d && t.replace(/\D/g, "").endsWith(d));
    const reparar = candidatos.filter((c) => !linhas.has(c.telefoneE164) && !mantido(c.telefoneE164));
    console.log(`Candidatos: ${candidatos.length} · a reparar: ${reparar.length} · modo: ${aplicar ? "APLICAR" : "somente leitura"}`);
    for (const d of manter) {
      const pegos = candidatos.filter((c) => !linhas.has(c.telefoneE164) && c.telefoneE164.replace(/\D/g, "").endsWith(d));
      console.log(`  --manter ${d}: ${pegos.length ? pegos.map((c) => mascarar(c.telefoneE164)).join(", ") : "nenhum candidato"}${pegos.length > 1 ? "  ⚠ mais de um — use mais dígitos" : ""}`);
    }

    for (const c of reparar) {
      const daConversa = { conversa: { contatoId: c.id } };
      const [primeira, porDirecao] = await Promise.all([
        prisma.mensagemWhatsApp.findFirst({ where: daConversa, orderBy: { criadoEm: "asc" }, select: { direcao: true, origem: true } }),
        prisma.mensagemWhatsApp.groupBy({ by: ["direcao"], where: daConversa, _count: { _all: true } }),
      ]);
      const total = (d: string) => porDirecao.find((g) => g.direcao === d)?._count._all ?? 0;
      const vinculo = [c.alunoId && "aluno", c.responsavelId && "responsável", c.leadId && "lead"].filter(Boolean).join("+") || "sem vínculo";
      const campos = [igual(c.nomeExibicao) && "cadastro", igual(c.nomePerfil) && "perfil"].filter(Boolean).join("+");
      const inicio = primeira ? `${primeira.direcao}${primeira.direcao === "SAIDA" && !primeira.origem ? " (celular)" : ""}` : "—";
      console.log(`  ${mascarar(c.telefoneE164)} · ${vinculo} · nome em: ${campos} · 1ª mensagem: ${inicio} · recebidas: ${total("ENTRADA")} · enviadas: ${total("SAIDA")}`);
    }

    const leads = await prisma.oportunidade.findMany({
      where: { OR: nomes.map((nome) => ({ nome: { equals: nome, mode: "insensitive" as const } })) },
      select: { id: true, codigo: true, nome: true, telefoneE164: true },
    });
    if (leads.length) {
      console.log(`Leads com o mesmo nome (conferir e renomear na tela de Leads): ${leads.length}`);
      for (const l of leads) console.log(`  ${l.codigo ?? l.id} · "${l.nome}" · ${l.telefoneE164 ? mascarar(l.telefoneE164) : "sem telefone"}`);
    }

    if (!aplicar) return;
    let reparados = 0;
    for (const c of reparar) {
      const data = { ...(igual(c.nomeExibicao) ? { nomeExibicao: null } : {}), ...(igual(c.nomePerfil) ? { nomePerfil: null } : {}) };
      reparados += await prisma.$transaction(async (tx) => {
        const r = await tx.contatoWhatsApp.updateMany({ where: { id: c.id, nomeExibicao: c.nomeExibicao, nomePerfil: c.nomePerfil }, data });
        if (!r.count) return 0;
        await registrarEvento(tx, { tipo: "NomeContatoReparado", agregadoTipo: "ContatoWhatsApp", agregadoId: c.id, autorId: null,
          payload: { motivo: "perfil_da_linha_em_mensagem_fromMe", antes: { nomeExibicao: c.nomeExibicao, nomePerfil: c.nomePerfil } } });
        return 1;
      });
    }
    console.log(`Reparo aplicado: ${reparados}/${reparar.length}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
