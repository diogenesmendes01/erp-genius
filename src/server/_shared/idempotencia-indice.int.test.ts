import { describe, it, expect, beforeAll } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario } from "@/test/integracao";
import { sqlBuscaIdempotente } from "./idempotencia";

// C1 da revisão do #240: a busca do Evento de criação pela chave de idempotência usa o índice de expressão
// parcial `Evento_idempotencia_idx` em vez de percorrer todos os Eventos do mesmo tipo.

let autorId: string;

beforeAll(async () => {
  await truncarBanco();
  autorId = (await criarUsuario([], "Autor")).id;
});

describe("Evento_idempotencia_idx", () => {
  it("existe, é parcial e cobre tipo, autor e a chave do payload", async () => {
    const [indice] = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes WHERE tablename = 'Evento' AND indexname = 'Evento_idempotencia_idx'`;
    expect(indice?.indexdef).toContain(`(tipo, "autorId", ((payload ->> 'chaveIdempotencia'::text)))`);
    expect(indice?.indexdef).toContain(`WHERE (payload ? 'chaveIdempotencia'::text)`);
  });

  it("a busca de repeticaoIdempotente usa o índice", async () => {
    // Cenário de produção: muitos Eventos do mesmo tipo e agregado, a maioria sem chave e o resto com chaves
    // de vários autores. Com estatísticas atualizadas, o planejador deve preferir o índice parcial.
    await prisma.$executeRaw`
      INSERT INTO "Evento" ("id", "tipo", "agregadoTipo", "agregadoId", "autorId", "payload")
      SELECT 'carga-' || g, 'TarefaCriada', 'Tarefa', 'tarefa-' || g, ${autorId},
             CASE WHEN g % 4 = 0 THEN jsonb_build_object('chaveIdempotencia', 'carga-' || g, 'entradaHash', 'h') ELSE '{}'::jsonb END
      FROM generate_series(1, 5000) AS g`;
    await prisma.$executeRaw`ANALYZE "Evento"`;
    const alvo = { tipo: "TarefaCriada", agregadoTipo: "Tarefa", autorId, chaveIdempotencia: "carga-400" };
    const linhas = await prisma.$queryRaw<{ "QUERY PLAN": string }[]>(Prisma.sql`EXPLAIN ${sqlBuscaIdempotente(alvo)}`);
    expect(linhas.map((l) => l["QUERY PLAN"]).join("\n")).toContain("Evento_idempotencia_idx");
    const [achado] = await prisma.$queryRaw<{ agregadoId: string }[]>(sqlBuscaIdempotente(alvo));
    expect(achado?.agregadoId).toBe("tarefa-400");
  });

  it("acha o Evento pela chave do payload, só do mesmo tipo, agregado e autor", async () => {
    const outroAutor = (await criarUsuario([], "Outro")).id;
    const payload = { chaveIdempotencia: "chave-indice-0002", entradaHash: "h" };
    await prisma.evento.createMany({
      data: [
        { tipo: "PrecoDefinido", agregadoTipo: "Preco", agregadoId: "certo", autorId, payload },
        { tipo: "PrecoDefinido", agregadoTipo: "Preco", agregadoId: "outro-autor", autorId: outroAutor, payload },
        { tipo: "PrecoDefinido", agregadoTipo: "Outro", agregadoId: "outro-agregado", autorId, payload },
        { tipo: "IdiomaCriado", agregadoTipo: "Preco", agregadoId: "outro-tipo", autorId, payload },
      ],
    });
    const achados = await prisma.$queryRaw<{ agregadoId: string }[]>(
      sqlBuscaIdempotente({ tipo: "PrecoDefinido", agregadoTipo: "Preco", autorId, chaveIdempotencia: "chave-indice-0002" }),
    );
    expect(achados.map((e) => e.agregadoId)).toEqual(["certo"]);
  });
});
