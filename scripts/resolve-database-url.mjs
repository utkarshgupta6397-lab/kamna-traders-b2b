const DEFAULT_SUPABASE_POOLER_HOST = 'aws-0-ap-south-1.pooler.supabase.com';

function isDirectSupabaseUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.hostname.startsWith('db.') && url.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

function getProjectRef() {
  for (const value of [process.env.DATABASE_URL, process.env.POSTGRES_PRISMA_URL]) {
    if (!value) continue;

    try {
      const hostname = new URL(value).hostname;
      if (hostname.startsWith('db.') && hostname.endsWith('.supabase.co')) {
        return hostname.split('.')[1];
      }
    } catch {
      // Continue checking the remaining metadata sources.
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      return new URL(supabaseUrl).hostname.split('.')[0];
    } catch {
      // Fall back to POSTGRES_HOST below.
    }
  }

  const postgresHost = process.env.POSTGRES_HOST;
  if (postgresHost?.startsWith('db.') && postgresHost.endsWith('.supabase.co')) {
    return postgresHost.split('.')[1];
  }

  return undefined;
}

function getUrlPassword(value) {
  if (!value) return undefined;

  try {
    return new URL(value).password;
  } catch {
    return undefined;
  }
}

function buildSupabasePoolerUrl() {
  const projectRef = getProjectRef();
  const password =
    process.env.POSTGRES_PASSWORD ||
    getUrlPassword(process.env.DATABASE_URL) ||
    getUrlPassword(process.env.POSTGRES_PRISMA_URL);

  if (!projectRef || !password) return undefined;

  const database = process.env.POSTGRES_DATABASE || 'postgres';
  const baseUser = process.env.POSTGRES_USER || 'postgres';
  const username = baseUser.includes('.') ? baseUser : `${baseUser}.${projectRef}`;
  const host = process.env.SUPABASE_POOLER_HOST || DEFAULT_SUPABASE_POOLER_HOST;
  const port = process.env.SUPABASE_POOLER_PORT || '5432';

  const url = new URL(`postgresql://${host}:${port}/${database}`);
  url.username = username;
  url.password = password;
  url.searchParams.set('schema', 'public');
  url.searchParams.set('sslmode', 'require');

  return url.toString();
}

function getDatabaseUrl() {
  const prismaUrl = process.env.POSTGRES_PRISMA_URL;
  if (prismaUrl && !isDirectSupabaseUrl(prismaUrl)) return prismaUrl;

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && !isDirectSupabaseUrl(databaseUrl)) return databaseUrl;

  return buildSupabasePoolerUrl() || prismaUrl || databaseUrl;
}

const databaseUrl = getDatabaseUrl();
if (!databaseUrl) {
  console.error('No database URL could be resolved.');
  process.exit(1);
}

process.stdout.write(databaseUrl);
