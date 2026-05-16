import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import ShopCategory from "./ShopCategory";
import API_BASE_URL from "../services/api";

const BrandPage = () => {
  const { brandSlug } = useParams();
  const [brand, setBrand] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/brands`)
      .then((r) => r.json())
      .then((data) => {
        const found = (data.brands || []).find((b) => b.slug === brandSlug);
        if (found) setBrand(found);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  }, [brandSlug]);

  if (notFound) return <div style={{ padding: 40, textAlign: "center" }}>Brand not found.</div>;
  if (!brand) return null;

  return (
    <ShopCategory
      category={brand.parentCategory}
      brand={brand.slug}
    />
  );
};

export default BrandPage;
