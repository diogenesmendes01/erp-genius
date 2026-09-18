-- Q245: a fotografia Q121/Q165 representa instantes em UTC independentemente
-- do fuso da conexão que aprova ou efetiva a desistência.
BEGIN;
ALTER FUNCTION validar_fontes_decisao_administrativa_desistencia("PedidoDesistenciaPreparacao") SET TimeZone TO 'UTC';
ALTER FUNCTION q165_validar_efeitos_aplicacao(TEXT) SET TimeZone TO 'UTC';
COMMIT;