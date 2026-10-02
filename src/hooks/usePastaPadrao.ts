import { useState, useEffect, useCallback } from "react";
import {
  suportaDirectoryPicker,
  selecionarPastaSaida,
  salvarPastaPadrao,
  obterPastaPadrao,
  removerPastaPadrao,
  obterNomePastaPadraoCache,
  verificarEObterPermissao,
  EVENTO_PASTA_PADRAO,
} from "../lib/fileSystem";

export interface UsePastaPadraoReturn {
  suportado: boolean;
  nome: string | null;
  handle: any | null;
  carregando: boolean;
  definirPasta: (customHandle?: any) => Promise<boolean>;
  removerPasta: () => Promise<void>;
  obterHandleComPermissao: () => Promise<any | null>;
}

/**
 * Hook para gerenciar e sincronizar a pasta padrão de saída das NDDs
 * usando IndexedDB e eventos customizados entre componentes.
 */
export function usePastaPadrao(): UsePastaPadraoReturn {
  const [suportado] = useState<boolean>(() => suportaDirectoryPicker());
  const [nome, setNome] = useState<string | null>(() => obterNomePastaPadraoCache());
  const [handle, setHandle] = useState<any | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);

  // Carrega o handle do IndexedDB na montagem
  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const h = await obterPastaPadrao();
        if (ativo && h) {
          setHandle(h);
          setNome(h.name || obterNomePastaPadraoCache());
        }
      } catch (e) {
        console.warn("[NDDForge] Erro ao carregar pasta padrão do IndexedDB:", e);
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregar();

    // Sincroniza em tempo real com alterações de outras abas ou componentes
    const onMudou = (e: any) => {
      const novoNome = e?.detail?.nome ?? obterNomePastaPadraoCache();
      setNome(novoNome);
      if (!novoNome) {
        setHandle(null);
      } else {
        obterPastaPadrao().then((h) => {
          if (ativo) setHandle(h);
        });
      }
    };

    window.addEventListener(EVENTO_PASTA_PADRAO, onMudou);
    return () => {
      ativo = false;
      window.removeEventListener(EVENTO_PASTA_PADRAO, onMudou);
    };
  }, []);

  const definirPasta = useCallback(async (customHandle?: any): Promise<boolean> => {
    try {
      const h = customHandle || (await selecionarPastaSaida());
      if (!h) return false;

      const perm = await verificarEObterPermissao(h, "readwrite");
      if (!perm) {
        console.warn("[NDDForge] Permissão de escrita negada na pasta selecionada.");
        return false;
      }

      await salvarPastaPadrao(h);
      setHandle(h);
      setNome(h.name || "Pasta Selecionada");
      return true;
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error("[NDDForge] Falha ao definir pasta padrão:", e);
      }
      return false;
    }
  }, []);

  const removerPasta = useCallback(async (): Promise<void> => {
    try {
      await removerPastaPadrao();
      setHandle(null);
      setNome(null);
    } catch (e) {
      console.error("[NDDForge] Falha ao remover pasta padrão:", e);
    }
  }, []);

  const obterHandleComPermissao = useCallback(async (): Promise<any | null> => {
    let h = handle;
    if (!h) {
      h = await obterPastaPadrao();
      if (h) setHandle(h);
    }
    if (!h) return null;

    const ok = await verificarEObterPermissao(h, "readwrite");
    return ok ? h : null;
  }, [handle]);

  return {
    suportado,
    nome,
    handle,
    carregando,
    definirPasta,
    removerPasta,
    obterHandleComPermissao,
  };
}
