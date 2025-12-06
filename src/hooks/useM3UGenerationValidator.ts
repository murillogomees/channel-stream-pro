/**
 * Hook for M3U Generation with mandatory validation
 * Implements the validation-first workflow before M3U generation
 */

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  m3uSeriesValidationService, 
  type SeriesValidationResult, 
  type SeriesEpisode 
} from '@/services/m3uSeriesValidationService';
import type { GenerationOptions } from '@/components/admin/m3u/M3UGenerationValidator';

export interface M3UGenerationState {
  isValidating: boolean;
  isGenerating: boolean;
  validationResult: SeriesValidationResult | null;
  showValidator: boolean;
  lastGeneratedUrl: string | null;
  error: string | null;
}

export interface UseM3UGenerationValidatorReturn {
  state: M3UGenerationState;
  // Actions
  startValidation: (entries: any[], sourceId: string) => Promise<void>;
  confirmGeneration: (options: GenerationOptions) => Promise<{ success: boolean; cdnUrl?: string; error?: string }>;
  cancelValidation: () => void;
  resetState: () => void;
}

export function useM3UGenerationValidator(): UseM3UGenerationValidatorReturn {
  const { toast } = useToast();
  const [state, setState] = useState<M3UGenerationState>({
    isValidating: false,
    isGenerating: false,
    validationResult: null,
    showValidator: false,
    lastGeneratedUrl: null,
    error: null,
  });

  // Internal state for generation context
  const [generationContext, setGenerationContext] = useState<{
    entries: any[];
    sourceId: string;
    normalizedEpisodes: SeriesEpisode[];
  } | null>(null);

  /**
   * Start validation process (mandatory before generation)
   */
  const startValidation = useCallback(async (entries: any[], sourceId: string) => {
    if (!entries || entries.length === 0) {
      toast({
        title: 'Erro',
        description: 'Nenhuma entrada para validar',
        variant: 'destructive',
      });
      return;
    }

    setState(prev => ({
      ...prev,
      isValidating: true,
      showValidator: true,
      validationResult: null,
      error: null,
    }));

    try {
      console.log(`[M3UGenerationValidator] Starting validation for ${entries.length} entries`);

      // Run validation
      const result = await m3uSeriesValidationService.validateSeriesEntries(entries);

      console.log(`[M3UGenerationValidator] Validation complete:`, {
        valid: result.valid,
        totalEpisodes: result.totalEpisodes,
        duplicatesFound: result.duplicatesFound,
        issues: result.issues.length,
      });

      // Store context for generation
      setGenerationContext({
        entries,
        sourceId,
        normalizedEpisodes: result.normalizedEpisodes,
      });

      setState(prev => ({
        ...prev,
        isValidating: false,
        validationResult: result,
      }));

      // Show toast based on result
      if (!result.valid) {
        toast({
          title: 'Atenção',
          description: `Validação encontrou ${result.issues.filter(i => i.type === 'error').length} erros que precisam ser corrigidos`,
          variant: 'destructive',
        });
      } else if (result.requiresConfirmation) {
        toast({
          title: 'Revisão Necessária',
          description: `${result.duplicatesFound} duplicatas e ${result.issues.length} avisos detectados`,
        });
      }
    } catch (error) {
      console.error('[M3UGenerationValidator] Validation error:', error);
      
      setState(prev => ({
        ...prev,
        isValidating: false,
        error: error instanceof Error ? error.message : 'Erro na validação',
      }));

      toast({
        title: 'Erro na Validação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  }, [toast]);

  /**
   * Confirm generation after validation approval
   */
  const confirmGeneration = useCallback(async (options: GenerationOptions): Promise<{ success: boolean; cdnUrl?: string; error?: string }> => {
    if (!generationContext || !state.validationResult) {
      return { success: false, error: 'Contexto de geração inválido' };
    }

    setState(prev => ({ ...prev, isGenerating: true, showValidator: false }));

    try {
      console.log(`[M3UGenerationValidator] Starting generation with options:`, options);

      // Get normalized and optionally deduplicated episodes
      let episodesToGenerate = generationContext.normalizedEpisodes;

      if (options.removeDuplicates) {
        episodesToGenerate = m3uSeriesValidationService.resolveDuplicates(
          episodesToGenerate,
          options.useRecommendedDuplicates
        );
        console.log(`[M3UGenerationValidator] After deduplication: ${episodesToGenerate.length} episodes`);
      }

      // Generate standardized M3U content
      const m3uContent = m3uSeriesValidationService.generateStandardizedM3U(
        episodesToGenerate,
        false // Already deduplicated above
      );

      toast({
        title: 'Gerando M3U CDN...',
        description: `Processando ${episodesToGenerate.length.toLocaleString()} episódios padronizados`,
      });

      // Get source info
      const { data: source } = await supabase
        .from('m3u_sync_sources')
        .select('key, name')
        .eq('id', generationContext.sourceId)
        .single();

      if (!source) {
        throw new Error('Fonte não encontrada');
      }

      // Call edge function with validated content
      const { data, error } = await supabase.functions.invoke('generate-m3u-from-sync', {
        body: {
          sourceId: generationContext.sourceId,
          sourceKey: source.key,
          sourceName: source.name,
          // Send pre-validated and formatted content
          validatedContent: m3uContent,
          validationStats: {
            totalEpisodes: state.validationResult.totalEpisodes,
            validEpisodes: episodesToGenerate.length,
            duplicatesRemoved: state.validationResult.duplicatesFound,
            seriesCount: state.validationResult.stats.series.size,
          },
        },
      });

      if (error) throw error;

      // Handle async generation
      if (data?.status === 'processing') {
        // Poll for completion
        const maxAttempts = 20;
        let attempt = 0;
        let cdnUrl: string | null = null;

        while (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 3000));
          attempt++;

          const { data: sourceData } = await supabase
            .from('m3u_sync_sources')
            .select('metadata')
            .eq('id', generationContext.sourceId)
            .single();

          const metadata = sourceData?.metadata as Record<string, any> | null;
          const status = metadata?.generation_status;

          if (status === 'completed' && metadata?.cdn_url) {
            cdnUrl = metadata.cdn_url;
            break;
          } else if (status === 'error') {
            throw new Error(metadata?.error || 'Erro na geração');
          }
        }

        if (cdnUrl) {
          setState(prev => ({
            ...prev,
            isGenerating: false,
            lastGeneratedUrl: cdnUrl,
          }));

          toast({
            title: 'M3U Gerado com Sucesso!',
            description: 'Arquivo padronizado disponível no CDN',
          });

          return { success: true, cdnUrl };
        } else {
          throw new Error('Timeout na geração');
        }
      }

      // Direct response
      if (data?.cdnUrl) {
        setState(prev => ({
          ...prev,
          isGenerating: false,
          lastGeneratedUrl: data.cdnUrl,
        }));

        toast({
          title: 'M3U Gerado com Sucesso!',
          description: 'Arquivo padronizado disponível no CDN',
        });

        return { success: true, cdnUrl: data.cdnUrl };
      }

      throw new Error('Resposta inesperada do servidor');
    } catch (error) {
      console.error('[M3UGenerationValidator] Generation error:', error);

      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Erro na geração',
      }));

      toast({
        title: 'Erro na Geração',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro na geração' 
      };
    }
  }, [generationContext, state.validationResult, toast]);

  /**
   * Cancel validation/generation flow
   */
  const cancelValidation = useCallback(() => {
    setState(prev => ({
      ...prev,
      showValidator: false,
      isValidating: false,
      isGenerating: false,
    }));
    setGenerationContext(null);
  }, []);

  /**
   * Reset all state
   */
  const resetState = useCallback(() => {
    setState({
      isValidating: false,
      isGenerating: false,
      validationResult: null,
      showValidator: false,
      lastGeneratedUrl: null,
      error: null,
    });
    setGenerationContext(null);
  }, []);

  return {
    state,
    startValidation,
    confirmGeneration,
    cancelValidation,
    resetState,
  };
}
