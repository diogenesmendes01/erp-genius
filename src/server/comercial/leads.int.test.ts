import { describe, it, expect, beforeAll, vi } from "vitest";
import { Papel, EtapaLead } from "@prisma/client";

// Prioridades 1 e 2 do docs/14 (integração):
//  1. row-level de LEITURA: vendedor não enxerga lead de outro vendedor;
//  2. toda mutação grava Evento NA MESMA transação (e falha não grava nada).
// Sessão mockada devolve só o id — os PAPÉIS vêm do banco de teste (papéis frescos),
// então o caminho real de autorização é exercitado de ponta a ponta.

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { criarLead } from "./acoes";
import { listarLeads, obterLead } from "./consultas";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import type { UsuarioSessao } from "@/server/_shared";

function logadoComo(id: string) {
  authMock.mockResolvedValue({ user: { id } });
}

function sessaoDe(u: { id: string; nome: string; papeis: Papel[] }): UsuarioSessao {
  return { id: u.id, nome: u.nome, papeis: u.papeis };
}

let vendedor1: Awaited<ReturnType<typeof criarUsuario>>;
let vendedor2: Awaited<ReturnType<typeof criarUsuario>>;
let gerente: Awaited<ReturnType<typeof criarUsuario>>;
let professor: Awaited<ReturnType<typeof criarUsuario>>;
let leadV1: string;
let leadV2: string;

beforeAll(async () => {
  await truncarBanco();
  vendedor1 = await criarUsuario([Papel.VENDEDOR], "Vendedor 1");
  vendedor2 = await criarUsuario([Papel.VENDEDOR], "Vendedor 2");
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  professor = await criarUsuario([Papel.PROFESSOR], "Professor");

  logadoComo(vendedor1.id);
  const r1 = await criarLead({ nome: "Lead do V1", segmento: "ADULTO", temperatura: "MORNO", b2b: false });
  if (!r1.ok) throw new Error(`setup: criarLead v1 falhou: ${r1.erro}`);
  leadV1 = r1.dado!.id;

  logadoComo(vendedor2.id);
  const r2 = await criarLead({ nome: "Lead do V2", segmento: "ADULTO", temperatura: "MORNO", b2b: false });
  if (!r2.ok) throw new Error(`setup: criarLead v2 falhou: ${r2.erro}`);
  leadV2 = r2.dado!.id;
});

describe("row-level de leitura (doc 07)", () => {
  it("vendedor lista SÓ os próprios leads", async () => {
    const doV1 = await listarLeads(sessaoDe(vendedor1));
    expect(doV1.map((l) => l.id)).toEqual([leadV1]);

    const doV2 = await listarLeads(sessaoDe(vendedor2));
    expect(doV2.map((l) => l.id)).toEqual([leadV2]);
  });

  it("gerente comercial enxerga os leads de todos", async () => {
    const todos = await listarLeads(sessaoDe(gerente));
    expect(new Set(todos.map((l) => l.id))).toEqual(new Set([leadV1, leadV2]));
  });

  it("ficha de lead de OUTRO vendedor não abre (retorna null, sem vazar)", async () => {
    const alheio = await obterLead(leadV2, sessaoDe(vendedor1));
    expect(alheio).toBeNull();
    const proprio = await obterLead(leadV1, sessaoDe(vendedor1));
    expect(proprio?.lead.id).toBe(leadV1);
  });
});

describe("evento na mesma transação (doc 10 §9 / doc 12)", () => {
  it("criarLead grava LeadCriado + LeadAtribuido com o autor correto", async () => {
    const eventos = await eventosDo("Lead", leadV1);
    const tipos = eventos.map((e) => e.tipo);
    expect(tipos).toContain("LeadCriado");
    expect(tipos).toContain("LeadAtribuido"); // vendedor vira dono ao criar
    expect(eventos.find((e) => e.tipo === "LeadCriado")?.autorId).toBe(vendedor1.id);
  });

  it("papel sem permissão (professor) não cria lead NEM evento — nada persiste", async () => {
    logadoComo(professor.id);
    const antes = await listarLeads(sessaoDe(gerente));

    const r = await criarLead({ nome: "Não deve existir", segmento: "ADULTO", temperatura: "MORNO", b2b: false });

    expect(r.ok).toBe(false);
    const depois = await listarLeads(sessaoDe(gerente));
    expect(depois.length).toBe(antes.length);
  });

  it("papéis frescos: papel revogado no banco derruba a ação mesmo com sessão 'antiga'", async () => {
    const efemero = await criarUsuario([Papel.VENDEDOR], "Efêmero");
    logadoComo(efemero.id);

    // Revoga o papel DEPOIS do "login" (sessão mockada continua a mesma).
    const { prisma } = await import("@/lib/prisma");
    await prisma.usuario.update({ where: { id: efemero.id }, data: { papeis: [] } });

    const r = await criarLead({ nome: "Barrado", segmento: "ADULTO", temperatura: "MORNO", b2b: false });
    expect(r.ok).toBe(false);
  });

  it("lead nasce na etapa NOVO (máquina de estados, doc 10 §1)", async () => {
    const lead = await obterLead(leadV1, sessaoDe(gerente));
    expect(lead?.lead.etapa).toBe(EtapaLead.NOVO);
  });
});
