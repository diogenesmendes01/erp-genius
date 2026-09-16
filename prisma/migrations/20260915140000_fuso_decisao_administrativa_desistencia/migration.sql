-- Q121/597: as colunas TIMESTAMP(3) da fotografia são UTC sem fuso. A
-- revalidação usa AT TIME ZONE para converter os valores JSON em timestamps;
-- fixar a configuração da função evita que to_char(timestamptz) os formate no
-- fuso da sessão (por exemplo, America/Sao_Paulo) e produza uma falsa fonte
-- financeira, documental ou contratual desatualizada.
ALTER FUNCTION validar_fontes_decisao_administrativa_desistencia("PedidoDesistenciaPreparacao")
  SET TimeZone TO 'UTC';
