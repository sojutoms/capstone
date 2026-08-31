import React, { Suspense, lazy } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Banner Assets
import adidas_banner from "./Components/Assets/Banner/banner_adidas.png";
import nike_banner from "./Components/Assets/Banner/banner_nike.png";
import nb_banner from "./Components/Assets/Banner/banner_nb.png";
import puma_banner from "./Components/Assets/Banner/banner_puma.png";

// Standard Components
import Navbar from "./Components/Navbar/Navbar";
import Footer from "./Components/Footer/Footer";
import ScrollToTop from "./Components/ScrollToTop/ScrollToTop";
import AdminTrigger from "./Components/AdminTrigger/AdminTrigger";
import Loader from "./Components/Loader/Loader";
import ChatWidget from "./Components/Chatbot/ChatWidget";

// Context Providers
import ShopContextProvider from "./Context/ShopContext";
import FavoritesProvider from "./Context/FavoritesContext";
import { ThemeProvider } from "./Context/ThemeContext";

// Lazy Loaded Pages
const Shop = lazy(() => import("./Pages/Shop"));
const ShopCategory = lazy(() => import("./Pages/ShopCategory"));
const Product = lazy(() => import("./Pages/Product"));
const Cart = lazy(() => import("./Pages/Cart"));
const LoginSignup = lazy(() => import("./Pages/LoginSignup"));
const PlaceOrder = lazy(() => import("./Components/PlaceOrder/PlaceOrder"));
const Orders = lazy(() => import("./Components/Order/Orders"));
const OrderHistory = lazy(() => import("./Components/OrderHistory/OrderHistory"));
const Favorites = lazy(() => import("./Pages/Favorites"));
const Settings = lazy(() => import("./Components/Settings/Settings"));
const BrandPage = lazy(() => import("./Pages/BrandPage"));
const MyVouchers = lazy(() => import("./Pages/MyVouchers"));

// Lazy Loaded Quick Links
const AboutUs = lazy(() => import("./Pages/AboutUs"));
const ContactUs = lazy(() => import("./Pages/ContactUs"));
const ShippingInfo = lazy(() => import("./Pages/ShippingInfo"));
const Returns = lazy(() => import("./Pages/Returns"));
const SizeGuide = lazy(() => import("./Pages/SizeGuide"));
const PrivacyPolicy = lazy(() => import("./Pages/PrivacyPolicy"));
const Terms = lazy(() => import("./Pages/Terms"));
const Cookies = lazy(() => import("./Pages/Cookies"));

function App() {
  return (
    <ThemeProvider>
      <div className="app-wrapper">
        <BrowserRouter>
          <AdminTrigger />
          <ScrollToTop />
          <ShopContextProvider>
            <FavoritesProvider>
              <Navbar />
              <div className="main-content">
                <Suspense fallback={<Loader />}>
                  <Routes>
                    <Route path="/" element={<Shop />} />

                    {/* ── Brand Routes ── */}
                    <Route path="/adidas" element={<ShopCategory banner={adidas_banner} category="shoes" brand="adidas" />} />
                    <Route path="/nike"   element={<ShopCategory banner={nike_banner}   category="shoes" brand="nike"   />} />
                    <Route path="/nb"     element={<ShopCategory banner={nb_banner}     category="shoes" brand="nb"     />} />
                    <Route path="/puma"   element={<ShopCategory banner={puma_banner}   category="shoes" brand="puma"   />} />

                    {/* ── Categories ── */}
                    <Route path="/shoes"        element={<ShopCategory category="shoes"        />} />
                    <Route path="/watch"        element={<ShopCategory category="watch"        />} />
                    <Route path="/bags"         element={<ShopCategory category="bags"         />} />
                    <Route path="/collectibles" element={<ShopCategory category="collectibles" />} />

                    {/* ── Product & User ── */}
                    <Route path="/product" element={<Product />} />
                    <Route path="/product/:productId" element={<Product />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/login" element={<LoginSignup />} />
                    <Route path="/place-order" element={<PlaceOrder />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/orderhistory" element={<OrderHistory />} />
                    <Route path="/favorites" element={<Favorites />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/my-vouchers" element={<MyVouchers />} />

                    {/* ── Customer Service ── */}
                    <Route path="/AboutUs" element={<AboutUs />} />
                    <Route path="/contact" element={<ContactUs />} />
                    <Route path="/shipping" element={<ShippingInfo />} />
                    <Route path="/returns" element={<Returns />} />
                    <Route path="/size-guide" element={<SizeGuide />} />
                    <Route path="/track-order" element={<OrderHistory />} />

                    {/* ── Legal ── */}
                    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/cookies" element={<Cookies />} />

                    {/* ── Dynamic Brand ── */}
                    <Route path="/:brandSlug" element={<BrandPage />} />
                  </Routes>
                </Suspense>
              </div>
              <Footer />
              <ChatWidget />
            </FavoritesProvider>
          </ShopContextProvider>
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}

export default App;