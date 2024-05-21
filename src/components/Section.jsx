import React from "react";
import "./Section.css";

export default function Section() {
  return (
    <>
      <section className="page">
        <h2 className="page-title">
          Apply On Any Section Or Enable For Whole Page
        </h2>
      </section>
      <section className="page-section">
        <div className="cards-container">
          <div className="card">
            <div className="card-head">
              <h2>Apply On Section</h2>
              <p>
                Apply on section is a game-changer, offering an unparalleled way
                to manage applications directly from your website.&nbsp;
              </p>
            </div>
            <img
              src="./icons/motionarteffect-img11.png"
              alt="Apply On Section"
            />
          </div>
          <div className="card" style={{ position: "relative", top: "70px" }}>
            <div className="card-head">
              <h2>Apply On Page</h2>
              <p>
                Take your website to new heights with Motion Art for Elementor.
                Embrace the power of motion and animation.
              </p>
            </div>
            <img
              src="./icons/motionarteffect-img10 (1).png"
              alt="Apply On Page"
            />
          </div>
        </div>
      </section>
      <section>
        <div className="poster">
          <div>
            <h2>Supported by All Popular Browsers</h2>
          </div>
          <div className="poster-description">
            <p>
              Rest assured, Motion Art is designed to be compatible with all
              major web browsers.
            </p>
          </div>
          <div className="icon-container">
            <img src="./icons/motionarteffect-img8.png" alt="" />
          </div>
        </div>
      </section>
    </>
  );
}
