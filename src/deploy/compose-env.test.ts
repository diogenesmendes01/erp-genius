import { readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { describe, expect, it } from "vitest";

// Toda variável de ambiente de produção lida pelo código precisa ser repassada no `environment`
// do serviço `app` dos dois composes: o Coolify (e o `.env` da VPS) só chegam ao container pelo
// que estiver citado ali. Sem isso, definir a variável no painel não tem efeito nenhum.
const raiz = process.cwd();
const ler = (arq: string) => readFileSync(resolve(raiz, arq), "utf8").replace(/\r\n/g, "\n");

// Lista de exclusão explícita: variáveis só de teste/homologação local (nunca em produção).
const SO_TESTE_EXATAS = new Set(["FAKE_PRISMA", "GUARD", "GUARD_GRADES", "TZ", "PRISMA_TESTE_TIMEOUT_MS"]);
const SO_TESTE_PREFIXOS = ["HOMOLOGACAO_UI_", "QA_"];
// Definidas pela própria imagem (Dockerfile), não pelo compose.
const DA_IMAGEM = ["NODE_ENV", "GIT_SHA"];
// Montadas pelo compose a partir de outras variáveis (não aparecem cruas no env de produção).
const DERIVADAS_NO_COMPOSE = ["DATABASE_URL", "NEXTAUTH_URL", "MOTOR_URL"];

const soTeste = (v: string) => SO_TESTE_EXATAS.has(v) || SO_TESTE_PREFIXOS.some((p) => v.startsWith(p));
const ehArquivoDeTeste = (arq: string) => /\.test\.tsx?$/.test(arq) || arq.split(/[\\/]/).includes("test");

function arquivosFonte(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) return arquivosFonte(caminho);
    return /\.tsx?$/.test(e.name) ? [caminho] : [];
  });
}

// Acessos: process.env.X, process.env["X"] e os objetos de ambiente injetáveis (`ambiente.X`, `env.X`),
// cujo padrão é process.env.
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

// Corpo do serviço `nome`: da linha "  nome:" até o próximo serviço (ou bloco raiz).
function secao(texto: string, nome: string): string {
  const m = texto.match(new RegExp(`^  ${nome}:\\n((?:(?:[ \\t]+.*)?\\n)*?)(?=^  [^\\s#]|^[^\\s#]|(?![\\s\\S]))`, "m"));
  if (!m) throw new Error(`serviço ${nome} não encontrado`);
  return m[1];
}

const lidas = lidasPeloCodigo();
const producao = [...lidas.keys()].filter((v) => !soTeste(v) && !DA_IMAGEM.includes(v)).sort();

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
    it("flags *_ENABLED repassadas com padrão seguro \"false\"", () => {
      for (const v of producao.filter((x) => x.endsWith("_ENABLED"))) {
        expect(env).toContain(`${v}: \${${v}:-false}`);
      }
    });
  });
}

describe("envs de exemplo listam todas as variáveis de produção", () => {
  it.each(producao)(".env.example cita %s", (v) => expect(ler(".env.example")).toMatch(new RegExp(`^#? ?${v}=`, "m")));
  it.each(producao.filter((v) => !DERIVADAS_NO_COMPOSE.includes(v)))("deploy/env.production.example cita %s", (v) => {
    expect(ler("deploy/env.production.example")).toMatch(new RegExp(`^${v}=`, "m"));
  });
});
