import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

// Task 26 (Fase 4): o serviço do motor substitui a Evolution nos dois composes, no backup e nas envs.
const ler = (arq: string) => readFileSync(resolve(process.cwd(), arq), "utf8").replace(/\r\n/g, "\n");

// Corpo do serviço `nome`: da linha "  nome:" até o próximo serviço (ou bloco raiz).
function secao(texto: string, nome: string): string {
  const m = texto.match(new RegExp(`^  ${nome}:\\n((?:(?:[ \\t]+.*)?\\n)*?)(?=^  [^\\s#]|^[^\\s#]|(?![\\s\\S]))`, "m"));
  if (!m) throw new Error(`serviço ${nome} não encontrado`);
  return m[1];
}

for (const arq of ["docker-compose.prod.yml", "docker-compose.coolify.yml"]) {
  describe(arq, () => {
    const t = ler(arq);
    const motor = secao(t, "motor");
    const app = secao(t, "app");
    it("sem Evolution", () => expect(t).not.toMatch(/evolution|EVOLUTION_|META_WA_/i));
    it("imagem obrigatória e reinício automático", () => {
      expect(motor).toContain("image: ${MOTOR_IMAGE:?defina");
      expect(motor).toContain("restart: unless-stopped");
    });
    it("motor sem porta publicada", () => expect(motor).not.toMatch(/^\s+ports:/m));
    it("motor em modo serviço com webhook interno", () => {
      expect(motor).toContain("MOTOR_MODE: servico");
      expect(motor).toContain("ERP_WEBHOOK_URL: http://app:3000/api/whatsapp/webhook/motor");
      expect(motor).toContain('HOST: "0.0.0.0"');
      expect(motor).toContain('PORT: "4317"');
      expect(motor).toContain("WA_DATA_DIR: /data");
      expect(motor).toContain("MOTOR_API_KEY:");
      expect(motor).toContain("MOTOR_WEBHOOK_SECRET:");
      expect(motor).toMatch(/motor_data:\/data/);
    });
    it("volume motor_data declarado", () => expect(t).toMatch(/^volumes:\n(?:  .*\n)*?  motor_data:/m));
    it("app aponta para o motor", () => {
      expect(app).toContain("MOTOR_URL: http://motor:4317");
      expect(app).toContain("MOTOR_API_KEY:");
      expect(app).toContain("MOTOR_WEBHOOK_SECRET:");
    });
  });
}

describe("docker-compose.prod.yml: banco", () => {
  it("db sem o mount de initdb", () => expect(secao(ler("docker-compose.prod.yml"), "db")).not.toMatch(/initdb/));
});

describe("docker-compose.coolify.yml: sem db-init", () => {
  const t = ler("docker-compose.coolify.yml");
  it("serviço db-init removido e migrate não depende dele", () => {
    expect(t).not.toMatch(/db-init/);
    expect(secao(t, "migrate")).not.toMatch(/db-init/);
  });
});

describe("envs de exemplo", () => {
  for (const arq of [".env.example", "deploy/env.production.example"]) {
    it(`${arq} sem Meta/Evolution e com as variáveis do motor`, () => {
      const t = ler(arq);
      expect(t).not.toMatch(/evolution|EVOLUTION_|META_WA_/i);
      for (const v of ["MOTOR_API_KEY", "MOTOR_WEBHOOK_SECRET"]) expect(t).toContain(v);
    });
  }
  it("env de produção define MOTOR_IMAGE", () => expect(ler("deploy/env.production.example")).toContain("MOTOR_IMAGE"));
  it(".env.example define MOTOR_URL", () => expect(ler(".env.example")).toContain("MOTOR_URL"));
});

describe("scripts/backup-producao.sh", () => {
  const t = ler("scripts/backup-producao.sh");
  it("cobre o volume do motor e não cita evolution", () => {
    expect(t).not.toMatch(/evolution/i);
    expect(t).toContain("$COMPOSE exec -T motor tar -czf - -C / data");
    expect(t).toContain("motor-data.tar.gz");
    expect(t).not.toContain("evolution.dump");
  });
});
