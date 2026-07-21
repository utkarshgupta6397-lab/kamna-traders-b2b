import { GatewayClient } from './src/lib/services/GatewayClient';

async function main() {
  const res = await fetch('http://localhost:3002/api/communications/gateway/templates', {
    headers: {
      'Cookie': '__next_hmr_refresh_hash__=235; session=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJjbXB3YzBmYjUwMDAxdWFmbnBqNmh2ZDZ6Iiwicm9sZSI6IlNUQUZGIiwic2Vzc2lvblRva2VuIjoiM2VlOTY3NzYtODllNy00YjU2LWEwYzEtNzhjYmEzZjI1NzNiIiwiZGV2aWNlVHlwZSI6ImRlc2t0b3AiLCJleHBpcmVzIjoiMjAyNi0wNy0xOFQxODo0MzoxNS41MzBaIiwiaWF0IjoxNzg0MzEzNzk1LCJleHAiOjE3ODQ0MDAxOTV9.VfjA9nrDqmMTVa8K14o9iSJl5mswvbOBBfnheqGWcmY'
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data.templates?.[0], null, 2));
}

main().catch(console.error);
