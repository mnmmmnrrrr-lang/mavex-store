const winterSizes = ["XS", "S", "M", "L", "XL", "XXL"];

function makeVariants(color: string) {
  return winterSizes.map((size) => ({
    id: `${color.toLowerCase()}-${size.toLowerCase()}`,
    color,
    size,
    stock_quantity: 10,
    price_override: null,
    is_active: true,
  }));
}

export const localProducts = [
  {
    id: "mavex-winter-27-navy-logo-hoodie",
    slug: "mavex-winter-27-navy-logo-hoodie",
    name: "MAVEX Winter 27 Navy Logo Hoodie",
    description: "Navy logo hoodie from the MAVEX Winter 27 collection.",
    price: 600,
    compare_at_price: 1000,
    product_images: [
      {
        image_url: "/mavex-products/navy-logo-hoodie.png",
        alt_text: "Navy MAVEX logo hoodie",
        sort_order: 0,
      },
    ],
    product_variants: makeVariants("Navy"),
  },
  {
    id: "mavex-winter-27-navy-logo-joggers",
    slug: "mavex-winter-27-navy-logo-joggers",
    name: "MAVEX Winter 27 Navy Logo Joggers",
    description: "Navy logo joggers from the MAVEX Winter 27 collection.",
    price: 600,
    compare_at_price: 1000,
    product_images: [
      {
        image_url: "/mavex-products/navy-logo-joggers.png",
        alt_text: "Navy MAVEX logo joggers",
        sort_order: 0,
      },
    ],
    product_variants: makeVariants("Navy"),
  },
  {
    id: "mavex-winter-27-grey-logo-hoodie",
    slug: "mavex-winter-27-grey-logo-hoodie",
    name: "MAVEX Winter 27 Grey Logo Hoodie",
    description: "Grey DTF and embroidered logo hoodie from the MAVEX Winter 27 collection.",
    price: 600,
    compare_at_price: 1000,
    product_images: [
      {
        image_url: "/mavex-products/grey-logo-hoodie.png",
        alt_text: "Grey MAVEX hoodie with DTF and embroidered logos",
        sort_order: 0,
      },
    ],
    product_variants: makeVariants("Grey"),
  },
  {
    id: "mavex-winter-27-burgundy-logo-hoodie",
    slug: "mavex-winter-27-burgundy-logo-hoodie",
    name: "MAVEX Winter 27 Burgundy Logo Hoodie",
    description: "Burgundy logo hoodie from the MAVEX Winter 27 collection.",
    price: 600,
    compare_at_price: 1000,
    product_images: [
      {
        image_url: "/mavex-products/burgundy-logo-hoodie.png",
        alt_text: "Burgundy MAVEX logo hoodie",
        sort_order: 0,
      },
    ],
    product_variants: makeVariants("Burgundy"),
  },
];
