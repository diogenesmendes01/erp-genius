import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Instrucao = { op: string; args: string };
type Estagio = { imagem: string; nome: string | null; instrucoes: Instrucao[] };

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

  it("builder reserva o mesmo heap do CI para o next build", () => {
    const envs = estagio("builder").instrucoes.filter((i) => i.op === "ENV").map((i) => i.args);
    expect(envs).toContain("NODE_OPTIONS=--max-old-space-size=5120");
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

  it("runner escuta em todas as interfaces IPv4 (HOSTNAME=0.0.0.0) para o healthcheck local", () => {
    const envs = estagio("runner").instrucoes.filter((i) => i.op === "ENV").map((i) => i.args);
    expect(envs).toContain("HOSTNAME=0.0.0.0");
  });
});

describe("docker-compose.coolify.yml: healthcheck do app", () => {
  it("usa /api/ready (readiness com banco), não /api/health (liveness)", () => {
    const compose = fs
      .readFileSync(path.resolve(process.cwd(), "docker-compose.coolify.yml"), "utf8")
      .replace(/\r\n/g, "\n");
    const app = compose.match(/^ {2}app:\s*\n((?:^(?: {4}.*)?\n)*)/m)?.[0] ?? "";
    const teste = app.split("\n").find((l) => /^\s*test:/.test(l)) ?? "";
    expect(teste).toContain("/api/ready");
  });

  it("chama 127.0.0.1, não localhost (wget do BusyBox resolve localhost para ::1 e o Next escuta só IPv4)", () => {
    const compose = fs
      .readFileSync(path.resolve(process.cwd(), "docker-compose.coolify.yml"), "utf8")
      .replace(/\r\n/g, "\n");
    const app = compose.match(/^ {2}app:\s*\n((?:^(?: {4}.*)?\n)*)/m)?.[0] ?? "";
    const teste = app.split("\n").find((l) => /^\s*test:/.test(l)) ?? "";
    expect(teste).toContain("http://127.0.0.1:3000/api/ready");
    expect(teste).not.toMatch(/localhost|\[::1\]/);
  });
});

describe("SHA do build chega ao runner", () => {
  const dockerfile = fs.readFileSync(path.join(__dirname, "../../Dockerfile"), "utf-8");
  const runner = dockerfile.slice(dockerfile.indexOf("AS runner"));

  it("o estágio runner declara ARG GIT_SHA e o exporta como ENV", () => {
    expect(runner).toMatch(/^ARG GIT_SHA=?/m);
    expect(runner).toMatch(/^ENV GIT_SHA=\$\{?GIT_SHA\}?/m);
  });

  it("o ARG vem depois das checagens do Prisma (o SHA muda a cada commit e não pode invalidar o cache delas)", () => {
    expect(runner.indexOf("ARG GIT_SHA")).toBeGreaterThan(runner.indexOf("P1001"));
  });
});
