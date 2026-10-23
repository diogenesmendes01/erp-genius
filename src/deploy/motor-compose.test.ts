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
    it("estrutura: serviços sem chave duplicada e cada um com image ou build", () => {
      const bloco = t.match(/^services:\n((?:(?:[ \t]+.*)?\n)*?)(?=^[^\s#]|(?![\s\S]))/m)?.[1] ?? "";
      const nomes = [...bloco.matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm)].map((m) => m[1]);
      expect(nomes.length).toBeGreaterThan(0);
      expect(new Set(nomes).size).toBe(nomes.length);
      for (const n of nomes) expect(secao(t, n), `serviço ${n}`).toMatch(/^    (image|build):/m);
      expect(secao(t, "db")).toMatch(/^    healthcheck:/m);
    });
    it("sem Evolution", () => expect(t).not.toMatch(/evolution|EVOLUTION_|META_WA_/i));
    it("imagem obrigatória e reinício automático", () => {
      expect(motor).toContain("image: ${MOTOR_IMAGE:?defina");
      expect(motor).toContain("restart: unless-stopped");
    });
    it("motor com healthcheck e limites de recursos", () => {
      expect(motor).toMatch(/^\s+healthcheck:/m);
      expect(motor).toMatch(/node.*fetch.*127\.0\.0\.1:4317\/api\/health/);
      expect(motor).toMatch(/^\s+deploy:/m);
      expect(motor).toMatch(/memory:/);
      expect(motor).toMatch(/cpus:/);
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
    it("coolify: motor nas redes default e coolify + banco Postgres dedicado", () => {
      if (arq === "docker-compose.coolify.yml") {
        expect(motor).toMatch(/^\s+networks:/m);
        expect(motor).toMatch(/^\s+-\s+default$/m);
        expect(motor).toMatch(/^\s+-\s+coolify$/m);
        expect(motor).toContain("DATABASE_URL: ${MOTOR_DATABASE_URL:?defina no Coolify}");
        expect(motor).toContain("MASTER_KEY: ${MOTOR_MASTER_KEY:?defina no Coolify}");
      }
    });
    it("prod: motor sem rede coolify", () => {
      if (arq === "docker-compose.prod.yml") {
        expect(motor).not.toMatch(/coolify/);
        expect(motor).not.toContain("MOTOR_DATABASE_URL");
        expect(motor).not.toContain("MOTOR_MASTER_KEY");
      }
    });
    it("volume motor_data declarado", () => expect(t).toMatch(/^volumes:\n(?:  .*\n)*?  motor_data:/m));
    it("coolify: rede externa declarada", () => {
      if (arq === "docker-compose.coolify.yml") {
        expect(t).toMatch(/^networks:\n(?:  .*\n)*?  coolify:\n    external: true$/m);
      }
    });
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
    expect(t).toContain("motor-data.tar.gz");
    expect(t).not.toContain("evolution.dump");
  });
  // C1 da R1 do #221: PGlite em arquivo não pode ser copiado com o motor gravando.
  it("para o motor só durante o tar e religa também em erro (trap)", () => {
    const iParar = t.indexOf("$COMPOSE stop motor");
    const iTar = t.indexOf('tar -czf - -C / data > "$PASTA/motor-data.tar.gz"');
    expect(iParar).toBeGreaterThan(-1);
    expect(iTar).toBeGreaterThan(iParar);
    expect(t).toMatch(/^trap religar_motor EXIT INT TERM$/m);
    expect(t.indexOf("trap religar_motor")).toBeLessThan(iParar);
    expect(t.slice(iTar)).toMatch(/^religar_motor$/m);
    expect(t).toContain("$COMPOSE start motor");
  });
  it("o tar do motor roda num container auxiliar montando o volume, não na imagem do motor", () => {
    expect(t).not.toContain("exec -T motor tar");
    expect(t).toContain('docker run --rm --volumes-from "$MOTOR_CID:ro" "$IMAGEM_TAR" tar -czf - -C / data');
    expect(t).not.toContain("--entrypoint tar motor");
  });
});
