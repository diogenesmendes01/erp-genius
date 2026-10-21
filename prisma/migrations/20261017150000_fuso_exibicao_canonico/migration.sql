-- Decisão do dono (17/10/2026): apelidos legados de fuso (US/*, Brazil/*) não existem num Postgres sem
-- tzdata-legacy. Uma linha de "Usuario" ou "ContaPortalAluno" que guarde um deles fica travada pelo trigger
-- validar_fuso_exibicao_266 em qualquer UPDATE. Converte as preferências já gravadas para o nome canônico IANA,
-- com o mesmo mapa de APELIDOS_FUSO_LEGADOS (src/server/operacao/fuso.ts). Idempotente; só toca "fusoExibicao".
-- Fusos de origem e snapshots (fusoOrigem, fusoReferencia etc.) não mudam: são registros históricos.
UPDATE "Usuario" u SET "fusoExibicao" = a.canonico
FROM (VALUES
  ('US/Eastern', 'America/New_York'),
  ('US/Central', 'America/Chicago'),
  ('US/Mountain', 'America/Denver'),
  ('US/Pacific', 'America/Los_Angeles'),
  ('US/Arizona', 'America/Phoenix'),
  ('US/Alaska', 'America/Anchorage'),
  ('US/Hawaii', 'Pacific/Honolulu'),
  ('US/East-Indiana', 'America/Indiana/Indianapolis'),
  ('US/Indiana-Starke', 'America/Indiana/Knox'),
  ('US/Michigan', 'America/Detroit'),
  ('US/Aleutian', 'America/Adak'),
  ('US/Samoa', 'Pacific/Pago_Pago'),
  ('Brazil/East', 'America/Sao_Paulo'),
  ('Brazil/West', 'America/Manaus'),
  ('Brazil/Acre', 'America/Rio_Branco'),
  ('Brazil/DeNoronha', 'America/Noronha')
) AS a(apelido, canonico)
WHERE lower(u."fusoExibicao") = lower(a.apelido);

UPDATE "ContaPortalAluno" c SET "fusoExibicao" = a.canonico
FROM (VALUES
  ('US/Eastern', 'America/New_York'),
  ('US/Central', 'America/Chicago'),
  ('US/Mountain', 'America/Denver'),
  ('US/Pacific', 'America/Los_Angeles'),
  ('US/Arizona', 'America/Phoenix'),
  ('US/Alaska', 'America/Anchorage'),
  ('US/Hawaii', 'Pacific/Honolulu'),
  ('US/East-Indiana', 'America/Indiana/Indianapolis'),
  ('US/Indiana-Starke', 'America/Indiana/Knox'),
  ('US/Michigan', 'America/Detroit'),
  ('US/Aleutian', 'America/Adak'),
  ('US/Samoa', 'Pacific/Pago_Pago'),
  ('Brazil/East', 'America/Sao_Paulo'),
  ('Brazil/West', 'America/Manaus'),
  ('Brazil/Acre', 'America/Rio_Branco'),
  ('Brazil/DeNoronha', 'America/Noronha')
) AS a(apelido, canonico)
WHERE lower(c."fusoExibicao") = lower(a.apelido);
