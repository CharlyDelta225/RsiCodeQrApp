-- Index sur le jour civil (AAAA-MM-JJ) : l'historique `/api/pointages` est
-- filtré par plage de dates SANS ouvrierId dans le cas le plus fréquent
-- (pointages du jour / période). L'index (ouvrierId, dateHeure) ne couvrait
-- que la variante par ouvrier ; ici le scan par plage de dates reste rapide
-- même à des centaines de milliers de pointages.

CREATE INDEX "Pointage_jour_idx" ON "Pointage"("jour");