const axios = require("axios");

const secretKey = process.env.PAYMONGO_SECRET_KEY || "";

const paymongo = axios.create({
  baseURL: "https://api.paymongo.com/v1",
  headers: {
    Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
    "Content-Type": "application/json",
  },
});

module.exports = paymongo;
