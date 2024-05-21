import React from "react";
import "./Fotter.css";
export default function Footer() {
  return (
    <>
      <section className="footer">
        <div>
          <h2 className="main-title">
            An All-Round Plugin With Powerful Features
          </h2>
          <p className="main-description">
            Whether you're a seasoned web designer or just starting out, Motion
            Art for Elementor seamlessly integrates with the Elementor platform,
            providing you with a seamless and intuitive experience.
          </p>
        </div>
        <div className="card-container">
          <div className="card-main">
            <div className="icon-main">
              <img src="./icons/motionarteffect-img9.png" alt="" />
            </div>
            <div className="content">
              <h2>Light Weight</h2>
              <p>Motion Art for Elementor is designed to be lightweight.</p>
            </div>
          </div>
          <div className="card-main">
            <div className="icon-main">
              <img src="./icons/motionarteffect-img6.png" alt="" />
            </div>
            <div className="content">
              <h2>100% Responsive</h2>
              <p>Create a consistent visual experience across all devices.</p>
            </div>
          </div>
          <div className="card-main">
            <div className="icon-main">
              <img src="./icons/motionarteffect-img7.png" alt="" />
            </div>
            <div className="content">
              <h2>User Friendly Interface</h2>
              <p>
                Ensure a smooth experience for both applicants and
                administrators.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
