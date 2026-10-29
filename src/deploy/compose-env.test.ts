import { readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

const raiz = process.cwd();
const ler = (arq: string) => readFileSync(resolve(raiz, arq), "utf8").replace(/\r\n/g, "\n");

const SO_TESTE_EXATAS = new Set(["FAKE_PRISMA", "GUARD", "GUARD_GRADES", "TZ", "PRISMA_TESTE_TIMEOUT_MS"]);
const SO_TESTE_PREFIXOS = ["HOMOLOGACAO_UI_", "QA_"];
const DA_IMAGEM = ["NODE_ENV", "GIT_SHA"];
const DO_NEXT = ["NEXT_RUNTIME"];
const DERIVADAS_NO_COMPOSE = ["DATABASE_URL", "NEXTAUTH_URL", "MOTOR_URL"];
const DO_COMPOSE = ["APP_IMAGE", "APP_MIGRATE_IMAGE", "MOTOR_IMAGE"];

const soTeste = (v: string) => SO_TESTE_EXATAS.has(v) || SO_TESTE_PREFIXOS.some((p) => v.startsWith(p));
const ehArquivoDeTeste = (arq: string) => /\.test\.tsx?$/.test(arq) || arq.split(/[\\/]/).includes("test");

function arquivosFonte(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) return arquivosFonte(caminho);
    return /\.tsx?$/.test(e.name) ? [caminho] : [];
  });
}

const ACESSOS = [
  /(?:process\.env|\bambiente|\benv)\??\.([A-Z][A-Z0-9_]+)/g,
  /process\.env\[\s*["'`]([A-Z][A-Z0-9_]+)["'`]\s*\]/g,
];

function lidasPeloCodigo() {
  const porVariavel = new Map<string, string[]>();
  for (const arq of arquivosFonte(resolve(raiz, "src"))) {
    const texto = readFileSync(arq, "utf8");
    for (const re of ACESSOS) for (const m of texto.matchAll(re)) {
      porVariavel.set(m[1], [...(porVariavel.get(m[1]) ?? []), arq]);
    }
  }
  return porVariavel;
}

function secao(texto: string, nome: string): string {
  const m = texto.match(new RegExp(`^  ${nome}:\\n((?:(?:[ \\t]+.*)?\\n)*?)(?=^  [^\\s#]|^[^\\s#]|(?![\\s\\S]))`, "m"));
  if (!m) throw new Error(`serviço ${nome} não encontrado`);
  return m[1];
}

const lidas = lidasPeloCodigo();
const producao = [...lidas.keys()].filter((v) => !soTeste(v) && !DA_IMAGEM.includes(v) && !DO_COMPOSE.includes(v) && !DO_NEXT.includes(v)).sort();

describe("variáveis lidas pelo código", () => {
  it("a varredura encontra as variáveis conhecidas (o regex não quebrou)", () => {
    for (const v of ["DATABASE_URL", "CRON_SECRET", "RESEND_API_KEY", "GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY", "COMUNICACOES_AGENDA_ENVIO_ENABLED", "MOTOR_API_KEY"]) {
      expect(producao).toContain(v);
    }
  });
  it("as de teste da lista de exclusão só são lidas em arquivos de teste", () => {
    for (const [v, arquivos] of lidas) {
      if (!soTeste(v)) continue;
      const foraDeTeste = arquivos.filter((a) => !ehArquivoDeTeste(a));
      expect(foraDeTeste, `${v} é lida fora de teste — não pode estar na exclusão`).toEqual([]);
    }
  });
  it("as definidas pela imagem estão no Dockerfile", () => {
    const dockerfile = ler("Dockerfile");
    for (const v of DA_IMAGEM) expect(dockerfile).toMatch(new RegExp(`^ENV ${v}=`, "m"));
  });
});

for (const arq of ["docker-compose.coolify.yml", "docker-compose.prod.yml"]) {
  describe(`${arq}: repasse ao serviço app`, () => {
    const app = secao(ler(arq), "app");
    const env = app.match(/^    environment:\n((?:(?:      .*)?\n)*)/m)?.[1] ?? "";
    it.each(producao)("%s está no environment do app", (v) => {
      expect(env).toMatch(new RegExp(`^      ${v}:`, "m"));
    });
    it("APP_BASE_URL entra na lista environment do app, sem env_file", () => {
      expect(env).toMatch(/^      APP_BASE_URL: \$\{APP_BASE_URL\}$/m);
      expect(app).not.toMatch(/^\s*env_file:/m);
    });
    it("flags *_ENABLED repassadas com padrão seguro \"false\"", () => {
      for (const v of producao.filter((x) => x.endsWith("_ENABLED"))) {
        expect(env).toContain(`${v}: \${${v}:-false}`);
      }
    });
  });

  describe(`${arq}: imagens dos serviços`, () => {
    const compose = ler(arq);
    it("app usa image: ${APP_IMAGE:?...} (obrigatório, fail closed)", () => {
      expect(secao(compose, "app")).toMatch(/^\s*image:\s+\$\{APP_IMAGE:\?[^}]+\}/m);
    });
    it("app não tem build: (build acontece no CI)", () => {
      expect(secao(compose, "app")).not.toMatch(/^\s*build:/m);
    });
    it("migrate usa image: ${APP_MIGRATE_IMAGE:?...} (builder stage com Prisma CLI)", () => {
      expect(secao(compose, "migrate")).toMatch(/^\s*image:\s+\$\{APP_MIGRATE_IMAGE:\?[^}]+\}/m);
    });
    it("migrate não tem build: (usa a imagem validada do builder)", () => {
      expect(secao(compose, "migrate")).not.toMatch(/^\s*build:/m);
    });
    it("motor usa image: ${MOTOR_IMAGE:?...} (obrigatório)", () => {
      expect(secao(compose, "motor")).toMatch(/^\s*image:\s+\$\{MOTOR_IMAGE:\?[^}]+\}/m);
    });
  });
}

describe("envs de exemplo listam todas as variáveis de produção", () => {
  it.each(producao)(".env.example cita %s", (v) => expect(ler(".env.example")).toMatch(new RegExp(`^#? ?${v}=`, "m")));
  it.each(producao.filter((v) => !DERIVADAS_NO_COMPOSE.includes(v)))("deploy/env.production.example cita %s", (v) => {
    expect(ler("deploy/env.production.example")).toMatch(new RegExp(`^${v}=`, "m"));
  });
});
