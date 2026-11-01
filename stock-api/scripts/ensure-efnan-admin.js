const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_DATABASE || 'stock_management',
  });
  await client.connect();

  const existing = await client.query(
    'SELECT email, full_name, is_active FROM users ORDER BY email',
  );
  console.log('Current users:');
  for (const row of existing.rows) {
    console.log(` - ${row.email} | ${row.full_name} | active=${row.is_active}`);
  }

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@efnanbusinessplc.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
  const hash = await bcrypt.hash(password, 10);

  const role = await client.query(
    "SELECT id FROM roles WHERE name = 'Admin' LIMIT 1",
  );
  if (!role.rows[0]) {
    throw new Error('Admin role missing — run full seed first');
  }
  const roleId = role.rows[0].id;

  const found = await client.query('SELECT id FROM users WHERE email = $1', [
    email,
  ]);

  if (found.rows[0]) {
    await client.query(
      `UPDATE users
       SET password_hash = $1, is_active = true, role_id = $2,
           full_name = COALESCE(NULLIF(full_name, ''), $3),
           updated_at = NOW()
       WHERE email = $4`,
      [hash, roleId, 'Ahmad Jemal', email],
    );
    console.log(`Updated password for ${email}`);
  } else {
    const old = await client.query(
      `SELECT id, email FROM users
       WHERE email IN ('admin@stock.local', 'admin@csolve.local')
       ORDER BY email
       LIMIT 1`,
    );
    if (old.rows[0]) {
      await client.query(
        `UPDATE users
         SET email = $1, password_hash = $2, is_active = true, role_id = $3,
             full_name = $4, updated_at = NOW()
         WHERE id = $5`,
        [email, hash, roleId, 'Ahmad Jemal', old.rows[0].id],
      );
      console.log(`Renamed ${old.rows[0].email} -> ${email} and reset password`);
    } else {
      await client.query(
        `INSERT INTO users
           (id, email, full_name, password_hash, role_id, is_active, created_at, updated_at)
         VALUES
           (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())`,
        [email, 'Ahmad Jemal', hash, roleId],
      );
      console.log(`Created ${email}`);
    }
  }

  const check = await client.query(
    'SELECT email, full_name, is_active FROM users WHERE email = $1',
    [email],
  );
  console.log('Ready:', check.rows[0]);
  console.log(`Login with ${email} / ${password}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
