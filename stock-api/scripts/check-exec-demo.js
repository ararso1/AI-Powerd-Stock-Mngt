require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const c = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: String(process.env.DB_PASSWORD ?? ''),
    database: process.env.DB_DATABASE,
  });
  await c.connect();
  const one = async (sql) => (await c.query(sql)).rows;
  console.log('exec lots', (await one("select count(*)::int as n from lots where code like 'LOT-EXEC%'"))[0]);
  console.log('collections', (await one("select count(*)::int as n from collection_tickets where ticket_number like 'COL-EXEC%'"))[0]);
  console.log('sales', (await one('select count(*)::int as n from sales'))[0]);
  console.log('exports', await one('select contract_number, status, allocated_kg from export_contracts order by contract_number'));
  console.log('expenses', (await one('select count(*)::int as n from expenses'))[0]);
  console.log('customers', (await one('select count(*)::int as n from customers'))[0]);
  console.log('process', (await one('select count(*)::int as n from process_runs'))[0]);
  console.log('stock levels', (await one('select count(*)::int as n from stock_levels'))[0]);
  console.log('banks', await one('select name, balance, currency_code from bank_accounts'));
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
