import React, { useContext, useState, useEffect } from "react";
import { ShopContext } from "../Context/ShopContext";
import { useParams } from "react-router-dom";
import Breadcrum from "../Components/Breadcrums/Breadcrum";
import ProductDisplay from "../Components/ProductDisplay/ProductDisplay";
import DescriptionBox from "../Components/DescriptionBox/DescriptionBox";
import RelatedProducts from "../Components/RelatedProducts/RelatedProducts";
import RecentlyViewed from "../Components/RecentlyViewed/RecentlyViewed";

const Product = () => {
  const { all_product } = useContext(ShopContext);
  const { productId } = useParams();
  const product = all_product.find((e) => e.id === Number(productId));

  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    if (product) {
      const stored = localStorage.getItem("recentlyViewed");
      let viewedList = stored ? JSON.parse(stored) : [];
      
      // Filter out existing and keep only top 12
      viewedList = viewedList.filter(p => p.id !== product.id);
      viewedList.unshift({
        id: product.id,
        name: product.name,
        image: product.image,
        new_price: product.new_price,
        price: product.price,
        sizes: product.sizes
      });
      localStorage.setItem("recentlyViewed", JSON.stringify(viewedList.slice(0, 12)));
    }
  }, [product]);

  if (!product) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading product...</div>;
  }

  return (
    <div>
      <Breadcrum product={product} />
      <ProductDisplay
        product={product}
        averageRating={averageRating}
        reviewCount={reviewCount}
      />
      <DescriptionBox
        setAverageRating={setAverageRating}
        setReviewCount={setReviewCount}
      />
      <RelatedProducts category={product.category} currentProductId={product.id} />
      <RecentlyViewed currentProductId={product.id} />
    </div>
  );
};

export default Product;
