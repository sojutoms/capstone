require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const all = await Product.find({}, "id name model3d").lean();
  console.log(`Total products: ${all.length}`);

  const byStatus = {};
  for (const p of all) {
    const status = p.model3d?.status || "none";
    byStatus[status] = (byStatus[status] || 0) + 1;
  }
  console.log("Counts by model3d.status:", byStatus);

  const ready = all.filter((p) => p.model3d?.status === "ready");
  console.log(`\nReady (${ready.length}):`);
  ready.forEach((p) => {
    console.log(`- id=${p.id} "${p.name}" frames=${p.model3d.turntableFrames?.length || 0} glbUrl=${p.model3d.glbUrl ? "yes" : "no"}`);
  });

  const active = all.filter((p) => ["processing", "rendering"].includes(p.model3d?.status));
  if (active.length) {
    console.log(`\nIn progress (${active.length}):`);
    active.forEach((p) => console.log(`- id=${p.id} "${p.name}" status=${p.model3d.status}`));
  }

  const failed = all.filter((p) => p.model3d?.status === "failed");
  if (failed.length) {
    console.log(`\nFailed (${failed.length}):`);
    failed.forEach((p) => console.log(`- id=${p.id} "${p.name}" error=${p.model3d.error}`));
  }

  await mongoose.disconnect();
})();
