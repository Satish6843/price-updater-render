require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const nodemailer = require("nodemailer");
const session = require("express-session");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: "priceupdatersecret",
    resave: false,
    saveUninitialized: true,
  })
);

/* ---------------- CONFIG ---------------- */

const SHOP = process.env.SHOP;
const TOKEN = process.env.SHOPIFY_TOKEN;
const API_VERSION = "2023-10";

/* ---------------- MAILER ---------------- */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ---------------- LOGIN PAGE ---------------- */

app.get("/", (req, res) => {
  if (req.session.loggedIn) {
    return res.redirect("/panel");
  }

  res.send(`
    <h2>Login with OTP</h2>
    <form method="POST" action="/send-otp">
      Email: <input name="email" required />
      <button type="submit">Send OTP</button>
    </form>
  `);
});

/* ---------------- SEND OTP ---------------- */

app.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000);
  req.session.otp = otp;
  req.session.email = email;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your OTP Login Code",
    text: `Your OTP is ${otp}`,
  });

  res.send(`
    <h2>Enter OTP</h2>
    <form method="POST" action="/verify-otp">
      OTP: <input name="otp" required />
      <button type="submit">Verify</button>
    </form>
  `);
});

/* ---------------- VERIFY OTP ---------------- */

app.post("/verify-otp", (req, res) => {
  const { otp } = req.body;

  if (otp == req.session.otp) {
    req.session.loggedIn = true;
    return res.redirect("/panel");
  }

  res.send("❌ Invalid OTP");
});

/* ---------------- LOGOUT ---------------- */

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

/* ---------------- PANEL ---------------- */

app.get("/panel", (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/");

  res.send(`
    <h2>Price Updater Panel</h2>

    <form method="POST" action="/update-prices">
      Gold Rate: <input name="gold" required /><br/><br/>
      Silver Rate: <input name="silver" required /><br/><br/>
      <button type="submit">Update Prices</button>
    </form>

    <br/>
    <a href="/logout">Logout</a>
  `);
});

/* ---------------- PRICE UPDATE ---------------- */

app.post("/update-prices", async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/");

  const goldRate = parseFloat(req.body.gold);
  const silverRate = parseFloat(req.body.silver);

  const productsRes = await fetch(
    `https://${SHOP}/admin/api/${API_VERSION}/products.json`,
    {
      headers: {
        "X-Shopify-Access-Token": TOKEN,
      },
    }
  );

  const products = await productsRes.json();

  for (const product of products.products) {
    const metafieldsRes = await fetch(
      `https://${SHOP}/admin/api/${API_VERSION}/products/${product.id}/metafields.json`,
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN,
        },
      }
    );

    const metafields = await metafieldsRes.json();

    let goldWeight = 0;
    let silverWeight = 0;
    let making = 0;

    metafields.metafields.forEach((m) => {
      if (m.key === "gold_weight") goldWeight = parseFloat(m.value);
      if (m.key === "silver_weight") silverWeight = parseFloat(m.value);
      if (m.key === "making_charge") making = parseFloat(m.value);
    });

    const price =
      goldWeight * goldRate +
      silverWeight * silverRate +
      making;

    await fetch(
      `https://${SHOP}/admin/api/${API_VERSION}/variants/${product.variants[0].id}.json`,
      {
        method: "PUT",
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variant: {
            id: product.variants[0].id,
            price: price.toFixed(2),
          },
        }),
      }
    );
  }

  res.send("✅ Prices Updated Successfully");
});

/* ---------------- SERVER ---------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
