async function main() {
  const res = await fetch('http://localhost:3002/api/solar-orders/documentation-dashboard');
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}
main();
