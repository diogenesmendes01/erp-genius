-- Referral CRU do click-to-WhatsApp (review PR #53 3a passada): os campos da Meta tem
-- semantica propria (sourceType ad|post, sourceId = id do anuncio/post, headline = titulo,
-- ctwaClid = id do clique) e NAO sao a hierarquia campanha/conjunto/anuncio/palavra.
-- Guardados crus em colunas proprias em vez de corromper os campos origem*. Migration aditiva.
ALTER TABLE "Lead" ADD COLUMN "waReferralSourceType" TEXT;
ALTER TABLE "Lead" ADD COLUMN "waReferralSourceId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "waReferralHeadline" TEXT;
ALTER TABLE "Lead" ADD COLUMN "waReferralSourceUrl" TEXT;
ALTER TABLE "Lead" ADD COLUMN "waReferralCtwaClid" TEXT;
