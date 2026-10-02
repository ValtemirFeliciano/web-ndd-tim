import JSZip from "jszip";

export interface ArquivoLoteInfo {
  id: string;
  file: File;
  nome: string;
  caminhoRelativo: string;
  tamanho: number;
}

export interface ArquivoSalvar {
  nome: string;
  blob: Blob;
}

/** Verifica se a File System Access API está disponível neste navegador */
export function suportaDirectoryPicker(): boolean {
  return typeof window !== "undefined" && typeof (window as any).showDirectoryPicker === "function";
}

/**
 * Lê recursivamente ou na raiz todos os arquivos .pdf de uma pasta selecionada pelo usuário
 */
export async function selecionarPastaEntrada(recursivo = true): Promise<ArquivoLoteInfo[]> {
  if (!suportaDirectoryPicker()) {
    throw new Error("Seu navegador não suporta a File System Access API. Utilize o Google Chrome, Edge ou Opera.");
  }

  const dirHandle = await (window as any).showDirectoryPicker({
    id: "ndd-forge-entrada",
    mode: "read",
  });

  const lista: ArquivoLoteInfo[] = [];

  async function varrerDiretorio(handle: any, caminhoPai: string) {
    for await (const entry of handle.values()) {
      if (entry.kind === "file") {
        if (entry.name.toLowerCase().endsWith(".pdf")) {
          const file: File = await entry.getFile();
          const rel = caminhoPai ? `${caminhoPai}/${entry.name}` : entry.name;
          lista.push({
            id: `${rel}_${file.size}_${file.lastModified}`,
            file,
            nome: entry.name,
            caminhoRelativo: rel,
            tamanho: file.size,
          });
        }
      } else if (entry.kind === "directory" && recursivo) {
        const subPai = caminhoPai ? `${caminhoPai}/${entry.name}` : entry.name;
        await varrerDiretorio(entry, subPai);
      }
    }
  }

  await varrerDiretorio(dirHandle, "");
  // Ordena por caminho relativo alfabeticamente
  lista.sort((a, b) => a.caminhoRelativo.localeCompare(b.caminhoRelativo));
  return lista;
}

/**
 * Abre o seletor nativo do navegador para o usuário escolher onde deseja salvar as NDDs
 */
export async function selecionarPastaSaida(): Promise<any> {
  if (!suportaDirectoryPicker()) {
    throw new Error("Seu navegador não suporta a File System Access API para salvar diretamente em pasta.");
  }
  return await (window as any).showDirectoryPicker({
    id: "ndd-forge-saida",
    mode: "readwrite",
  });
}

/* ------------------------------------------------------------------ */
/*  Persistência da Pasta Padrão no Navegador (IndexedDB)             */
/* ------------------------------------------------------------------ */

const DB_NAME = "ndd_forge_fs_db";
const STORE_NAME = "handles";
const KEY_PASTA_PADRAO = "pasta_padrao_ndd";
export const EVENTO_PASTA_PADRAO = "nddforge:pastaPadraoChanged";

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB não disponível."));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Salva o handle da pasta padrão no IndexedDB e seu nome no localStorage */
export async function salvarPastaPadrao(handle: any): Promise<void> {
  const db = await abrirDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(handle, KEY_PASTA_PADRAO);
    req.onsuccess = () => {
      try {
        const nome = handle.name || "Pasta Selecionada";
        localStorage.setItem("nddforge.pastaPadraoNome", nome);
        window.dispatchEvent(new CustomEvent(EVENTO_PASTA_PADRAO, { detail: { nome } }));
      } catch {}
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/** Obtém o handle da pasta padrão salvo no IndexedDB (se existir) */
export async function obterPastaPadrao(): Promise<any | null> {
  if (!suportaDirectoryPicker()) return null;
  try {
    const db = await abrirDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_PASTA_PADRAO);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Remove a pasta padrão configurada */
export async function removerPastaPadrao(): Promise<void> {
  try {
    const db = await abrirDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(KEY_PASTA_PADRAO);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    localStorage.removeItem("nddforge.pastaPadraoNome");
    window.dispatchEvent(new CustomEvent(EVENTO_PASTA_PADRAO, { detail: { nome: null } }));
  } catch {}
}

/** Lê o nome da pasta padrão salvo em cache síncrono */
export function obterNomePastaPadraoCache(): string | null {
  try {
    return localStorage.getItem("nddforge.pastaPadraoNome");
  } catch {
    return null;
  }
}

/** Verifica se a permissão de leitura/gravação já foi concedida ou solicita sob clique do usuário */
export async function verificarEObterPermissao(handle: any, mode: "read" | "readwrite" = "readwrite"): Promise<boolean> {
  if (!handle) return false;
  try {
    const status = await handle.queryPermission({ mode });
    if (status === "granted") return true;
    const requestStatus = await handle.requestPermission({ mode });
    return requestStatus === "granted";
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Gravação e Empacotamento com Criação Automática de Subpastas      */
/* ------------------------------------------------------------------ */

/**
 * Salva uma única NDD criando a subpasta [NDD] WINITY_... e o arquivo .xlsx dentro dela
 */
export async function salvarNddIndividualEmSubpasta(
  dirHandle: any,
  nomeArquivo: string,
  blob: Blob
): Promise<{ pastaCriada: string; arquivoCriado: string }> {
  // Nome da subpasta é exatamente o nome do arquivo sem .xlsx
  const nomePasta = nomeArquivo.replace(/\.xlsx$/i, "");
  const subDirHandle = await dirHandle.getDirectoryHandle(nomePasta, { create: true });
  const fileHandle = await subDirHandle.getFileHandle(nomeArquivo, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return { pastaCriada: nomePasta, arquivoCriado: nomeArquivo };
}

/**
 * Gera um pacote .ZIP contendo a pasta [NDD] WINITY_... e o arquivo .xlsx dentro dela
 */
export async function gerarZipNddIndividual(nomeArquivo: string, blob: Blob): Promise<Blob> {
  const zip = new JSZip();
  const nomePasta = nomeArquivo.replace(/\.xlsx$/i, "");
  zip.folder(nomePasta)?.file(nomeArquivo, blob);
  return await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/**
 * Grava uma lista de arquivos diretamente no diretório do sistema de arquivos,
 * criando para CADA planilha sua respectiva subpasta:
 * [NDD] WINITY_{ID_OPERADORA}_{ID_WINITY}_{CIDADE}_{ID_OPERADORA} / [NDD] WINITY_....xlsx
 */
export async function salvarArquivosEmPasta(
  dirHandle: any,
  arquivos: ArquivoSalvar[],
  onProgresso?: (atual: number, total: number, nome: string) => void
): Promise<number> {
  let salvos = 0;
  for (let i = 0; i < arquivos.length; i++) {
    const arq = arquivos[i];
    const nomePasta = arq.nome.replace(/\.xlsx$/i, "");
    onProgresso?.(i + 1, arquivos.length, `${nomePasta}/${arq.nome}`);
    
    // Cria ou abre a subpasta com o nome da NDD
    const subDirHandle = await dirHandle.getDirectoryHandle(nomePasta, { create: true });
    // Cria a planilha dentro da subpasta
    const fileHandle = await subDirHandle.getFileHandle(arq.nome, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(arq.blob);
    await writable.close();
    salvos++;
  }
  return salvos;
}

/**
 * Compacta múltiplos arquivos em um único pacote .ZIP,
 * organizando cada planilha dentro de sua própria subpasta [NDD] WINITY_.../
 */
export async function gerarPacoteZip(arquivos: ArquivoSalvar[]): Promise<Blob> {
  const zip = new JSZip();
  arquivos.forEach((arq) => {
    const nomePasta = arq.nome.replace(/\.xlsx$/i, "");
    zip.folder(nomePasta)?.file(arq.nome, arq.blob);
  });
  return await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/**
 * Converte um objeto File para base64 limpo (sem prefixo data:...;base64,)
 */
export function lerArquivoComoBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const partes = dataUrl.split(",");
      const mime = partes[0].match(/:(.*?);/)?.[1] || "application/pdf";
      const base64 = partes[1] || "";
      resolve({ base64, mime });
    };
    reader.onerror = () => reject(new Error(`Falha ao ler o arquivo "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

