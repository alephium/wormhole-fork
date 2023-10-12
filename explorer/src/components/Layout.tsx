import React from "react";
import Footer from "./Footer";
import NavBar from "./Navbar";

const Layout: React.FC = ({ children }) => (
  <main style={{ overflow: "hidden" }}>
    <NavBar />
    {children}
  </main>
);

export default Layout;
