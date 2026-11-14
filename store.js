
import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const categoryList = document.getElementById("categoryList");
const productCount = document.getElementById("productCount");

let allProducts = [];
let selectedCategory = "All";
let whatsappNumber = "";

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

async function loadSettings() {
  const { data, error } = await supabase
    .from("store_settings")
    .select("whatsapp_number")
    .eq("id", 1)
    .maybeSingle();

  if (!error && data) {
    whatsappNumber = data.whatsapp_number || "";
  }
}

async function loadProducts() {
  productGrid.innerHTML =
    '<div class="loading-message">Loading products...</div>';

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    productGrid.innerHTML =
      '<div class="empty-message">Unable to load products. Please refresh the page.</div>';
    console.error(error);
    return;
  }

  allProducts = data || [];
  renderProducts();
}

function renderProducts() {
  const search = searchInput.value.trim().toLowerCase();

  const filtered = allProducts.filter(product => {
    const matchesCategory =
      selectedCategory === "All" ||
      (product.category || "Wall Posters") === selectedCategory;

    const matchesSearch =
      (product.name || "").toLowerCase().includes(search) ||
      (product.description || "").toLowerCase().includes(search);

    return matchesCategory && matchesSearch;
  });

  productCount.textContent = `${filtered.length} products`;

  if (!filtered.length) {
    productGrid.innerHTML =
      '<div class="empty-message">No posters found. Try another search.</div>';
    return;
  }

  productGrid.innerHTML = filtered.map(product => {
    const images = [
      product.image_url,
      product.image_url_2,
      product.image_url_3
    ].filter(Boolean);

    const safeName = escapeHTML(product.name);
    const safeCategory = escapeHTML(product.category || "Wall Posters");
    const safeDescription = escapeHTML(product.description || "");
    const galleryClass =
      images.length === 1 ? "single-image" :
      images.length === 2 ? "two-images" : "";

    const gallery = images.length
      ? images.map((url, index) => `
          <img
            src="${escapeHTML(url)}"
            alt="${safeName} - image ${index + 1}"
            loading="lazy"
          >
        `).join("")
      : '<div class="empty-message">No image available</div>';

    return `
      <article class="product-card">
        <div class="product-gallery ${galleryClass}">
          ${gallery}
        </div>

        <div class="product-info">
          <span class="product-category">${safeCategory}</span>
          <h3>${safeName}</h3>
          <p class="product-description">${safeDescription}</p>

          <div class="product-bottom">
            <span class="product-price">₹${Number(product.price).toLocaleString("en-IN")}</span>
            <button class="buy-btn" data-product-id="${escapeHTML(product.id)}">
              BUY NOW →
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function buyProduct(productId) {
  const product = allProducts.find(
    item => String(item.id) === String(productId)
  );

  if (!product) return;

  if (!whatsappNumber) {
    alert("WhatsApp ordering number has not been configured yet.");
    return;
  }

  const phone = whatsappNumber.replace(/\D/g, "");

  if (!phone) {
    alert("The WhatsApp number in the admin settings is invalid.");
    return;
  }

  const message =
    `Hello PRINTCORE!\n\nI want to order this poster:\n` +
    `Product: ${product.name}\n` +
    `Price: ₹${product.price}\n` +
    `Product ID: ${product.id}`;

  const url =
    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  window.open(url, "_blank", "noopener,noreferrer");
}

productGrid.addEventListener("click", event => {
  const button = event.target.closest(".buy-btn");
  if (button) buyProduct(button.dataset.productId);
});

searchInput.addEventListener("input", renderProducts);

categoryList.addEventListener("click", event => {
  const button = event.target.closest(".category-chip");
  if (!button) return;

  document.querySelectorAll(".category-chip").forEach(chip => {
    chip.classList.remove("active");
  });

  button.classList.add("active");
  selectedCategory = button.dataset.category;
  renderProducts();
});

async function startStore() {
  await Promise.all([loadSettings(), loadProducts()]);
}

startStore();
