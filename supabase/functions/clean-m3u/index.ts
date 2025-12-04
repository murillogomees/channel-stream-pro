/**
 * clean-m3u Edge Function
 * Enterprise-grade M3U playlist sanitizer, validator and optimizer
 * 
 * Accepts: multipart/form-data (file), JSON { url }, JSON { m3u }
 * Returns: Cleaned M3U + statistics or downloadable file
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// ============================================================================
// TYPES
// ============================================================================

interface CleanOptions {
  skipProbe: boolean
  maxChannels: number
  probeTimeoutMs: number
  concurrency: number
  download: boolean
}

interface Channel {
  raw: string
  url: string
  title: string
  duration: number
  tvgId: string
  tvgName: string
  tvgLogo: string
  groupTitle: string
}

interface QuarantinedChannel {
  url: string
  title: string
  reason: 'probe-failed' | 'invalid-url' | 'unsupported-protocol' | 'duplicate' | 'parse-error'
  details?: string
}

interface CleanStats {
  inChannels: number
  uniqueChannels: number
  cleanedChannels: number
  quarantinedCount: number
  quarantined: QuarantinedChannel[]
  generatedAt: string
  processingTimeMs: number
  opts: CleanOptions
}

interface CleanResult {
  cleaned: string
  stats: CleanStats
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_OPTIONS: CleanOptions = {
  skipProbe: false,
  maxChannels: 2000,
  probeTimeoutMs: 4000,
  concurrency: 10,
  download: false
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// Category normalization map
const CATEGORY_MAP: Record<string, string> = {
  // Filmes
  'filme': 'Filmes', 'filmes': 'Filmes', 'movie': 'Filmes', 'movies': 'Filmes',
  'cinema': 'Filmes', 'film': 'Filmes', 'vod': 'Filmes', 'lancamento': 'Filmes',
  'lancamentos': 'Filmes', 'dublado': 'Filmes', 'legendado': 'Filmes',
  // Séries
  'serie': 'Séries', 'series': 'Séries', 'séries': 'Séries', 'tv show': 'Séries',
  'tv shows': 'Séries', 'novela': 'Séries', 'novelas': 'Séries',
  // Esportes
  'esporte': 'Esportes', 'esportes': 'Esportes', 'sport': 'Esportes', 'sports': 'Esportes',
  'futebol': 'Esportes', 'football': 'Esportes', 'soccer': 'Esportes',
  // Infantil
  'infantil': 'Infantil', 'kids': 'Infantil', 'crianca': 'Infantil', 'cartoon': 'Infantil',
  'desenho': 'Infantil', 'desenhos': 'Infantil', 'children': 'Infantil',
  // Notícias
  'noticia': 'Notícias', 'noticias': 'Notícias', 'notícias': 'Notícias', 'news': 'Notícias',
  'jornalismo': 'Notícias', 'jornal': 'Notícias',
  // Aberto
  'aberto': 'Aberto', 'aberta': 'Aberto', 'tv aberta': 'Aberto', 'broadcast': 'Aberto',
  'nacional': 'Aberto', 'brasil': 'Aberto',
  // Documentários
  'documentario': 'Documentários', 'documentários': 'Documentários', 'documentary': 'Documentários',
  // Música
  'musica': 'Música', 'música': 'Música', 'music': 'Música',
  // Adulto (will be filtered)
  'adulto': '🔞 Adulto', 'adult': '🔞 Adulto', 'xxx': '🔞 Adulto', '+18': '🔞 Adulto'
}

// ============================================================================
// LOGGING
// ============================================================================

const LOG_PREFIX = '[clean-m3u]'

function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString()
  const safeData = data ? sanitizeLogData(data) : ''
  console.log(`[${timestamp}]${LOG_PREFIX}[${level}] ${message} ${safeData}`)
}

function sanitizeLogData(data: Record<string, unknown>): string {
  // Avoid logging sensitive URLs
  const safe = { ...data }
  if (safe.url && typeof safe.url === 'string') {
    safe.url = safe.url.substring(0, 50) + '...'
  }
  if (safe.urls && Array.isArray(safe.urls)) {
    safe.urls = `[${safe.urls.length} URLs]`
  }
  return JSON.stringify(safe)
}

// ============================================================================
// PARSING UTILITIES
// ============================================================================

/**
 * Remove BOM and normalize encoding
 */
function sanitizeContent(content: string): string {
  // Remove BOM
  let clean = content.replace(/^\uFEFF/, '')
  
  // Normalize line endings
  clean = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  
  // Remove null bytes and control characters (except newline)
  clean = clean.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
  
  return clean
}

/**
 * Clean a single line
 */
function sanitizeLine(line: string): string {
  return line
    .trim()
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove invisible characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
}

/**
 * Remove emojis and visual garbage from title
 */
function cleanTitle(title: string): string {
  return title
    // Remove emojis
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    // Remove common garbage patterns
    .replace(/[|•★☆►▶◄◀■□●○]/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/{.*?}/g, '')
    // Remove HD/FHD/4K markers (keep clean)
    .replace(/\b(HD|FHD|4K|UHD|SD)\b/gi, '')
    // Normalize spaces
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parse #EXTINF line attributes
 */
function parseEXTINF(line: string): Partial<Channel> {
  const result: Partial<Channel> = {
    duration: -1,
    title: '',
    tvgId: '',
    tvgName: '',
    tvgLogo: '',
    groupTitle: ''
  }
  
  // Extract duration
  const durationMatch = line.match(/#EXTINF:\s*(-?\d+)/)
  if (durationMatch) {
    result.duration = parseInt(durationMatch[1], 10)
  }
  
  // Extract attributes
  const tvgIdMatch = line.match(/tvg-id="([^"]*)"/)
  if (tvgIdMatch) result.tvgId = tvgIdMatch[1].trim()
  
  const tvgNameMatch = line.match(/tvg-name="([^"]*)"/)
  if (tvgNameMatch) result.tvgName = tvgNameMatch[1].trim()
  
  const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/)
  if (tvgLogoMatch) result.tvgLogo = tvgLogoMatch[1].trim()
  
  const groupMatch = line.match(/group-title="([^"]*)"/)
  if (groupMatch) result.groupTitle = groupMatch[1].trim()
  
  // Extract title (after last comma)
  const titleMatch = line.match(/,\s*(.+)$/)
  if (titleMatch) {
    result.title = titleMatch[1].trim()
  }
  
  return result
}

/**
 * Build normalized #EXTINF line
 */
function buildEXTINF(channel: Channel): string {
  const cleanedTitle = cleanTitle(channel.title) || channel.tvgName || 'Unknown'
  const normalizedGroup = normalizeGroup(channel.groupTitle)
  
  const attrs: string[] = []
  
  if (channel.tvgId) attrs.push(`tvg-id="${channel.tvgId}"`)
  if (channel.tvgName || cleanedTitle) attrs.push(`tvg-name="${channel.tvgName || cleanedTitle}"`)
  if (channel.tvgLogo) attrs.push(`tvg-logo="${channel.tvgLogo}"`)
  attrs.push(`group-title="${normalizedGroup}"`)
  
  const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : ''
  
  return `#EXTINF:${channel.duration}${attrsStr},${cleanedTitle}`
}

/**
 * Normalize group/category name
 */
function normalizeGroup(group: string): string {
  if (!group) return 'Outros'
  
  const normalized = group.toLowerCase().trim()
  
  // Check direct mapping
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (normalized.includes(key)) {
      return value
    }
  }
  
  // Return cleaned original if no match
  return group
    .replace(/[|•★☆►▶◄◀■□●○]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Outros'
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): { valid: boolean; reason?: string } {
  if (!url) {
    return { valid: false, reason: 'empty-url' }
  }
  
  // Check protocol
  const lowerUrl = url.toLowerCase()
  if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
    // Allow rtmp, rtsp for some streams
    if (!lowerUrl.startsWith('rtmp://') && !lowerUrl.startsWith('rtsp://')) {
      return { valid: false, reason: 'unsupported-protocol' }
    }
  }
  
  try {
    new URL(url)
    return { valid: true }
  } catch {
    return { valid: false, reason: 'malformed-url' }
  }
}

// ============================================================================
// URL PROBING
// ============================================================================

/**
 * Probe URL with HEAD request, fallback to GET
 */
async function probeUrl(url: string, timeoutMs: number): Promise<{ ok: boolean; status?: number; reason?: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    // Try HEAD first
    let response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; M3U-Cleaner/1.0)'
      }
    })
    
    // Some servers don't support HEAD, try GET with range
    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; M3U-Cleaner/1.0)',
          'Range': 'bytes=0-0'
        }
      })
    }
    
    clearTimeout(timeout)
    
    // Check status
    if (response.status === 403 || response.status === 404 || response.status >= 500) {
      return { ok: false, status: response.status, reason: `http-${response.status}` }
    }
    
    return { ok: true, status: response.status }
  } catch (error) {
    clearTimeout(timeout)
    const reason = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network-error'
    return { ok: false, reason }
  }
}

/**
 * Probe multiple URLs with controlled concurrency
 */
async function probeUrlsBatch(
  channels: Channel[],
  options: CleanOptions
): Promise<Map<string, { ok: boolean; reason?: string }>> {
  const results = new Map<string, { ok: boolean; reason?: string }>()
  
  if (options.skipProbe) {
    // Mark all as OK if skipping probe
    for (const ch of channels) {
      results.set(ch.url, { ok: true })
    }
    return results
  }
  
  log('INFO', 'Starting URL probing', { count: channels.length, concurrency: options.concurrency })
  
  // Process in batches
  const batchSize = options.concurrency
  for (let i = 0; i < channels.length; i += batchSize) {
    const batch = channels.slice(i, i + batchSize)
    
    const probePromises = batch.map(async (ch) => {
      // Skip if already probed (deduped URLs)
      if (results.has(ch.url)) return
      
      const result = await probeUrl(ch.url, options.probeTimeoutMs)
      results.set(ch.url, result)
    })
    
    await Promise.all(probePromises)
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < channels.length) {
      await new Promise(r => setTimeout(r, 50))
    }
  }
  
  log('INFO', 'URL probing complete', { 
    total: channels.length, 
    successful: [...results.values()].filter(r => r.ok).length 
  })
  
  return results
}

// ============================================================================
// MAIN PROCESSING PIPELINE
// ============================================================================

/**
 * Tokenize M3U content into channel objects
 */
function tokenize(content: string): { channels: Channel[]; errors: QuarantinedChannel[] } {
  const channels: Channel[] = []
  const errors: QuarantinedChannel[] = []
  
  const lines = content.split('\n')
  let currentExtinf: Partial<Channel> | null = null
  let lineNumber = 0
  
  for (const rawLine of lines) {
    lineNumber++
    const line = sanitizeLine(rawLine)
    
    // Skip empty lines
    if (!line) continue
    
    // Skip header and comments
    if (line === '#EXTM3U' || (line.startsWith('#') && !line.startsWith('#EXTINF'))) {
      continue
    }
    
    // Parse EXTINF
    if (line.startsWith('#EXTINF')) {
      currentExtinf = parseEXTINF(line)
      currentExtinf.raw = line
      continue
    }
    
    // URL line
    if (currentExtinf && (line.startsWith('http') || line.startsWith('rtmp') || line.startsWith('rtsp'))) {
      const urlValidation = isValidUrl(line)
      
      if (!urlValidation.valid) {
        errors.push({
          url: line.substring(0, 100),
          title: currentExtinf.title || 'Unknown',
          reason: urlValidation.reason === 'unsupported-protocol' ? 'unsupported-protocol' : 'invalid-url',
          details: urlValidation.reason
        })
        currentExtinf = null
        continue
      }
      
      channels.push({
        raw: currentExtinf.raw || '',
        url: line,
        title: currentExtinf.title || '',
        duration: currentExtinf.duration || -1,
        tvgId: currentExtinf.tvgId || '',
        tvgName: currentExtinf.tvgName || '',
        tvgLogo: currentExtinf.tvgLogo || '',
        groupTitle: currentExtinf.groupTitle || ''
      })
      
      currentExtinf = null
    } else if (line.startsWith('http') || line.startsWith('rtmp') || line.startsWith('rtsp')) {
      // URL without EXTINF - skip
      errors.push({
        url: line.substring(0, 100),
        title: 'No EXTINF',
        reason: 'parse-error',
        details: 'URL without preceding EXTINF'
      })
    }
  }
  
  return { channels, errors }
}

/**
 * Deduplicate channels by URL
 */
function deduplicate(channels: Channel[]): { unique: Channel[]; duplicates: QuarantinedChannel[] } {
  const seen = new Map<string, Channel>()
  const duplicates: QuarantinedChannel[] = []
  
  for (const ch of channels) {
    const normalizedUrl = ch.url.toLowerCase().trim()
    
    if (seen.has(normalizedUrl)) {
      duplicates.push({
        url: ch.url.substring(0, 100),
        title: ch.title,
        reason: 'duplicate',
        details: 'URL already exists'
      })
    } else {
      seen.set(normalizedUrl, ch)
    }
  }
  
  return {
    unique: Array.from(seen.values()),
    duplicates
  }
}

/**
 * Build final M3U content
 */
function buildM3U(channels: Channel[]): string {
  const lines: string[] = ['#EXTM3U']
  
  // Sort by group then by title
  const sorted = [...channels].sort((a, b) => {
    const groupCmp = (a.groupTitle || '').localeCompare(b.groupTitle || '')
    if (groupCmp !== 0) return groupCmp
    return (a.title || '').localeCompare(b.title || '')
  })
  
  for (const ch of sorted) {
    lines.push(buildEXTINF(ch))
    lines.push(ch.url)
  }
  
  return lines.join('\n')
}

/**
 * Main cleaning pipeline
 */
async function cleanM3U(content: string, options: CleanOptions): Promise<CleanResult> {
  const startTime = Date.now()
  const quarantined: QuarantinedChannel[] = []
  
  log('INFO', 'Starting M3U cleaning pipeline', { contentLength: content.length })
  
  // Step 1: Sanitize content
  const sanitized = sanitizeContent(content)
  
  // Step 2: Tokenize
  const { channels: parsed, errors: parseErrors } = tokenize(sanitized)
  quarantined.push(...parseErrors)
  
  log('INFO', 'Tokenization complete', { parsed: parsed.length, parseErrors: parseErrors.length })
  
  // Step 3: Apply max channels limit
  const limited = parsed.slice(0, options.maxChannels)
  if (parsed.length > options.maxChannels) {
    log('WARN', 'Channel limit applied', { original: parsed.length, limited: options.maxChannels })
  }
  
  // Step 4: Deduplicate
  const { unique, duplicates } = deduplicate(limited)
  quarantined.push(...duplicates)
  
  log('INFO', 'Deduplication complete', { unique: unique.length, duplicates: duplicates.length })
  
  // Step 5: Probe URLs
  const probeResults = await probeUrlsBatch(unique, options)
  
  // Step 6: Filter by probe results
  const cleaned: Channel[] = []
  for (const ch of unique) {
    const probeResult = probeResults.get(ch.url)
    
    if (probeResult && !probeResult.ok) {
      quarantined.push({
        url: ch.url.substring(0, 100),
        title: ch.title,
        reason: 'probe-failed',
        details: probeResult.reason
      })
    } else {
      cleaned.push(ch)
    }
  }
  
  log('INFO', 'Probe filtering complete', { cleaned: cleaned.length, failed: unique.length - cleaned.length })
  
  // Step 7: Build final M3U
  const finalM3U = buildM3U(cleaned)
  
  const processingTimeMs = Date.now() - startTime
  
  log('INFO', 'Pipeline complete', { 
    inChannels: parsed.length,
    cleanedChannels: cleaned.length,
    processingTimeMs
  })
  
  return {
    cleaned: finalM3U,
    stats: {
      inChannels: parsed.length,
      uniqueChannels: unique.length,
      cleanedChannels: cleaned.length,
      quarantinedCount: quarantined.length,
      quarantined: quarantined.slice(0, 100), // Limit quarantine list in response
      generatedAt: new Date().toISOString(),
      processingTimeMs,
      opts: options
    }
  }
}

// ============================================================================
// INPUT HANDLING
// ============================================================================

/**
 * Extract M3U content from request
 */
async function extractM3UContent(req: Request): Promise<string> {
  const contentType = req.headers.get('content-type') || ''
  
  // Handle multipart/form-data
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file')
    
    if (file && file instanceof File) {
      log('INFO', 'Processing multipart file upload', { filename: file.name, size: file.size })
      return await file.text()
    }
    
    throw new Error('No file found in multipart request')
  }
  
  // Handle JSON
  if (contentType.includes('application/json')) {
    const body = await req.json()
    
    // URL-based fetch
    if (body.url) {
      log('INFO', 'Fetching M3U from URL', { url: body.url.substring(0, 50) })
      
      const response = await fetch(body.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; M3U-Cleaner/1.0)'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch M3U from URL: ${response.status}`)
      }
      
      return await response.text()
    }
    
    // Raw M3U content
    if (body.m3u) {
      log('INFO', 'Processing raw M3U from body', { length: body.m3u.length })
      return body.m3u
    }
    
    throw new Error('JSON body must contain either "url" or "m3u" field')
  }
  
  // Handle plain text
  if (contentType.includes('text/')) {
    log('INFO', 'Processing plain text body')
    return await req.text()
  }
  
  throw new Error(`Unsupported content type: ${contentType}`)
}

/**
 * Parse options from request
 */
function parseOptions(req: Request, body?: Record<string, unknown>): CleanOptions {
  const url = new URL(req.url)
  const options = { ...DEFAULT_OPTIONS }
  
  // From query params
  if (url.searchParams.has('skipProbe')) {
    options.skipProbe = url.searchParams.get('skipProbe') === 'true'
  }
  if (url.searchParams.has('maxChannels')) {
    options.maxChannels = Math.min(parseInt(url.searchParams.get('maxChannels')!) || 2000, 10000)
  }
  if (url.searchParams.has('probeTimeoutMs')) {
    options.probeTimeoutMs = Math.min(parseInt(url.searchParams.get('probeTimeoutMs')!) || 4000, 10000)
  }
  if (url.searchParams.has('download')) {
    options.download = url.searchParams.get('download') === 'true'
  }
  if (url.searchParams.has('concurrency')) {
    options.concurrency = Math.min(parseInt(url.searchParams.get('concurrency')!) || 10, 50)
  }
  
  // From body (overrides query)
  if (body) {
    if (typeof body.skipProbe === 'boolean') options.skipProbe = body.skipProbe
    if (typeof body.maxChannels === 'number') options.maxChannels = Math.min(body.maxChannels, 10000)
    if (typeof body.probeTimeoutMs === 'number') options.probeTimeoutMs = Math.min(body.probeTimeoutMs, 10000)
    if (typeof body.download === 'boolean') options.download = body.download
    if (typeof body.concurrency === 'number') options.concurrency = Math.min(body.concurrency, 50)
  }
  
  return options
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }
  
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
  
  try {
    log('INFO', 'Request received', { 
      contentType: req.headers.get('content-type'),
      url: req.url 
    })
    
    // Extract content
    const content = await extractM3UContent(req)
    
    if (!content || content.length < 10) {
      throw new Error('M3U content is empty or too short')
    }
    
    // Parse options (need to re-read body for JSON requests)
    let bodyOptions: Record<string, unknown> = {}
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      // Body already consumed, options were in URL or we need to handle differently
      // For JSON requests, options come from the same body
      try {
        const url = new URL(req.url)
        bodyOptions = Object.fromEntries(url.searchParams)
      } catch { /* ignore */ }
    }
    
    const options = parseOptions(req, bodyOptions)
    
    log('INFO', 'Options parsed', { options })
    
    // Process M3U
    const result = await cleanM3U(content, options)
    
    // Return as download if requested
    if (options.download) {
      return new Response(result.cleaned, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'audio/x-mpegurl',
          'Content-Disposition': 'attachment; filename="cleaned.m3u"'
        }
      })
    }
    
    // Return JSON response
    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    log('ERROR', 'Request failed', { error: message })
    
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
})
