/**
 * Bateria de Testes para a Técnica de Citação Obrigatória (Anti-Alucinação)
 * Executar com: node scripts/test-anti-alucinacao.js
 */

import assert from "assert";

// Simulação dos helpers e lógica idêntica a src/lib/gemini.ts e src/lib/mapping.ts

function simplificarChave(k) {
  return k
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function decomporDimensoes(str) {
  if (!str || typeof str !== "string") return null;
  const limpo = str.replace(/m/gi, "").replace(/,/g, ".").trim();
  const partes = limpo.split(/\s*[xX×*]\s*/).map((p) => parseFloat(p.trim())).filter((p) => !isNaN(p));
  if (partes.length === 0) return null;
  const fmt = (n) => {
    const emMetros = n > 20 ? n / 1000 : n;
    const exato = parseFloat(emMetros.toFixed(4));
    return exato.toString().replace(".", ",");
  };
  if (partes.length >= 3) {
    return { comprimento: fmt(partes[0]), largura: fmt(partes[1]), profundidade: fmt(partes[2]) };
  } else if (partes.length === 2) {
    return { comprimento: fmt(partes[0]), largura: fmt(partes[1]) };
  } else if (partes.length === 1) {
    return { profundidade: fmt(partes[0]) };
  }
  return null;
}

const mapaCanonico = {
  tipoequipamento: "tipo_equipamento",
  tipo: "tipo_equipamento",
  modelo: "modelo",
  model: "modelo",
  qtde: "qtde",
  qtd: "qtde",
  azimute: "azimute",
  comprimento: "comprimento",
  largura: "largura",
  profundidade: "profundidade",
  radcenter: "rad_center",
  cota: "rad_center",
  ca: "ca",
  arrasto: "ca",
  aevsemca: "aev_sem_ca",
  aev: "aev_sem_ca",
  aevcomca: "aev_com_ca",
  trechocitadodopdf: "trecho_citado_do_pdf",
  trechocitado: "trecho_citado_do_pdf",
  trechooriginal: "trecho_citado_do_pdf",
  citacao: "trecho_citado_do_pdf",
  trechopdf: "trecho_citado_do_pdf",
  origemtrecho: "trecho_citado_do_pdf",
  pagina: "pagina",
  pag: "pagina",
  folha: "pagina",
};

function aplicarAliases(obj, aliases = [], logs = []) {
  if (!obj || typeof obj !== "object") return obj;
  const resultado = {};
  for (const k of Object.keys(obj)) {
    const sKey = simplificarChave(k);
    let val = obj[k];
    if (typeof val === "string") val = val.trim();
    const destino = mapaCanonico[sKey];
    if (destino) {
      resultado[destino] = val;
    } else {
      resultado[sKey] = val;
    }
  }
  return resultado;
}

function normalizarDadosSimulado(bruto, aliases = []) {
  const logs = [];
  const log = (level, msg) => logs.push({ level, msg });
  const s = (v) => (v === null || v === undefined ? "" : String(v).trim());
  const eqBrutos = Array.isArray(bruto.equipamentos) ? bruto.equipamentos : [];

  const equipamentos = [];
  const temAlgumaCitacaoNoLote = eqBrutos.some((e) => {
    const rawQuote = e?.trecho_citado_do_pdf || e?.trecho_original || e?.trecho_citado || e?.citacao || "";
    return typeof rawQuote === "string" && rawQuote.trim().length > 3;
  });

  for (let i = 0; i < eqBrutos.length; i++) {
    const e = eqBrutos[i];
    const eComAliases = aplicarAliases(e, aliases, logs);

    let tipoEquip = s(eComAliases?.tipo_equipamento).trim().toUpperCase();
    const modeloUpper = s(eComAliases?.modelo).toUpperCase().trim();
    const trechoCitado = s(
      eComAliases?.trecho_citado_do_pdf ||
      e?.trecho_citado_do_pdf ||
      eComAliases?.trecho_original ||
      e?.trecho_original ||
      e?.trecho_citado ||
      e?.citacao ||
      ""
    ).trim();

    const paginaRaw = eComAliases?.pagina ?? e?.pagina ?? 3;
    let paginaNum = 3;
    if (typeof paginaRaw === "number") {
      paginaNum = paginaRaw;
    } else {
      const matchNum = String(paginaRaw).replace(/\D/g, "");
      paginaNum = matchNum ? parseInt(matchNum, 10) : 3;
    }

    // 1. Verificação Anti-Alucinação:
    // Se a linha é completamente vazia ou fantasma (sem tipo e sem modelo)
    const semTipoNemModelo = (!tipoEquip || tipoEquip === "-") && (!eComAliases?.modelo || eComAliases?.modelo === "-");
    if (semTipoNemModelo) {
      log("warn", `[Anti-Alucinação] Linha #${i + 1} descartada: sem tipo nem modelo identificados.`);
      continue;
    }

    // Se o modelo é claramente cabeçalho ou resumo da tabela
    if (/^(TIPO|MODELO|ANTENA|CARREGAMENTO|TOTAL|RESUMO)/i.test(modeloUpper)) {
      log("warn", `[Anti-Alucinação] Linha #${i + 1} ("${eComAliases?.modelo}") descartada por ser cabeçalho ou resumo da tabela.`);
      continue;
    }

    // Se o lote contém citações obrigatórias mas este item NÃO tem citação ou tem citação nula/inválida
    const citacaoInvalida = /^(não|nao|nenhum|n\/a|null|undefined|vazio|-)$/i.test(trechoCitado);
    if (temAlgumaCitacaoNoLote && (!trechoCitado || citacaoInvalida)) {
      log("warn", `[Anti-Alucinação] Equipamento #${i + 1} ("${eComAliases?.modelo || tipoEquip}") DESCARTADO: modelo não comprovou o item com trecho literal do PDF.`);
      continue;
    }

    if (trechoCitado) {
      log("ok", `[Anti-Alucinação] Equipamento #${i + 1} ("${eComAliases?.modelo || tipoEquip}") comprovado no PDF (Pág. ${paginaNum}): "${trechoCitado}"`);
    }

    const eq = {
      tipo_equipamento: tipoEquip || "RF",
      modelo: s(eComAliases?.modelo),
      qtde: eComAliases?.qtde ?? 1,
      azimute: s(eComAliases?.azimute) || "-",
      comprimento: s(eComAliases?.comprimento),
      largura: s(eComAliases?.largura),
      profundidade: s(eComAliases?.profundidade),
      rad_center: s(eComAliases?.rad_center),
      aev_sem_ca: s(eComAliases?.aev_sem_ca),
      ca: s(eComAliases?.ca) || "-",
      aev_com_ca: s(eComAliases?.aev_com_ca),
      trecho_citado_do_pdf: trechoCitado,
      pagina: paginaNum,
    };

    equipamentos.push(eq);
  }

  // 1. Extração e validação Anti-Alucinação da Localização (Carimbo):
  const trechoLocalizacao = s(
    bruto?.trecho_citado_localizacao ||
    bruto?.trecho_citado_endereco ||
    bruto?.trecho_carimbo ||
    bruto?.rastreabilidade?.origem_localizacao ||
    bruto?.origem_localizacao ||
    ""
  ).trim();

  let pagLocalizacao = bruto?.pagina_localizacao ?? 1;
  if (typeof pagLocalizacao === "string") {
    const num = parseInt(pagLocalizacao.replace(/\D/g, ""), 10);
    pagLocalizacao = !isNaN(num) && num > 0 ? num : 1;
  }

  if (trechoLocalizacao && !/^(não|nao|nenhum|n\/a|null|undefined|-)$/i.test(trechoLocalizacao)) {
    log("ok", `[Anti-Alucinação] Localização comprovada no carimbo (Pág. ${pagLocalizacao}): "${trechoLocalizacao}"`);
  }

  // 2. Extração e validação Anti-Alucinação da Base de Concreto (Legenda Civil):
  const trechoBase = s(
    bruto?.trecho_citado_base ||
    bruto?.trecho_citado_base_concreto ||
    bruto?.trecho_base ||
    bruto?.rastreabilidade?.base_em_concreto ||
    bruto?.origem_base ||
    ""
  ).trim();

  let pagBase = bruto?.pagina_base ?? 2;
  if (typeof pagBase === "string") {
    const num = parseInt(pagBase.replace(/\D/g, ""), 10);
    pagBase = !isNaN(num) && num > 0 ? num : 2;
  }

  let nxBaseFinal = s(bruto.nx_base);
  let diBaseFinal = s(bruto.di_base);

  const baseSemCitacao = !trechoBase || /^(não|nao|nenhum|n\/a|null|undefined|inexistente|-)$/i.test(trechoBase);
  const baseAlucinadaDeOutrosElementos = (
    /haste|aterramento|gradil|cerca|expans[aã]o|recuo/i.test(trechoBase) &&
    !/base.*concreto|base.*implant|base.*equipamento/i.test(trechoBase)
  );

  if ((diBaseFinal || nxBaseFinal) && (baseSemCitacao || baseAlucinadaDeOutrosElementos)) {
    const motivo = baseAlucinadaDeOutrosElementos
      ? `o trecho citado refere-se a aterramento/gradil/expansão ("${trechoBase}") e não à base civil`
      : "nenhum trecho da legenda civil comprovou base a implantar";
    log("warn", `[Anti-Alucinação] Base de concreto descartada (${diBaseFinal || "nx=" + nxBaseFinal}): ${motivo}.`);
    diBaseFinal = "";
    nxBaseFinal = "";
  } else if (trechoBase && !baseSemCitacao) {
    log("ok", `[Anti-Alucinação] Base de concreto comprovada na legenda civil (Pág. ${pagBase}): "${trechoBase}"`);
  }

  const dados = {
    endereco: s(bruto.endereco),
    bairro: s(bruto.bairro),
    cidade: s(bruto.cidade),
    uf: s(bruto.uf),
    cep: s(bruto.cep),
    latitude: s(bruto.latitude),
    longitude: s(bruto.longitude),
    nx_base: nxBaseFinal,
    di_base: diBaseFinal,
    trecho_citado_localizacao: trechoLocalizacao,
    pagina_localizacao: pagLocalizacao,
    trecho_citado_base: trechoBase,
    pagina_base: pagBase,
    equipamentos,
  };

  return { dados, equipamentos, logs };
}

// BATERIA DE TESTES
console.log("=== INICIANDO TESTES DA TÉCNICA DE CITAÇÃO OBRIGATÓRIA (ANTI-ALUCINAÇÃO) ===\n");

// Teste 1: Equipamentos reais com citação do PDF são aprovados
{
  const entrada = {
    equipamentos: [
      {
        tipo_equipamento: "RF",
        modelo: "APXVLL199014-C-A20",
        qtde: 6,
        trecho_citado_do_pdf: "RF | APXVLL199014-C-A20 | 06 | 100° | 1400 x 320 x 145",
        pagina: 3,
      },
      {
        tipo_equipamento: "MW",
        modelo: "VHLP2-18",
        qtde: 1,
        trecho_citado_do_pdf: "MW | VHLP2-18 | 01 | 240° | 600",
        pagina: 3,
      },
    ],
  };

  const res = normalizarDadosSimulado(entrada);
  assert.strictEqual(res.equipamentos.length, 2, "Deveria manter 2 equipamentos válidos");
  assert.strictEqual(res.equipamentos[0].trecho_citado_do_pdf, "RF | APXVLL199014-C-A20 | 06 | 100° | 1400 x 320 x 145");
  assert.strictEqual(res.equipamentos[0].pagina, 3);
  console.log("✔ Teste 1: Equipamentos comprovados com citação literal do PDF aprovados com sucesso.");
}

// Teste 2: Item alucinado (sem citação no PDF) é DESCARTADO automaticamente
{
  const entrada = {
    equipamentos: [
      {
        tipo_equipamento: "RF",
        modelo: "APXVLL199014-C-A20",
        qtde: 6,
        trecho_citado_do_pdf: "RF | APXVLL199014-C-A20 | 06 | 100°",
        pagina: 3,
      },
      {
        tipo_equipamento: "RRU",
        modelo: "RRU 4415 B3 (FANTASMA INVENTADA PELO LLM)",
        qtde: 3,
        trecho_citado_do_pdf: "", // SEM CITAÇÃO!
        pagina: 3,
      },
      {
        tipo_equipamento: "GPS",
        modelo: "GPS ANTENNA",
        qtde: 1,
        trecho_citado_do_pdf: "N/A", // CITAÇÃO INVÁLIDA!
        pagina: 3,
      },
    ],
  };

  const res = normalizarDadosSimulado(entrada);
  assert.strictEqual(res.equipamentos.length, 1, "Deveria descartar os 2 itens alucinados sem comprovação");
  assert.strictEqual(res.equipamentos[0].modelo, "APXVLL199014-C-A20");
  const warnDescarte = res.logs.filter((l) => l.msg.includes("DESCARTADO: modelo não comprovou o item"));
  assert.strictEqual(warnDescarte.length, 2, "Deveria registrar 2 warnings de descarte anti-alucinação");
  console.log("✔ Teste 2: Equipamentos alucinados/sem citação descartados com precisão cirúrgica.");
}

// Teste 3: Cabeçalho ou linha de resumo da tabela é DESCARTADA
{
  const entrada = {
    equipamentos: [
      {
        tipo_equipamento: "RF",
        modelo: "APXVLL199014-C-A20",
        qtde: 6,
        trecho_citado_do_pdf: "RF | APXVLL199014-C-A20 | 06",
        pagina: 3,
      },
      {
        tipo_equipamento: "",
        modelo: "TOTAL DE CARREGAMENTO",
        qtde: 6,
        trecho_citado_do_pdf: "TOTAL: 6 antenas",
        pagina: 3,
      },
    ],
  };

  const res = normalizarDadosSimulado(entrada);
  assert.strictEqual(res.equipamentos.length, 1, "Deveria descartar linha de TOTAL/resumo");
  console.log("✔ Teste 3: Linha de resumo/total de tabela descartada com sucesso.");
}

// Teste 4: Aliases de citação (trecho_original, citacao, folha) funcionam perfeitamente
{
  const entrada = {
    equipamentos: [
      {
        tipo: "ODU",
        modelo: "SR2-D",
        qtde: 2,
        trecho_original: "ODU | SR2-D | 02 | 151 x 151 x 84",
        folha: "03",
      },
    ],
  };

  const res = normalizarDadosSimulado(entrada);
  assert.strictEqual(res.equipamentos.length, 1);
  assert.strictEqual(res.equipamentos[0].trecho_citado_do_pdf, "ODU | SR2-D | 02 | 151 x 151 x 84");
  assert.strictEqual(res.equipamentos[0].pagina, 3);
  console.log("✔ Teste 4: Aliases semânticos (trecho_original, folha) mapeados corretamente.");
}

// Teste 5: Localização com comprovação literal do carimbo
{
  const entrada = {
    endereco: "VC CAFÉ DO POVO",
    bairro: "CRISTO VIVO",
    cidade: "BREU BRANCO",
    uf: "PA",
    cep: "68695-000",
    latitude: "-3.413902",
    longitude: "-49.042893",
    trecho_citado_localizacao: "VC CAFÉ DO POVO - CRISTO VIVO - BREU BRANCO - PA CEP:68695-000 | LAT: -3.413902 LONG: -49.042893",
    pagina_localizacao: 1,
    equipamentos: [],
  };

  const res = normalizarDadosSimulado(entrada);
  assert.strictEqual(res.dados.trecho_citado_localizacao, "VC CAFÉ DO POVO - CRISTO VIVO - BREU BRANCO - PA CEP:68695-000 | LAT: -3.413902 LONG: -49.042893");
  assert.strictEqual(res.dados.pagina_localizacao, 1);
  console.log("✔ Teste 5: Localização ancorada e comprovada pelo carimbo (Pág. 1) com sucesso.");
}

// Teste 6: Base de concreto comprovada pela legenda civil
{
  const entrada = {
    di_base: "1,00x1,00",
    nx_base: "2",
    trecho_citado_base: "2X BASE DE CONCRETO PARA EQUIPAMENTO TIM 1P (1,00X1,00m) - A INSTALAR",
    pagina_base: 2,
    equipamentos: [],
  };

  const res = normalizarDadosSimulado(entrada);
  assert.strictEqual(res.dados.di_base, "1,00x1,00");
  assert.strictEqual(res.dados.nx_base, "2");
  assert.strictEqual(res.dados.trecho_citado_base, "2X BASE DE CONCRETO PARA EQUIPAMENTO TIM 1P (1,00X1,00m) - A INSTALAR");
  assert.strictEqual(res.dados.pagina_base, 2);
  console.log("✔ Teste 6: Base de concreto comprovada pela legenda civil (Pág. 2) aprovada.");
}

// Teste 7: Base de concreto alucinada (sem citação no PDF) é DESCARTADA
{
  const entrada = {
    di_base: "2,00x2,00",
    nx_base: "1",
    trecho_citado_base: "", // Sem citação!
    equipamentos: [],
  };

  const res = normalizarDadosSimulado(entrada);
  assert.strictEqual(res.dados.di_base, "", "di_base deveria ser zerado por falta de citação");
  assert.strictEqual(res.dados.nx_base, "", "nx_base deveria ser zerado por falta de citação");
  const warn = res.logs.find((l) => l.msg.includes("Base de concreto descartada"));
  assert(warn, "Deveria emitir log de descarte anti-alucinação");
  console.log("✔ Teste 7: Base de concreto alucinada sem citação descartada com sucesso.");
}

// Teste 8: Base de concreto alucinada a partir de haste de aterramento é DESCARTADA
{
  const entrada = {
    di_base: "2,00x2,00",
    nx_base: "1",
    trecho_citado_base: "HASTE DE ATERRAMENTO COBREADA 2,00M",
    pagina_base: 2,
    equipamentos: [],
  };

  const res = normalizarDadosSimulado(entrada);
  assert.strictEqual(res.dados.di_base, "", "di_base deveria ser zerado pois o trecho é de aterramento");
  assert.strictEqual(res.dados.nx_base, "", "nx_base deveria ser zerado pois o trecho é de aterramento");
  const warn = res.logs.find((l) => l.msg.includes("refere-se a aterramento/gradil/expansão"));
  assert(warn, "Deveria emitir log identificando aterramento em vez de base civil");
  console.log("✔ Teste 8: Base alucinada a partir de cota de aterramento (2,00m) bloqueada com sucesso.");
}

console.log("\n=======================================================");
console.log("TODOS OS 8 TESTES DA TÉCNICA DE CITAÇÃO OBRIGATÓRIA PASSARAM COM 100% DE SUCESSO!");
console.log("=======================================================\n");
