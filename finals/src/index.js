import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import ShopContextProvider from "./Context/ShopContext";
import FavoritesProvider from "./Context/FavoritesContext";

const isLoggedIn = true; // Replace with actual login state from your auth system

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ShopContextProvider>
    <FavoritesProvider isLoggedIn={isLoggedIn}>
      <App />
    </FavoritesProvider>
  </ShopContextProvider>
);

reportWebVitals();
