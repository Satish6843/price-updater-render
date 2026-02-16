require("dotenv").config();

const express = require("express");
const session = require("express-session");
const nodemailer = require("nodemailer");
const fetch = require("node-fetch");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

/* ---------------- SESSION ---------------- */

app.use(
  session({
    secret: "otp-secret",
    resave: false,
    saveUninitialized: true,
  })
);

/* ---------------- EMAIL ---------------- */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ---------------- LOGIN ---------------- */

app.get("/", (req, res) => {
  if (req.session.login) return res.redirect("/panel");

  res.send(`
<link rel="stylesheet" href="/style.css">
<div class="card">
<img src="/logo.png" class="logo"/>
<h2>Store Login</h2>

<form method="POST" action="/send-otp">
<input name="email" placeholder="Enter Email" required/>
<button>Send OTP</button>
</form>

<div class="footer">
Powered by 
<a href="https://www.mumbaipixels.com" target="_blank">
Mumbai Pixels
</a>
</div>
</div>
`);
});

/* ---------------- SEND OTP ---------------- */

app.post("/send-otp", async (req, res) => {
  const otp = Math.floor(100000 + Math.random() * 900000);

  req.session.otp = otp;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: req.body.email,
    subject: "Your OTP",
    text: `Your OTP is ${otp}`,
  });

  res.send(`
<link rel="stylesheet" href="/style.css">
<div class="card">
<img src="/logo.png" class="logo"/>
<h2>Enter OTP</h2>

<form method="POST" action="/verify">
<input name="otp" required/>
<button>Verify</button>
</form>
</div>
`);
});

/* ---------------- VERIFY ---------------- */

app.post("/verify", (req, res) => {
  if (req.body.otp == req.session.otp) {
    req.session.login = true;
    res.redirect("/panel");
  } else {
    res.send("Invalid OTP");
  }
});

/* ---------------- PANEL ---------------- */

app.get("/panel", (req, res) => {
  if (!req.session.login) return res.redirect("/");

  res.send(`
<link rel="stylesheet" href="/style.css">

<div class="card">
<img src="/logo.png" class="logo"/>

<h2>Price Updater</h2>

<form method="POST" action="/update">
<input name="gold" placeholder="Gold Rate" required/>
<input name="silver" placeholder="Silver Rate" required/>
<button>Update Prices</button>
</form>

<div class="footer">
Powered by 
<a href="https://www.mumbaipixels.com" target="_blank">
Mumbai Pixels
</a>
</div>
</div>

<script>
window.addEventListener("beforeunload", function () {
  navigator.sendBeacon("/auto-logout");
});
</script>
`);
});

/* ---------------- PRICE UPDATE ---------------- */

app.post("/update", async (req, res) => {
  const goldRate = Number(req.body.gold);
  const silverRate = Number(req.body.silver);

  const SHOP = process.env.SHOP;
  const TOKEN = process.env.SHOPIFY_TOKEN;

  const products = await fetch(
    `https://${SHOP}/admin/api/2023-10/products.json`,
    {
      headers: { "X-Shopify-Access-Token": TOKEN },
    }
  ).then((r) => r.json());

  for (const product of products.products) {
    const metafields = await fetch(
      `https://${SHOP}/admin/api/2023-10/products/${product.id}/metafields.json`,
      {
        headers: { "X-Shopify-Access-Token": TOKEN },
      }
    ).then((r) => r.json());

    let goldWeight = 0;
    let silverWeight = 0;
    let making = 0;
    let gst = 0;

    metafields.metafields.forEach((m) => {
      if (m.key === "gold_weight") goldWeight = Number(m.value);
      if (m.key === "silver_weight") silverWeight = Number(m.value);
      if (m.key === "making_charge") making = Number(m.value);
      if (m.key === "gst_percent") gst = Number(m.value);
    });

    /* ---- CALCULATION ---- */

    const metalPrice =
      goldWeight * goldRate +
      silverWeight * silverRate;

    const subtotal = metalPrice + making;

    const finalPrice =
      subtotal + (subtotal * gst) / 100;

    /* UPDATE PRICE */

    for (const variant of product.variants) {
      await fetch(
        `https://${SHOP}/admin/api/2023-10/variants/${variant.id}.json`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": TOKEN,
          },
          body: JSON.stringify({
            variant: {
              id: variant.id,
              price: finalPrice.toFixed(2),
            },
          }),
        }
      );
    }
  }

  res.send("Prices Updated Successfully ✅");
});

/* ---------------- AUTO LOGOUT ---------------- */

app.post("/auto-logout", (req, res) => {
  req.session.destroy();
});

/* ---------------- SERVER ---------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running");
});
