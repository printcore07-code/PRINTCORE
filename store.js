
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const grid = document.getElementById("productGrid");
const search = document.getElementById("searchInput");
const filter = document.getElementById("categoryFilter");
const count = document.getElementById("productCount");

let products = [];
let whatsappNumber = "";

const money = value => "₹" + Number(value || 0).toLocaleString("en-IN");

async function loadSettings() {
  const { data, error } = await db
    .from("store_settings")
    .select("whatsapp_number")
    .eq("id", 1)
    .maybeSingle();

  if (!error && data) {
    whatsappNumber = String(data.whatsapp_number || "").replace(/\D/g, "");
  }
}

async function loadProducts() {
  grid.innerHTML = '<div class="loading">Loading posters...</div>';

  const { data, error } = await db
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    grid.innerHTML = '<div class="empty-state">Unable to load products. Please try again later.</div>';
    count.textContent = "Products unavailable";
    console.error(error);
    return;
  }

  products = data || [];
  renderProducts();
}

function renderProducts() {
  const keyword = search.value.trim().toLowerCase();
  const category = filter.value;

  const filtered = products.filter(product => {
    const matchesSearch =
      String(product.name || "").toLowerCase().includes(keyword) ||
      String(product.description || "").toLowerCase().includes(keyword);

    const matchesCategory =
      category === "all" || product.category === category;

    return matchesSearch && matchesCategory;
  });

  count.textContent = `${filtered.length} PRODUCTS`;

  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-state">No posters found. Try another search.</div>';
    return;
  }

  grid.innerHTML = filtered.map(product => {
    const safeName = escapeHTML(product.name);
    const safeCategory = escapeHTML(product.category || "Wall Posters");
    const safeDescription = escapeHTML(product.description || "");

    return `
      <article class="product-card">
        <div class="product-image">
          <div class="product-gallery">
  ${[
    product.image_url,
    product.image_url_2,
    product.image_url_3
  ]
    .filter(Boolean)
    .map(url => `
      <img src="${escapeHTML(url)}"
           alt="${escapeHTML(product.name)}"
           loading="lazy">
    `).join("")}
</div>
        </div>
        <div class="product-info">
          <span class="product-category">${safeCategory}</span>
          <h3>${safeName}</h3>
          <p class="product-description">${safeDescription}</p>
          <div class="product-price">${money(product.price)}</div>
          <button class="buy-btn" data-buy="${escapeHTML(String(product.id))}">
            BUY NOW ↗
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

grid.addEventListener("click", event => {
  const button = event.target.closest("[data-buy]");
  if (!button) return;

  const product = products.find(p => String(p.id) === button.dataset.buy);
  if (!product) return;

  if (!whatsappNumber) {
    alert("WhatsApp ordering is not configured yet. Please contact the store.");
    return;
  }

  const message = [
    "Hello PRINTCORE! I would like to order:",
    "",
    `Product: ${product.name}`,
    `Price: ${money(product.price)}`,
    `Product ID: ${product.id}`,
    "",
    "Please share the ordering details."
  ].join("\n");

  const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
});

search.addEventListener("input", renderProducts);
filter.addEventListener("change", renderProducts);

document.querySelectorAll(".category-card").forEach(button => {
  button.addEventListener("click", () => {
    filter.value = button.dataset.category;
    renderProducts();
    document.getElementById("products").scrollIntoView({ behavior: "smooth" });
  });
});

document.getElementById("menuToggle").addEventListener("click", () => {
  document.getElementById("mobileMenu").classList.toggle("open");
});

document.querySelectorAll("#mobileMenu a").forEach(link => {
  link.addEventListener("click", () => {
    document.getElementById("mobileMenu").classList.remove("open");
  });
});

document.getElementById("year").textContent = new Date().getFullYear();

await loadSettings();
await loadProducts();
