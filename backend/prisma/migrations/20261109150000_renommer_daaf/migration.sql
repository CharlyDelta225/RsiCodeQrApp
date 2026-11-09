-- Le département s'écrit DAAF. Un temple qui aurait déjà un DAAF garde ses deux lignes (nom unique par temple).
UPDATE "Departement" AS d
SET "nom" = 'DAAF',
    "libelleCarte" = CASE WHEN UPPER(TRIM(d."libelleCarte")) = 'DAF' THEN NULL ELSE d."libelleCarte" END
WHERE UPPER(TRIM(d."nom")) = 'DAF'
  AND NOT EXISTS (
    SELECT 1 FROM "Departement" AS autre
    WHERE autre."egliseId" = d."egliseId" AND autre."nom" = 'DAAF'
  );

-- La carte DAAF porte le titre seul, dans tous les temples.
UPDATE "Departement" SET "modeleCarte" = 'TITRE' WHERE UPPER(TRIM("nom")) = 'DAAF';
