const express = require("express");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= CONFIG ================= */

const SHOP = process.env.SHOP;  
const TOKEN = process.env.SHOPIFY_TOKEN;
const API_VERSION = "2023-10";

/* ============== HOME PANEL ============== */

app.get("/", (req, res) => {
  res.send(`
    <h2>Price Updater Panel</h2>

    <form method="GET" action="/update-prices">
      <label>Gold Rate:</label><br>
      <input name="gold" /><br><br>

      <label>Silver Rate:</label><br>
      <input name="silver" /><br><br>

      <button type="submit">Update Prices</button>
    </form>
  `);
});

/* ============== UPDATE ROUTE ============== */

app.get("/update-prices", async (req, res) => {
  try {
    const GOLD_RATE = Number(req.query.gold);
    const SILVER_RATE = Number(req.query.silver);

    if (!GOLD_RATE || !SILVER_RATE) {
      return res.send("❌ Enter both rates");
    }

    /* ===== GET PRODUCTS ===== */

    const productRes = await fetch(
      `https://${SHOP}/admin/api/${API_VERSION}/products.json?limit=250`,
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const productData = await productRes.json();
    const products = productData.products;

    /* ===== LOOP PRODUCTS ===== */

    for (const product of products) {
      for (const variant of product.variants) {
        
        /* ===== SAMPLE PRICE LOGIC =====
           (Customize as per your need)
        */

        let newPrice = 0;

        if (product.title.toLowerCase().includes("gold")) {
          newPrice = GOLD_RATE;
        } 
        else if (product.title.toLowerCase().includes("silver")) {
          newPrice = SILVER_RATE;
        } 
        else {
          continue;
        }

        /* ===== UPDATE VARIANT PRICE ===== */

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
                price: newPrice,
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

/* ============== SERVER START ============== */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
