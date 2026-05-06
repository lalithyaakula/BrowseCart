import { useEffect, useMemo, useState } from "react";

const apiBase = process.env.REACT_APP_API_URL || "http://localhost:5000";
const RADIUS_KM_DEFAULT = 2;
const RADIUS_PRESETS_KM = [1, 2, 3, 5];
const categoryList = ["All", "Food", "Medicines", "Kirana"];

// Simple hardcoded demo data as a fallback when API returns nothing.
const HARD_CODED_STORES = [
  {
    id: "demo-1",
    name: "Green Basket",
    category: "Kirana",
    distance: 0.8,
    open: true,
    rating: 4.3,
    products: [
      { name: "Rice", quantity: 2, inStock: true },
      { name: "Flour", quantity: 5, inStock: true },
      { name: "Cooking Oil", quantity: 3, inStock: true },
      { name: "Sugar", quantity: 4, inStock: true },
    ],
  },
  {
    id: "demo-2",
    name: "MediCare Plus",
    category: "Medicines",
    distance: 1.1,
    open: true,
    rating: 4.5,
    products: [
      { name: "Paracetamol", quantity: 20, inStock: true },
      { name: "Cough Syrup", quantity: 10, inStock: true },
      { name: "Bandages", quantity: 15, inStock: true },
    ],
  },
  {
    id: "demo-3",
    name: "Taste Point",
    category: "Food",
    distance: 1.6,
    open: true,
    rating: 4.1,
    products: [
      { name: "Burger", quantity: 8, inStock: true },
      { name: "Pizza", quantity: 5, inStock: true },
      { name: "Juice", quantity: 12, inStock: true },
    ],
  },
];

const S = {
  app: {
    minHeight: "100vh",
    background: "linear-gradient(150deg, #0b1220 0%, #121f3b 45%, #0f172a 100%)",
    color: "#e2e8f0",
    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
  },
  shell: { maxWidth: "1180px", margin: "0 auto", padding: "22px" },
  panel: {
    background: "rgba(15, 23, 42, 0.72)",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    backdropFilter: "blur(10px)",
    borderRadius: "16px",
    boxShadow: "0 18px 50px rgba(2, 6, 23, 0.4)",
    padding: "18px",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: "10px",
    border: "1px solid rgba(148,163,184,0.35)",
    padding: "10px 12px",
    fontSize: "0.95rem",
    color: "#e2e8f0",
    background: "rgba(15,23,42,0.5)",
  },
  b1: {
    background: "linear-gradient(135deg, #22d3ee, #3b82f6)",
    color: "#07101f",
    border: "none",
    borderRadius: "10px",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  b2: {
    background: "rgba(15,23,42,0.6)",
    color: "#e2e8f0",
    border: "1px solid rgba(148,163,184,0.35)",
    borderRadius: "10px",
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  chip: {
    display: "inline-block",
    fontSize: "0.75rem",
    borderRadius: "999px",
    padding: "4px 10px",
    border: "1px solid rgba(148,163,184,0.35)",
    color: "#cbd5e1",
    background: "rgba(15,23,42,0.45)",
  },
};

export default function App() {
  const [role, setRole] = useState(null);
  const [userName, setUserName] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [authError, setAuthError] = useState("");
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [radiusKm, setRadiusKm] = useState(RADIUS_KM_DEFAULT);
  const [location, setLocation] = useState("");
  const [locationSet, setLocationSet] = useState(false);
  const [coords, setCoords] = useState({ lat: "", lng: "" });
  const [geoEnabled, setGeoEnabled] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState("nearest");
  const [openOnly, setOpenOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selected, setSelected] = useState(null);
  const [productDrafts, setProductDrafts] = useState({});
  const [qtyDrafts, setQtyDrafts] = useState({});
  const [stockDrafts, setStockDrafts] = useState({});
  const [savingStoreId, setSavingStoreId] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminToken, setAdminToken] = useState("");

  const fetchNearbyStores = async (nextCategory, nextSearch, lat, lng) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        radius: String(radiusKm),
        category: nextCategory,
        q: nextSearch,
      });
      const latNum = Number(lat);
      const lngNum = Number(lng);
      if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
        params.append("lat", String(latNum));
        params.append("lng", String(lngNum));
      }
      const res = await fetch(`${apiBase}/stores/nearby?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to fetch stores");

      let list = Array.isArray(data.stores) ? data.stores : [];

      // If API returned nothing, fall back to hardcoded demo data.
      if (!list.length) {
        const normSearch = nextSearch.toLowerCase().trim();
        list = HARD_CODED_STORES.filter((s) => {
          if (nextCategory !== "All" && s.category !== nextCategory) return false;
          if (!normSearch) return s.distance <= radiusKm;
          const inName = s.name.toLowerCase().includes(normSearch);
          const inProducts = (s.products || []).some((p) =>
            p.name.toLowerCase().includes(normSearch)
          );
          return (inName || inProducts) && s.distance <= radiusKm;
        });
      }

      setShops(list);
    } catch (err) {
      // On error, still show hardcoded demo stores so the UI is never empty.
      const normSearch = nextSearch.toLowerCase().trim();
      const demo = HARD_CODED_STORES.filter((s) => {
        if (nextCategory !== "All" && s.category !== nextCategory) return false;
        if (!normSearch) return s.distance <= radiusKm;
        const inName = s.name.toLowerCase().includes(normSearch);
        const inProducts = (s.products || []).some((p) =>
          p.name.toLowerCase().includes(normSearch)
        );
        return (inName || inProducts) && s.distance <= radiusKm;
      });
      setShops(demo);
      if (demo.length === 0) {
        setError(err.message || "Failed to fetch stores");
      } else {
        setError("");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStores = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/stores`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unable to fetch stores");
      setShops(Array.isArray(data.stores) ? data.stores : []);
    } catch (err) {
      setError(err.message || "Failed to fetch stores");
      setShops([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === "admin" && adminToken) fetchAllStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, adminToken]);

  useEffect(() => {
    if (role !== "user" || !locationSet) return;
    if (!coords.lat || !coords.lng) {
      // Allow the user to see something even without GPS.
      // We'll still load stores (API may return empty, but fetchNearbyStores has a hardcoded fallback).
      setError("GPS not enabled, showing demo nearby stores.");
      fetchNearbyStores(category, search, null, null);
      return;
    }
    fetchNearbyStores(category, search, coords.lat, coords.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, locationSet, category, search, coords.lat, coords.lng, radiusKm]);

  const logout = () => {
    setRole(null);
    setUserName("");
    setAdminUser("");
    setAdminPass("");
    setAdminToken("");
    setAuthError("");
    setError("");
    setLocation("");
    setLocationSet(false);
    setCoords({ lat: "", lng: "" });
    setShops([]);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return setError("Geolocation is not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocation("Current Location");
        setGeoEnabled(true);
        setError("");
        setLocationSet(true);
      },
      () => {
        setGeoEnabled(false);
        setError("Unable to get your location");
      }
    );
  };

  const bootstrapDemoStores = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/stores/bootstrap-demo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not add demo stores");
      await fetchNearbyStores(category, search, coords.lat, coords.lng);
    } catch (err) {
      setError(err.message || "Failed to add demo stores");
    } finally {
      setLoading(false);
    }
  };

  const addProduct = async (store) => {
    const newProduct = (productDrafts[store.id] || "").trim();
    if (!newProduct) return;
    const products = [...(store.products || [])];
    if (products.some((p) => p.name === newProduct)) return;
    const quantity = Number(qtyDrafts[store.id] || 1);
    products.push({
      name: newProduct,
      quantity: Number.isFinite(quantity) ? Math.max(0, quantity) : 1,
      inStock: stockDrafts[store.id] !== false,
    });
    setSavingStoreId(store.id);
    try {
      const res = await fetch(`${apiBase}/stores/${store.id}/products`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ products }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add product");
      setProductDrafts((prev) => ({ ...prev, [store.id]: "" }));
      setQtyDrafts((prev) => ({ ...prev, [store.id]: 1 }));
      setStockDrafts((prev) => ({ ...prev, [store.id]: true }));
      fetchAllStores();
    } catch (err) {
      setError(err.message || "Could not add product");
    } finally {
      setSavingStoreId("");
    }
  };

  const deleteProduct = async (store, productToDelete) => {
    setSavingStoreId(store.id);
    try {
      const products = (store.products || []).filter((p) => p.name !== productToDelete.name);
      const res = await fetch(`${apiBase}/stores/${store.id}/products`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ products }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete product");
      fetchAllStores();
    } catch (err) {
      setError(err.message || "Could not delete product");
    } finally {
      setSavingStoreId("");
    }
  };

  const searchTerm = search.trim().toLowerCase();

  const visibleShops = useMemo(() => {
    let list = Array.isArray(shops) ? [...shops] : [];

    if (openOnly) list = list.filter((s) => s.open);

    if (inStockOnly) {
      list = list.filter((s) =>
        (s.products || []).some((p) => p.inStock && Number(p.quantity) > 0)
      );
    }

    const inStockCount = (s) => (s.products || []).filter((p) => p.inStock && Number(p.quantity) > 0).length;

    if (sortBy === "rating") {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (a.distance || 999) - (b.distance || 999));
    } else if (sortBy === "inStockFirst") {
      list.sort((a, b) => inStockCount(b) - inStockCount(a) || (a.distance || 999) - (b.distance || 999));
    } else {
      // nearest
      list.sort((a, b) => (a.distance || 999) - (b.distance || 999) || (b.rating || 0) - (a.rating || 0));
    }

    return list;
  }, [shops, openOnly, inStockOnly, sortBy]);

  const nearestByDistance = useMemo(
    () => (!visibleShops.length ? null : [...visibleShops].sort((a, b) => (a.distance || 999) - (b.distance || 999))[0]),
    [visibleShops]
  );
  const filteredAdminStores = useMemo(() => shops.filter((s) => s.name.toLowerCase().includes(adminSearch.toLowerCase().trim())), [shops, adminSearch]);

  const modalProducts = useMemo(() => {
    const list = (selected?.products || []).slice();
    if (!searchTerm) return list;
    return list.filter((p) => (p.name || "").toLowerCase().includes(searchTerm));
  }, [selected, searchTerm]);

  if (!role) {
    return (
      <div style={{ ...S.app, display: "grid", placeItems: "center", padding: "22px" }}>
        <div style={{ width: "min(1040px,100%)" }}>
          <h1 style={{ textAlign: "center", margin: 0 }}>BrowseCart</h1>
          <p style={{ textAlign: "center", color: "#94a3b8" }}>Choose your access mode</p>
          <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
            <div style={S.panel}>
              <h3 style={{ marginTop: 0 }}>User Portal</h3>
              <p style={{ color: "#94a3b8" }}>Browse nearby products and stores.</p>
              <input style={S.input} placeholder="Your name" value={userName} onChange={(e) => setUserName(e.target.value)} />
              <button style={{ ...S.b1, marginTop: "12px" }} onClick={() => (userName.trim() ? (setRole("user"), setAuthError("")) : setAuthError("Please enter your name"))}>Continue</button>
            </div>
            <div style={S.panel}>
              <h3 style={{ marginTop: 0 }}>Admin Portal</h3>
              <p style={{ color: "#94a3b8" }}>Update inventory and products.</p>
              <input style={{ ...S.input, marginBottom: "10px" }} placeholder="Username" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} />
              <input style={S.input} placeholder="Password" type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} />
              <p style={{ color: "#94a3b8", fontSize: "0.82rem" }}>Demo: admin / admin123</p>
              <button
                style={S.b1}
                onClick={async () => {
                  setAuthError("");
                  try {
                    const res = await fetch(`${apiBase}/auth/admin/login`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ username: adminUser, password: adminPass }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || "Invalid admin credentials");
                    setAdminToken(data.token);
                    setRole("admin");
                  } catch (err) {
                    setAuthError(err.message || "Invalid admin credentials");
                  }
                }}
              >
                Login
              </button>
            </div>
          </div>
          {!!authError && <p style={{ color: "#f87171", textAlign: "center" }}>{authError}</p>}
        </div>
      </div>
    );
  }

  if (role === "user" && !locationSet) {
    return (
      <div style={{ ...S.app, display: "grid", placeItems: "center", padding: "22px" }}>
        <div style={{ ...S.panel, width: "min(540px,100%)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ marginTop: 0 }}>Welcome, {userName}</h2>
            <button style={S.b2} onClick={logout}>Logout</button>
          </div>
          <p style={{ color: "#94a3b8" }}>
            Geolocation filter is enabled only with live location. Use your current location
              to get stores within {radiusKm} km.
          </p>
            <div style={{ marginBottom: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {RADIUS_PRESETS_KM.map((km) => (
                <button
                  key={km}
                  style={km === radiusKm ? S.b1 : S.b2}
                  onClick={() => setRadiusKm(km)}
                >
                  {km} km
                </button>
              ))}
            </div>
          <input style={{ ...S.input, marginBottom: "10px" }} placeholder="Enter city or area" value={location} onChange={(e) => setLocation(e.target.value)} />
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              style={S.b2}
              onClick={() => {
                setLocationSet(true);
                setGeoEnabled(false);
              }}
            >
              Continue without GPS
            </button>
            <button style={S.b2} onClick={handleUseMyLocation}>Use my location</button>
          </div>
          {!!error && <p style={{ color: "#f87171" }}>{error}</p>}
        </div>
      </div>
    );
  }

  if (role === "user") {
    return (
      <div style={S.app}>
        <div style={{ borderBottom: "1px solid rgba(148,163,184,0.25)", background: "rgba(2,6,23,0.45)" }}>
          <div style={{ ...S.shell, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h2 style={{ margin: 0 }}>Welcome, {userName}</h2>
              <p style={{ margin: "4px 0 0", color: "#94a3b8" }}>
                Location: {location} | {geoEnabled ? "GPS filter ON" : "GPS filter OFF"}
              </p>
            </div>
            <button style={S.b2} onClick={logout}>Logout</button>
          </div>
        </div>
        <div style={S.shell}>
          <div style={{ ...S.panel, marginBottom: "14px" }}>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input style={{ ...S.input, maxWidth: "340px" }} placeholder="Search product or store" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button style={S.b2} onClick={handleUseMyLocation}>Refresh GPS</button>
              {categoryList.map((cat) => <button key={cat} style={cat === category ? S.b1 : S.b2} onClick={() => setCategory(cat)}>{cat}</button>)}
            </div>
            <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={S.chip}>Radius:</span>
              {RADIUS_PRESETS_KM.map((km) => (
                <button key={km} style={km === radiusKm ? S.b1 : S.b2} onClick={() => setRadiusKm(km)}>
                  {km}km
                </button>
              ))}

              <span style={S.chip}>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  borderRadius: "10px",
                  border: "1px solid rgba(148,163,184,0.35)",
                  padding: "10px 12px",
                  background: "rgba(15,23,42,0.5)",
                  color: "#e2e8f0",
                  fontWeight: 600,
                }}
              >
                <option value="nearest">Nearest</option>
                <option value="rating">Top Rated</option>
                <option value="inStockFirst">In-stock First</option>
              </select>

              <button style={openOnly ? S.b1 : S.b2} onClick={() => setOpenOnly((v) => !v)}>
                Open only
              </button>
              <button style={inStockOnly ? S.b1 : S.b2} onClick={() => setInStockOnly((v) => !v)}>
                In-stock items
              </button>
            </div>
            <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span style={S.chip}>{loading ? "Loading..." : `${visibleShops.length} stores found`}</span>
              {nearestByDistance && (
                <span style={S.chip}>
                  {searchTerm ? `Nearest for "${searchTerm}": ` : "Nearest: "}
                  {nearestByDistance.name} | {nearestByDistance.distance} km
                </span>
              )}
            </div>
          </div>
          {!!error && <p style={{ color: "#f87171" }}>{error}</p>}
          {!loading && visibleShops.length === 0 && (
            <div style={{ ...S.panel, marginBottom: "12px" }}>
              <p>No stores found for current filters.</p>
              <button style={S.b1} onClick={bootstrapDemoStores}>Add Demo Stores</button>
            </div>
          )}
          <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
            {visibleShops.map((shop) => {
              const isNearest = nearestByDistance && shop.id === nearestByDistance.id;
              return (
              <div
                key={shop.id}
                style={{
                  ...S.panel,
                  border: isNearest ? "1px solid rgba(34,211,238,0.7)" : S.panel.border,
                  boxShadow: isNearest ? "0 18px 60px rgba(34,211,238,0.25)" : S.panel.boxShadow,
                }}
                onClick={() => setSelected(shop)}
              >
                <h4 style={{ margin: "0 0 6px" }}>{shop.name}</h4>
                <p style={{ margin: 0, color: "#94a3b8" }}>{shop.category} | {shop.distance} km</p>
                <p style={{ margin: "8px 0 0", color: shop.open ? "#34d399" : "#f87171", fontWeight: 700 }}>{shop.open ? "Open" : "Closed"}</p>
                {isNearest && <div style={{ ...S.chip, marginBottom: "8px", borderColor: "rgba(34,211,238,0.7)" }}>Nearest</div>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                  {(shop.products || [])
                    .filter((p) => !searchTerm || p.name.toLowerCase().includes(searchTerm))
                    .slice(0, 6)
                    .map((p) => (
                    <span key={p.name} style={S.chip}>
                      {p.name} ({p.quantity}) {p.inStock ? "" : "- out"}
                    </span>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
        </div>
        {selected && (
          <div
            onClick={() => setSelected(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.6)", display: "grid", placeItems: "center", padding: "20px" }}
          >
            <div style={{ ...S.panel, width: "min(520px,100%)" }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>{selected.name}</h3>
              <p>{selected.category} | {selected.distance} km</p>
              <ul>
                {modalProducts.length ? (
                  modalProducts.map((p) => (
                    <li key={p.name}>
                      {p.name} - Qty: {p.quantity} - {p.inStock ? "In stock" : "Out of stock"}
                    </li>
                  ))
                ) : (
                  <li>No matching products for your search.</li>
                )}
              </ul>
              <button style={S.b1} onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={S.app}>
      <div style={{ borderBottom: "1px solid rgba(148,163,184,0.25)", background: "rgba(2,6,23,0.45)" }}>
        <div style={{ ...S.shell, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div><h2 style={{ margin: 0 }}>Admin Dashboard</h2><p style={{ margin: "4px 0 0", color: "#94a3b8" }}>Inventory management center</p></div>
          <div style={{ display: "flex", gap: "8px" }}><button style={S.b2} onClick={fetchAllStores}>Refresh</button><button style={S.b2} onClick={logout}>Logout</button></div>
        </div>
      </div>
      <div style={S.shell}>
        <div style={{ ...S.panel, marginBottom: "14px", display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", alignItems: "end" }}>
          <div><div style={{ color: "#94a3b8", fontSize: "0.82rem" }}>Total Stores</div><div style={{ fontWeight: 800, fontSize: "1.3rem" }}>{shops.length}</div></div>
          <div><div style={{ color: "#94a3b8", fontSize: "0.82rem" }}>Open Stores</div><div style={{ fontWeight: 800, fontSize: "1.3rem" }}>{shops.filter((s) => s.open).length}</div></div>
          <div><div style={{ color: "#94a3b8", fontSize: "0.82rem", marginBottom: "4px" }}>Search</div><input style={S.input} placeholder="Filter by store name" value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} /></div>
        </div>
        <p style={{ color: "#94a3b8" }}>{loading ? "Loading stores..." : `${filteredAdminStores.length} stores visible`}</p>
        {!!error && <p style={{ color: "#f87171" }}>{error}</p>}
        <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))" }}>
          {filteredAdminStores.map((store) => (
            <div key={store.id} style={S.panel}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                <h3 style={{ margin: 0 }}>{store.name}</h3><span style={S.chip}>{store.category}</span>
              </div>
              <p style={{ margin: "6px 0 10px", color: "#94a3b8" }}>{store.source || "manual"} | {store.distance} km | {store.open ? "Open" : "Closed"}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                {(store.products || []).length === 0 ? <span style={{ color: "#94a3b8" }}>No products yet</span> : (store.products || []).map((product) => <span key={product.name} style={{ ...S.chip, display: "inline-flex", alignItems: "center", gap: "6px" }}>{product.name} ({product.quantity}) {product.inStock ? "" : "- out"}<button onClick={() => deleteProduct(store, product)} style={{ border: "none", background: "transparent", color: "#f87171", cursor: "pointer", fontWeight: 700, padding: 0 }} disabled={savingStoreId === store.id}>x</button></span>)}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input style={S.input} placeholder="Add product" value={productDrafts[store.id] || ""} onChange={(e) => setProductDrafts((prev) => ({ ...prev, [store.id]: e.target.value }))} />
                <input style={{ ...S.input, maxWidth: "90px" }} type="number" min="0" placeholder="Qty" value={qtyDrafts[store.id] ?? 1} onChange={(e) => setQtyDrafts((prev) => ({ ...prev, [store.id]: e.target.value }))} />
                <button style={S.b2} onClick={() => setStockDrafts((prev) => ({ ...prev, [store.id]: !(prev[store.id] ?? true) }))}>
                  {(stockDrafts[store.id] ?? true) ? "In" : "Out"}
                </button>
                <button style={S.b1} onClick={() => addProduct(store)} disabled={savingStoreId === store.id}>{savingStoreId === store.id ? "..." : "Add"}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
