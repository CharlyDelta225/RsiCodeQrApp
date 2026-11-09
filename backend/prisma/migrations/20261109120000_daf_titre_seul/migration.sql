-- La carte du département DAF porte le titre seul, sans le mot « Département », dans tous les temples.
UPDATE "Departement" SET "modeleCarte" = 'TITRE' WHERE UPPER(TRIM("nom")) = 'DAF';
