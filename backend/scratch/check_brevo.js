const Brevo = require("@getbrevo/brevo");
console.log("Brevo exports:", Object.keys(Brevo));
try {
  const { BrevoClient } = Brevo;
  if (BrevoClient) {
    const client = new BrevoClient({ apiKey: "test" });
    console.log("Client properties:", Object.keys(client));
    if (client.transactionalEmails) {
      console.log("transactionalEmails exists");
      let proto = Object.getPrototypeOf(client.transactionalEmails);
      console.log("transactionalEmails prototype methods:", Object.getOwnPropertyNames(proto));
    }
  }
} catch (e) {
  console.error("Error checking client instance:", e.message);
}
