import { GET } from './src/app/api/admin/customer-statement/search/route';

async function test() {
  const req = new Request('http://localhost:3000/api/admin/customer-statement/search?q=M/S%20SUN%20POWER');
  const res = await GET(req);
  console.log(await res.json());
}

test().catch(console.error);
