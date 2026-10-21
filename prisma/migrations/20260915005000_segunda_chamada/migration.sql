-- CreateEnum
CREATE TYPE "StatusReservaSegundaChamada" AS ENUM ('RESERVADA', 'LIBERADA_CANCELAMENTO_ESCOLA', 'LIBERADA_CANCELAMENTO_TEMPESTIVO', 'CONSUMIDA_REALIZACAO', 'CONSUMIDA_FALTA', 'CONSUMIDA_CANCELAMENTO_TARDIO', 'PENDENCIA_ESCOLA');

-- AlterEnum
ALTER TYPE "FinalidadeEncontroAgenda" ADD VALUE 'SEGUNDA_CHAMADA';

-- AlterTable
ALTER TABLE "VersaoLancamentoAvaliacao" ADD COLUMN     "segundaChamadaRealizacaoId" TEXT;

-- CreateTable
CREATE TABLE "PropostaSegundaChamada" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "alocacaoId" TEXT NOT NULL,
    "turmaId" TEXT NOT NULL,
    "nivelId" TEXT NOT NULL,
    "regraId" TEXT NOT NULL,
    "codigoAvaliacao" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "evidencias" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "estadoHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaSegundaChamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoSegundaChamada" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoSegundaChamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisponibilizacaoSegundaChamada" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "disponibilizadaEm" TIMESTAMP(3) NOT NULL,
    "prazoRegraMinutos" INTEGER NOT NULL,
    "prazoAte" TIMESTAMP(3) NOT NULL,
    "condicoes" TEXT NOT NULL,
    "evidenciaComunicacao" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisponibilizacaoSegundaChamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropostaProrrogacaoSegundaChamada" (
    "id" TEXT NOT NULL,
    "disponibilizacaoId" TEXT NOT NULL,
    "preparadorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "prazoAnterior" TIMESTAMP(3) NOT NULL,
    "novoPrazo" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaProrrogacaoSegundaChamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoProrrogacaoSegundaChamada" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoProrrogacaoSegundaChamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservaSegundaChamada" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "regraId" TEXT NOT NULL,
    "codigoAvaliacao" TEXT NOT NULL,
    "reservadaPorId" TEXT NOT NULL,
    "reservadaEm" TIMESTAMP(3) NOT NULL,
    "status" "StatusReservaSegundaChamada" NOT NULL,
    "regraCancelamentoMinutos" INTEGER NOT NULL,

    CONSTRAINT "ReservaSegundaChamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaSegundaChamada" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "encontroId" TEXT NOT NULL,
    "agendadaPorId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgendaSegundaChamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcorrenciaSegundaChamada" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "registradaPorId" TEXT NOT NULL,
    "status" "StatusReservaSegundaChamada" NOT NULL,
    "ocorridaEm" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT NOT NULL,
    "evidencia" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcorrenciaSegundaChamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealizacaoSegundaChamada" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "registradaPorId" TEXT NOT NULL,
    "realizadaEm" TIMESTAMP(3) NOT NULL,
    "evidencia" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lancamentoOriginalId" TEXT,

    CONSTRAINT "RealizacaoSegundaChamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropostaExtraSegundaChamada" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "alocacaoId" TEXT NOT NULL,
    "regraId" TEXT NOT NULL,
    "codigoAvaliacao" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "autorId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "evidencias" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropostaExtraSegundaChamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisaoExtraSegundaChamada" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "decisorId" TEXT NOT NULL,
    "aprovada" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoExtraSegundaChamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutorizacaoEspecialSegundaChamada" (
    "id" TEXT NOT NULL,
    "matriculaId" TEXT NOT NULL,
    "alocacaoId" TEXT NOT NULL,
    "regraId" TEXT NOT NULL,
    "codigoAvaliacao" TEXT NOT NULL,
    "autorizadorId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "prazoAte" TIMESTAMP(3) NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutorizacaoEspecialSegundaChamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignacaoSegundaChamada" (
    "id" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "professorId" TEXT NOT NULL,
    "gestorId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3),
    "motivo" TEXT NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "entradaHash" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignacaoSegundaChamada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropostaSegundaChamada_matriculaId_regraId_codigoAvaliacao_idx" ON "PropostaSegundaChamada"("matriculaId", "regraId", "codigoAvaliacao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaSegundaChamada_autorId_chaveIdempotencia_key" ON "PropostaSegundaChamada"("autorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoSegundaChamada_propostaId_key" ON "DecisaoSegundaChamada"("propostaId");

-- CreateIndex
CREATE UNIQUE INDEX "DisponibilizacaoSegundaChamada_propostaId_key" ON "DisponibilizacaoSegundaChamada"("propostaId");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaProrrogacaoSegundaChamada_disponibilizacaoId_versao_key" ON "PropostaProrrogacaoSegundaChamada"("disponibilizacaoId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaProrrogacaoSegundaChamada_preparadorId_chaveIdempot_key" ON "PropostaProrrogacaoSegundaChamada"("preparadorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoProrrogacaoSegundaChamada_propostaId_key" ON "DecisaoProrrogacaoSegundaChamada"("propostaId");

-- CreateIndex
CREATE INDEX "ReservaSegundaChamada_matriculaId_regraId_codigoAvaliacao_s_idx" ON "ReservaSegundaChamada"("matriculaId", "regraId", "codigoAvaliacao", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgendaSegundaChamada_reservaId_key" ON "AgendaSegundaChamada"("reservaId");

-- CreateIndex
CREATE UNIQUE INDEX "AgendaSegundaChamada_encontroId_key" ON "AgendaSegundaChamada"("encontroId");

-- CreateIndex
CREATE INDEX "OcorrenciaSegundaChamada_reservaId_ocorridaEm_idx" ON "OcorrenciaSegundaChamada"("reservaId", "ocorridaEm");

-- CreateIndex
CREATE UNIQUE INDEX "RealizacaoSegundaChamada_reservaId_key" ON "RealizacaoSegundaChamada"("reservaId");

-- CreateIndex
CREATE UNIQUE INDEX "RealizacaoSegundaChamada_lancamentoOriginalId_key" ON "RealizacaoSegundaChamada"("lancamentoOriginalId");

-- CreateIndex
CREATE INDEX "PropostaExtraSegundaChamada_matriculaId_regraId_codigoAvali_idx" ON "PropostaExtraSegundaChamada"("matriculaId", "regraId", "codigoAvaliacao");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaExtraSegundaChamada_autorId_chaveIdempotencia_key" ON "PropostaExtraSegundaChamada"("autorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "DecisaoExtraSegundaChamada_propostaId_key" ON "DecisaoExtraSegundaChamada"("propostaId");

-- CreateIndex
CREATE INDEX "AutorizacaoEspecialSegundaChamada_matriculaId_regraId_codig_idx" ON "AutorizacaoEspecialSegundaChamada"("matriculaId", "regraId", "codigoAvaliacao", "prazoAte");

-- CreateIndex
CREATE UNIQUE INDEX "AutorizacaoEspecialSegundaChamada_autorizadorId_chaveIdempo_key" ON "AutorizacaoEspecialSegundaChamada"("autorizadorId", "chaveIdempotencia");

-- CreateIndex
CREATE INDEX "DesignacaoSegundaChamada_propostaId_professorId_inicio_idx" ON "DesignacaoSegundaChamada"("propostaId", "professorId", "inicio");

-- CreateIndex
CREATE UNIQUE INDEX "DesignacaoSegundaChamada_propostaId_versao_key" ON "DesignacaoSegundaChamada"("propostaId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "DesignacaoSegundaChamada_gestorId_chaveIdempotencia_key" ON "DesignacaoSegundaChamada"("gestorId", "chaveIdempotencia");

-- CreateIndex
CREATE UNIQUE INDEX "VersaoLancamentoAvaliacao_segundaChamadaRealizacaoId_key" ON "VersaoLancamentoAvaliacao"("segundaChamadaRealizacaoId");

-- AddForeignKey
ALTER TABLE "VersaoLancamentoAvaliacao" ADD CONSTRAINT "VersaoLancamentoAvaliacao_segundaChamadaRealizacaoId_fkey" FOREIGN KEY ("segundaChamadaRealizacaoId") REFERENCES "RealizacaoSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaSegundaChamada" ADD CONSTRAINT "PropostaSegundaChamada_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaSegundaChamada" ADD CONSTRAINT "PropostaSegundaChamada_alocacaoId_fkey" FOREIGN KEY ("alocacaoId") REFERENCES "AlocacaoTurma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaSegundaChamada" ADD CONSTRAINT "PropostaSegundaChamada_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaSegundaChamada" ADD CONSTRAINT "PropostaSegundaChamada_nivelId_fkey" FOREIGN KEY ("nivelId") REFERENCES "Nivel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaSegundaChamada" ADD CONSTRAINT "PropostaSegundaChamada_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "VersaoRegraAvaliacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaSegundaChamada" ADD CONSTRAINT "PropostaSegundaChamada_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisaoSegundaChamada" ADD CONSTRAINT "DecisaoSegundaChamada_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisaoSegundaChamada" ADD CONSTRAINT "DecisaoSegundaChamada_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisponibilizacaoSegundaChamada" ADD CONSTRAINT "DisponibilizacaoSegundaChamada_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisponibilizacaoSegundaChamada" ADD CONSTRAINT "DisponibilizacaoSegundaChamada_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaProrrogacaoSegundaChamada" ADD CONSTRAINT "PropostaProrrogacaoSegundaChamada_disponibilizacaoId_fkey" FOREIGN KEY ("disponibilizacaoId") REFERENCES "DisponibilizacaoSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaProrrogacaoSegundaChamada" ADD CONSTRAINT "PropostaProrrogacaoSegundaChamada_preparadorId_fkey" FOREIGN KEY ("preparadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisaoProrrogacaoSegundaChamada" ADD CONSTRAINT "DecisaoProrrogacaoSegundaChamada_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaProrrogacaoSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisaoProrrogacaoSegundaChamada" ADD CONSTRAINT "DecisaoProrrogacaoSegundaChamada_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaSegundaChamada" ADD CONSTRAINT "ReservaSegundaChamada_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaSegundaChamada" ADD CONSTRAINT "ReservaSegundaChamada_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaSegundaChamada" ADD CONSTRAINT "ReservaSegundaChamada_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "VersaoRegraAvaliacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaSegundaChamada" ADD CONSTRAINT "ReservaSegundaChamada_reservadaPorId_fkey" FOREIGN KEY ("reservadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaSegundaChamada" ADD CONSTRAINT "AgendaSegundaChamada_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "ReservaSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaSegundaChamada" ADD CONSTRAINT "AgendaSegundaChamada_encontroId_fkey" FOREIGN KEY ("encontroId") REFERENCES "EncontroAgenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaSegundaChamada" ADD CONSTRAINT "AgendaSegundaChamada_agendadaPorId_fkey" FOREIGN KEY ("agendadaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcorrenciaSegundaChamada" ADD CONSTRAINT "OcorrenciaSegundaChamada_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "ReservaSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcorrenciaSegundaChamada" ADD CONSTRAINT "OcorrenciaSegundaChamada_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealizacaoSegundaChamada" ADD CONSTRAINT "RealizacaoSegundaChamada_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "ReservaSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealizacaoSegundaChamada" ADD CONSTRAINT "RealizacaoSegundaChamada_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealizacaoSegundaChamada" ADD CONSTRAINT "RealizacaoSegundaChamada_registradaPorId_fkey" FOREIGN KEY ("registradaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaExtraSegundaChamada" ADD CONSTRAINT "PropostaExtraSegundaChamada_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaExtraSegundaChamada" ADD CONSTRAINT "PropostaExtraSegundaChamada_alocacaoId_fkey" FOREIGN KEY ("alocacaoId") REFERENCES "AlocacaoTurma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaExtraSegundaChamada" ADD CONSTRAINT "PropostaExtraSegundaChamada_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "VersaoRegraAvaliacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaExtraSegundaChamada" ADD CONSTRAINT "PropostaExtraSegundaChamada_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisaoExtraSegundaChamada" ADD CONSTRAINT "DecisaoExtraSegundaChamada_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaExtraSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisaoExtraSegundaChamada" ADD CONSTRAINT "DecisaoExtraSegundaChamada_decisorId_fkey" FOREIGN KEY ("decisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutorizacaoEspecialSegundaChamada" ADD CONSTRAINT "AutorizacaoEspecialSegundaChamada_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutorizacaoEspecialSegundaChamada" ADD CONSTRAINT "AutorizacaoEspecialSegundaChamada_alocacaoId_fkey" FOREIGN KEY ("alocacaoId") REFERENCES "AlocacaoTurma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutorizacaoEspecialSegundaChamada" ADD CONSTRAINT "AutorizacaoEspecialSegundaChamada_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "VersaoRegraAvaliacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutorizacaoEspecialSegundaChamada" ADD CONSTRAINT "AutorizacaoEspecialSegundaChamada_autorizadorId_fkey" FOREIGN KEY ("autorizadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignacaoSegundaChamada" ADD CONSTRAINT "DesignacaoSegundaChamada_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "PropostaSegundaChamada"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignacaoSegundaChamada" ADD CONSTRAINT "DesignacaoSegundaChamada_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignacaoSegundaChamada" ADD CONSTRAINT "DesignacaoSegundaChamada_gestorId_fkey" FOREIGN KEY ("gestorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "guard_segunda_chamada_link_nota"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; v record;
BEGIN
 IF NEW."segundaChamadaRealizacaoId" IS NULL THEN RETURN NEW; END IF;
 SELECT sc.*,rs.status,p."matriculaId",p."alocacaoId",p."regraId",p."codigoAvaliacao" INTO r FROM "RealizacaoSegundaChamada" sc JOIN "ReservaSegundaChamada" rs ON rs.id=sc."reservaId" JOIN "PropostaSegundaChamada" p ON p.id=rs."propostaId" WHERE sc.id=NEW."segundaChamadaRealizacaoId" FOR KEY SHARE;
 SELECT "matriculaId","alocacaoId","regraId","codigoAvaliacao" INTO v FROM "RegistroAvaliacaoMatricula" WHERE id=NEW."registroId";
 IF NOT FOUND OR r.status<>'CONSUMIDA_REALIZACAO' OR (v."matriculaId",v."alocacaoId",v."regraId",v."codigoAvaliacao") IS DISTINCT FROM (r."matriculaId",r."alocacaoId",r."regraId",r."codigoAvaliacao") OR NEW."realizadaPorId" IS DISTINCT FROM r."professorId" OR NEW."realizadaEm" IS DISTINCT FROM r."realizadaEm" THEN RAISE EXCEPTION 'vínculo da nota original de segunda chamada inválido'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "guard_segunda_chamada_reserva"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proposta record; limite integer; extras integer; ocupadas integer; prazo timestamp(3); especial boolean;
BEGIN
 SELECT ps.*, ds.aprovada AS decisao_aprovada, disp.id AS disponibilizacao_id INTO proposta
 FROM "PropostaSegundaChamada" ps LEFT JOIN "DecisaoSegundaChamada" ds ON ds."propostaId"=ps.id LEFT JOIN "DisponibilizacaoSegundaChamada" disp ON disp."propostaId"=ps.id
 WHERE ps.id=NEW."propostaId" FOR KEY SHARE OF ps;
 IF NOT FOUND OR proposta.decisao_aprovada IS DISTINCT FROM true OR proposta.disponibilizacao_id IS NULL OR NEW."matriculaId"<>proposta."matriculaId" OR NEW."regraId"<>proposta."regraId" OR NEW."codigoAvaliacao"<>proposta."codigoAvaliacao" THEN RAISE EXCEPTION 'reserva exige proposta aprovada e disponibilizada no contexto exato'; END IF;
 SELECT (item->>'limiteSegundasChamadas')::integer INTO limite FROM "VersaoRegraAvaliacao" regra CROSS JOIN LATERAL jsonb_array_elements(regra.conteudo->'avaliacoes') item WHERE regra.id=proposta."regraId" AND item->>'codigo'=proposta."codigoAvaliacao";
 IF limite IS NULL THEN RAISE EXCEPTION 'limite não configurado'; END IF;
 SELECT COALESCE((SELECT pr."novoPrazo" FROM "PropostaProrrogacaoSegundaChamada" pr JOIN "DecisaoProrrogacaoSegundaChamada" dp ON dp."propostaId"=pr.id AND dp.aprovada WHERE pr."disponibilizacaoId"=proposta.disponibilizacao_id ORDER BY pr.versao DESC LIMIT 1), disp."prazoAte") INTO prazo FROM "DisponibilizacaoSegundaChamada" disp WHERE disp.id=proposta.disponibilizacao_id;
 IF prazo IS NULL OR (clock_timestamp() AT TIME ZONE 'UTC')>=prazo THEN RAISE EXCEPTION 'prazo da segunda chamada vencido não permite reserva'; END IF;
 SELECT EXISTS(SELECT 1 FROM "AutorizacaoEspecialSegundaChamada" ae WHERE ae."alocacaoId"=proposta."alocacaoId" AND ae."regraId"=proposta."regraId" AND ae."codigoAvaliacao"=proposta."codigoAvaliacao" AND ae."prazoAte">(clock_timestamp() AT TIME ZONE 'UTC')) INTO especial;
 IF NOT EXISTS (SELECT 1 FROM "AlocacaoTurma" al JOIN "Matricula" ma ON ma.id=al."matriculaId" WHERE al.id=proposta."alocacaoId" AND al.ativa AND ma.status='ATIVA') AND NOT especial THEN RAISE EXCEPTION 'reserva exige vínculo/matrícula ativos ou autorização especial vigente'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('segunda:'||NEW."matriculaId"||':'||NEW."regraId"||':'||NEW."codigoAvaliacao",0));
 SELECT COALESCE(sum(pe.quantidade),0) INTO extras FROM "PropostaExtraSegundaChamada" pe JOIN "DecisaoExtraSegundaChamada" de ON de."propostaId"=pe.id AND de.aprovada WHERE pe."matriculaId"=NEW."matriculaId" AND pe."regraId"=NEW."regraId" AND pe."codigoAvaliacao"=NEW."codigoAvaliacao";
 SELECT count(*) INTO ocupadas FROM "ReservaSegundaChamada" WHERE "matriculaId"=NEW."matriculaId" AND "regraId"=NEW."regraId" AND "codigoAvaliacao"=NEW."codigoAvaliacao" AND status IN ('RESERVADA','CONSUMIDA_REALIZACAO','CONSUMIDA_FALTA','CONSUMIDA_CANCELAMENTO_TARDIO');
 IF ocupadas>=limite+extras THEN RAISE EXCEPTION 'saldo de segunda chamada esgotado'; END IF; RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "guard_agenda_segunda_chamada"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record; e record; u record;
BEGIN
 SELECT rs.*,p."matriculaId",p."turmaId" INTO r FROM "ReservaSegundaChamada" rs JOIN "PropostaSegundaChamada" p ON p.id=rs."propostaId" WHERE rs.id=NEW."reservaId" FOR KEY SHARE;
 SELECT id,"matriculaId","turmaId","professorId",inicio,fim,status,finalidade INTO e FROM "EncontroAgenda" WHERE id=NEW."encontroId" FOR KEY SHARE;
 IF NOT FOUND OR e.finalidade<>'SEGUNDA_CHAMADA' OR e.status<>'PREVISTO' OR e."matriculaId" IS DISTINCT FROM r."matriculaId" OR e."turmaId" IS DISTINCT FROM r."turmaId" THEN RAISE EXCEPTION 'agenda exige encontro SEGUNDA_CHAMADA previsto do vínculo exato'; END IF;
 IF e."professorId" IS NULL THEN RAISE EXCEPTION 'agenda exige professor identificado'; END IF;
 SELECT ativo,papeis INTO u FROM "Usuario" WHERE id=e."professorId"; IF NOT FOUND OR NOT u.ativo OR NOT ('PROFESSOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'professor da agenda precisa estar ativo'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "VinculoDocente" v WHERE v."turmaId"=e."turmaId" AND v."professorId"=e."professorId" AND v.inicio<=e.inicio AND (v.fim IS NULL OR v.fim>e.inicio)) AND NOT EXISTS (SELECT 1 FROM "DesignacaoSegundaChamada" d WHERE d."propostaId"=r."propostaId" AND d."professorId"=e."professorId" AND d.inicio<=e.inicio AND (d.fim IS NULL OR d.fim>e.inicio)) THEN RAISE EXCEPTION 'professor sem escopo para segunda chamada'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "guard_decisao_segunda_chamada"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record; u record;
BEGIN
 SELECT * INTO p FROM "PropostaSegundaChamada" WHERE id=NEW."propostaId" FOR KEY SHARE;
 SELECT ativo,papeis INTO u FROM "Usuario" WHERE id=NEW."decisorId" FOR KEY SHARE;
 IF NOT FOUND OR p."autorId"=NEW."decisorId" OR NOT u.ativo OR NOT ('GERENTE_PEDAGOGICO'=ANY(u.papeis) OR 'ADMINISTRADOR'=ANY(u.papeis)) THEN RAISE EXCEPTION 'decisor ativo e independente da gestão é obrigatório'; END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "guard_oficializacao_segunda_chamada"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v record;
BEGIN
 SELECT l."autorId",l."realizadaPorId",l."segundaChamadaRealizacaoId" INTO v FROM "VersaoLancamentoAvaliacao" l WHERE l.id=NEW."lancamentoId" FOR KEY SHARE;
 IF v."segundaChamadaRealizacaoId" IS NOT NULL AND (NEW."decisorId"=v."autorId" OR NEW."decisorId"=v."realizadaPorId") THEN RAISE EXCEPTION 'realizador ou autor não pode oficializar a própria segunda chamada'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "trg_segunda_chamada_link_nota" BEFORE INSERT OR UPDATE OF "segundaChamadaRealizacaoId","registroId","realizadaPorId","realizadaEm" ON "VersaoLancamentoAvaliacao" FOR EACH ROW EXECUTE FUNCTION "guard_segunda_chamada_link_nota"();
CREATE TRIGGER "trg_segunda_chamada_reserva" BEFORE INSERT ON "ReservaSegundaChamada" FOR EACH ROW EXECUTE FUNCTION "guard_segunda_chamada_reserva"();
CREATE TRIGGER "trg_agenda_segunda_chamada" BEFORE INSERT OR UPDATE OF "reservaId","encontroId" ON "AgendaSegundaChamada" FOR EACH ROW EXECUTE FUNCTION "guard_agenda_segunda_chamada"();
CREATE TRIGGER "trg_decisao_segunda_chamada" BEFORE INSERT ON "DecisaoSegundaChamada" FOR EACH ROW EXECUTE FUNCTION "guard_decisao_segunda_chamada"();
CREATE TRIGGER "trg_oficializacao_segunda_chamada" BEFORE INSERT ON "DecisaoLancamentoAvaliacao" FOR EACH ROW EXECUTE FUNCTION "guard_oficializacao_segunda_chamada"();