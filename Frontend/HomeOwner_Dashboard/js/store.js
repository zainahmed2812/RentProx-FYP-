// ═══════════════════════════════════════════════════════
//  RentProx — Mock Data Store (replaces backend for now)
// ═══════════════════════════════════════════════════════

const Store = {
  stats: {
    totalProperties: 10,
    activeTenants: 12,
    pendingPayments: 3
  },

  tenants: [
    { id: 1, name: 'Memon',  unit: 'A-101', rent: 25000, status: 'paid'    },
    { id: 2, name: 'Moavia', unit: 'B-202', rent: 18000, status: 'pending' },
    { id: 3, name: 'Zain',   unit: 'C-303', rent: 22000, status: 'paid'    }
  ],

  properties: [
    { id: 1, name: 'Dha',    address: 'DHA Phase 5, Lahore',          units: 4, occupied: 4 },
    { id: 2, name: 'Bahria', address: 'Bahria Town, Rawalpindi',      units: 6, occupied: 5 }
  ],

  getTenants(query = '') {
    return this.tenants.filter(t =>
      t.name.toLowerCase().includes(query.toLowerCase())
    );
  },

  getTenant(id) {
    return this.tenants.find(t => t.id == id);
  },

  addProperty(data) {
    const newProp = { id: Date.now(), ...data };
    this.properties.push(newProp);
    this.stats.totalProperties++;
    return newProp;
  },

  updateProperty(id, data) {
    const idx = this.properties.findIndex(p => p.id == id);
    if (idx !== -1) this.properties[idx] = { ...this.properties[idx], ...data };
    return this.properties[idx];
  }
};

// ── Shared Helpers ─────────────────────────────────────
const UI = {
  openModal(id) {
    document.getElementById(id).classList.add('active');
  },
  closeModal(id) {
    document.getElementById(id).classList.remove('active');
  },
  avatarLetter(name) {
    return name ? name[0].toUpperCase() : '?';
  },
  formatRent(amount) {
    return 'PKR ' + Number(amount).toLocaleString();
  }
};