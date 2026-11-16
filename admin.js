
// ==========================================
// PRINTCORE - ADMIN PANEL
// ==========================================

const config = window.PRINTCORE_CONFIG;

if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
  alert("Supabase configuration is missing. Please check config.js.");
  throw new Error("Missing Supabase configuration.");
}

const supabase = window.supabase.createClient(
  config.SUPABASE_URL,
  config.SUPABASE_ANON_KEY
);

const STORAGE_BUCKET = "product-images";

// HTML elements
const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");

const loginForm = document.getElementById("loginForm");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
const loginMessage = document.getElementById("loginMessage");

const logoutBtn = document.getElementById("logoutBtn");

const productForm = document.getElementById("productForm");
const productId = document.getElementById("productId");
const productName = document.getElementById("productName");
const productCategory = document.getElementById("productCategory");
const productPrice = document.getElementById("productPrice");
const productOldPrice = document.getElementById("productOldPrice");
const productDescription = document.getElementById("productDescription");
const productSpecifications = document.getElementById("productSpecifications");
const productWhatsapp = document.getElementById("productWhatsapp");

const saveProductBtn = document.getElementById("saveProductBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const formTitle = document.getElementById("formTitle");
const productMessage = document.getElementById("productMessage");

const adminProductList = document.getElementById("adminProductList");
const refreshProductsBtn = document.getElementById("refreshProductsBtn");

const imageInputs = [
  document.getElementById("image1"),
  document.getElementById("image2"),
  document.getElementById("image3"),
  document.getElementById("image4")
];

let currentProducts = [];
let currentUser = null;


// ==========================================
// MESSAGE HELPER
// ==========================================

function showMessage(element, message, isError = false) {
  element.textContent = message;
  element.style.color = isError ? "#c00000" : "#16803c";
}


// ==========================================
// CHECK WHETHER USER IS AN ADMIN
// ==========================================

async function isAdmin(userId) {
  const { data, error } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Admin check failed:", error);
    return false;
  }

  return !!data;
}


// ==========================================
// SHOW / HIDE ADMIN DASHBOARD
// ==========================================

async function checkLogin() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    showLogin();
    return;
  }

  const user = data.session.user;
  const allowed = await isAdmin(user.id);

  if (!allowed) {
    await supabase.auth.signOut();
    showLogin();
    showMessage(
      loginMessage,
      "This account is not registered as an admin.",
      true
    );
    return;
  }

  currentUser = user;
  showDashboard();
}

function showLogin() {
  loginSection.hidden = false;
  dashboardSection.hidden = true;
}

function showDashboard() {
  loginSection.hidden = true;
  dashboardSection.hidden = false;
  loadProducts();
}


// ==========================================
// ADMIN LOGIN
// ==========================================

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = adminEmail.value.trim();
  const password = adminPassword.value;

  showMessage(loginMessage, "Logging in...");

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showMessage(loginMessage, error.message, true);
    return;
  }

  const allowed = await isAdmin(data.user.id);

  if (!allowed) {
    await supabase.auth.signOut();

    showMessage(
      loginMessage,
      "Login successful, but this account is not an admin. Add its user ID to the admins table.",
      true
    );
    return;
  }

  currentUser = data.user;
  loginForm.reset();
  showDashboard();
});


// ==========================================
// ADMIN LOGOUT
// ==========================================

logoutBtn.addEventListener("click", async function () {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert("Logout failed: " + error.message);
    return;
  }

  currentUser = null;
  productForm.reset();
  showLogin();
});


// ==========================================
// UPLOAD PRODUCT IMAGE
// ==========================================

async function uploadImage(file, productIdValue, imageNumber) {
  const extension = file.name.includes(".")
    ? file.name.split(".").pop().toLowerCase()
    : "jpg";

  const filePath =
    productIdValue +
    "/" +
    Date.now() +
    "-" +
    imageNumber +
    "." +
    extension;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return data.publicUrl;
}


// ==========================================
// ADD / UPDATE PRODUCT
// ==========================================

productForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  saveProductBtn.disabled = true;
  saveProductBtn.textContent = "Saving...";
  showMessage(productMessage, "Please wait...");

  try {
    const editingId = productId.value.trim();

    const productData = {
      name: productName.value.trim(),
      category: productCategory.value,
      price: Number(productPrice.value),
      old_price: productOldPrice.value
        ? Number(productOldPrice.value)
        : null,
      description: productDescription.value.trim(),
      specifications: productSpecifications.value.trim(),
      whatsapp: productWhatsapp.value.trim() || null
    };

    if (!productData.name || !productData.category) {
      throw new Error("Please enter the product name and category.");
    }

    // Get existing images when editing
    let imageUrls = [];

    if (editingId) {
      const existingProduct = currentProducts.find(
        product => product.id === editingId
      );

      imageUrls = existingProduct?.image_urls || [];
      imageUrls = [...imageUrls];
    }

    // Create a new product ID when adding a product
    const newProductId = editingId || crypto.randomUUID();

    // Upload selected images and keep unchanged existing images
    for (let i = 0; i < imageInputs.length; i++) {
      const file = imageInputs[i].files[0];

      if (file) {
        if (!file.type.startsWith("image/")) {
          throw new Error("Please select valid image files.");
        }

        const imageUrl = await uploadImage(
          file,
          newProductId,
          i + 1
        );

        imageUrls[i] = imageUrl;
      }
    }

    // Remove empty image positions
    imageUrls = imageUrls.filter(Boolean);

    if (imageUrls.length === 0) {
      throw new Error("Please upload at least one product image.");
    }

    productData.image_urls = imageUrls;

    if (editingId) {
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingId);

      if (error) throw error;

      showMessage(productMessage, "Product updated successfully!");
    } else {
      const { error } = await supabase
        .from("products")
        .insert({
          id: newProductId,
          ...productData
        });

      if (error) throw error;

      showMessage(productMessage, "Product added successfully!");
    }

    resetProductForm();
    await loadProducts();

  } catch (error) {
    console.error(error);
    showMessage(
      productMessage,
      error.message || "Something went wrong.",
      true
    );
  } finally {
    saveProductBtn.disabled = false;
    saveProductBtn.textContent = productId.value
      ? "Update Product"
      : "Add Product";
  }
});


// ==========================================
// LOAD ALL PRODUCTS
// ==========================================

async function loadProducts() {
  adminProductList.innerHTML = "<p>Loading products...</p>";

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    adminProductList.textContent =
      "Could not load products: " + error.message;
    return;
  }

  currentProducts = data || [];

  if (currentProducts.length === 0) {
    adminProductList.innerHTML = "<p>No products added yet.</p>";
    return;
  }

  adminProductList.innerHTML = "";

  currentProducts.forEach(product => {
    const item = document.createElement("div");
    item.className = "admin-product-item";

    const image = document.createElement("img");
    image.src = product.image_urls?.[0] || "";
    image.alt = product.name;
    image.onerror = function () {
      this.style.display = "none";
    };

    const info = document.createElement("div");
    info.className = "admin-product-info";

    const name = document.createElement("h3");
    name.textContent = product.name;

    const category = document.createElement("p");
    category.textContent = product.category;

    const price = document.createElement("p");
    price.textContent = "₹" + product.price;

    info.append(name, category, price);

    const editButton = document.createElement("button");
    editButton.className = "edit-btn";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => editProduct(product.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteProduct(product.id));

    item.append(image, info, editButton, deleteButton);
    adminProductList.appendChild(item);
  });
}


// ==========================================
// EDIT PRODUCT
// ==========================================

function editProduct(id) {
  const product = currentProducts.find(item => item.id === id);

  if (!product) return;

  productId.value = product.id;
  productName.value = product.name || "";
  productCategory.value = product.category || "";
  productPrice.value = product.price ?? "";
  productOldPrice.value = product.old_price ?? "";
  productDescription.value = product.description || "";
  productSpecifications.value = product.specifications || "";
  productWhatsapp.value = product.whatsapp || "";

  imageInputs.forEach(input => {
    input.value = "";
  });

  formTitle.textContent = "Edit Product";
  saveProductBtn.textContent = "Update Product";
  cancelEditBtn.hidden = false;

  showMessage(
    productMessage,
    "Editing product. Leave image fields empty to keep the existing images."
  );

  productForm.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


// ==========================================
// DELETE PRODUCT
// ==========================================

async function deleteProduct(id) {
  const product = currentProducts.find(item => item.id === id);

  if (!product) return;

  const confirmed = confirm(
    'Are you sure you want to delete "' + product.name + '"?'
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Could not delete product: " + error.message);
    return;
  }

  alert("Product deleted successfully!");
  await loadProducts();
}


// ==========================================
// RESET PRODUCT FORM
// ==========================================

function resetProductForm() {
  productForm.reset();
  productId.value = "";

  formTitle.textContent = "Add New Product";
  saveProductBtn.textContent = "Add Product";
  cancelEditBtn.hidden = true;
}

cancelEditBtn.addEventListener("click", function () {
  resetProductForm();
  showMessage(productMessage, "");
});


// ==========================================
// REFRESH PRODUCT LIST
// ==========================================

refreshProductsBtn.addEventListener("click", loadProducts);


// ==========================================
// START ADMIN PANEL
// ==========================================

checkLogin();
