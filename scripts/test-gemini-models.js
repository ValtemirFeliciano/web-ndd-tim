// Script para testar chamadas aos modelos Gemini e diagnosticar o erro 403 e a existência do gemini-2.5-flash-lite
import https from "https";

const BASE_HOST = "generativelanguage.googleapis.com";

function testEndpoint(method, path, body = null) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: BASE_HOST,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let respData = "";
        res.on("data", (chunk) => (respData += chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            body: respData,
          });
        });
      }
    );

    req.on("error", (err) => {
      resolve({ error: err.message });
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function run() {
  console.log("=== TESTANDO ENDPOINTS DO GOOGLE GEMINI ===");

  // 1. Chamada sem chave ou chave fictícia para ver como a API responde
  console.log("\n1. Testando chamada POST sem chave para gemini-2.5-flash-lite:");
  const semChave = await testEndpoint(
    "POST",
    "/v1beta/models/gemini-2.5-flash-lite:generateContent",
    { contents: [{ parts: [{ text: "ping" }] }] }
  );
  console.log("Status:", semChave.status);
  console.log("Corpo:", semChave.body);

  console.log("\n2. Testando chamada POST com nome sem prefixo (2.5-flash-lite) sem chave:");
  const semPrefixo = await testEndpoint(
    "POST",
    "/v1beta/models/2.5-flash-lite:generateContent",
    { contents: [{ parts: [{ text: "ping" }] }] }
  );
  console.log("Status:", semPrefixo.status);
  console.log("Corpo:", semPrefixo.body);

  console.log("\n3. Testando chamada com chave inválida de formato real (AIzaSyFakeKeyForTest...):");
  const chaveInvalida = await testEndpoint(
    "POST",
    "/v1beta/models/gemini-2.5-flash-lite:generateContent?key=AIzaSyA_TEST_KEY_FOR_DIAGNOSIS_ONLY_XYZ123",
    { contents: [{ parts: [{ text: "ping" }] }] }
  );
  console.log("Status:", chaveInvalida.status);
  console.log("Corpo:", chaveInvalida.body);

  console.log("\n4. Testando v1 vs v1beta:");
  const testeV1 = await testEndpoint(
    "POST",
    "/v1/models/gemini-2.5-flash-lite:generateContent?key=AIzaSyA_TEST_KEY_FOR_DIAGNOSIS_ONLY_XYZ123",
    { contents: [{ parts: [{ text: "ping" }] }] }
  );
  console.log("v1 Status:", testeV1.status);
  console.log("v1 Corpo:", testeV1.body);
}

run();
