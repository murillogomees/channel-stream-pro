/**
 * clean-m3u Edge Function
 * Enterprise-grade M3U playlist sanitizer, validator and optimizer
 * Extended with R2 storage persistence and Postgres indexing
 * 
 * Accepts: multipart/form-data (file), JSON { url }, JSON { m3u }
 * Returns: Cleaned M3U + statistics, optional storage URL
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// TYPES
// ============================================================================

interface CleanOptions {
  skipProbe: boolean
  maxChannels: number
  probeTimeoutMs: number
  concurrency: number
  download: boolean
  save: boolean
  retentionDays: number
  userId?: string
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
  storageUrl?: string
  playlistId?: string
}

interface PlaylistRecord {
  id: string
  filename: string
  storage_path: string
  user_id?: string
  original_source?: string
  channel_count: number
  unique_count: number
  quarantined_count: number
  opts: Record<string, unknown>
  probe_summary: Record<string, unknown>
  sha256: string
  size_bytes: number
  expires_at: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Maximum content size: 20MB (Edge functions have ~150MB memory limit)
const MAX_CONTENT_SIZE = 20 * 1024 * 1024

const DEFAULT_OPTIONS: CleanOptions = {
  skipProbe: true, // Default to skip probe for large files
  maxChannels: 5000, // Reduced default for safety
  probeTimeoutMs: 4000,
  concurrency: 10,
  download: false,
  save: false,
  retentionDays: 30
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// R2 Configuration
const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID') || ''
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID') || ''
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY') || ''
const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME') || 'iptvlink-cdn'
const R2_PUBLIC_URL = Deno.env.get('R2_PUBLIC_URL') || `https://${R2_BUCKET_NAME}.r2.dev`

// Category normalization map
const CATEGORY_MAP: Record<string, string> = {
  'filme': 'Filmes', 'filmes': 'Filmes', 'movie': 'Filmes', 'movies': 'Filmes',
  'cinema': 'Filmes', 'film': 'Filmes', 'vod': 'Filmes', 'lancamento': 'Filmes',
  'serie': 'Séries', 'series': 'Séries', 'séries': 'Séries', 'tv show': 'Séries',
  'esporte': 'Esportes', 'esportes': 'Esportes', 'sport': 'Esportes', 'sports': 'Esportes',
  'infantil': 'Infantil', 'kids': 'Infantil', 'crianca': 'Infantil', 'cartoon': 'Infantil',
  'noticia': 'Notícias', 'noticias': 'Notícias', 'notícias': 'Notícias', 'news': 'Notícias',
  'aberto': 'Aberto', 'aberta': 'Aberto', 'tv aberta': 'Aberto', 'broadcast': 'Aberto',
  'documentario': 'Documentários', 'documentários': 'Documentários', 'documentary': 'Documentários',
  'musica': 'Música', 'música': 'Música', 'music': 'Música',
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
// CRYPTO UTILITIES
// ============================================================================

async function sha256(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function shortHash(hash: string): string {
  return hash.substring(0, 8)
}

// ============================================================================
// R2 STORAGE
// ============================================================================

async function uploadToR2(
  path: string, 
  content: string, 
  metadata: Record<string, string>
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return { success: false, error: 'R2 credentials not configured' }
  }

  try {
    const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    const url = `${endpoint}/${R2_BUCKET_NAME}/${path}`
    const body = new TextEncoder().encode(content)
    
    // Create AWS4 signature
    const date = new Date()
    const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '')
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const region = 'auto'
    const service = 's3'
    
    const headers: Record<string, string> = {
      'Host': `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      'Content-Type': 'audio/x-mpegurl',
      'x-amz-date': amzDate,
      'x-amz-content-sha256': await sha256(content),
    }
    
    // Add custom metadata
    for (const [key, value] of Object.entries(metadata)) {
      headers[`x-amz-meta-${key}`] = value
    }
    
    // Sign the request
    const signedHeaders = await signRequest('PUT', path, headers, body, dateStamp, amzDate, region, service)
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: signedHeaders,
      body
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      log('ERROR', 'R2 upload failed', { status: response.status, error: errorText.substring(0, 200) })
      return { success: false, error: `R2 upload failed: ${response.status}` }
    }
    
    const publicUrl = `${R2_PUBLIC_URL}/${path}`
    log('INFO', 'R2 upload successful', { path })
    
    return { success: true, url: publicUrl }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    log('ERROR', 'R2 upload error', { error: message })
    return { success: false, error: message }
  }
}

async function signRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  body: Uint8Array,
  dateStamp: string,
  amzDate: string,
  region: string,
  service: string
): Promise<Record<string, string>> {
  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  
  // Canonical request
  const signedHeadersList = Object.keys(headers).map(k => k.toLowerCase()).sort()
  const signedHeadersStr = signedHeadersList.join(';')
  
  const canonicalHeaders = signedHeadersList
    .map(key => `${key}:${headers[key.split('-').map((p, i) => i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)).join('-')] || headers[key]}`)
    .join('\n') + '\n'
  
  const payloadHash = headers['x-amz-content-sha256']
  const canonicalRequest = [
    method,
    '/' + R2_BUCKET_NAME + '/' + path,
    '',
    canonicalHeaders,
    signedHeadersStr,
    payloadHash
  ].join('\n')
  
  // String to sign
  const canonicalRequestHash = await sha256(canonicalRequest)
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join('\n')
  
  // Signing key
  const kDate = await hmacSha256(`AWS4${R2_SECRET_ACCESS_KEY}`, dateStamp)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  const kSigning = await hmacSha256(kService, 'aws4_request')
  
  // Signature
  const signature = await hmacSha256Hex(kSigning, stringToSign)
  
  // Authorization header
  const authorization = `${algorithm} Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`
  
  return {
    ...headers,
    'Authorization': authorization
  }
}

async function hmacSha256(key: string | ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const keyData = typeof key === 'string' ? encoder.encode(key) : key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
}

async function hmacSha256Hex(key: ArrayBuffer, message: string): Promise<string> {
  const result = await hmacSha256(key, message)
  return Array.from(new Uint8Array(result)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ============================================================================
// PARSING UTILITIES
// ============================================================================

function sanitizeContent(content: string): string {
  let clean = content.replace(/^\uFEFF/, '')
  clean = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  clean = clean.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '')
  return clean
}

function sanitizeLine(line: string): string {
  return line
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
}

function cleanTitle(title: string): string {
  return title
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[|•★☆►▶◄◀■□●○]/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\{.*?\}/g, '')
    .replace(/\b(HD|FHD|4K|UHD|SD)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseEXTINF(line: string): Partial<Channel> {
  const result: Partial<Channel> = {
    duration: -1,
    title: '',
    tvgId: '',
    tvgName: '',
    tvgLogo: '',
    groupTitle: ''
  }
  
  const durationMatch = line.match(/#EXTINF:\s*(-?\d+)/)
  if (durationMatch) result.duration = parseInt(durationMatch[1], 10)
  
  const tvgIdMatch = line.match(/tvg-id="([^"]*)"/)
  if (tvgIdMatch) result.tvgId = tvgIdMatch[1].trim()
  
  const tvgNameMatch = line.match(/tvg-name="([^"]*)"/)
  if (tvgNameMatch) result.tvgName = tvgNameMatch[1].trim()
  
  const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/)
  if (tvgLogoMatch) result.tvgLogo = tvgLogoMatch[1].trim()
  
  const groupMatch = line.match(/group-title="([^"]*)"/)
  if (groupMatch) result.groupTitle = groupMatch[1].trim()
  
  const titleMatch = line.match(/,\s*(.+)$/)
  if (titleMatch) result.title = titleMatch[1].trim()
  
  return result
}

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

function normalizeGroup(group: string): string {
  if (!group) return 'Outros'
  const normalized = group.toLowerCase().trim()
  
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (normalized.includes(key)) return value
  }
  
  return group.replace(/[|•★☆►▶◄◀■□●○]/g, '').replace(/\s+/g, ' ').trim() || 'Outros'
}

function isValidUrl(url: string): { valid: boolean; reason?: string } {
  if (!url) return { valid: false, reason: 'empty-url' }
  
  const lowerUrl = url.toLowerCase()
  if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://') &&
      !lowerUrl.startsWith('rtmp://') && !lowerUrl.startsWith('rtsp://')) {
    return { valid: false, reason: 'unsupported-protocol' }
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

async function probeUrl(url: string, timeoutMs: number): Promise<{ ok: boolean; status?: number; reason?: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    let response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; M3U-Cleaner/1.0)' }
    })
    
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

async function probeUrlsBatch(
  channels: Channel[],
  options: CleanOptions
): Promise<Map<string, { ok: boolean; reason?: string }>> {
  const results = new Map<string, { ok: boolean; reason?: string }>()
  
  if (options.skipProbe) {
    for (const ch of channels) results.set(ch.url, { ok: true })
    return results
  }
  
  log('INFO', 'Starting URL probing', { count: channels.length, concurrency: options.concurrency })
  
  const batchSize = options.concurrency
  for (let i = 0; i < channels.length; i += batchSize) {
    const batch = channels.slice(i, i + batchSize)
    
    const probePromises = batch.map(async (ch) => {
      if (results.has(ch.url)) return
      const result = await probeUrl(ch.url, options.probeTimeoutMs)
      results.set(ch.url, result)
    })
    
    await Promise.all(probePromises)
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

function tokenize(content: string, maxChannels: number): { channels: Channel[]; errors: QuarantinedChannel[]; totalParsed: number } {
  const channels: Channel[] = []
  const errors: QuarantinedChannel[] = []
  
  // Process line by line without storing all lines in memory
  let currentExtinf: Partial<Channel> | null = null
  let lineStart = 0
  let totalParsed = 0
  const maxErrors = 50 // Limit stored errors to save memory
  
  while (lineStart < content.length && channels.length < maxChannels) {
    // Find end of current line
    let lineEnd = content.indexOf('\n', lineStart)
    if (lineEnd === -1) lineEnd = content.length
    
    // Extract and sanitize line
    const rawLine = content.substring(lineStart, lineEnd)
    const line = rawLine.trim().replace(/\s+/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '')
    lineStart = lineEnd + 1
    
    if (!line) continue
    if (line === '#EXTM3U' || (line.startsWith('#') && !line.startsWith('#EXTINF'))) continue
    
    if (line.startsWith('#EXTINF')) {
      currentExtinf = parseEXTINF(line)
      currentExtinf.raw = line
      continue
    }
    
    if (currentExtinf && (line.startsWith('http') || line.startsWith('rtmp') || line.startsWith('rtsp'))) {
      totalParsed++
      const urlValidation = isValidUrl(line)
      
      if (!urlValidation.valid) {
        if (errors.length < maxErrors) {
          errors.push({
            url: line.substring(0, 100),
            title: currentExtinf.title || 'Unknown',
            reason: urlValidation.reason === 'unsupported-protocol' ? 'unsupported-protocol' : 'invalid-url',
            details: urlValidation.reason
          })
        }
        currentExtinf = null
        continue
      }
      
      channels.push({
        raw: '', // Don't store raw to save memory
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
      totalParsed++
      if (errors.length < maxErrors) {
        errors.push({
          url: line.substring(0, 100),
          title: 'No EXTINF',
          reason: 'parse-error',
          details: 'URL without preceding EXTINF'
        })
      }
    }
  }
  
  return { channels, errors, totalParsed }
}

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
  
  return { unique: Array.from(seen.values()), duplicates }
}

function buildM3U(channels: Channel[]): string {
  const lines: string[] = ['#EXTM3U']
  
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

async function cleanM3U(content: string, options: CleanOptions): Promise<CleanResult> {
  const startTime = Date.now()
  const quarantined: QuarantinedChannel[] = []
  
  log('INFO', 'Starting M3U cleaning pipeline', { contentLength: content.length, maxChannels: options.maxChannels })
  
  // Sanitize content (lightweight - only BOM and line ending normalization)
  const sanitized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  
  // Tokenize with early limit enforcement
  const { channels: parsed, errors: parseErrors, totalParsed } = tokenize(sanitized, options.maxChannels)
  quarantined.push(...parseErrors)
  
  log('INFO', 'Tokenization complete', { parsed: parsed.length, totalParsed, parseErrors: parseErrors.length })
  
  // Deduplicate
  const { unique, duplicates } = deduplicate(parsed)
  quarantined.push(...duplicates)
  
  log('INFO', 'Deduplication complete', { unique: unique.length, duplicates: duplicates.length })
  
  // URL probing (skip for very large sets or if option enabled)
  let cleaned: Channel[]
  if (options.skipProbe || unique.length > 2000) {
    cleaned = unique
    if (!options.skipProbe) {
      log('WARN', 'Skipping probe due to large channel count', { count: unique.length })
    }
  } else {
    const probeResults = await probeUrlsBatch(unique, options)
    cleaned = []
    
    for (const ch of unique) {
      const probeResult = probeResults.get(ch.url)
      
      if (probeResult && !probeResult.ok) {
        if (quarantined.length < 100) {
          quarantined.push({
            url: ch.url.substring(0, 100),
            title: ch.title,
            reason: 'probe-failed',
            details: probeResult.reason
          })
        }
      } else {
        cleaned.push(ch)
      }
    }
    
    log('INFO', 'Probe filtering complete', { cleaned: cleaned.length, failed: unique.length - cleaned.length })
  }
  
  const finalM3U = buildM3U(cleaned)
  const processingTimeMs = Date.now() - startTime
  
  log('INFO', 'Pipeline complete', { 
    inChannels: totalParsed,
    cleanedChannels: cleaned.length,
    processingTimeMs
  })
  
  return {
    cleaned: finalM3U,
    stats: {
      inChannels: totalParsed,
      uniqueChannels: unique.length,
      cleanedChannels: cleaned.length,
      quarantinedCount: quarantined.length,
      quarantined: quarantined.slice(0, 100),
      generatedAt: new Date().toISOString(),
      processingTimeMs,
      opts: options
    }
  }
}

// ============================================================================
// STORAGE PERSISTENCE
// ============================================================================

async function savePlaylist(
  cleanedM3U: string,
  stats: CleanStats,
  options: CleanOptions,
  originalSource?: string
): Promise<{ playlistId: string; storageUrl: string } | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Generate identifiers
    const playlistId = crypto.randomUUID()
    const contentHash = await sha256(cleanedM3U)
    const short = shortHash(contentHash)
    
    // Build storage path
    const now = new Date()
    const year = now.getUTCFullYear()
    const month = String(now.getUTCMonth() + 1).padStart(2, '0')
    const day = String(now.getUTCDate()).padStart(2, '0')
    const filename = `${playlistId}-${short}.m3u`
    const storagePath = `playlists/cleaned/${year}/${month}/${day}/${filename}`
    
    // Upload to R2
    const metadata = {
      'playlist-id': playlistId,
      'source': originalSource?.substring(0, 100) || 'direct',
      'hash': short,
      'channels': String(stats.cleanedChannels)
    }
    
    const uploadResult = await uploadToR2(storagePath, cleanedM3U, metadata)
    
    if (!uploadResult.success) {
      log('ERROR', 'Failed to upload to R2', { error: uploadResult.error })
      return null
    }
    
    // Calculate expiration
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + options.retentionDays)
    
    // Insert record in Postgres
    const record: PlaylistRecord = {
      id: playlistId,
      filename,
      storage_path: storagePath,
      user_id: options.userId,
      original_source: originalSource?.substring(0, 500),
      channel_count: stats.inChannels,
      unique_count: stats.uniqueChannels,
      quarantined_count: stats.quarantinedCount,
      opts: options as unknown as Record<string, unknown>,
      probe_summary: {
        probed: !options.skipProbe,
        probeTimeoutMs: options.probeTimeoutMs,
        concurrency: options.concurrency
      },
      sha256: contentHash,
      size_bytes: new TextEncoder().encode(cleanedM3U).length,
      expires_at: expiresAt.toISOString()
    }
    
    const { error: insertError } = await supabase
      .from('playlists')
      .insert(record)
    
    if (insertError) {
      log('ERROR', 'Failed to insert playlist record', { error: insertError.message })
      return null
    }
    
    log('INFO', 'Playlist saved successfully', { playlistId, storagePath })
    
    return {
      playlistId,
      storageUrl: uploadResult.url!
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    log('ERROR', 'savePlaylist error', { error: message })
    return null
  }
}

// ============================================================================
// INPUT HANDLING
// ============================================================================

async function extractM3UContent(req: Request): Promise<{ content: string; source?: string }> {
  const contentType = req.headers.get('content-type') || ''
  
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file')
    
    if (file && file instanceof File) {
      log('INFO', 'Processing multipart file upload', { filename: file.name, size: file.size })
      return { content: await file.text(), source: file.name }
    }
    
    throw new Error('No file found in multipart request')
  }
  
  if (contentType.includes('application/json')) {
    const body = await req.json()
    
    if (body.url) {
      log('INFO', 'Fetching M3U from URL', { url: body.url.substring(0, 50) })
      
      const response = await fetch(body.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; M3U-Cleaner/1.0)' }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch M3U from URL: ${response.status}`)
      }
      
      return { content: await response.text(), source: body.url }
    }
    
    if (body.m3u) {
      log('INFO', 'Processing raw M3U from body', { length: body.m3u.length })
      return { content: body.m3u, source: 'raw-input' }
    }
    
    throw new Error('JSON body must contain either "url" or "m3u" field')
  }
  
  if (contentType.includes('text/')) {
    log('INFO', 'Processing plain text body')
    return { content: await req.text(), source: 'raw-text' }
  }
  
  throw new Error(`Unsupported content type: ${contentType}`)
}

function parseOptions(req: Request, body?: Record<string, unknown>): CleanOptions {
  const url = new URL(req.url)
  const options = { ...DEFAULT_OPTIONS }
  
  // From query params
  if (url.searchParams.has('skipProbe')) options.skipProbe = url.searchParams.get('skipProbe') === 'true'
  if (url.searchParams.has('maxChannels')) options.maxChannels = Math.min(parseInt(url.searchParams.get('maxChannels')!) || 2000, 10000)
  if (url.searchParams.has('probeTimeoutMs')) options.probeTimeoutMs = Math.min(parseInt(url.searchParams.get('probeTimeoutMs')!) || 4000, 10000)
  if (url.searchParams.has('download')) options.download = url.searchParams.get('download') === 'true'
  if (url.searchParams.has('concurrency')) options.concurrency = Math.min(parseInt(url.searchParams.get('concurrency')!) || 10, 50)
  if (url.searchParams.has('save')) options.save = url.searchParams.get('save') === 'true'
  if (url.searchParams.has('retentionDays')) options.retentionDays = Math.min(parseInt(url.searchParams.get('retentionDays')!) || 30, 365)
  
  // From body
  if (body) {
    if (typeof body.skipProbe === 'boolean') options.skipProbe = body.skipProbe
    if (typeof body.maxChannels === 'number') options.maxChannels = Math.min(body.maxChannels, 10000)
    if (typeof body.probeTimeoutMs === 'number') options.probeTimeoutMs = Math.min(body.probeTimeoutMs, 10000)
    if (typeof body.download === 'boolean') options.download = body.download
    if (typeof body.concurrency === 'number') options.concurrency = Math.min(body.concurrency, 50)
    if (typeof body.save === 'boolean') options.save = body.save
    if (typeof body.retentionDays === 'number') options.retentionDays = Math.min(body.retentionDays, 365)
    if (typeof body.userId === 'string') options.userId = body.userId
  }
  
  return options
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }
  
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }
  
  try {
    log('INFO', 'Request received', { contentType: req.headers.get('content-type'), url: req.url })
    
    const { content, source } = await extractM3UContent(req)
    
    if (!content || content.length < 10) {
      throw new Error('M3U content is empty or too short')
    }
    
    // Check content size limit
    if (content.length > MAX_CONTENT_SIZE) {
      const sizeMB = (content.length / (1024 * 1024)).toFixed(1)
      const maxMB = (MAX_CONTENT_SIZE / (1024 * 1024)).toFixed(0)
      log('WARN', 'Content too large', { size: content.length, max: MAX_CONTENT_SIZE })
      throw new Error(`M3U content too large (${sizeMB}MB). Maximum allowed: ${maxMB}MB. Use the m3u-sync system for large playlists.`)
    }
    
    const url = new URL(req.url)
    const options = parseOptions(req, {})
    
    log('INFO', 'Options parsed', { options })
    
    // Process M3U
    const result = await cleanM3U(content, options)
    
    // Save if requested
    if (options.save) {
      const saveResult = await savePlaylist(result.cleaned, result.stats, options, source)
      if (saveResult) {
        result.storageUrl = saveResult.storageUrl
        result.playlistId = saveResult.playlistId
      }
    }
    
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
