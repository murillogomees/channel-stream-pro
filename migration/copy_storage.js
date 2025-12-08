#!/usr/bin/env node
/**
 * =============================================================================
 * SUPABASE MIGRATION: Storage Copy Script
 * Copia objetos do Storage da origem para o destino
 * =============================================================================
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURAÇÃO
// =============================================================================
const config = {
  origin: {
    url: process.env.SUPABASE_URL_ORIG || '{{SUPABASE_URL_ORIG}}',
    serviceKey: process.env.SUPABASE_SERVICE_KEY_ORIG || '{{SUPABASE_SERVICE_KEY_ORIG}}',
  },
  destination: {
    url: process.env.SUPABASE_URL_DEST || '{{SUPABASE_URL_DEST}}',
    serviceKey: process.env.SUPABASE_SERVICE_KEY_DEST || '{{SUPABASE_SERVICE_KEY_DEST}}',
  },
  buckets: (process.env.BUCKETS_LIST || '{{BUCKETS_LIST}}').split(',').map(b => b.trim()).filter(Boolean),
  concurrency: parseInt(process.env.CONCURRENCY || '5', 10),
  retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3', 10),
  retryDelay: parseInt(process.env.RETRY_DELAY || '1000', 10),
  logFile: process.env.LOG_FILE || './storage_migration.log',
};

// =============================================================================
// LOGGING
// =============================================================================
const log = {
  info: (msg) => console.log(`\x1b[34m[INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[OK]\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
};

const logToFile = (msg) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(config.logFile, `[${timestamp}] ${msg}\n`);
};

// =============================================================================
// HTTP REQUEST HELPER
// =============================================================================
function makeRequest(url, options, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = [];
      
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        
        if (res.headers['content-type']?.includes('application/json')) {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(buffer.toString()), headers: res.headers });
          } catch {
            resolve({ status: res.statusCode, data: buffer, headers: res.headers });
          }
        } else {
          resolve({ status: res.statusCode, data: buffer, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    
    req.end();
  });
}

// =============================================================================
// RETRY WRAPPER
// =============================================================================
async function withRetry(fn, attempts = config.retryAttempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) throw error;
      log.warn(`Tentativa ${i + 1} falhou, retentando em ${config.retryDelay}ms...`);
      await new Promise(r => setTimeout(r, config.retryDelay * (i + 1)));
    }
  }
}

// =============================================================================
// SUPABASE STORAGE API
// =============================================================================
class SupabaseStorage {
  constructor(baseUrl, serviceKey) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.serviceKey = serviceKey;
    this.headers = {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
    };
  }
  
  async listBuckets() {
    const url = `${this.baseUrl}/storage/v1/bucket`;
    const response = await makeRequest(url, { method: 'GET', headers: this.headers });
    
    if (response.status !== 200) {
      throw new Error(`Failed to list buckets: ${response.status}`);
    }
    
    return response.data;
  }
  
  async createBucket(name, options = {}) {
    const url = `${this.baseUrl}/storage/v1/bucket`;
    const body = {
      name,
      id: name,
      public: options.public || false,
      ...options,
    };
    
    const response = await makeRequest(url, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
    }, body);
    
    if (response.status !== 200 && response.status !== 201) {
      if (response.data?.message?.includes('already exists')) {
        log.warn(`Bucket ${name} já existe`);
        return { id: name, name };
      }
      throw new Error(`Failed to create bucket: ${JSON.stringify(response.data)}`);
    }
    
    return response.data;
  }
  
  async listObjects(bucket, prefix = '', options = {}) {
    const url = `${this.baseUrl}/storage/v1/object/list/${bucket}`;
    const body = {
      prefix,
      limit: options.limit || 1000,
      offset: options.offset || 0,
    };
    
    const response = await makeRequest(url, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
    }, body);
    
    if (response.status !== 200) {
      throw new Error(`Failed to list objects: ${response.status}`);
    }
    
    return response.data;
  }
  
  async downloadObject(bucket, path) {
    const url = `${this.baseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(path)}`;
    const response = await makeRequest(url, { method: 'GET', headers: this.headers });
    
    if (response.status !== 200) {
      throw new Error(`Failed to download object: ${response.status}`);
    }
    
    return { data: response.data, contentType: response.headers['content-type'] };
  }
  
  async uploadObject(bucket, path, data, contentType) {
    const url = `${this.baseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(path)}`;
    const response = await makeRequest(url, {
      method: 'POST',
      headers: {
        ...this.headers,
        'Content-Type': contentType || 'application/octet-stream',
        'x-upsert': 'true',
      },
    }, data);
    
    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Failed to upload object: ${JSON.stringify(response.data)}`);
    }
    
    return response.data;
  }
}

// =============================================================================
// MIGRATION LOGIC
// =============================================================================
async function getAllObjects(storage, bucket) {
  const allObjects = [];
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const objects = await storage.listObjects(bucket, '', { limit, offset });
    
    if (!objects || objects.length === 0) break;
    
    allObjects.push(...objects.filter(obj => obj.name)); // Filter out folders
    
    if (objects.length < limit) break;
    offset += limit;
  }
  
  return allObjects;
}

async function copyObject(origin, destination, bucket, objectPath) {
  return withRetry(async () => {
    const { data, contentType } = await origin.downloadObject(bucket, objectPath);
    await destination.uploadObject(bucket, objectPath, data, contentType);
    return true;
  });
}

async function migrateBucket(origin, destination, bucketName) {
  log.info(`\n📦 Migrando bucket: ${bucketName}`);
  logToFile(`Iniciando migração do bucket: ${bucketName}`);
  
  // Get bucket info from origin
  const buckets = await origin.listBuckets();
  const bucketInfo = buckets.find(b => b.name === bucketName || b.id === bucketName);
  
  if (!bucketInfo) {
    log.warn(`Bucket ${bucketName} não encontrado na origem`);
    return { bucket: bucketName, success: 0, failed: 0, skipped: 0 };
  }
  
  // Create bucket in destination
  try {
    await destination.createBucket(bucketName, { public: bucketInfo.public });
    log.success(`Bucket ${bucketName} criado no destino`);
  } catch (e) {
    log.warn(`Erro ao criar bucket (pode já existir): ${e.message}`);
  }
  
  // List all objects
  log.info(`Listando objetos do bucket ${bucketName}...`);
  const objects = await getAllObjects(origin, bucketName);
  log.info(`Encontrados ${objects.length} objetos`);
  
  if (objects.length === 0) {
    return { bucket: bucketName, success: 0, failed: 0, skipped: 0 };
  }
  
  // Copy objects with concurrency
  let success = 0;
  let failed = 0;
  const total = objects.length;
  
  // Process in batches
  for (let i = 0; i < objects.length; i += config.concurrency) {
    const batch = objects.slice(i, i + config.concurrency);
    
    const results = await Promise.allSettled(
      batch.map(async (obj) => {
        try {
          await copyObject(origin, destination, bucketName, obj.name);
          return { success: true, path: obj.name };
        } catch (error) {
          return { success: false, path: obj.name, error: error.message };
        }
      })
    );
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        success++;
        logToFile(`OK: ${bucketName}/${result.value.path}`);
      } else {
        failed++;
        const errorMsg = result.reason?.message || result.value?.error || 'Unknown error';
        logToFile(`FAILED: ${bucketName}/${result.value?.path || 'unknown'} - ${errorMsg}`);
        log.error(`Falha: ${result.value?.path || 'unknown'}`);
      }
    }
    
    // Progress
    const progress = Math.round(((i + batch.length) / total) * 100);
    process.stdout.write(`\r  Progresso: ${progress}% (${success}/${total} copiados, ${failed} falhas)`);
  }
  
  console.log(''); // New line after progress
  
  return { bucket: bucketName, success, failed, skipped: 0 };
}

// =============================================================================
// VALIDATION
// =============================================================================
function validateConfig() {
  const missing = [];
  
  if (config.origin.url.includes('{{')) missing.push('SUPABASE_URL_ORIG');
  if (config.origin.serviceKey.includes('{{')) missing.push('SUPABASE_SERVICE_KEY_ORIG');
  if (config.destination.url.includes('{{')) missing.push('SUPABASE_URL_DEST');
  if (config.destination.serviceKey.includes('{{')) missing.push('SUPABASE_SERVICE_KEY_DEST');
  if (config.buckets.length === 0 || config.buckets[0].includes('{{')) missing.push('BUCKETS_LIST');
  
  if (missing.length > 0) {
    log.error('Variáveis de ambiente não configuradas:');
    missing.forEach(v => console.log(`  - ${v}`));
    console.log('\nExemplo:');
    console.log('  export SUPABASE_URL_ORIG="https://xxxx.supabase.co"');
    console.log('  export SUPABASE_SERVICE_KEY_ORIG="eyJ..."');
    console.log('  export SUPABASE_URL_DEST="https://seu-supabase.hostinger.com"');
    console.log('  export SUPABASE_SERVICE_KEY_DEST="eyJ..."');
    console.log('  export BUCKETS_LIST="avatars,documents,uploads"');
    process.exit(1);
  }
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  console.log('='.repeat(60));
  console.log(' SUPABASE MIGRATION: STORAGE COPY');
  console.log('='.repeat(60));
  console.log('');
  
  validateConfig();
  
  log.info(`Origem: ${config.origin.url}`);
  log.info(`Destino: ${config.destination.url}`);
  log.info(`Buckets: ${config.buckets.join(', ')}`);
  log.info(`Concorrência: ${config.concurrency}`);
  console.log('');
  
  // Initialize clients
  const origin = new SupabaseStorage(config.origin.url, config.origin.serviceKey);
  const destination = new SupabaseStorage(config.destination.url, config.destination.serviceKey);
  
  // Test connections
  log.info('Testando conexões...');
  try {
    await origin.listBuckets();
    log.success('Conexão com origem OK');
  } catch (e) {
    log.error(`Falha na conexão com origem: ${e.message}`);
    process.exit(1);
  }
  
  try {
    await destination.listBuckets();
    log.success('Conexão com destino OK');
  } catch (e) {
    log.error(`Falha na conexão com destino: ${e.message}`);
    process.exit(1);
  }
  
  // Migrate each bucket
  const results = [];
  for (const bucket of config.buckets) {
    try {
      const result = await migrateBucket(origin, destination, bucket);
      results.push(result);
    } catch (e) {
      log.error(`Erro ao migrar bucket ${bucket}: ${e.message}`);
      results.push({ bucket, success: 0, failed: 0, error: e.message });
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(' RESUMO DA MIGRAÇÃO');
  console.log('='.repeat(60));
  
  let totalSuccess = 0;
  let totalFailed = 0;
  
  for (const r of results) {
    console.log(`\n📦 ${r.bucket}:`);
    console.log(`   ✅ Sucesso: ${r.success}`);
    console.log(`   ❌ Falhas: ${r.failed}`);
    if (r.error) console.log(`   ⚠️ Erro: ${r.error}`);
    
    totalSuccess += r.success || 0;
    totalFailed += r.failed || 0;
  }
  
  console.log('\n' + '-'.repeat(40));
  console.log(`TOTAL: ${totalSuccess} copiados, ${totalFailed} falhas`);
  console.log(`Log: ${config.logFile}`);
  console.log('');
  
  if (totalFailed > 0) {
    log.warn('Alguns objetos falharam. Verifique o log para detalhes.');
    process.exit(1);
  }
  
  log.success('Migração de storage concluída!');
}

main().catch((e) => {
  log.error(`Erro fatal: ${e.message}`);
  process.exit(1);
});
