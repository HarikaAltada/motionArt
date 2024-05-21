import React from "react";
import "./main.css";
export default function Main() {
  return (
    <>
      <section>
        <div>
          <h2 className="title-container">
            Trusted by thousands of users around the world
          </h2>
          <div className="icons">
            <div className="logo-1">
              <div>
                <img src="./icons/motionarteffect-img2.png" alt="logo-icon" />
              </div>
              <div>
                <img src="./icons/motionarteffect-img4.png" alt="star-icon" />
                <p className="score">
                  <strong>4.5</strong> Score, 9 Reviews
                </p>
              </div>
            </div>
            <div className="logo-1">
              <div>
                <img src="./icons/motionarteffect-img1.png" alt="" />
              </div>
              <div>
                <img src="./icons/motionarteffect-img4.png" alt="star-icon" />{" "}
                <p className="score">
                  <strong>4.5</strong> Score, 9 Reviews
                </p>
              </div>
            </div>
            <div className="logo-1">
              <div>
                <img
                  src="./icons/motionarteffect-img3.png"
                  alt="wordpress-icon"
                />
              </div>
              <div>
                <img src="./icons/motionarteffect-img4.png" alt="star-icon" />
                <p className="score">
                  <strong>4.5</strong> Score, 9 Reviews
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="section-container">
          <div className="container-main">
            <h2 className="section-title">
              Turn Your Cursor Into A Colorful Magic Wand &amp; Charm Your
              Visitors
            </h2>

            <div className="section-description">
              <p className="container-description">
                Motion Art for Elementor is a groundbreaking plugin that
                empowers you to effortlessly infuse your website with visually
                stunning motion art elements.
              </p>
            </div>
            <div className="button-purchase">
              <span className="button-text">
                <span>
                  <span className="button-content">Purchase From Envato</span>
                </span>
                <span className="arrow-icon">
                  <img
                    src="./icons/right-arrow.png"
                    alt=""
                    width="24px"
                    className="arrow"
                  />
                </span>
              </span>
            </div>
          </div>
          <div className="main-img">
            <img
              src="./icons/motionarteffect-img5.png"
              alt=""
              className="img-icon"
            />
          </div>
        </div>
      </section>
    </>
  );
}
