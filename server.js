require("dotenv").config();

const express = require("express");
const fetch = require("node-fetch");
const session = require("express-session");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

/* ---------------- SESSION ---------------- */

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

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
  if (req.session.login) return res.redirect("/panel");

  res.send(`
    <h2>Login</h2>
    <form method="POST" action="/send-otp">
      Email: <input name="email" required />
      <button type="submit">Send OTP</button>
    </form>
  `);
});

/* ---------------- SEND OTP ---------------- */

app.post("/send-otp", async (req, res) => {
  const email = req.body.email;
  const otp = Math.floor(100000 + Math.random() * 900000);

  req.session.otp = otp;
  req.session.email = email;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your Login OTP",
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
  if (req.body.otp == req.session.otp) {
    req.session.login = true;
    res.redirect("/panel");
  } else {
    res.send("❌ Invalid OTP");
  }
});

/* ---------------- PANEL ---------------- */

app.get("/panel", (req, res) => {
  if (!req.session.login) return res.redirect("/");

  res.send(`
    <h2>Price Updater</h2>
    <form method="POST" action="/update-prices">
      Gold Rate: <input name="gold" required /><br/><br/>
      Silver Rate: <input name="silver" required /><br/><br/>
      <button type="submit">Update Prices</button>
    </form>
  `);
});

/* ---------------- SHOPIFY UPDATE ---------------- */

app.post("/update-prices", async (req, res) => {
  if (!req.session.login) return res.redirect("/");

  const GOLD_RATE = Number(req.body.gold);
  const SILVER_RATE = Number(req.body.silver);

  const SHOP = process.env.SHOP;
  const TOKEN = process.env.SHOPIFY_TOKEN;

  /* GET PRODUCTS */
  const products = await fetch(
    `https://${SHOP}/admin/api/2023-10/products.json`,
    {
      headers: { "X-Shopify-Access-Token": TOKEN },
    }
  ).then((r) => r.json());

  for (let product of products.products) {
    const metafields = await fetch(
      `https://${SHOP}/admin/api/2023-10/products/${product.id}/metafields.json`,
      {
        headers: { "X-Shopify-Access-Token": TOKEN },
      }
    ).then((r) => r.json());

    let gold = 0,
      silver = 0,
      making = 0,
      gst = 0;

    metafields.metafields.forEach((m) => {
      if (m.key === "gold_weight") gold = Number(m.value);
      if (m.key === "silver_weight") silver = Number(m.value);
      if (m.key === "making_charge") making = Number(m.value);
      if (m.key === "gst") gst = Number(m.value);
    });

    let price =
      gold * GOLD_RATE +
      silver * SILVER_RATE +
      making;

    price += price * (gst / 100);

    /* UPDATE VARIANT PRICE */
    await fetch(
      `https://${SHOP}/admin/api/2023-10/variants/${product.variants[0].id}.json`,
      {
        method: "PUT",
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variant: { id: product.variants[0].id, price: price.toFixed(2) },
        }),
      }
    );
  }

  res.send("✅ Prices Updated Successfully");
});

/* ---------------- LOGOUT ---------------- */

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

/* ---------------- SERVER ---------------- */

app.listen(3000, () => console.log("Server running"));
