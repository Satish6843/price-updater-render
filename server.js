const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

/* STORE CONFIG */
const SHOP = "silverindiaheritage.myshopify.com";
const TOKEN = process.env.SHOPIFY_TOKEN;

/* METAL RATES */
const GOLD_RATE = 6200;
const SILVER_RATE = 75;

/* API VERSION */
const API = "2023-10";

/* PRICE UPDATE ROUTE */
app.get("/update-prices", async (req, res) => {

  let products = await fetch(
    `https://${SHOP}/admin/api/${API}/products.json?limit=250`,
    {
      headers: { "X-Shopify-Access-Token": TOKEN }
    }
  ).then(r => r.json());

  for (let product of products.products) {

    let metafields = await fetch(
      `https://${SHOP}/admin/api/${API}/products/${product.id}/metafields.json`,
      {
        headers: { "X-Shopify-Access-Token": TOKEN }
      }
    ).then(r => r.json());

    let gold = 0;
    let silver = 0;

    metafields.metafields.forEach(m => {

      if (m.key === "gold_weight") gold = parseFloat(m.value);
      if (m.key === "silver_weight") silver = parseFloat(m.value);

    });

    if (gold === 0 && silver === 0) continue;

    let price =
      (GOLD_RATE * gold) +
      (SILVER_RATE * silver);

    for (let variant of product.variants) {

      await fetch(
        `https://${SHOP}/admin/api/${API}/variants/${variant.id}.json`,
        {
          method: "PUT",
          headers: {
            "X-Shopify-Access-Token": TOKEN,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            variant: { id: variant.id, price }
          })
        }
      );

    }

  }

  res.send("Prices Updated ✅");

});
app.use(express.urlencoded({ extended: true }));


app.listen(3000, () =>
  console.log("Server running")
);
app.get("/", (req, res) => {
  res.send(`
    <h2>Price Updater</h2>

    <form action="/update-prices-manual" method="POST">
      Gold Rate: <input name="gold" /><br/><br/>
      Silver Rate: <input name="silver" /><br/><br/>

      <button type="submit">Update Prices</button>
    </form>
  `);
});
app.post("/update-prices-manual", async (req, res) => {

  const GOLD_RATE = req.body.gold;
  const SILVER_RATE = req.body.silver;

  // 👉 yaha tumhara same price update logic chalega

  res.send("Prices Updated ✅");
});
