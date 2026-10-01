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

/**
 * Grava uma lista de arquivos diretamente no diretório do sistema de arquivos
 */
export async function salvarArquivosEmPasta(
  dirHandle: any,
  arquivos: ArquivoSalvar[],
  onProgresso?: (atual: number, total: number, nome: string) => void
): Promise<number> {
  let salvos = 0;
  for (let i = 0; i < arquivos.length; i++) {
    const arq = arquivos[i];
    onProgresso?.(i + 1, arquivos.length, arq.nome);
    const fileHandle = await dirHandle.getFileHandle(arq.nome, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(arq.blob);
    await writable.close();
    salvos++;
  }
  return salvos;
}

/**
 * Compacta múltiplos arquivos em um único pacote .ZIP
 */
export async function gerarPacoteZip(arquivos: ArquivoSalvar[]): Promise<Blob> {
  const zip = new JSZip();
  arquivos.forEach((arq) => {
    zip.file(arq.nome, arq.blob);
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
