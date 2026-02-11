const express = require("express");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
app.use(express.json());

/* ---------------- CONFIG ---------------- */

const SHOP = process.env.SHOP;
const TOKEN = process.env.SHOPIFY_TOKEN;
const API_VERSION = "2023-10";

/* ---------------- PRICE UPDATE PANEL ---------------- */

app.get("/", (req, res) => {
  res.send(`
    <h2>Price Updater Panel</h2>

    <form method="POST" action="/update-prices">
      Gold Rate: <input name="gold" /><br/><br/>
      Silver Rate: <input name="silver" /><br/><br/>
      <button type="submit">Update Prices</button>
    </form>
  `);
});

/* ---------------- UPDATE PRICES ---------------- */

app.post("/update-prices", express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const GOLD_RATE = parseFloat(req.body.gold);
    const SILVER_RATE = parseFloat(req.body.silver);

    /* ---- GET PRODUCTS ---- */

    const productsRes = await fetch(
      `https://${SHOP}/admin/api/${API_VERSION}/products.json?limit=250`,
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const productsData = await productsRes.json();
    const products = productsData.products;

    /* ---- LOOP PRODUCTS ---- */

    for (const product of products) {
      const productId = product.id;

      /* ---- GET METAFIELDS ---- */

      const metaRes = await fetch(
        `https://${SHOP}/admin/api/${API_VERSION}/products/${productId}/metafields.json`,
        {
          headers: {
            "X-Shopify-Access-Token": TOKEN,
            "Content-Type": "application/json",
          },
        }
      );

      const metaData = await metaRes.json();
      const metafields = metaData.metafields;

      /* ---- FIND VALUES ---- */

      const goldWeight =
        metafields.find(m => m.namespace === "custom" && m.key === "gold_weight")?.value || 0;

      const silverWeight =
        metafields.find(m => m.namespace === "custom" && m.key === "silver_weight")?.value || 0;

      const makingCharge =
        metafields.find(m => m.namespace === "custom" && m.key === "making_charge")?.value || 0;

      const gstPercent =
        metafields.find(m => m.namespace === "custom" && m.key === "gst_percent")?.value || 0;

      /* ---- PRICE CALCULATION ---- */

      const goldPrice = goldWeight * GOLD_RATE;
      const silverPrice = silverWeight * SILVER_RATE;

      let finalPrice =
        goldPrice +
        silverPrice +
        parseFloat(makingCharge);

      finalPrice =
        finalPrice +
        (finalPrice * parseFloat(gstPercent)) / 100;

      finalPrice = finalPrice.toFixed(2);

      /* ---- UPDATE VARIANTS ---- */

      for (const variant of product.variants) {
        await fetch(
          `https://${SHOP}/admin/api/${API_VERSION}/variants/${variant.id}.json`,
          {
            method: "PUT",
            headers: {
              "X-Shopify-Access-Token": TOKEN,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              variant: {
                id: variant.id,
                price: finalPrice,
              },
            }),
          }
        );
      }
    }

    res.send("✅ Prices Updated Successfully");
  } catch (error) {
    console.error(error);
    res.send("❌ Error updating prices");
  }
});

/* ---------------- SERVER ---------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
