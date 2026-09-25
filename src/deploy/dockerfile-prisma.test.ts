import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Trava a correção Prisma/OpenSSL do Dockerfile (review #127 B1/B2): Alpine 3.24 vem sem o binário
// `openssl`, o Prisma 5.22 detecta a libssl errada e carrega o engine errado (migrate exit 1, queries
// quebradas com /api/health verde). A garantia de produção é: openssl instalado no estágio `base`
// herdado por deps/builder/runner + checagens que CARREGAM os engines no build (engine errado quebra
// o build, não a produção). O Dockerfile é lido como o Docker lê: sem comentários e com as
// continuações `\` juntadas, então comentar uma linha conta como removê-la. Mutações cobradas:
// - Remover ou comentar o `RUN apk add --no-cache openssl` → DEVE FALHAR
// - Trocar por `RUN echo apk add --no-cache openssl` (spoof) → DEVE FALHAR
// - Algum estágio deixar de herdar de `base` / despinar a imagem → DEVE FALHAR
// - Remover/esvaziar a checagem do schema engine no builder → DEVE FALHAR
// - Trocar a checagem do runner por algo que não exija P1001 (ex.: `process.exit(0)`) → DEVE FALHAR
// - Remover ENV HOSTNAME=0.0.0.0 do runner → DEVE FALHAR
// - Healthcheck do Coolify voltar para /api/health → DEVE FALHAR

type Instrucao = { op: string; args: string };
type Estagio = { imagem: string; nome: string | null; instrucoes: Instrucao[] };

// Porta sem banco: as checagens nunca podem apontar para um banco real.
const URL_SEM_BANCO = /^DATABASE_URL="postgresql:\/\/[^"@]*@127\.0\.0\.1:1\/[^"]*"/;

function lerDockerfile(texto: string): Estagio[] {
  const semComentarios = texto
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((linha) => !/^\s*#/.test(linha))
    .join("\n");
  const instrucoes = semComentarios
    .split("\\\n")
    .join("")
    .split("\n")
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const m = linha.match(/^(\w+)\s+([\s\S]*)$/);
      if (!m) throw new Error(`instrução ilegível no Dockerfile: ${linha}`);
      return { op: m[1].toUpperCase(), args: m[2].trim() };
    });

  const estagios: Estagio[] = [];
  for (const instrucao of instrucoes) {
    if (instrucao.op === "FROM") {
      const [imagem, as, nome] = instrucao.args.split(/\s+/);
      estagios.push({ imagem, nome: as?.toUpperCase() === "AS" ? nome : null, instrucoes: [] });
    } else {
      estagios.at(-1)?.instrucoes.push(instrucao);
    }
  }
  return estagios;
}

// Comandos simples de um RUN (separados por && e ;). `echo apk add ...` não vira `apk add`.
function comandos(run: string): string[] {
  return run.split(/&&|;/).map((c) => c.trim());
}

function instalaOpenssl(run: string): boolean {
  return comandos(run).some((c) => /^apk add\b/.test(c) && c.split(/\s+/).includes("openssl"));
}

describe("Dockerfile: Prisma/OpenSSL em Alpine", () => {
  let estagios: Estagio[];
  const estagio = (nome: string): Estagio => {
    const e = estagios.find((s) => s.nome === nome);
    if (!e) throw new Error(`estágio ${nome} não encontrado`);
    return e;
  };
  const runs = (nome: string): string[] =>
    estagio(nome).instrucoes.filter((i) => i.op === "RUN").map((i) => i.args);

  beforeAll(() => {
    estagios = lerDockerfile(fs.readFileSync(path.resolve(process.cwd(), "Dockerfile"), "utf8"));
  });

  it("estágio base usa node:22-alpine3.24 pinado por digest", () => {
    expect(estagio("base").imagem).toMatch(/^node:22-alpine3\.24@sha256:[0-9a-f]{64}$/);
  });

  it("estágio base instala openssl com um RUN real (não comentado, não spoof)", () => {
    expect(runs("base").filter(instalaOpenssl)).toHaveLength(1);
  });

  it("detector de apk add rejeita spoof e comentário", () => {
    expect(instalaOpenssl("apk add --no-cache openssl")).toBe(true);
    expect(instalaOpenssl("echo apk add --no-cache openssl")).toBe(false);
    expect(instalaOpenssl("apk add --no-cache openssl-dev")).toBe(false);
    const comentado = lerDockerfile("FROM x AS base\n# RUN apk add --no-cache openssl\n");
    expect(comentado[0].instrucoes).toHaveLength(0);
  });

  it("deps, builder e runner herdam de base (nenhum estágio volta para a imagem crua)", () => {
    for (const nome of ["deps", "builder", "runner"]) {
      expect(estagio(nome).imagem).toBe("base");
    }
    expect(estagios.filter((e) => e.imagem !== "base").map((e) => e.nome)).toEqual(["base"]);
  });

  it("builder executa o schema engine (usado pelo serviço migrate) e exige P1001", () => {
    const builder = runs("builder");
    const gerar = builder.findIndex((r) => r === "npx prisma generate");
    const checagem = builder.findIndex(
      (r) =>
        URL_SEM_BANCO.test(r) &&
        /\snpx prisma migrate status 2>&1 \| grep -q P1001\s*\|\| \(echo "[^"]+" && exit 1\)$/.test(r)
    );
    expect(gerar).toBeGreaterThanOrEqual(0);
    expect(checagem).toBeGreaterThan(gerar);
  });

  describe("runner: checagem do query engine", () => {
    let js: string;
    let dir: string;

    // Executa o JS REAL da checagem contra um @prisma/client falso, controlado por env.
    const rodar = (modo: "p1001" | "engine-quebrado" | "conectou") =>
      spawnSync(process.execPath, ["-e", js], {
        cwd: dir,
        env: { ...process.env, FAKE_PRISMA: modo },
        encoding: "utf8",
      }).status;

    beforeAll(() => {
      const instrucoes = estagio("runner").instrucoes;
      const copiaStandalone = instrucoes.findIndex(
        (i) => i.op === "COPY" && i.args.includes("/app/.next/standalone")
      );
      const idx = instrucoes.findIndex(
        (i) => i.op === "RUN" && URL_SEM_BANCO.test(i.args) && /\snode -e '/.test(i.args)
      );
      expect(idx, "checagem do query engine ausente no runner").toBeGreaterThan(copiaStandalone);
      expect(copiaStandalone).toBeGreaterThanOrEqual(0);
      const m = instrucoes[idx].args.match(/\snode -e '([\s\S]+)'$/);
      expect(m).not.toBeNull();
      js = m![1];

      dir = fs.mkdtempSync(path.join(os.tmpdir(), "dockerfile-prisma-"));
      const pacote = path.join(dir, "node_modules", "@prisma", "client");
      fs.mkdirSync(pacote, { recursive: true });
      fs.writeFileSync(path.join(pacote, "package.json"), '{"name":"@prisma/client","main":"index.js"}');
      fs.writeFileSync(
        path.join(pacote, "index.js"),
        `class PrismaClient {
          $connect() {
            const modo = process.env.FAKE_PRISMA;
            if (modo === "conectou") return Promise.resolve();
            const e = new Error(modo === "p1001" ? "Can't reach database server" : "Unable to require(libquery_engine)");
            if (modo === "p1001") e.errorCode = "P1001";
            return Promise.reject(e);
          }
        }
        module.exports = { PrismaClient };`
      );
    });

    afterAll(() => {
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    });

    it("passa (exit 0) só quando o engine carregou e o banco é inalcançável (P1001)", () => {
      expect(rodar("p1001")).toBe(0);
    });

    it("quebra o build (exit 1) quando o engine não carrega", () => {
      expect(rodar("engine-quebrado")).toBe(1);
    });

    it("quebra o build (exit 1) se conectar em algum banco", () => {
      expect(rodar("conectou")).toBe(1);
    });
  });

  it("runner escuta em todas as interfaces (HOSTNAME=0.0.0.0) para o healthcheck em localhost", () => {
    const envs = estagio("runner").instrucoes.filter((i) => i.op === "ENV").map((i) => i.args);
    expect(envs).toContain("HOSTNAME=0.0.0.0");
  });
});

describe("docker-compose.coolify.yml: healthcheck do app", () => {
  it("usa /api/ready (readiness com banco), não /api/health (liveness)", () => {
    // CRLF normalizado: com core.autocrlf=true o checkout no Windows traz o compose em CRLF.
    const compose = fs
      .readFileSync(path.resolve(process.cwd(), "docker-compose.coolify.yml"), "utf8")
      .replace(/\r\n/g, "\n");
    const app = compose.match(/^ {2}app:\s*\n((?:^(?: {4}.*)?\n)*)/m)?.[0] ?? "";
    const teste = app.split("\n").find((l) => /^\s*test:/.test(l)) ?? "";
    expect(teste).toContain("http://localhost:3000/api/ready");
  });
});
