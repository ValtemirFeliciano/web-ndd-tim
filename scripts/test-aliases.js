/**
 * Bateria de Testes para Aliases e Normalização Inteligente
 * Executar com: node scripts/test-aliases.js
 */

const aliasesPadrao = [
  { campoSistema: "comprimento", aliasPdf: "Length" },
  { campoSistema: "comprimento", aliasPdf: "Height" },
  { campoSistema: "comprimento", aliasPdf: "Alt" },
  { campoSistema: "largura", aliasPdf: "Width" },
  { campoSistema: "largura", aliasPdf: "Larg" },
  { campoSistema: "profundidade", aliasPdf: "Depth" },
  { campoSistema: "profundidade", aliasPdf: "Prof" },
  { campoSistema: "azimute", aliasPdf: "Az" },
  { campoSistema: "azimute", aliasPdf: "Azim" },
  { campoSistema: "qtde", aliasPdf: "Qtd" },
  { campoSistema: "qtde", aliasPdf: "Qtd." },
  { campoSistema: "qtde", aliasPdf: "Quant" },
  { campoSistema: "qtde", aliasPdf: "Quant." },
  { campoSistema: "qtde", aliasPdf: "Qty" },
  { campoSistema: "tipo_equipamento", aliasPdf: "Tipo_de_antena" },
  { campoSistema: "tipo_equipamento", aliasPdf: "Tipo de antena" },
  { campoSistema: "tipo_equipamento", aliasPdf: "TIPO ANTENA" },
  { campoSistema: "tipo_equipamento", aliasPdf: "TIPO DE EQUIPAMENTO" },
  { campoSistema: "tipo_equipamento", aliasPdf: "Equipment" },
  { campoSistema: "modelo", aliasPdf: "Model" },
  { campoSistema: "modelo", aliasPdf: "Mod" },
  { campoSistema: "rad_center", aliasPdf: "Cota" },
  { campoSistema: "rad_center", aliasPdf: "RadCenter" },
  { campoSistema: "ca", aliasPdf: "Arrasto" },
  { campoSistema: "aev_sem_ca", aliasPdf: "Área de exposição" },
  { campoSistema: "aev_com_ca", aliasPdf: "Área de exposição com arrasto" },
  { campoSistema: "aev_com_ca", aliasPdf: "Área com arrasto" },
];

/** Simplifica uma chave removendo acentos, pontuação e parênteses */
function simplificarChave(k) {
  return k
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\(.*?\)/g, "") // remove conteúdo entre parênteses tipo (mm), (°NV)
    .replace(/[^a-z0-9]/g, "") // remove tudo que não for letra ou número
    .trim();
}

/** Divide e converte dimensões compostas como '1400 x 320 x 145' ou '1.40 x 0.32 x 0.15' */
function decomporDimensoes(str) {
  if (!str || typeof str !== "string") return null;
  const limpo = str.replace(/m/gi, "").replace(/,/g, ".").trim();
  const partes = limpo.split(/\s*[xX×*]\s*/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
  
  if (partes.length === 0) return null;

  // Formata para 2 casas decimais caso necessário
  const fmt = (n) => {
    // Se veio em milímetros (> 20), converte para metros
    const emMetros = n > 20 ? n / 1000 : n;
    return Number.isInteger(emMetros) ? emMetros.toString() : (Math.round((emMetros + Number.EPSILON) * 100) / 100).toFixed(2);
  };

  if (partes.length >= 3) {
    return {
      comprimento: fmt(partes[0]),
      largura: fmt(partes[1]),
      profundidade: fmt(partes[2]),
    };
  } else if (partes.length === 2) {
    return {
      comprimento: fmt(partes[0]),
      largura: fmt(partes[1]),
    };
  } else if (partes.length === 1) {
    // Diâmetro único (ex: antena MW 600mm)
    return {
      profundidade: fmt(partes[0]),
    };
  }
  return null;
}

function aplicarAliasesInteligente(obj, aliases = []) {
  if (!obj || typeof obj !== "object") return obj;

  const resultado = {};
  const chavesOriginais = Object.keys(obj);

  // Mapeamento semântico canônico
  const canonicMap = {
    // Tipo
    "tipoequipamento": "tipo_equipamento",
    "tipo": "tipo_equipamento",
    "tipodeantena": "tipo_equipamento",
    "tipoantena": "tipo_equipamento",
    "tipodeequipamento": "tipo_equipamento",
    "tipodoequipamento": "tipo_equipamento",
    "antena": "tipo_equipamento",
    "equipment": "tipo_equipamento",
    "antennatype": "tipo_equipamento",
    
    // Modelo
    "modelo": "modelo",
    "model": "modelo",
    "mod": "modelo",
    "antennamodel": "modelo",
    
    // Quantidade
    "qtde": "qtde",
    "qtd": "qtde",
    "qty": "qtde",
    "quant": "qtde",
    "quantidade": "qtde",
    
    // Azimute
    "azimute": "azimute",
    "az": "azimute",
    "azim": "azimute",
    "azimuth": "azimute",
    
    // Rad Center (cota de instalação na torre)
    "radcenter": "rad_center",
    "cota": "rad_center",
    "cotainstalacao": "rad_center",
    
    // Dimensões individuais
    "comprimento": "comprimento",
    "length": "comprimento",
    "height": "comprimento",
    "alt": "comprimento",
    "largura": "largura",
    "larg": "largura",
    "width": "largura",
    "profundidade": "profundidade",
    "prof": "profundidade",
    "depth": "profundidade",
    
    // Dimensões compostas
    "dimensoes": "dimensoes_compostas",
    "dimensions": "dimensoes_compostas",
    "dimensoesmm": "dimensoes_compostas",
    
    // Arrasto e AEV
    "ca": "ca",
    "arrasto": "ca",
    "aevsemca": "aev_sem_ca",
    "aev": "aev_sem_ca",
    "areadeexposicao": "aev_sem_ca",
    "aevcomca": "aev_com_ca",
    "areadeexposicaocomarrasto": "aev_com_ca",
    "areacomarrasto": "aev_com_ca",
  };

  // 1. Processar chaves normalizadas
  for (const k of chavesOriginais) {
    const sKey = simplificarChave(k);
    let val = obj[k];

    // Limpar valores típicos (graus, etc)
    if (typeof val === "string") {
      val = val.trim();
      if (sKey === "azimute" || sKey === "az") {
        val = val.replace(/[°º\s]/g, "");
      }
    }

    // Caso especial: chave "ALTURA"
    // Se o valor for > 10 (ex: 50,0000m ou 48,0000m), é cota de torre (rad_center),
    // a menos que seja claramente a dimensão em mm (que viria em dimensoes)
    if (sKey === "altura") {
      const numAlt = parseFloat(String(val).replace(",", "."));
      if (numAlt > 10 && numAlt < 200) {
        resultado["rad_center"] = val;
      } else {
        resultado["comprimento"] = val;
      }
      continue;
    }

    const destino = canonicMap[sKey];
    if (destino) {
      if (destino === "dimensoes_compostas") {
        const decomposto = decomporDimensoes(val);
        if (decomposto) {
          if (decomposto.comprimento && !resultado["comprimento"]) resultado["comprimento"] = decomposto.comprimento;
          if (decomposto.largura && !resultado["largura"]) resultado["largura"] = decomposto.largura;
          if (decomposto.profundidade && !resultado["profundidade"]) resultado["profundidade"] = decomposto.profundidade;
        }
      } else {
        if (!resultado[destino]) {
          resultado[destino] = val;
        }
      }
    } else {
      resultado[sKey] = val;
    }
  }

  // 2. Aplicar aliases customizados do usuário se algum campo ainda faltar
  aliases.forEach((alias) => {
    const aliasSimples = simplificarChave(alias.aliasPdf);
    const campoSistema = alias.campoSistema.toLowerCase();
    if (resultado[campoSistema] === undefined || resultado[campoSistema] === "") {
      for (const k of chavesOriginais) {
        if (simplificarChave(k) === aliasSimples) {
          resultado[campoSistema] = obj[k];
          break;
        }
      }
    }
  });

  // 3. Fallback determinístico para tipo_equipamento idêntico ao normalizarDados do sistema
  let tipoEquip = resultado["tipo_equipamento"];
  if (!tipoEquip || tipoEquip === "-") {
    // Procura se algum valor do objeto retornado é "MODULO", "RF", "MW", "GPS" ou "TMA"
    for (const [k, v] of Object.entries(obj ?? {})) {
      if (typeof v === "string" && ["MODULO", "RF", "MW", "GPS", "TMA"].includes(v.trim().toUpperCase())) {
        tipoEquip = v.trim().toUpperCase();
        break;
      }
    }
    // Se ainda estiver vazio e o modelo contiver "RRU", preenche com "MODULO"
    if (!tipoEquip && resultado["modelo"] && String(resultado["modelo"]).toUpperCase().includes("RRU")) {
      tipoEquip = "MODULO";
    }
    if (tipoEquip) {
      resultado["tipo_equipamento"] = tipoEquip;
    }
  }

  return resultado;
}

// Bateria de Casos de Teste
const casosDeTeste = [
  {
    nome: "Caso 1: Tabela do PPI Breu Branco (PDF Anexado - Antena RF)",
    entrada: {
      "ALTURA": "50,0000",
      "SETOR": "ALPHA",
      "TIPO DE ANTENA": "RF",
      "MODELO": "ODI-065R15M18JJ02-GQ V1",
      "DIMENSÕES (mm)": "1400 x 320 x 145",
      "AZIMUTE (°NV)": "75°",
      "QUANT.": "01",
      "ÁREA DE EXPOSIÇÃO (m²)": "0,448",
      "ARRASTO": "1.2",
      "ÁREA DE EXPOSIÇÃO (m²) COM ARRASTO": "0,538"
    },
    esperado: {
      tipo_equipamento: "RF",
      modelo: "ODI-065R15M18JJ02-GQ V1",
      qtde: "01",
      azimute: "75",
      comprimento: "1.40",
      largura: "0.32",
      profundidade: "0.15",
      rad_center: "50,0000",
      aev_sem_ca: "0,448",
      ca: "1.2",
      aev_com_ca: "0,538"
    }
  },
  {
    nome: "Caso 2: Tabela do PPI Breu Branco (Antena MW)",
    entrada: {
      "ALTURA": "48,0000",
      "SETOR": "-",
      "TIPO DE ANTENA": "MW",
      "MODELO": "MINI-LINK 600",
      "DIMENSÕES (mm)": "600",
      "AZIMUTE (°NV)": "0°",
      "QUANT.": "1",
      "ÁREA DE EXPOSIÇÃO (m²)": "0,283",
      "ARRASTO": "1.6",
      "ÁREA COM ARRASTO": "0,452"
    },
    esperado: {
      tipo_equipamento: "MW",
      modelo: "MINI-LINK 600",
      qtde: "1",
      azimute: "0",
      profundidade: "0.60",
      rad_center: "48,0000",
      ca: "1.6"
    }
  },
  {
    nome: "Caso 3: Padrão em Inglês (Height/Width/Depth/RadCenter)",
    entrada: {
      "Equipment": "RF",
      "Model": "TQB-6565",
      "Qty": 3,
      "Az": "120",
      "Length": "2.0",
      "Width": "0.3",
      "Depth": "0.15",
      "RadCenter": "45.0",
      "AEVsemCA": "0.88",
      "CA": "1.2",
      "AEVcomCA": "1.05"
    },
    esperado: {
      tipo_equipamento: "RF",
      modelo: "TQB-6565",
      qtde: 3,
      azimute: "120",
      comprimento: "2.0",
      largura: "0.3",
      profundidade: "0.15",
      rad_center: "45.0",
      aev_sem_ca: "0.88",
      ca: "1.2",
      aev_com_ca: "1.05"
    }
  },
  {
    nome: "Caso 4: Abreviações em Português (Qtd, Cota, Alt, Larg, Prof)",
    entrada: {
      "Tipo": "Painel",
      "Mod": "APXVAALL24",
      "Qtd": 2,
      "Azim": "90",
      "Cota": "52",
      "Alt": "2.60",
      "Larg": "0.49",
      "Prof": "0.21",
      "AEV": "1.27",
      "CA": "1.2"
    },
    esperado: {
      tipo_equipamento: "Painel",
      modelo: "APXVAALL24",
      qtde: 2,
      azimute: "90",
      rad_center: "52",
      comprimento: "2.60",
      largura: "0.49",
      profundidade: "0.21"
    }
  },
  {
    nome: "Caso 5: Dimensões Compostas com 'x' e unidade m ('1,40m x 0,32m x 0,15m')",
    entrada: {
      "tipo_equipamento": "RF",
      "modelo": "TEST-1",
      "qtde": 1,
      "dimensoes": "1,40m x 0,32m x 0,15m",
      "rad_center": "60m"
    },
    esperado: {
      comprimento: "1.40",
      largura: "0.32",
      profundidade: "0.15"
    }
  },
  {
    nome: "Caso 6: Linha 04 do PPI - RRU NOKIA com TIPO DE ANTENA: MODULO",
    entrada: {
      "ALTURA": "40",
      "SETOR": "-",
      "TIPO DE ANTENA": "MODULO",
      "MODELO": "RRU NOKIA",
      "QUANT.": "03",
      "AZIMUTE (°NV)": "-",
      "DIMENSÕES (mm)": "560 x 490 x 140",
      "ÁREA DE EXPOSIÇÃO SEM ARRASTO": "0.27",
      "ARRASTO": "1.2",
      "ÁREA DE EXPOSIÇÃO COM ARRASTO": "0.33"
    },
    esperado: {
      tipo_equipamento: "MODULO",
      modelo: "RRU NOKIA",
      qtde: "03",
      azimute: "-",
      comprimento: "0.56",
      largura: "0.49",
      profundidade: "0.14",
      rad_center: "40",
      ca: "1.2"
    }
  },
  {
    nome: "Caso 7: Chave alternativa 'tipo_antena' (sem 'de') retornada pela IA",
    entrada: {
      "tipo_antena": "MODULO",
      "modelo": "RRU HUAWEI",
      "qtde": "2",
      "rad_center": "42"
    },
    esperado: {
      tipo_equipamento: "MODULO",
      modelo: "RRU HUAWEI",
      qtde: "2",
      rad_center: "42"
    }
  },
  {
    nome: "Caso 8: IA deixou tipo_equipamento vazio para RRU (Fallback por modelo)",
    entrada: {
      "tipo_equipamento": "",
      "modelo": "RRU NOKIA AHEGB",
      "qtde": "3",
      "rad_center": "40"
    },
    esperado: {
      tipo_equipamento: "MODULO",
      modelo: "RRU NOKIA AHEGB",
      qtde: "3",
      rad_center: "40"
    }
  }
];

console.log("================================================================================");
console.log("TESTE DE ALIASES (IMPLEMENTACAO INTELIGENTE)");
console.log("================================================================================");

let totalFalhas = 0;
let totalSucessos = 0;

casosDeTeste.forEach((caso, i) => {
  console.log(`\n[${i + 1}/${casosDeTeste.length}] ${caso.nome}`);
  const resultado = aplicarAliasesInteligente(caso.entrada, aliasesPadrao);
  
  let falhou = false;
  const diferencas = [];

  for (const [campo, esperadoVal] of Object.entries(caso.esperado)) {
    const obtidoVal = resultado[campo];
    if (obtidoVal === undefined || obtidoVal === "") {
      falhou = true;
      diferencas.push(`  x [${campo}] Esperado: "${esperadoVal}" | Obtido: NAO ENCONTRADO / VAZIO`);
    } else if (String(obtidoVal).trim() !== String(esperadoVal).trim()) {
      falhou = true;
      diferencas.push(`  ! [${campo}] Esperado: "${esperadoVal}" | Obtido: "${obtidoVal}"`);
    }
  }

  if (falhou) {
    totalFalhas++;
    console.log("  STATUS: FALHOU");
    diferencas.forEach(d => console.log(d));
  } else {
    totalSucessos++;
    console.log("  STATUS: PASSOU");
  }
});

console.log("\n================================================================================");
console.log(`RESULTADO: ${totalSucessos} PASSARAM | ${totalFalhas} FALHARAM`);
console.log("================================================================================\n");
