
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);

let editingProduct = null;
let currentProducts = [];

function message(id, text, error = false) {
  $(id).textContent = text;
  $(id).style.color = error ? "#bd3434" : "#21834b";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

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
    message("loginMessage", "This account is not authorised as a store admin.", true);
    return;
  }

  showDashboard();
}

function showLogin() {
  $("loginSection").classList.remove("hidden");
  $("dashboard").classList.add("hidden");
}

async function showDashboard() {
  $("loginSection").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  await loadSettings();
  await loadAdminProducts();
}

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

$("logoutButton").addEventListener("click", async () => {
  await db.auth.signOut();
  location.reload();
});

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

$("settingsForm").addEventListener("submit", async event => {
  event.preventDefault();

  const number = $("whatsappNumber").value.replace(/\D/g, "");

  if (!/^\d{10,15}$/.test(number)) {
    message("settingsMessage", "Enter a valid number with country code, such as 919876543210.", true);
    return;
  }

  const { error } = await db
    .from("store_settings")
    .upsert({
      id: 1,
      whatsapp_number: number,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });

  if (error) {
    message("settingsMessage", error.message, true);
    return;
  }

  $("whatsappNumber").value = number;
  message("settingsMessage", "WhatsApp number saved successfully.");
});

async function loadAdminProducts() {
  $("adminProductList").textContent = "Loading products...";

  const { data, error } = await db
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("adminProductList").textContent = "Unable to load products: " + error.message;
    return;
  }

  currentProducts = data || [];

  if (!currentProducts.length) {
    $("adminProductList").textContent = "No products added yet.";
    return;
  }

  $("adminProductList").innerHTML = currentProducts.map(product => `
    <div class="admin-product">
      <img src="${escapeHTML(product.image_url || "")}" alt=""
           onerror="this.style.visibility='hidden'">
      <div class="admin-product-info">
        <strong>${escapeHTML(product.name)}</strong>
        <small>₹${Number(product.price).toLocaleString("en-IN")} · ${escapeHTML(product.category || "")} · ${product.is_active ? "Active" : "Hidden"}</small>
      </div>
      <div class="admin-product-actions">
        <button class="admin-button" data-edit="${escapeHTML(product.id)}" type="button">EDIT</button>
        <button class="admin-button danger" data-delete="${escapeHTML(product.id)}" type="button">DELETE</button>
      </div>
    </div>
  `).join("");
}

$("adminProductList").addEventListener("click", async event => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");

  if (editButton) {
    const product = currentProducts.find(p => String(p.id) === editButton.dataset.edit);
    if (product) startEditing(product);
  }

  if (deleteButton) {
    const product = currentProducts.find(p => String(p.id) === deleteButton.dataset.delete);
    if (!product) return;

    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

    const { error } = await db.from("products").delete().eq("id", product.id);

    if (error) {
      message("productMessage", error.message, true);
    } else {
      message("productMessage", "Product deleted.");
      await loadAdminProducts();
    }
  }
});

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

  $("productFormTitle").scrollIntoView({ behavior: "smooth" });
}

function resetProductForm() {
  editingProduct = null;
  $("productForm").reset();
  $("productId").value = "";
  $("productActive").checked = true;
  $("productFormTitle").textContent = "Add New Product";
  $("saveProductButton").textContent = "ADD PRODUCT";
  $("cancelEditButton").classList.add("hidden");
}

$("cancelEditButton").addEventListener("click", resetProductForm);

$("productForm").addEventListener("submit", async event => {
  event.preventDefault();
  message("productMessage", "Saving product...");

  const name = $("productName").value.trim();
  const price = Number($("productPrice").value);
  const category = $("productCategory").value;
  const description = $("productDescription").value.trim();
  const is_active = $("productActive").checked;
  const file = $("productImage").files[0];

  if (!name || !Number.isFinite(price) || price < 0) {
    message("productMessage", "Enter a valid product name and price.", true);
    return;
  }

  let image_url = editingProduct?.image_url || "";

  if (file) {
    if (!file.type.startsWith("image/")) {
      message("productMessage", "Please select an image file.", true);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      message("productMessage", "Image must be smaller than 5 MB.", true);
      return;
    }

    const extension = file.name.split(".").pop().toLowerCase();
    const path = `${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await db.storage
      .from("product-images")
      .upload(path, file, { upsert: false });

    if (uploadError) {
      message("productMessage", "Image upload failed: " + uploadError.message, true);
      return;
    }

    const { data: publicData } = db.storage
      .from("product-images")
      .getPublicUrl(path);

    image_url = publicData.publicUrl;
  }

  const productData = {
    name,
    price,
    category,
    description,
    image_url,
    is_active
  };

  let result;

  if (editingProduct) {
    result = await db
      .from("products")
      .update(productData)
      .eq("id", editingProduct.id);
  } else {
    result = await db
      .from("products")
      .insert(productData);
  }

  if (result.error) {
    message("productMessage", result.error.message, true);
    return;
  }

  message("productMessage", editingProduct ? "Product updated!" : "Product added!");
  resetProductForm();
  await loadAdminProducts();
});

await checkAdmin();
