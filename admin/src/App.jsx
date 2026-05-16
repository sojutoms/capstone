import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./Components/Navbar/Navbar";
import Admin from "./Pages/Admin/Admin";
import AdminLogin from "./Pages/Admin/AdminLogin";
import AdminRoute from "./Pages/Admin/AdminRoute";
import { ThemeProvider } from "./Context/ThemeContext";

const App = () => {
  return (
    <ThemeProvider>
      <Routes>
        {/* Login page — no navbar */}
        <Route path="/login" element={<AdminLogin />} />

        {/* Protected admin — with navbar */}
        <Route path="/*" element={
          <AdminRoute>
            <Navbar />
            <Admin />
          </AdminRoute>
        } />
      </Routes>
    </ThemeProvider>
  );
};

export default App;
