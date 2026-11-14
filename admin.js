
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

import {
  createClient
} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);

let editingProduct = null;
let currentProducts = [];

// Display messages
function message(id, text, error = false) {
  $(id).textContent = text;
  $(id).style.color = error ? "#bd3434" : "#21834b";
}

// Protect displayed text
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

// Upload product image to Supabase
async function uploadProductImage(file) {
  if (!file) return null;

  if (!file.type.startsWith("image/")) {
    throw new Error("Please select a valid image.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Each image must be smaller than 5 MB.");
  }

  const extension = file.name.split(".").pop().toLowerCase();
  const path = `${crypto.randomUUID()}.${extension}`;

  const { error } = await db.storage
    .from("product-images")
    .upload(path, file);

  if (error) throw error;

  const { data } = db.storage
    .from("product-images")
    .getPublicUrl(path);

  return data.publicUrl;
}

// Check admin login
async function checkAdmin() {
  const { data: { session } } = await db.auth.getSession();

  if (!session) {
    showLogin();
    return;
  }

  const { data, error } = await db
    .from("admins")
    .select("user_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !data) {
    await db.auth.signOut();
    showLogin();

    message(
      "loginMessage",
      "This account is not authorised as a store admin.",
      true
    );

    return;
  }

  await showDashboard();
}

// Show login page
function showLogin() {
  $("loginSection").classList.remove("hidden");
  $("dashboard").classList.add("hidden");
}

// Show admin dashboard
async function showDashboard() {
  $("loginSection").classList.add("hidden");
  $("dashboard").classList.remove("hidden");

  await loadSettings();
  await loadAdminProducts();
}

// Admin login
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  message("loginMessage", "Checking login...");

  const { error } = await db.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });

  if (error) {
    message("loginMessage", error.message, true);
    return;
  }

  await checkAdmin();
});

// Logout
$("logoutButton").addEventListener("click", async () => {
  await db.auth.signOut();
  location.reload();
});

// Load WhatsApp number
async function loadSettings() {
  const { data, error } = await db
    .from("store_settings")
    .select("whatsapp_number")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    message("settingsMessage", error.message, true);
    return;
  }

  $("whatsappNumber").value = data?.whatsapp_number || "";
}

// Save WhatsApp number
$("settingsForm").addEventListener("submit", async event => {
  event.preventDefault();

  const number = $("whatsappNumber").value.replace(/\D/g, "");

  if (!/^\d{10,15}$/.test(number)) {
    message(
      "settingsMessage",
      "Enter a valid number with country code.",
      true
    );
    return;
  }

  const { error } = await db
    .from("store_settings")
    .upsert({
      id: 1,
      whatsapp_number: number,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "id"
    });

  if (error) {
    message("settingsMessage", error.message, true);
    return;
  }

  message("settingsMessage", "WhatsApp number saved successfully!");
});

// Load all products
async function loadAdminProducts() {
  $("adminProductList").textContent = "Loading products...";

  const { data, error } = await db
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("adminProductList").textContent =
      "Unable to load products: " + error.message;
    return;
  }

  currentProducts = data || [];

  if (!currentProducts.length) {
    $("adminProductList").textContent = "No products added yet.";
    return;
  }

  $("adminProductList").innerHTML = currentProducts.map(product => `
    <div class="admin-product">

      <img
        src="${escapeHTML(product.image_url || "")}"
        alt=""
        onerror="this.style.visibility='hidden'"
      >

      <div class="admin-product-info">
        <strong>${escapeHTML(product.name)}</strong>

        <small>
          ₹${Number(product.price).toLocaleString("en-IN")}
          · ${escapeHTML(product.category || "Wall Posters")}
          · ${product.is_active ? "Active" : "Hidden"}
        </small>

        <small>
          Images:
          ${[
            product.image_url,
            product.image_url_2,
            product.image_url_3
          ].filter(Boolean).length}/3
        </small>
      </div>

      <div class="admin-product-actions">

        <button
          class="admin-button"
          data-edit="${escapeHTML(product.id)}"
          type="button"
        >
          EDIT
        </button>

        <button
          class="admin-button danger"
          data-delete="${escapeHTML(product.id)}"
          type="button"
        >
          DELETE
        </button>

      </div>
    </div>
  `).join("");
}

// Edit and delete product buttons
$("adminProductList").addEventListener("click", async event => {

  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");

  if (editButton) {
    const product = currentProducts.find(
      p => String(p.id) === editButton.dataset.edit
    );

    if (product) startEditing(product);
  }

  if (deleteButton) {
    const product = currentProducts.find(
      p => String(p.id) === deleteButton.dataset.delete
    );

    if (!product) return;

    if (!confirm(`Delete "${product.name}"?`)) return;

    const { error } = await db
      .from("products")
      .delete()
      .eq("id", product.id);

    if (error) {
      message("productMessage", error.message, true);
    } else {
      message("productMessage", "Product deleted successfully!");
      await loadAdminProducts();
    }
  }
});

// Load existing product into edit form
function startEditing(product) {
  editingProduct = product;

  $("productId").value = product.id;
  $("productName").value = product.name || "";
  $("productPrice").value = product.price || "";
  $("productCategory").value = product.category || "Wall Posters";
  $("productDescription").value = product.description || "";
  $("productActive").checked = product.is_active !== false;

  $("productFormTitle").textContent = "Edit Product";
  $("saveProductButton").textContent = "SAVE CHANGES";

  $("cancelEditButton").classList.remove("hidden");

  $("productFormTitle").scrollIntoView({
    behavior: "smooth"
  });
}

// Reset product form
function resetProductForm() {
  editingProduct = null;

  $("productForm").reset();
  $("productId").value = "";

  $("productActive").checked = true;

  $("productFormTitle").textContent = "Add New Product";
  $("saveProductButton").textContent = "ADD PRODUCT";

  $("cancelEditButton").classList.add("hidden");
}

// Cancel editing
$("cancelEditButton").addEventListener("click", resetProductForm);

// Add or update product with 3 images
$("productForm").addEventListener("submit", async event => {
  event.preventDefault();

  message("productMessage", "Saving product...");

  const name = $("productName").value.trim();
  const price = Number($("productPrice").value);
  const category = $("productCategory").value;
  const description = $("productDescription").value.trim();
  const is_active = $("productActive").checked;

  const files = [
    $("productImage1").files[0],
    $("productImage2").files[0],
    $("productImage3").files[0]
  ];

  if (!name || !Number.isFinite(price) || price < 0) {
    message("productMessage", "Enter a valid product name and price.", true);
    return;
  }

  // Keep previous images when editing
  let imageUrls = [
    editingProduct?.image_url || "",
    editingProduct?.image_url_2 || "",
    editingProduct?.image_url_3 || ""
  ];

  // Main image is required for new products
  if (!editingProduct && !files[0]) {
    message("productMessage", "Please upload the main product image.", true);
    return;
  }

  // Upload selected images
  try {
    for (let i = 0; i < 3; i++) {
      if (files[i]) {
        imageUrls[i] = await uploadProductImage(files[i]);
      }
    }
  } catch (error) {
    message("productMessage", error.message, true);
    return;
  }

  // Product information
  const productData = {
    name,
    price,
    category,
    description,

    image_url: imageUrls[0],
    image_url_2: imageUrls[1],
    image_url_3: imageUrls[2],

    is_active
  };

  let result;

  // Update existing product
  if (editingProduct) {
    result = await db
      .from("products")
      .update(productData)
      .eq("id", editingProduct.id);

  } else {
    // Add new product
    result = await db
      .from("products")
      .insert(productData);
  }

  if (result.error) {
    message("productMessage", result.error.message, true);
    return;
  }

  message(
    "productMessage",
    editingProduct
      ? "Product updated successfully!"
      : "Product added successfully!"
  );

  resetProductForm();

  await loadAdminProducts();
});

// Start admin panel
await checkAdmin();
