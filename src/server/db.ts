import pg from "pg";
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 12,
});
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export const schema = `
CREATE TABLE IF NOT EXISTS "user" (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, "emailVerified" boolean NOT NULL DEFAULT false, image text, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), role text NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher','committee','office','admin')), banned boolean DEFAULT false, "banReason" text, "banExpires" timestamptz);
CREATE TABLE IF NOT EXISTS session (id text PRIMARY KEY, "expiresAt" timestamptz NOT NULL, token text NOT NULL UNIQUE, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "ipAddress" text, "userAgent" text, "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, "impersonatedBy" text);
CREATE TABLE IF NOT EXISTS account (id text PRIMARY KEY, "accountId" text NOT NULL, "providerId" text NOT NULL, "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, scope text, password text, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS verification (id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, "expiresAt" timestamptz NOT NULL, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS teams (id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE IF NOT EXISTS memberships (team_id text REFERENCES teams(id) ON DELETE CASCADE, user_id text REFERENCES "user"(id) ON DELETE CASCADE, PRIMARY KEY(team_id,user_id));
CREATE TABLE IF NOT EXISTS templates (id text PRIMARY KEY, version integer UNIQUE NOT NULL, published boolean NOT NULL DEFAULT false, payload jsonb NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS exams (id text PRIMARY KEY, team_id text NOT NULL REFERENCES teams(id), version integer NOT NULL DEFAULT 1, payload jsonb NOT NULL, locked_n_term text, locked_at timestamptz, locked_by text REFERENCES "user"(id), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS revisions (id bigserial PRIMARY KEY, exam_id text NOT NULL REFERENCES exams(id), version integer NOT NULL, payload jsonb NOT NULL, actor_id text REFERENCES "user"(id), created_at timestamptz DEFAULT now(), UNIQUE(exam_id,version));
CREATE TABLE IF NOT EXISTS audit (id bigserial PRIMARY KEY, exam_id text REFERENCES exams(id), actor_id text REFERENCES "user"(id), action text NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS edit_locks (exam_id text REFERENCES exams(id) ON DELETE CASCADE, section_id text NOT NULL, user_id text NOT NULL REFERENCES "user"(id), expires_at timestamptz NOT NULL, PRIMARY KEY(exam_id,section_id));
CREATE TABLE IF NOT EXISTS files (id text PRIMARY KEY, exam_id text NOT NULL REFERENCES exams(id), name text NOT NULL, mime text NOT NULL, path text NOT NULL, created_at timestamptz DEFAULT now());
CREATE INDEX IF NOT EXISTS exams_team_idx ON exams(team_id);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON session("userId");
`;
