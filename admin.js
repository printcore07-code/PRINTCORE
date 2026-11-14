
import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);

let currentProducts = [];

function showMessage(id, message, isError = false) {
  $(id).textContent = message;
  $(id).style.color = isError ? "#ff7777" : "#ff782b";
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showDashboard() {
  $("loginSection").hidden = true;
  $("dashboard").hidden = false;
}

function showLogin() {
  $("loginSection").hidden = false;
  $("dashboard").hidden = true;
}

async function isAdmin(userId) {
  const { data, error } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return !error && !!data;
}

async function uploadProductImage(file) {
  if (!file) return null;

  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Each image must be smaller than 5 MB.");
  }

  const extension = file.name.split(".").pop().toLowerCase();
  const safeExtension = /^[a-z0-9]+$/.test(extension)
    ? extension
    : "jpg";

  const filePath =
    `${crypto.randomUUID()}.${safeExtension}`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("product-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function loadSettings() {
  const { data, error } = await supabase
    .from("store_settings")
    .select("whatsapp_number")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    showMessage("settingsMessage", error.message, true);
    return;
  }

  $("whatsappNumber").value = data?.whatsapp_number || "";
}

$("settingsForm").addEventListener("submit", async event => {
  event.preventDefault();

  const number = $("whatsappNumber").value.trim();

  if (!number) {
    showMessage("settingsMessage", "Enter a WhatsApp number.", true);
    return;
  }

  const cleanNumber = number.replace(/\D/g, "");

  if (cleanNumber.length < 10) {
    showMessage("settingsMessage", "Enter a valid number with country code.", true);
    return;
  }

  showMessage("settingsMessage", "Saving...");

  const { error } = await supabase
    .from("store_settings")
    .upsert({
      id: 1,
      whatsapp_number: cleanNumber,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "id"
    });

  if (error) {
    showMessage("settingsMessage", error.message, true);
  } else {
    showMessage("settingsMessage", "WhatsApp number saved successfully!");
  }
});

async function loadAdminProducts() {
  $("adminProductList").textContent = "Loading products...";

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("adminProductList").textContent = error.message;
    return;
  }

  currentProducts = data || [];

  if (!currentProducts.length) {
    $("adminProductList").innerHTML =
      '<p class="product-description">No products added yet.</p>';
    return;
  }

  $("adminProductList").innerHTML = currentProducts.map(product => `
    <article class="admin-product">
      <img
        src="${escapeHTML(product.image_url || "")}"
        alt="${escapeHTML(product.name)}"
      >

      <div class="admin-product-details">
        <strong>${escapeHTML(product.name)}</strong>
        <p>₹${Number(product.price).toLocaleString("en-IN")}</p>
        <p>${escapeHTML(product.category || "Wall Posters")}</p>
        <p>${product.is_active ? "Visible on website" : "Hidden from website"}</p>
        <p>${[
          product.image_url,
          product.image_url_2,
          product.image_url_3
        ].filter(Boolean).length} image(s)</p>
      </div>

      <div class="admin-product-actions">
        <button
          type="button"
          class="secondary-btn"
          data-edit="${escapeHTML(product.id)}"
        >EDIT</button>

        <button
          type="button"
          class="danger-btn"
          data-delete="${escapeHTML(product.id)}"
        >DELETE</button>
      </div>
    </article>
  `).join("");
}

function resetProductForm() {
  $("productForm").reset();
  $("productId").value = "";
  $("productActive").checked = true;
  $("productFormTitle").textContent = "ADD NEW PRODUCT";
  $("saveProductButton").textContent = "SAVE PRODUCT";
  $("cancelEditButton").hidden = true;
  showMessage("productMessage", "");
}

function editProduct(product) {
  $("productId").value = product.id;
  $("productName").value = product.name || "";
  $("productPrice").value = product.price || "";
  $("productCategory").value = product.category || "Wall Posters";
  $("productDescription").value = product.description || "";
  $("productActive").checked = product.is_active !== false;

  $("productImage1").value = "";
  $("productImage2").value = "";
  $("productImage3").value = "";

  $("productFormTitle").textContent = "EDIT PRODUCT";
  $("saveProductButton").textContent = "UPDATE PRODUCT";
  $("cancelEditButton").hidden = false;

  showMessage(
    "productMessage",
    "Choose new images only for the images you want to replace. Leave the others empty to keep existing images."
  );

  $("productForm").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

$("productForm").addEventListener("submit", async event => {
  event.preventDefault();

  const productId = $("productId").value;
  const oldProduct = currentProducts.find(
    product => String(product.id) === String(productId)
  );

  const name = $("productName").value.trim();
  const price = Number($("productPrice").value);

  if (!name || !Number.isFinite(price) || price < 0) {
    showMessage("productMessage", "Enter a valid product name and price.", true);
    return;
  }

  const files = [
    $("productImage1").files[0],
    $("productImage2").files[0],
    $("productImage3").files[0]
  ];

  if (!oldProduct && !files[0]) {
    showMessage("productMessage", "Please select the main product image.", true);
    return;
  }

  const saveButton = $("saveProductButton");
  saveButton.disabled = true;
  saveButton.textContent = "SAVING...";

  try {
    showMessage("productMessage", "Uploading images...");

    const imageUrls = [
      oldProduct?.image_url || null,
      oldProduct?.image_url_2 || null,
      oldProduct?.image_url_3 || null
    ];

    for (let i = 0; i < files.length; i++) {
      if (files[i]) {
        imageUrls[i] = await uploadProductImage(files[i]);
      }
    }

    const productData = {
      name,
      price,
      category: $("productCategory").value,
      description: $("productDescription").value.trim(),
      image_url: imageUrls[0],
      image_url_2: imageUrls[1],
      image_url_3: imageUrls[2],
      is_active: $("productActive").checked
    };

    showMessage("productMessage", "Saving product details...");

    let result;

    if (oldProduct) {
      result = await supabase
        .from("products")
        .update(productData)
        .eq("id", productId);
    } else {
      result = await supabase
        .from("products")
        .insert(productData);
    }

    if (result.error) throw result.error;

    showMessage("productMessage", "Product saved successfully!");

    resetProductForm();
    await loadAdminProducts();

  } catch (error) {
    console.error(error);
    showMessage("productMessage", error.message || "Something went wrong.", true);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = $("productId").value
      ? "UPDATE PRODUCT"
      : "SAVE PRODUCT";
  }
});

$("cancelEditButton").addEventListener("click", resetProductForm);

$("adminProductList").addEventListener("click", async event => {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");

  if (editButton) {
    const product = currentProducts.find(
      item => String(item.id) === editButton.dataset.edit
    );

    if (product) editProduct(product);
  }

  if (deleteButton) {
    const product = currentProducts.find(
      item => String(item.id) === deleteButton.dataset.delete
    );

    if (!product) return;

    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) {
      return;
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);

    if (error) {
      alert(error.message);
    } else {
      await loadAdminProducts();
      if ($("productId").value === String(product.id)) {
        resetProductForm();
      }
    }
  }
});

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  showMessage("loginMessage", "Checking login...");

  const email = $("email").value.trim();
  const password = $("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage("loginMessage", error.message, true);
    return;
  }

  const allowed = await isAdmin(data.user.id);

  if (!allowed) {
    await supabase.auth.signOut();
    showMessage("loginMessage", "This account is not authorised as an admin.", true);
    return;
  }

  showDashboard();
  await Promise.all([loadSettings(), loadAdminProducts()]);
});

$("logoutButton").addEventListener("click", async () => {
  await supabase.auth.signOut();
  showLogin();
  $("loginForm").reset();
  showMessage("loginMessage", "You have logged out.");
});

async function checkExistingSession() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;

  if (!user) {
    showLogin();
    return;
  }

  if (await isAdmin(user.id)) {
    showDashboard();
    await Promise.all([loadSettings(), loadAdminProducts()]);
  } else {
    await supabase.auth.signOut();
    showLogin();
    showMessage("loginMessage", "This account is not authorised as an admin.", true);
  }
}

checkExistingSession();
