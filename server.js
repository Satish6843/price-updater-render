const express = require("express");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* ---------------- CONFIG ---------------- */

const SHOP = process.env.SHOP;
const TOKEN = process.env.SHOPIFY_TOKEN;
const API_VERSION = "2023-10";

/* ---- LOGIN CREDENTIAL ---- */

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

/* ---------------- LOGIN PAGE ---------------- */

app.get("/", (req, res) => {
  res.send(`
    <h2>Login</h2>
    <form method="POST" action="/login">
      Username: <input name="username" /><br/><br/>
      Password: <input type="password" name="password" /><br/><br/>
      <button>Login</button>
    </form>
  `);
});

/* ---------------- LOGIN CHECK ---------------- */

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.redirect("/panel");
  } else {
    res.send("❌ Invalid Login");
  }
});

/* ---------------- PANEL ---------------- */

app.get("/panel", (req, res) => {
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

app.post("/update-prices", async (req, res) => {
  try {
    const GOLD_RATE = parseFloat(req.body.gold);
    const SILVER_RATE = parseFloat(req.body.silver);

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

    for (const product of products) {
      const productId = product.id;

      const metaRes = await fetch(
        `https://${SHOP}/admin/api/${API_VERSION}/products/${productId}/metafields.json`,
        {
          headers: {
            "X-Shopify-Access-Token": TOKEN,
            "Content-Type": "application/json",
          },
        }
      );

      const metafields = (await metaRes.json()).metafields;

      const goldWeight =
        metafields.find(m => m.namespace === "custom" && m.key === "gold_weight")?.value || 0;

      const silverWeight =
        metafields.find(m => m.namespace === "custom" && m.key === "silver_weight")?.value || 0;

      const makingCharge =
        metafields.find(m => m.namespace === "custom" && m.key === "making_charge")?.value || 0;

      const gstPercent =
        metafields.find(m => m.namespace === "custom" && m.key === "gst_percent")?.value || 0;

      let price =
        goldWeight * GOLD_RATE +
        silverWeight * SILVER_RATE +
        parseFloat(makingCharge);

      price = price + (price * gstPercent) / 100;
      price = price.toFixed(2);

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
                price: price,
              },
            }),
          }
        );
      }
    }

    res.send("✅ Prices Updated Successfully");
  } catch (err) {
    console.error(err);
    res.send("❌ Error updating prices");
  }
});

/* ---------------- SERVER ---------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running");
});
