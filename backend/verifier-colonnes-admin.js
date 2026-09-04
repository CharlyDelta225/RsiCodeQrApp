import dotenv from "dotenv";
dotenv.config();
import pkg from "pg";
const { Client } = pkg;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const res = await client.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'Admin'
    ORDER BY ordinal_position;
  `);

  console.log("Colonnes réelles de la table \"Admin\" :");
  console.table(res.rows);

  await client.end();
}

main().catch((e) => {
  console.error("Erreur de connexion :", e.message);
});
