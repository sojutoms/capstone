const fetch = require('node-fetch');

async function check() {
    try {
        const res = await fetch('http://localhost:4000/allproducts');
        const products = await res.json();
        console.log("First product:", JSON.stringify(products[0], null, 2));
        const p = products.find(prod => prod.name.toUpperCase().includes("AJ") || prod.name.toUpperCase().includes("JORDAN"));
        if (p) {
            console.log("Found Jordan product:", JSON.stringify(p, null, 2));
        }
    } catch (err) {
        console.error(err);
    }
}
check();
