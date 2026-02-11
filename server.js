app.post("/update-prices", async (req, res) => {

  const goldRate = Number(req.body.goldRate);
  const silverRate = Number(req.body.silverRate);

  // Get products
  const products = await fetch(
    `https://${SHOP}/admin/api/2023-10/products.json`,
    {
      headers: {
        "X-Shopify-Access-Token": TOKEN,
        "Content-Type": "application/json"
      }
    }
  ).then(r => r.json());

  for (let product of products.products) {

    let price = 0;

    // Example metafields weight
    let goldWeight = Number(product.metafields?.gold_weight || 0);
    let silverWeight = Number(product.metafields?.silver_weight || 0);

    if (goldWeight)
      price += goldWeight * goldRate;

    if (silverWeight)
      price += silverWeight * silverRate;

    // Update price
    await fetch(
      `https://${SHOP}/admin/api/2023-10/variants/${product.variants[0].id}.json`,
      {
        method: "PUT",
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          variant: {
            id: product.variants[0].id,
            price: price
          }
        })
      }
    );
  }

  res.send("Prices Updated");
});
