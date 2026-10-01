// Script simples e direto para testar chamadas ao modelo gemini-2.5-flash-lite via Node.js
// Execução: node scripts/test-call-node.js [SUA_CHAVE_OPCIONAL]

const apiKey = process.argv[2] || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

console.log("======================================================================");
console.log("TESTE NODE.JS - GEMINI 2.5-FLASH-LITE");
console.log("======================================================================");

async function testarModelo() {
  if (!apiKey) {
    console.log("[AVISO] Nenhuma chave fornecida na linha de comando ou ambiente.");
    console.log("Testando requisição envelope para confirmar comportamento da API Google...");
    
    try {
      const resp = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] }),
        }
      );
      console.log(`Resposta HTTP: ${resp.status} ${resp.statusText}`);
      const body = await resp.text();
      console.log("Corpo retornado:", body);
      console.log("\n-> Note que sem chave o Google retorna HTTP 403 PERMISSION_DENIED.");
    } catch (e) {
      console.error("Erro na requisição:", e.message);
    }
    
    console.log("\nPara testar com sua chave real, execute:");
    console.log("  node scripts/test-call-node.js SUA_CHAVE_AQUI");
    return;
  }

  console.log(`[INFO] Chave detectada (${apiKey.slice(0, 6)}...${apiKey.slice(-4)})`);

  // 1. Testar endpoint com gemini-2.5-flash-lite
  console.log("\n[1/2] Chamando modelo 'gemini-2.5-flash-lite' via REST v1beta...");
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Responda apenas: OK - modelo gemini-2.5-flash-lite operando com sucesso." }] }],
        generationConfig: { maxOutputTokens: 30, temperature: 0.1 },
      }),
    });

    console.log(`Status HTTP: ${resp.status}`);
    const textoResp = await resp.text();
    if (resp.status === 200) {
      const j = JSON.parse(textoResp);
      const output = j?.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log("✓ Resposta do modelo:", output?.trim());
    } else {
      console.log("✗ Falha:", textoResp);
    }
  } catch (err) {
    console.error("Erro ao chamar API:", err.message);
  }

  // 2. Listar modelos
  console.log("\n[2/2] Consultando lista de modelos disponíveis na conta...");
  try {
    const urlList = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const respList = await fetch(urlList);
    if (respList.status === 200) {
      const data = await respList.json();
      const todos = (data.models || []).map((m) => m.name.replace(/^models\//, ""));
      const flashLite = todos.filter((m) => m.includes("lite") || m.includes("2.5"));
      console.log("Modelos 2.5 e Flash-Lite encontrados:");
      flashLite.forEach((m) => console.log(`  - ${m}`));
    } else {
      console.log(`✗ Erro ao listar: ${respList.status}`);
    }
  } catch (err) {
    console.error("Erro ao listar modelos:", err.message);
  }

  console.log("\n======================================================================");
}

testarModelo();
