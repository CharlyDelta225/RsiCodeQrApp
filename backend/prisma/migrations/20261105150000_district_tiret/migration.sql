-- District imprimé : un tiret entre DISTRICT et le lieu (« DISTRICT-ADJAHUI », pas « DISTRICT ADJAHUI »).
UPDATE "Eglise"
SET "libelleCarte" = regexp_replace("libelleCarte", '^DISTRICT[[:space:]-]+', 'DISTRICT-')
WHERE "libelleCarte" ~ '^DISTRICT[[:space:]]';
