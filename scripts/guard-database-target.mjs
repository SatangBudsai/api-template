import pg from "pg";

const EXPECTED_DATABASE = "api_template";
const EXPECTED_SCHEMA = "public";

export function assertDatabaseTarget(rawUrl = process.env.DATABASE_URL) {
  if (!rawUrl) throw new Error("DATABASE_URL is required.");

  const url = new URL(rawUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const schema = url.searchParams.get("schema") ?? EXPECTED_SCHEMA;

  if (database !== EXPECTED_DATABASE || schema !== EXPECTED_SCHEMA) {
    throw new Error(
      `Refusing database mutation: expected ${EXPECTED_DATABASE}/${EXPECTED_SCHEMA}.`,
    );
  }

  return { database, schema };
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll("\\", "/")}`) {
  const target = assertDatabaseTarget();
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });
  try {
    const result = await pool.query(
      "select current_database() as database, current_schema() as schema",
    );
    const actual = result.rows[0];
    if (
      actual?.database !== target.database ||
      actual?.schema !== target.schema
    ) {
      throw new Error(
        "Connected database target does not match the guarded URL target.",
      );
    }
    const tables = await pool.query(
      "select tablename from pg_tables where schemaname = $1 order by tablename",
      [target.schema],
    );
    process.stdout.write(
      `Database target verified: ${target.database}/${target.schema}; tables=${tables.rowCount ?? 0}\n`,
    );
  } finally {
    await pool.end();
  }
}
