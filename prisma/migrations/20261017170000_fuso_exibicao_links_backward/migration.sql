-- Revisão R1 do #210 (C1): o CampoFuso das telas de preferência sugere Intl.supportedValuesOf("timeZone"), e o
-- ICU ainda lista links do arquivo backward do tzdata (Asia/Calcutta, Europe/Kiev, America/Buenos_Aires...) que um
-- Postgres sem tzdata-legacy não tem em pg_timezone_names. Uma linha que guarde um deles fica travada pelo trigger
-- validar_fuso_exibicao_266 em qualquer UPDATE. Converte as preferências já gravadas para o nome canônico IANA, com
-- o mesmo mapa de LINKS_FUSO_BACKWARD_ICU (src/server/operacao/fuso.ts). Complementa a 20261017150000 (US/*, Brazil/*),
-- que não é editada. Idempotente; só toca "fusoExibicao". Fusos de origem e snapshots não mudam.
UPDATE "Usuario" u SET "fusoExibicao" = a.canonico
FROM (VALUES
  ('Africa/Asmera', 'Africa/Asmara'),
  ('America/Buenos_Aires', 'America/Argentina/Buenos_Aires'),
  ('America/Catamarca', 'America/Argentina/Catamarca'),
  ('America/Cordoba', 'America/Argentina/Cordoba'),
  ('America/Godthab', 'America/Nuuk'),
  ('America/Indianapolis', 'America/Indiana/Indianapolis'),
  ('America/Jujuy', 'America/Argentina/Jujuy'),
  ('America/Louisville', 'America/Kentucky/Louisville'),
  ('America/Mendoza', 'America/Argentina/Mendoza'),
  ('Asia/Calcutta', 'Asia/Kolkata'),
  ('Asia/Katmandu', 'Asia/Kathmandu'),
  ('Asia/Rangoon', 'Asia/Yangon'),
  ('Asia/Saigon', 'Asia/Ho_Chi_Minh'),
  ('Atlantic/Faeroe', 'Atlantic/Faroe'),
  ('Europe/Kiev', 'Europe/Kyiv'),
  ('Pacific/Enderbury', 'Pacific/Kanton'),
  ('Pacific/Ponape', 'Pacific/Pohnpei'),
  ('Pacific/Truk', 'Pacific/Chuuk')
) AS a(apelido, canonico)
WHERE lower(u."fusoExibicao") = lower(a.apelido);

UPDATE "ContaPortalAluno" c SET "fusoExibicao" = a.canonico
FROM (VALUES
  ('Africa/Asmera', 'Africa/Asmara'),
  ('America/Buenos_Aires', 'America/Argentina/Buenos_Aires'),
  ('America/Catamarca', 'America/Argentina/Catamarca'),
  ('America/Cordoba', 'America/Argentina/Cordoba'),
  ('America/Godthab', 'America/Nuuk'),
  ('America/Indianapolis', 'America/Indiana/Indianapolis'),
  ('America/Jujuy', 'America/Argentina/Jujuy'),
  ('America/Louisville', 'America/Kentucky/Louisville'),
  ('America/Mendoza', 'America/Argentina/Mendoza'),
  ('Asia/Calcutta', 'Asia/Kolkata'),
  ('Asia/Katmandu', 'Asia/Kathmandu'),
  ('Asia/Rangoon', 'Asia/Yangon'),
  ('Asia/Saigon', 'Asia/Ho_Chi_Minh'),
  ('Atlantic/Faeroe', 'Atlantic/Faroe'),
  ('Europe/Kiev', 'Europe/Kyiv'),
  ('Pacific/Enderbury', 'Pacific/Kanton'),
  ('Pacific/Ponape', 'Pacific/Pohnpei'),
  ('Pacific/Truk', 'Pacific/Chuuk')
) AS a(apelido, canonico)
WHERE lower(c."fusoExibicao") = lower(a.apelido);
