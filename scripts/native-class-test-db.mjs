import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

function docker(args, input = '') {
  return new Promise((resolve, reject) => {
    const process = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', error = '';
    process.stdout.on('data', data => { out += data; });
    process.stderr.on('data', data => { error += data; });
    process.on('error', reject);
    process.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(error.trim() || `docker exited ${code}`)));
    process.stdin.end(input);
  });
}
const literal = value => value === null ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
const parameters = (sql, values) => sql.replace(/\$(\d+)/g, (_, index) => literal(values[Number(index) - 1]));

export async function nativeClassTestDb() {
  const name = `schwanki-class-test-${randomUUID().slice(0, 8)}`;
  // Dedicated local test container; no host ports, network, volumes or production credentials.
  await docker(['run', '-d', '--name', name, '--network', 'none', '--memory', '512m', '-e', 'POSTGRES_PASSWORD=schwanki-test-only', 'postgres:17-alpine']);
  let role = '', user = '';
  const execute = sql => docker(['exec', '-i', name, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'], sql);
  const context = (selectedRole = role, selectedUser = user) => `${selectedRole ? `set role ${selectedRole};` : ''}${selectedUser ? `set "request.jwt.claim.sub" to ${literal(selectedUser)};` : ''}`;
  async function query(sql, values = [], selectedRole = role, selectedUser = user) {
    const statement = parameters(sql, values);
    const read = /^\s*select\b/i.test(statement);
    const output = await execute(`${context(selectedRole, selectedUser)}${read ? `select coalesce(json_agg(r), '[]'::json) from (${statement}) r;` : statement}`);
    return { rows: read ? JSON.parse(output.split('\n').at(-1)) : [] };
  }
  try {
    let available = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        // The image starts a temporary init server before exec'ing postgres as
        // PID 1. Do not mistake that temporary server for the test database.
        const main = await docker(['exec', name, 'cat', '/proc/1/comm']);
        if (main !== 'postgres') throw new Error('Database initialization is still running.');
        await execute('select 1;'); available = true; break;
      }
      catch { await new Promise(resolve => setTimeout(resolve, 250)); }
    }
    if (!available) throw new Error('Native test PostgreSQL did not start.');
    return {
      async exec(sql) {
        if (sql === 'set role authenticated;') { role = 'authenticated'; return; }
        if (sql === 'reset role;') { role = ''; return; }
        return execute(context() + sql);
      },
      async query(sql, values) {
        if (sql.startsWith("select set_config('request.jwt.claim.sub'")) { user = values[0]; return { rows: [] }; }
        return query(sql, values);
      },
      queryAsUser: (actor, sql, values) => query(sql, values, 'authenticated', actor),
      close: () => docker(['rm', '-f', name]),
    };
  } catch (error) { await docker(['rm', '-f', name]); throw error; }
}
