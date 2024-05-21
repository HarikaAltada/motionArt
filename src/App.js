import "./App.css";
import Header from "./components/Header";
import React, { useEffect, useRef } from "react";
import Main from "./components/main";
import Section from "./components/Section";
import Footer from "./components/Fotter";
import { useState } from "react";

function App() {
  return (
    <div>
      <Header />
      <Main />
      <Section />
      <Footer />
    </div>
  );
}

export default App;
