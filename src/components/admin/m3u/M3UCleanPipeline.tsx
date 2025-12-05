import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sparkles, Loader2, CheckCircle, AlertTriangle, XCircle,
  ChevronDown, Trash2, Eye, Settings, Undo2, Zap, Filter,
  History, Download, Play, Pause, RotateCcw, Lightbulb
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
interface CleanConfig {
  preset: 'conservative' | 'aggressive' | 'custom';
  remove_empty_lines: boolean;
  keep_protocols: string[];
  dedupe_by: 'url' | 'title' | 'both' | 'none';
  strip_emojis: boolean;
  title_cleanup: Array<{ type: 'regex'; pattern: string; replace: string }>;
  group_actions: Array<{ group: string; action: 'keep' | 'remove' }>;
  healthcheck: {
    enabled: boolean;
    method: 'HEAD' | 'GET';
    timeout: number;
    concurrency: number;
  };
  batchSize: number;
}

interface CleanStats {
  totalEntries: number;
  validEntries: number;
  duplicatesRemoved: number;
  invalidUrlsRemoved: number;
  emptyTitlesRemoved: number;
  protocolFiltered: number;
  groupFiltered: number;
  healthCheckFailed: number;
  processingTimeMs: number;
}

interface CleanJob {
  id: string;
  source_id: string;
  config: CleanConfig;
  stats: CleanStats | null;
  status: 'pending' | 'analyzing' | 'preview' | 'executing' | 'completed' | 'failed' | 'cancelled';
  preview_path: string | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
}

interface Suggestion {
  id: string;
  type: 'dedupe' | 'protocol' | 'emoji' | 'group' | 'empty' | 'format' | 'quality' | 'language' | 'region' | 'category' | 'invalid' | 'regex' | 'health';
  message: string;
  action: () => void;
  impact: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
}

interface PreviewEntry {
  original: { title: string; url: string; group?: string };
  cleaned: { title: string; url: string; group?: string } | null;
  action: 'keep' | 'remove' | 'modify';
  reason?: string;
  ruleApplied?: string;
}

// Sample data generator for demo/testing
const generateSampleSuggestions = (setConfig: (fn: (c: CleanConfig) => CleanConfig) => void): Suggestion[] => [
  {
    id: 'dedupe-url',
    type: 'dedupe',
    message: '12.847 URLs duplicadas detectadas',
    action: () => setConfig(c => ({ ...c, dedupe_by: 'url' })),
    impact: 12847,
    severity: 'critical',
    category: 'Duplicação',
  },
  {
    id: 'dedupe-title',
    type: 'dedupe',
    message: '3.291 títulos idênticos com URLs diferentes',
    action: () => setConfig(c => ({ ...c, dedupe_by: 'both' })),
    impact: 3291,
    severity: 'high',
    category: 'Duplicação',
  },
  {
    id: 'empty-titles',
    type: 'empty',
    message: '1.523 entradas sem título (título vazio)',
    action: () => setConfig(c => ({ ...c, remove_empty_lines: true })),
    impact: 1523,
    severity: 'high',
    category: 'Dados Vazios',
  },
  {
    id: 'empty-urls',
    type: 'invalid',
    message: '847 entradas com URL vazia ou inválida',
    action: () => setConfig(c => ({ ...c, remove_empty_lines: true })),
    impact: 847,
    severity: 'critical',
    category: 'URLs Inválidas',
  },
  {
    id: 'strip-emojis',
    type: 'emoji',
    message: '28% dos títulos contêm emojis (🔥📺🎬)',
    action: () => setConfig(c => ({ ...c, strip_emojis: true })),
    impact: 58432,
    severity: 'low',
    category: 'Formatação',
  },
  {
    id: 'remove-brackets',
    type: 'format',
    message: '15.234 títulos com [HD], [FHD], [4K] redundantes',
    action: () => setConfig(c => ({ 
      ...c, 
      title_cleanup: [...c.title_cleanup, { type: 'regex', pattern: '\\[(HD|FHD|4K|SD|UHD)\\]', replace: '' }]
    })),
    impact: 15234,
    severity: 'medium',
    category: 'Formatação',
  },
  {
    id: 'remove-quality-tags',
    type: 'quality',
    message: '9.876 tags de qualidade no título (1080p, 720p)',
    action: () => setConfig(c => ({ 
      ...c, 
      title_cleanup: [...c.title_cleanup, { type: 'regex', pattern: '(1080p|720p|480p|2160p)', replace: '' }]
    })),
    impact: 9876,
    severity: 'low',
    category: 'Formatação',
  },
  {
    id: 'protocol-rtmp',
    type: 'protocol',
    message: '2.341 streams usando protocolo RTMP (incompatível)',
    action: () => setConfig(c => ({ ...c, keep_protocols: ['http', 'https'] })),
    impact: 2341,
    severity: 'high',
    category: 'Protocolos',
  },
  {
    id: 'protocol-rtsp',
    type: 'protocol',
    message: '567 streams usando protocolo RTSP',
    action: () => setConfig(c => ({ ...c, keep_protocols: ['http', 'https'] })),
    impact: 567,
    severity: 'medium',
    category: 'Protocolos',
  },
  {
    id: 'protocol-mms',
    type: 'protocol',
    message: '123 streams usando protocolo MMS (obsoleto)',
    action: () => setConfig(c => ({ ...c, keep_protocols: ['http', 'https'] })),
    impact: 123,
    severity: 'high',
    category: 'Protocolos',
  },
  {
    id: 'group-adult',
    type: 'group',
    message: '4.521 canais no grupo "Adulto" / "XXX"',
    action: () => setConfig(c => ({ 
      ...c, 
      group_actions: [...c.group_actions, { group: 'Adulto', action: 'remove' }, { group: 'XXX', action: 'remove' }]
    })),
    impact: 4521,
    severity: 'medium',
    category: 'Grupos',
  },
  {
    id: 'group-test',
    type: 'group',
    message: '892 canais de teste/placeholder',
    action: () => setConfig(c => ({ 
      ...c, 
      group_actions: [...c.group_actions, { group: 'TEST', action: 'remove' }, { group: 'Teste', action: 'remove' }]
    })),
    impact: 892,
    severity: 'high',
    category: 'Grupos',
  },
  {
    id: 'group-empty',
    type: 'group',
    message: '1.234 canais sem grupo definido',
    action: () => setConfig(c => ({ ...c, remove_empty_lines: true })),
    impact: 1234,
    severity: 'low',
    category: 'Grupos',
  },
  {
    id: 'language-foreign',
    type: 'language',
    message: '6.789 canais em idiomas não-PT/EN',
    action: () => setConfig(c => ({ 
      ...c, 
      title_cleanup: [...c.title_cleanup, { type: 'regex', pattern: '\\[(AR|RU|CN|JP|KR)\\]', replace: '' }]
    })),
    impact: 6789,
    severity: 'low',
    category: 'Idioma',
  },
  {
    id: 'region-blocked',
    type: 'region',
    message: '3.456 canais com restrição regional detectada',
    action: () => setConfig(c => ({ ...c, healthcheck: { ...c.healthcheck, enabled: true } })),
    impact: 3456,
    severity: 'medium',
    category: 'Região',
  },
  {
    id: 'special-chars',
    type: 'format',
    message: '7.891 títulos com caracteres especiais excessivos',
    action: () => setConfig(c => ({ 
      ...c, 
      title_cleanup: [...c.title_cleanup, { type: 'regex', pattern: '[\\|\\*\\#\\@\\^]+', replace: ' ' }]
    })),
    impact: 7891,
    severity: 'medium',
    category: 'Formatação',
  },
  {
    id: 'trailing-spaces',
    type: 'format',
    message: '23.456 títulos com espaços extras',
    action: () => setConfig(c => ({ 
      ...c, 
      title_cleanup: [...c.title_cleanup, { type: 'regex', pattern: '\\s+', replace: ' ' }]
    })),
    impact: 23456,
    severity: 'low',
    category: 'Formatação',
  },
  {
    id: 'invalid-m3u8',
    type: 'health',
    message: '1.876 links .m3u8 com formato inválido',
    action: () => setConfig(c => ({ ...c, healthcheck: { ...c.healthcheck, enabled: true } })),
    impact: 1876,
    severity: 'high',
    category: 'Health Check',
  },
  {
    id: 'timeout-hosts',
    type: 'health',
    message: '5.432 URLs de hosts com timeout frequente',
    action: () => setConfig(c => ({ ...c, healthcheck: { ...c.healthcheck, enabled: true, timeout: 3000 } })),
    impact: 5432,
    severity: 'critical',
    category: 'Health Check',
  },
  {
    id: 'dead-links',
    type: 'health',
    message: '8.765 links mortos (HTTP 404/500)',
    action: () => setConfig(c => ({ ...c, healthcheck: { ...c.healthcheck, enabled: true } })),
    impact: 8765,
    severity: 'critical',
    category: 'Health Check',
  },
  {
    id: 'category-news',
    type: 'category',
    message: '2.345 canais de notícias duplicados',
    action: () => setConfig(c => ({ ...c, dedupe_by: 'url' })),
    impact: 2345,
    severity: 'medium',
    category: 'Categorias',
  },
  {
    id: 'category-sports',
    type: 'category',
    message: '1.567 canais esportivos sem evento ativo',
    action: () => setConfig(c => ({ ...c, healthcheck: { ...c.healthcheck, enabled: true } })),
    impact: 1567,
    severity: 'low',
    category: 'Categorias',
  },
  {
    id: 'regex-brackets-content',
    type: 'regex',
    message: 'Remover conteúdo entre parênteses: (BACKUP), (OLD)',
    action: () => setConfig(c => ({ 
      ...c, 
      title_cleanup: [...c.title_cleanup, { type: 'regex', pattern: '\\(BACKUP\\)|\\(OLD\\)|\\(ALTERNATIVO\\)', replace: '' }]
    })),
    impact: 4321,
    severity: 'medium',
    category: 'Regex',
  },
  {
    id: 'url-params-tracking',
    type: 'format',
    message: '11.234 URLs com parâmetros de tracking desnecessários',
    action: () => setConfig(c => ({ 
      ...c, 
      title_cleanup: [...c.title_cleanup, { type: 'regex', pattern: '[\\?&](utm_|ref=|source=)[^&]*', replace: '' }]
    })),
    impact: 11234,
    severity: 'low',
    category: 'URLs',
  },
];

const generateSamplePreview = (): PreviewEntry[] => [
  {
    original: { title: '🔥 HBO MAX HD 🎬', url: 'http://server1.com/hbo', group: 'Filmes' },
    cleaned: { title: 'HBO MAX HD', url: 'http://server1.com/hbo', group: 'Filmes' },
    action: 'modify',
    reason: 'Emojis removidos do título',
    ruleApplied: 'strip_emojis',
  },
  {
    original: { title: 'ESPN Brasil [HD] [1080p]', url: 'http://server2.com/espn', group: 'Esportes' },
    cleaned: { title: 'ESPN Brasil', url: 'http://server2.com/espn', group: 'Esportes' },
    action: 'modify',
    reason: 'Tags de qualidade removidas',
    ruleApplied: 'regex_cleanup',
  },
  {
    original: { title: 'Globo SP', url: 'http://server1.com/globo', group: 'Abertos' },
    cleaned: null,
    action: 'remove',
    reason: 'URL duplicada (mantida entrada anterior)',
    ruleApplied: 'dedupe_url',
  },
  {
    original: { title: '', url: 'http://server3.com/empty', group: 'Sem Grupo' },
    cleaned: null,
    action: 'remove',
    reason: 'Título vazio',
    ruleApplied: 'remove_empty',
  },
  {
    original: { title: 'Canal XXX Premium', url: 'http://adult.com/xxx', group: 'Adulto' },
    cleaned: null,
    action: 'remove',
    reason: 'Grupo "Adulto" marcado para remoção',
    ruleApplied: 'group_filter',
  },
  {
    original: { title: 'Test Channel 1', url: 'rtmp://stream.test.com/live', group: 'TEST' },
    cleaned: null,
    action: 'remove',
    reason: 'Protocolo RTMP não permitido',
    ruleApplied: 'protocol_filter',
  },
  {
    original: { title: 'Discovery Channel', url: 'https://cdn.valid.com/discovery', group: 'Documentários' },
    cleaned: { title: 'Discovery Channel', url: 'https://cdn.valid.com/discovery', group: 'Documentários' },
    action: 'keep',
    reason: 'Entrada válida',
    ruleApplied: 'none',
  },
  {
    original: { title: 'CNN   International   HD', url: 'http://news.com/cnn', group: 'Notícias' },
    cleaned: { title: 'CNN International HD', url: 'http://news.com/cnn', group: 'Notícias' },
    action: 'modify',
    reason: 'Espaços extras removidos',
    ruleApplied: 'regex_cleanup',
  },
  {
    original: { title: 'SporTV (BACKUP)', url: 'http://backup.com/sportv', group: 'Esportes' },
    cleaned: { title: 'SporTV', url: 'http://backup.com/sportv', group: 'Esportes' },
    action: 'modify',
    reason: 'Tag (BACKUP) removida',
    ruleApplied: 'regex_cleanup',
  },
  {
    original: { title: 'Band News', url: '', group: 'Notícias' },
    cleaned: null,
    action: 'remove',
    reason: 'URL vazia',
    ruleApplied: 'remove_empty',
  },
  {
    original: { title: 'Telecine Premium || HD || 4K', url: 'http://movies.com/telecine', group: 'Filmes' },
    cleaned: { title: 'Telecine Premium HD 4K', url: 'http://movies.com/telecine', group: 'Filmes' },
    action: 'modify',
    reason: 'Caracteres especiais (||) substituídos',
    ruleApplied: 'regex_cleanup',
  },
  {
    original: { title: 'Fox Sports 1', url: 'http://dead.server.com/fox?utm_source=app&ref=123', group: 'Esportes' },
    cleaned: { title: 'Fox Sports 1', url: 'http://dead.server.com/fox', group: 'Esportes' },
    action: 'modify',
    reason: 'Parâmetros de tracking removidos da URL',
    ruleApplied: 'url_cleanup',
  },
  {
    original: { title: 'Nacional [AR]', url: 'http://ar.server.com/nacional', group: 'Internacionais' },
    cleaned: null,
    action: 'remove',
    reason: 'Canal em idioma não permitido [AR]',
    ruleApplied: 'language_filter',
  },
  {
    original: { title: 'History Channel 2 FHD', url: 'http://history.com/hc2', group: 'Documentários' },
    cleaned: { title: 'History Channel 2', url: 'http://history.com/hc2', group: 'Documentários' },
    action: 'modify',
    reason: 'Tag FHD removida',
    ruleApplied: 'quality_cleanup',
  },
  {
    original: { title: 'MTV Live', url: 'mms://old.protocol.com/mtv', group: 'Música' },
    cleaned: null,
    action: 'remove',
    reason: 'Protocolo MMS obsoleto',
    ruleApplied: 'protocol_filter',
  },
  {
    original: { title: '★★★ Canal VIP ★★★', url: 'http://vip.com/canal', group: 'Premium' },
    cleaned: { title: 'Canal VIP', url: 'http://vip.com/canal', group: 'Premium' },
    action: 'modify',
    reason: 'Caracteres decorativos removidos',
    ruleApplied: 'regex_cleanup',
  },
  {
    original: { title: 'Cartoon Network', url: 'http://cdn.cartoon.com/stream.m3u8', group: 'Infantil' },
    cleaned: { title: 'Cartoon Network', url: 'http://cdn.cartoon.com/stream.m3u8', group: 'Infantil' },
    action: 'keep',
    reason: 'Entrada válida',
    ruleApplied: 'none',
  },
  {
    original: { title: 'Animal Planet', url: 'http://offline.server.com/animal', group: 'Documentários' },
    cleaned: null,
    action: 'remove',
    reason: 'Health check falhou (timeout)',
    ruleApplied: 'healthcheck',
  },
  {
    original: { title: 'TNT Series', url: 'http://server1.com/tnt', group: 'Séries' },
    cleaned: null,
    action: 'remove',
    reason: 'URL duplicada de entrada #47',
    ruleApplied: 'dedupe_url',
  },
  {
    original: { title: 'Warner Channel (OLD)', url: 'http://old.warner.com/wc', group: 'Séries' },
    cleaned: { title: 'Warner Channel', url: 'http://old.warner.com/wc', group: 'Séries' },
    action: 'modify',
    reason: 'Tag (OLD) removida',
    ruleApplied: 'regex_cleanup',
  },
  {
    original: { title: 'AXN HD 1080p', url: 'http://valid.axn.com/stream', group: 'Séries' },
    cleaned: { title: 'AXN HD', url: 'http://valid.axn.com/stream', group: 'Séries' },
    action: 'modify',
    reason: 'Tag 1080p removida (redundante)',
    ruleApplied: 'quality_cleanup',
  },
  {
    original: { title: 'Sony Channel', url: 'http://cdn.sony.com/live', group: 'Filmes' },
    cleaned: { title: 'Sony Channel', url: 'http://cdn.sony.com/live', group: 'Filmes' },
    action: 'keep',
    reason: 'Entrada válida',
    ruleApplied: 'none',
  },
  {
    original: { title: 'Mega TV @#$%', url: 'http://mega.tv/stream', group: 'Variedades' },
    cleaned: { title: 'Mega TV', url: 'http://mega.tv/stream', group: 'Variedades' },
    action: 'modify',
    reason: 'Caracteres especiais removidos',
    ruleApplied: 'regex_cleanup',
  },
  {
    original: { title: 'SBT Rio', url: 'http://sbt.com/rio?source=iptv&utm_campaign=2024', group: 'Abertos' },
    cleaned: { title: 'SBT Rio', url: 'http://sbt.com/rio', group: 'Abertos' },
    action: 'modify',
    reason: 'Parâmetros de tracking removidos',
    ruleApplied: 'url_cleanup',
  },
  {
    original: { title: 'Record News 24h', url: 'http://record.com/news', group: 'Notícias' },
    cleaned: { title: 'Record News 24h', url: 'http://record.com/news', group: 'Notícias' },
    action: 'keep',
    reason: 'Entrada válida',
    ruleApplied: 'none',
  },
];

interface M3UCleanPipelineProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string;
  sourceName: string;
  sourceKey: string;
  entriesCount: number;
  onComplete?: () => void;
}

const DEFAULT_CONFIG: CleanConfig = {
  preset: 'conservative',
  remove_empty_lines: true,
  keep_protocols: ['http', 'https'],
  dedupe_by: 'url',
  strip_emojis: false,
  title_cleanup: [],
  group_actions: [],
  healthcheck: {
    enabled: false,
    method: 'HEAD',
    timeout: 3000,
    concurrency: 10,
  },
  batchSize: 1000,
};

const PRESETS: Record<string, Partial<CleanConfig>> = {
  conservative: {
    remove_empty_lines: true,
    keep_protocols: ['http', 'https'],
    dedupe_by: 'url',
    strip_emojis: false,
    healthcheck: { enabled: false, method: 'HEAD', timeout: 3000, concurrency: 10 },
  },
  aggressive: {
    remove_empty_lines: true,
    keep_protocols: ['http', 'https'],
    dedupe_by: 'both',
    strip_emojis: true,
    healthcheck: { enabled: true, method: 'HEAD', timeout: 3000, concurrency: 20 },
  },
};

export function M3UCleanPipeline({
  open,
  onOpenChange,
  sourceId,
  sourceName,
  sourceKey,
  entriesCount,
  onComplete,
}: M3UCleanPipelineProps) {
  const [tab, setTab] = useState<'config' | 'suggestions' | 'preview' | 'history'>('config');
  const [config, setConfig] = useState<CleanConfig>(DEFAULT_CONFIG);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<CleanStats | null>(null);
  const [preview, setPreview] = useState<PreviewEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [jobs, setJobs] = useState<CleanJob[]>([]);
  const [currentJob, setCurrentJob] = useState<CleanJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<string[]>([]);

  // Load job history
  useEffect(() => {
    if (open && sourceId) {
      loadJobHistory();
      analyzeSource();
    }
  }, [open, sourceId]);

  const loadJobHistory = async () => {
    const { data } = await supabase
      .from('m3u_clean_jobs')
      .select('*')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (data) {
      setJobs(data as unknown as CleanJob[]);
    }
  };

  const loadDemoData = () => {
    setSuggestions(generateSampleSuggestions(setConfig));
    setPreview(generateSamplePreview());
    setGroups(['Filmes', 'Séries', 'Esportes', 'Notícias', 'Documentários', 'Infantil', 'Música', 'Adulto', 'TEST', 'Premium']);
    setStats({
      totalEntries: 209568,
      validEntries: 165234,
      duplicatesRemoved: 16138,
      invalidUrlsRemoved: 12847,
      emptyTitlesRemoved: 2370,
      protocolFiltered: 3031,
      groupFiltered: 5413,
      healthCheckFailed: 4535,
      processingTimeMs: 45230,
    });
  };

  const analyzeSource = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('m3u-clean-advanced', {
        body: { 
          action: 'analyze', 
          sourceId,
          sampleSize: 5000 
        },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      // Generate suggestions from analysis
      const newSuggestions: Suggestion[] = [];
      
      if (data.analysis.duplicateUrls > 0) {
        newSuggestions.push({
          id: 'dedupe-url',
          type: 'dedupe',
          message: `${data.analysis.duplicateUrls.toLocaleString()} URLs duplicadas detectadas`,
          action: () => setConfig(c => ({ ...c, dedupe_by: 'url' })),
          impact: data.analysis.duplicateUrls,
          severity: data.analysis.duplicateUrls > 5000 ? 'critical' : 'high',
          category: 'Duplicação',
        });
      }

      if (data.analysis.duplicateTitles > 0) {
        newSuggestions.push({
          id: 'dedupe-title',
          type: 'dedupe',
          message: `${data.analysis.duplicateTitles.toLocaleString()} títulos duplicados`,
          action: () => setConfig(c => ({ ...c, dedupe_by: 'both' })),
          impact: data.analysis.duplicateTitles,
          severity: 'high',
          category: 'Duplicação',
        });
      }

      if (data.analysis.emptyTitles > 0) {
        newSuggestions.push({
          id: 'empty-titles',
          type: 'empty',
          message: `${data.analysis.emptyTitles.toLocaleString()} títulos vazios`,
          action: () => setConfig(c => ({ ...c, remove_empty_lines: true })),
          impact: data.analysis.emptyTitles,
          severity: 'high',
          category: 'Dados Vazios',
        });
      }

      if (data.analysis.invalidUrls > 0) {
        newSuggestions.push({
          id: 'invalid-urls',
          type: 'invalid',
          message: `${data.analysis.invalidUrls.toLocaleString()} URLs inválidas`,
          action: () => setConfig(c => ({ ...c, remove_empty_lines: true })),
          impact: data.analysis.invalidUrls,
          severity: 'critical',
          category: 'URLs Inválidas',
        });
      }

      if (data.analysis.emojiCount > data.analysis.sampleSize * 0.1) {
        newSuggestions.push({
          id: 'strip-emojis',
          type: 'emoji',
          message: `${Math.round((data.analysis.emojiCount / data.analysis.sampleSize) * 100)}% dos títulos contêm emojis`,
          action: () => setConfig(c => ({ ...c, strip_emojis: true })),
          impact: data.analysis.emojiCount,
          severity: 'low',
          category: 'Formatação',
        });
      }

      // Add protocol suggestions
      if (data.analysis.protocols) {
        const nonHttpProtocols = Object.entries(data.analysis.protocols)
          .filter(([proto]) => !['http', 'https'].includes(proto.toLowerCase()));
        
        for (const [proto, count] of nonHttpProtocols) {
          if ((count as number) > 0) {
            newSuggestions.push({
              id: `protocol-${proto}`,
              type: 'protocol',
              message: `${(count as number).toLocaleString()} streams usando ${proto.toUpperCase()}`,
              action: () => setConfig(c => ({ ...c, keep_protocols: ['http', 'https'] })),
              impact: count as number,
              severity: proto.toLowerCase() === 'rtmp' ? 'high' : 'medium',
              category: 'Protocolos',
            });
          }
        }
      }

      // Add group-based suggestions
      if (data.analysis.groups) {
        setGroups(Object.keys(data.analysis.groups));
        
        const adultGroups = Object.entries(data.analysis.groups)
          .filter(([group]) => /adulto|xxx|adult|porn/i.test(group));
        
        if (adultGroups.length > 0) {
          const totalAdult = adultGroups.reduce((acc, [, count]) => acc + (count as number), 0);
          newSuggestions.push({
            id: 'group-adult',
            type: 'group',
            message: `${totalAdult.toLocaleString()} canais adultos detectados`,
            action: () => setConfig(c => ({ 
              ...c, 
              group_actions: [...c.group_actions, ...adultGroups.map(([g]) => ({ group: g, action: 'remove' as const }))]
            })),
            impact: totalAdult,
            severity: 'medium',
            category: 'Grupos',
          });
        }

        const testGroups = Object.entries(data.analysis.groups)
          .filter(([group]) => /test|teste|placeholder/i.test(group));
        
        if (testGroups.length > 0) {
          const totalTest = testGroups.reduce((acc, [, count]) => acc + (count as number), 0);
          newSuggestions.push({
            id: 'group-test',
            type: 'group',
            message: `${totalTest.toLocaleString()} canais de teste/placeholder`,
            action: () => setConfig(c => ({ 
              ...c, 
              group_actions: [...c.group_actions, ...testGroups.map(([g]) => ({ group: g, action: 'remove' as const }))]
            })),
            impact: totalTest,
            severity: 'high',
            category: 'Grupos',
          });
        }
      }

      setSuggestions(newSuggestions);
      
      if (newSuggestions.length > 0) {
        setTab('suggestions');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro na análise';
      setError(message);
      // Load demo data on error for testing
      loadDemoData();
      toast.info('Dados de demonstração carregados');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePreview = async () => {
    setIsAnalyzing(true);
    setError(null);
    setProgress(0);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('m3u-clean-advanced', {
        body: { 
          action: 'preview', 
          sourceId,
          config,
          previewSize: 100 
        },
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setPreview(data.preview || []);
      setStats(data.stats);
      setTab('preview');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro no preview';
      setError(message);
      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setError(null);
    setProgress(0);

    try {
      // Execute clean via Edge Function
      const response = await supabase.functions.invoke(
        `clean-sync-entries?sourceId=${sourceId}&apply=true`
      );

      if (response.error) throw response.error;
      if (response.data.error) throw new Error(response.data.error);

      setStats(response.data.stats);
      setProgress(100);
      
      toast.success(`Limpeza concluída: ${response.data.stats.validEntries.toLocaleString()} entradas válidas`);
      
      if (onComplete) {
        onComplete();
      }

      loadJobHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro na execução';
      setError(message);
      toast.error(message);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleUndo = async (jobId: string) => {
    toast.info('Funcionalidade de undo em desenvolvimento');
    // TODO: Implement version restore from storage backup
  };

  const applyPreset = (presetName: 'conservative' | 'aggressive') => {
    setConfig(c => ({
      ...c,
      ...PRESETS[presetName],
      preset: presetName,
    }));
  };

  const handleClose = () => {
    setTab('config');
    setStats(null);
    setPreview([]);
    setSuggestions([]);
    setError(null);
    setProgress(0);
    onOpenChange(false);
  };

  const totalImpact = suggestions.reduce((acc, s) => acc + s.impact, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Pipeline de Limpeza M3U
          </DialogTitle>
          <DialogDescription>
            Limpe e valide <strong>{sourceName}</strong> ({entriesCount.toLocaleString()} entradas)
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="config" className="gap-1">
              <Settings className="w-4 h-4" /> Config
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="gap-1">
              <Lightbulb className="w-4 h-4" /> Sugestões
              {suggestions.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {suggestions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1">
              <Eye className="w-4 h-4" /> Preview
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <History className="w-4 h-4" /> Histórico
            </TabsTrigger>
          </TabsList>

          {/* Config Tab */}
          <TabsContent value="config" className="flex-1 overflow-auto space-y-4 mt-4">
            {/* Presets */}
            <div className="flex gap-2">
              <Button
                variant={config.preset === 'conservative' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset('conservative')}
              >
                Conservador
              </Button>
              <Button
                variant={config.preset === 'aggressive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyPreset('aggressive')}
              >
                Agressivo
              </Button>
              <Button
                variant={config.preset === 'custom' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setConfig(c => ({ ...c, preset: 'custom' }))}
              >
                Personalizado
              </Button>
            </div>

            {/* Basic Options */}
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="remove-empty">Remover linhas vazias</Label>
                <Switch
                  id="remove-empty"
                  checked={config.remove_empty_lines}
                  onCheckedChange={(v) => setConfig(c => ({ ...c, remove_empty_lines: v, preset: 'custom' }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="strip-emojis">Remover emojis dos títulos</Label>
                <Switch
                  id="strip-emojis"
                  checked={config.strip_emojis}
                  onCheckedChange={(v) => setConfig(c => ({ ...c, strip_emojis: v, preset: 'custom' }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Deduplicação</Label>
                <Select
                  value={config.dedupe_by}
                  onValueChange={(v) => setConfig(c => ({ ...c, dedupe_by: v as CleanConfig['dedupe_by'], preset: 'custom' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Desativado</SelectItem>
                    <SelectItem value="url">Por URL</SelectItem>
                    <SelectItem value="title">Por Título</SelectItem>
                    <SelectItem value="both">URL + Título</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Health Check */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Health Check
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label>Ativar verificação de URLs</Label>
                    <Switch
                      checked={config.healthcheck.enabled}
                      onCheckedChange={(v) => setConfig(c => ({
                        ...c,
                        healthcheck: { ...c.healthcheck, enabled: v },
                        preset: 'custom',
                      }))}
                    />
                  </div>
                  {config.healthcheck.enabled && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Timeout (ms)</Label>
                          <Input
                            type="number"
                            value={config.healthcheck.timeout}
                            onChange={(e) => setConfig(c => ({
                              ...c,
                              healthcheck: { ...c.healthcheck, timeout: parseInt(e.target.value) || 3000 },
                            }))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Concorrência</Label>
                          <Input
                            type="number"
                            value={config.healthcheck.concurrency}
                            onChange={(e) => setConfig(c => ({
                              ...c,
                              healthcheck: { ...c.healthcheck, concurrency: parseInt(e.target.value) || 10 },
                            }))}
                          />
                        </div>
                      </div>
                      <Alert>
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription className="text-xs">
                          Health check pode demorar para {entriesCount.toLocaleString()} entradas
                        </AlertDescription>
                      </Alert>
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Group Actions */}
              {groups.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Filtros por Grupo ({groups.length})
                      </span>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <ScrollArea className="h-[150px]">
                      <div className="space-y-2">
                        {groups.slice(0, 20).map((group) => {
                          const action = config.group_actions.find(g => g.group === group);
                          return (
                            <div key={group} className="flex items-center justify-between text-sm">
                              <span className="truncate max-w-[200px]">{group}</span>
                              <Select
                                value={action?.action || 'keep'}
                                onValueChange={(v) => {
                                  const newActions = config.group_actions.filter(g => g.group !== group);
                                  if (v !== 'keep') {
                                    newActions.push({ group, action: v as 'keep' | 'remove' });
                                  }
                                  setConfig(c => ({ ...c, group_actions: newActions, preset: 'custom' }));
                                }}
                              >
                                <SelectTrigger className="w-24 h-7">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="keep">Manter</SelectItem>
                                  <SelectItem value="remove">Remover</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </TabsContent>

          {/* Suggestions Tab */}
          <TabsContent value="suggestions" className="flex-1 overflow-auto space-y-4 mt-4">
            {isAnalyzing ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Analisando amostra...</span>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p>Nenhuma sugestão de otimização</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={loadDemoData}
                >
                  Carregar dados de demonstração
                </Button>
              </div>
            ) : (
              <>
                {/* Impact Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-xs text-muted-foreground">Total de sugestões</div>
                    <div className="text-xl font-bold">{suggestions.length}</div>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-lg">
                    <div className="text-xs text-muted-foreground">Críticas</div>
                    <div className="text-xl font-bold text-red-600">
                      {suggestions.filter(s => s.severity === 'critical').length}
                    </div>
                  </div>
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <div className="text-xs text-muted-foreground">Altas</div>
                    <div className="text-xl font-bold text-orange-600">
                      {suggestions.filter(s => s.severity === 'high').length}
                    </div>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <div className="text-xs text-muted-foreground">Impacto total</div>
                    <div className="text-xl font-bold">{totalImpact.toLocaleString()}</div>
                  </div>
                </div>

                {/* Group by category */}
                <ScrollArea className="h-[280px]">
                  <div className="space-y-4">
                    {Array.from(new Set(suggestions.map(s => s.category))).map(category => (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur py-1">
                          <h4 className="text-sm font-semibold">{category}</h4>
                          <Badge variant="outline" className="text-xs">
                            {suggestions.filter(s => s.category === category).length}
                          </Badge>
                        </div>
                        {suggestions.filter(s => s.category === category).map((s) => (
                          <div
                            key={s.id}
                            className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors ${
                              s.severity === 'critical' ? 'border-red-500/50 bg-red-500/5' :
                              s.severity === 'high' ? 'border-orange-500/50 bg-orange-500/5' :
                              s.severity === 'medium' ? 'border-yellow-500/50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${
                                s.severity === 'critical' ? 'bg-red-500' :
                                s.severity === 'high' ? 'bg-orange-500' :
                                s.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                              }`} />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{s.message}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant={
                                    s.severity === 'critical' ? 'destructive' :
                                    s.severity === 'high' ? 'default' : 'secondary'
                                  } className="text-[10px] h-4">
                                    {s.severity === 'critical' ? 'Crítico' :
                                     s.severity === 'high' ? 'Alto' :
                                     s.severity === 'medium' ? 'Médio' : 'Baixo'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {s.impact.toLocaleString()} itens
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={s.action} className="shrink-0 ml-2">
                              Aplicar
                            </Button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => {
                      suggestions.filter(s => s.severity === 'critical').forEach(s => s.action());
                      toast.success('Sugestões críticas aplicadas');
                    }}
                  >
                    Aplicar Críticas ({suggestions.filter(s => s.severity === 'critical').length})
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      suggestions.forEach(s => s.action());
                      toast.success('Todas as sugestões aplicadas');
                    }}
                  >
                    Aplicar Todas ({suggestions.length})
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="flex-1 overflow-auto space-y-4 mt-4">
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <StatCard label="Total" value={stats.totalEntries} />
                <StatCard label="Válidas" value={stats.validEntries} variant="success" />
                <StatCard label="Duplicadas" value={stats.duplicatesRemoved} variant="warning" />
                <StatCard label="Removidas" value={(stats.invalidUrlsRemoved ?? 0) + (stats.emptyTitlesRemoved ?? 0) + (stats.protocolFiltered ?? 0) + (stats.groupFiltered ?? 0)} variant="danger" />
              </div>
            )}

            {/* Stats breakdown */}
            {stats && (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-1 text-xs">
                <div className="p-2 bg-muted/30 rounded text-center">
                  <div className="font-medium">{(stats.invalidUrlsRemoved ?? 0).toLocaleString()}</div>
                  <div className="text-muted-foreground">URLs inválidas</div>
                </div>
                <div className="p-2 bg-muted/30 rounded text-center">
                  <div className="font-medium">{(stats.emptyTitlesRemoved ?? 0).toLocaleString()}</div>
                  <div className="text-muted-foreground">Títulos vazios</div>
                </div>
                <div className="p-2 bg-muted/30 rounded text-center">
                  <div className="font-medium">{(stats.protocolFiltered ?? 0).toLocaleString()}</div>
                  <div className="text-muted-foreground">Protocolos</div>
                </div>
                <div className="p-2 bg-muted/30 rounded text-center">
                  <div className="font-medium">{(stats.groupFiltered ?? 0).toLocaleString()}</div>
                  <div className="text-muted-foreground">Por grupo</div>
                </div>
                <div className="p-2 bg-muted/30 rounded text-center">
                  <div className="font-medium">{(stats.healthCheckFailed ?? 0).toLocaleString()}</div>
                  <div className="text-muted-foreground">Health check</div>
                </div>
                <div className="p-2 bg-muted/30 rounded text-center">
                  <div className="font-medium">{((stats.processingTimeMs ?? 0) / 1000).toFixed(1)}s</div>
                  <div className="text-muted-foreground">Tempo</div>
                </div>
              </div>
            )}

            {preview.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Mostrando {preview.length} entradas de exemplo</span>
                  <div className="flex gap-2">
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded bg-green-500" /> Manter ({preview.filter(p => p.action === 'keep').length})
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded bg-yellow-500" /> Modificar ({preview.filter(p => p.action === 'modify').length})
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded bg-red-500" /> Remover ({preview.filter(p => p.action === 'remove').length})
                    </span>
                  </div>
                </div>
                <ScrollArea className="h-[250px] border rounded-lg">
                  <div className="p-2 space-y-1">
                    {preview.map((entry, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded text-xs transition-colors ${
                          entry.action === 'remove'
                            ? 'bg-red-500/10 border-l-4 border-red-500'
                            : entry.action === 'modify'
                            ? 'bg-yellow-500/10 border-l-4 border-yellow-500'
                            : 'bg-green-500/10 border-l-4 border-green-500'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 space-y-1">
                            {/* Original */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground w-12 shrink-0">Original:</span>
                              <span className={`truncate ${entry.action === 'remove' ? 'line-through text-muted-foreground' : ''}`}>
                                {entry.original.title || '(sem título)'}
                              </span>
                              {entry.original.group && (
                                <Badge variant="outline" className="text-[10px] h-4 shrink-0">
                                  {entry.original.group}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Cleaned (if modified) */}
                            {entry.action === 'modify' && entry.cleaned && (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground w-12 shrink-0">Limpo:</span>
                                <span className="truncate font-medium text-primary">
                                  {entry.cleaned.title}
                                </span>
                              </div>
                            )}
                            
                            {/* URL preview */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground w-12 shrink-0">URL:</span>
                              <span className="truncate text-muted-foreground font-mono text-[10px]">
                                {entry.original.url || '(vazia)'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge 
                              variant={entry.action === 'remove' ? 'destructive' : entry.action === 'modify' ? 'secondary' : 'outline'}
                              className="text-[10px]"
                            >
                              {entry.action === 'remove' ? 'Remover' : entry.action === 'modify' ? 'Modificar' : 'Manter'}
                            </Badge>
                            {entry.ruleApplied && (
                              <span className="text-[10px] text-muted-foreground">
                                {entry.ruleApplied}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {entry.reason && (
                          <div className="mt-2 pt-2 border-t border-border/50 text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {entry.reason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Eye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Clique em "Simular" para ver o preview</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={loadDemoData}
                >
                  Carregar preview de demonstração
                </Button>
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="flex-1 overflow-auto space-y-4 mt-4">
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum histórico de limpeza</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            job.status === 'completed' ? 'default' :
                            job.status === 'failed' ? 'destructive' : 'secondary'
                          }>
                            {job.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(job.created_at).toLocaleString()}
                          </span>
                        </div>
                        {job.stats && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {(job.stats as unknown as CleanStats).validEntries?.toLocaleString()} válidas de{' '}
                            {(job.stats as unknown as CleanStats).totalEntries?.toLocaleString()}
                          </div>
                        )}
                      </div>
                      {job.status === 'completed' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUndo(job.id)}
                        >
                          <Undo2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Progress */}
        {(isAnalyzing || isExecuting) && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{isExecuting ? 'Executando limpeza...' : 'Analisando...'}</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={loadDemoData}
            className="mr-auto"
          >
            <Lightbulb className="w-4 h-4 mr-1" />
            Demo
          </Button>
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
          <Button
            variant="secondary"
            onClick={handlePreview}
            disabled={isAnalyzing || isExecuting}
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            Simular
          </Button>
          <Button
            onClick={handleExecute}
            disabled={isAnalyzing || isExecuting}
          >
            {isExecuting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            Executar Limpeza
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ 
  label, 
  value, 
  variant = 'default' 
}: { 
  label: string; 
  value: number; 
  variant?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const variants = {
    default: 'bg-muted/50',
    success: 'bg-green-500/10 text-green-600',
    warning: 'bg-yellow-500/10 text-yellow-600',
    danger: 'bg-red-500/10 text-red-600',
  };

  return (
    <div className={`p-2 rounded-lg text-center ${variants[variant]}`}>
      <div className="text-lg font-bold">{(value ?? 0).toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
