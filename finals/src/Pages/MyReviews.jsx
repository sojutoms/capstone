import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./CSS/MyReviews.css";
import API_BASE_URL from "../services/api";
import star_icon from "../Components/Assets/star_icon.png";
import star_dull_icon from "../Components/Assets/star_dull_icon.png";

const Stars = ({ rating }) => (
  <div className="myreviews-stars">
    {Array.from({ length: 5 }).map((_, i) => (
      <img key={i} src={i < Math.round(rating || 0) ? star_icon : star_dull_icon} alt="" />
    ))}
  </div>
);

const MyReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth-token");
    if (!token) { setLoading(false); return; }

    fetch(`${API_BASE_URL}/myreviews`, { headers: { "auth-token": token } })
      .then((r) => r.json())
      .then((data) => { if (data.success) setReviews(data.reviews || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="myreviews-page">
      <div className="myreviews-container">
        <div className="myreviews-header">
          <div>
            <h1 className="myreviews-title">My Reviews</h1>
            <p className="myreviews-subtitle">
              {reviews.length} {reviews.length === 1 ? "review" : "reviews"} written
            </p>
          </div>
        </div>

        {loading ? (
          <div className="myreviews-loading">Loading your reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="myreviews-empty">
            <div className="myreviews-empty-icon">✎</div>
            <h2 className="myreviews-empty-title">No reviews yet</h2>
            <p className="myreviews-empty-desc">
              Reviews you write for products you've purchased will show up here.
            </p>
            <Link to="/orderhistory" className="myreviews-empty-btn">View Your Orders</Link>
          </div>
        ) : (
          <div className="myreviews-list">
            {reviews.map((r) => (
              <div key={r._id} className="myreviews-card">
                <div className="myreviews-card-header">
                  <Link to={`/product/${r.productId}`} className="myreviews-thumb">
                    <img src={r.productImage} alt={r.productName} />
                  </Link>
                  <div className="myreviews-card-heading">
                    <Link to={`/product/${r.productId}`} className="myreviews-product-name">
                      {r.productName}
                    </Link>
                    <Stars rating={r.rating} />
                  </div>
                  <span className="myreviews-date">
                    {new Date(r.date).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                </div>

                {!!r.title && <h3 className="myreviews-review-title">{r.title}</h3>}
                <p className="myreviews-review-text">{r.review}</p>

                {(r.fit || r.comfort || r.recommend) && (
                  <div className="myreviews-meta-row">
                    {!!r.fit && <span className="myreviews-meta-chip">Fit: {r.fit}</span>}
                    {!!r.comfort && <span className="myreviews-meta-chip">Comfort: {r.comfort}</span>}
                    {!!r.recommend && <span className="myreviews-meta-chip">Recommend: {r.recommend}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyReviews;
