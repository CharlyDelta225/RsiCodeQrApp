import app from "./app.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✓ API RsiCodeQrApp démarrée sur http://localhost:${PORT}`);
  console.log("  Health : http://localhost:" + PORT + "/api/health");
});