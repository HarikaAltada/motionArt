import React from "react";
import "./Header.css";
export default function Header() {
  return (
    <section>
      <img src="./icons/MotionArtEffect-logo.png" alt="" className="header" />
      <button className="purchase-button">Purchase Now</button>
      <div className="main-section">
        <div className="title">
          <h2 className="website-title">Transform Your Website</h2>
          <p className="motion">With Motion Art Effect</p>
        </div>
        <div className="main">
          <h1 className="main-head">
            Attract Your Visitors Attention With Colorful
            <span>
              <span className="main-motion"> Motion Art Effect</span>
            </span>
          </h1>

          <p className="description">
            Unleash the power of creativity with Motion Art for Elementor - your
            ultimate solution for seamlessly integrating captivating animations
            into your website.&nbsp;
          </p>
        </div>
      </div>
    </section>
  );
}
