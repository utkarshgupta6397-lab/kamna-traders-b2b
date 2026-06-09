async function run() {
  try {
    const res = await fetch('http://localhost:3002/api/admin/dcr/invoices?limit=5');
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
}
run();
