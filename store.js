
// ========================================
// PRINTCORE - STORE JAVASCRIPT
// ========================================

const db = window.supabase.createClient(
  window.PRINTCORE_CONFIG.SUPABASE_URL,
  window.PRINTCORE_CONFIG.SUPABASE_ANON_KEY
);

let allProducts = [];
let selectedCategory = "All";
let selectedProduct = null;

// ========================================
// HTML ELEMENTS
// ========================================

const productGrid = document.getElementById("productGrid");
const productCount = document.getElementById("productCount");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");

const modal = document.getElementById("productModal");
const mainImage = document.getElementById("mainProductImage");
const thumbnails = document.getElementById("thumbnails");

// ========================================
// FORMAT PRICE
// ========================================

function formatPrice(price) {
  return "₹" + Number(price || 0).toLocaleString("en-IN");
}

// ========================================
// GET PRODUCT IMAGES
// Supports image_urls array or image1-image4
// ========================================

function getImages(product) {
  let images = [];

  if (Array.isArray(product.image_urls)) {
    images = product.image_urls;
  } else if (Array.isArray(product.images)) {
    images = product.images;
  } else {
    images = [
      product.image1,
      product.image2,
      product.image3,
      product.image4
    ];
  }

  return images.filter(
    image => typeof image === "string" && image.trim() !== ""
  ).slice(0, 4);
}

// ========================================
// LOAD PRODUCTS FROM SUPABASE
// ========================================

async function loadProducts() {

  productGrid.innerHTML =
    '<div class="loading">Loading products...</div>';

  try {

    const { data, error } = await db
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    allProducts = data || [];

    displayProducts();

  } catch (error) {

    console.error("Product loading error:", error);

    productGrid.innerHTML =
      '<div class="loading">Unable to load products. Please check your database connection.</div>';

    productCount.textContent = "Error";

  }

}

// ========================================
// DISPLAY PRODUCTS
// ========================================

function displayProducts() {

  const searchText = searchInput.value
    .trim()
    .toLowerCase();

  const filteredProducts = allProducts.filter(product => {

    const matchesCategory =
      selectedCategory === "All" ||
      product.category === selectedCategory;

    const matchesSearch =
      (product.name || "")
        .toLowerCase()
        .includes(searchText) ||
      (product.description || "")
        .toLowerCase()
        .includes(searchText);

    return matchesCategory && matchesSearch;

  });

  productGrid.innerHTML = "";

  productCount.textContent =
    filteredProducts.length + " products";

  emptyState.classList.toggle(
    "hidden",
    filteredProducts.length !== 0
  );

  filteredProducts.forEach(product => {

    const images = getImages(product);

    const image = images[0] ||
      "https://placehold.co/500x600?text=PRINTCORE";

    const card = document.createElement("article");

    card.className = "product-card";

    const imageBox = document.createElement("div");
    imageBox.className = "product-image";

    const img = document.createElement("img");
    img.src = image;
    img.alt = product.name || "Product";
    img.loading = "lazy";

    const tag = document.createElement("span");
    tag.className = "product-tag";
    tag.textContent = product.category || "Poster";

    imageBox.append(img, tag);

    const name = document.createElement("h3");
    name.textContent = product.name || "Unnamed product";

    const bottom = document.createElement("div");
    bottom.className = "card-bottom";

    const priceBox = document.createElement("div");
    priceBox.className = "card-price";
    priceBox.textContent = formatPrice(product.price);

    if (product.old_price) {

      const oldPrice = document.createElement("del");
      oldPrice.className = "card-old";
      oldPrice.textContent = formatPrice(product.old_price);

      priceBox.appendChild(oldPrice);

    }

    const quickView = document.createElement("span");
    quickView.className = "quick-view";
    quickView.textContent = "View details ↗";

    bottom.append(priceBox, quickView);

    card.append(imageBox, name, bottom);

    card.addEventListener("click", () => {
      openProduct(product);
    });

    productGrid.appendChild(card);

  });

}

// ========================================
// CATEGORY FILTER
// ========================================

document.querySelectorAll(".category").forEach(button => {

  button.addEventListener("click", () => {

    document.querySelectorAll(".category")
      .forEach(item => item.classList.remove("active"));

    button.classList.add("active");

    selectedCategory =
      button.dataset.category;

    displayProducts();

  });

});

// ========================================
// SEARCH
// ========================================

searchInput.addEventListener("input", displayProducts);

// ========================================
// OPEN PRODUCT DETAILS
// ========================================

function openProduct(product) {

  selectedProduct = product;

  const images = getImages(product);

  document.getElementById("modalName").textContent =
    product.name || "";

  document.getElementById("modalCategory").textContent =
    product.category || "";

  document.getElementById("modalPrice").textContent =
    formatPrice(product.price);

  document.getElementById("modalOldPrice").textContent =
    product.old_price
      ? formatPrice(product.old_price)
      : "";

  document.getElementById("modalDescription").textContent =
    product.description || "No description available.";

  document.getElementById("modalSpecs").textContent =
    product.specifications || "";

  // MAIN IMAGE

  mainImage.src = images[0] ||
    "https://placehold.co/500x600?text=PRINTCORE";

  // FOUR IMAGE THUMBNAILS

  thumbnails.innerHTML = "";

  images.forEach((image, index) => {

    const button = document.createElement("button");

    if (index === 0) {
      button.classList.add("active");
    }

    const img = document.createElement("img");

    img.src = image;
    img.alt = "Product image " + (index + 1);

    button.appendChild(img);

    button.addEventListener("click", () => {

      mainImage.src = image;

      thumbnails.querySelectorAll("button")
        .forEach(item => item.classList.remove("active"));

      button.classList.add("active");

    });

    thumbnails.appendChild(button);

  });

  modal.classList.remove("hidden");

  document.body.style.overflow = "hidden";

}

// ========================================
// CLOSE PRODUCT POPUP
// ========================================

function closeProductModal() {

  modal.classList.add("hidden");

  document.body.style.overflow = "";

  selectedProduct = null;

}

document.getElementById("closeModal")
  .addEventListener("click", closeProductModal);

document.getElementById("closeBackdrop")
  .addEventListener("click", closeProductModal);

document.addEventListener("keydown", event => {

  if (event.key === "Escape" && !modal.classList.contains("hidden")) {
    closeProductModal();
  }

});

// ========================================
// WHATSAPP BUY NOW
// ========================================

document.getElementById("buyNow")
  .addEventListener("click", () => {

    if (!selectedProduct) return;

    const product = selectedProduct;

    const whatsapp =
      String(
        product.whatsapp ||
        window.PRINTCORE_CONFIG.STORE_WHATSAPP ||
        ""
      ).replace(/\D/g, "");

    if (!whatsapp) {
      alert("WhatsApp number is not configured.");
      return;
    }

    const message =

`Hello PRINTCORE!

I am interested in ordering this product.

Product: ${product.name}
Category: ${product.category}
Price: ${formatPrice(product.price)}

Please provide more details about ordering.

Thank you!`;

    const url =
      "https://wa.me/" +
      whatsapp +
      "?text=" +
      encodeURIComponent(message);

    window.open(url, "_blank");

  });

// ========================================
// CURRENT YEAR
// ========================================

document.getElementById("year").textContent =
  new Date().getFullYear();

// ========================================
// START WEBSITE
// ========================================

loadProducts();
