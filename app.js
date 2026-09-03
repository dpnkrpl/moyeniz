// State and Constants
const DEFAULT_GOOGLE_CLIENT_ID = '461450879911-5c3efm2cm8hkk04dgihamf8osds5k9mn.apps.googleusercontent.com';
let googleTokenClient = null;
let googleAccessToken = null;
let googleUserEmail = localStorage.getItem('moyeniz_gdrive_email') || '';
let googleTokenExpiresAt = 0;
let pendingGDriveAction = null;
let autoSyncIntervalId = null;
let autoSyncDebounceTimer = null;
let isSyncingToGDrive = false;
let lastSyncedTimestamp = parseInt(localStorage.getItem('moyeniz_last_synced_at') || '0', 10);
let autoSyncMinutes = parseInt(localStorage.getItem('moyeniz_auto_sync_interval') !== null ? localStorage.getItem('moyeniz_auto_sync_interval') : '15', 10);
let relativeTimeIntervalId = null;

function getGoogleClientId() {
  const custom = localStorage.getItem('moyeniz_custom_client_id');
  if (custom && custom.trim().length > 0) {
    return custom.trim();
  }
  return DEFAULT_GOOGLE_CLIENT_ID;
}

let investments = [];
let liabilities = [];
let borrowLent = [];
let salaries = [];
let expenses = [];
let expenseCategories = [];
let globalBudget = 40000;
let monthlyBudgets = {};
let activeBreakdownClass = '';

function getBudgetForMonth(monthStr) {
  if (monthlyBudgets && monthlyBudgets[monthStr] !== undefined) {
    return monthlyBudgets[monthStr];
  }
  return globalBudget;
}
let searchQueryLiabilities = '';
let searchQueryBorrowLent = '';
let searchQuerySalaries = '';
let searchQueryExpenses = '';
let selectedExpenseMonth = '';
let currentBLFilter = 'all';
let currentCalcExpression = '';

const LIABILITY_TYPES = {
  'home-loan': 'Home Loan',
  'car-loan': 'Car Loan',
  'personal-loan': 'Personal Loan',
  'education-loan': 'Education Loan',
  'other-loan': 'Other Loan / EMI'
};

const SAMPLE_LIABILITIES = [
  { id: 'loan-home', type: 'home-loan', name: 'SBI MaxGain Home Loan', outstanding: 3450000, emi: 31200, rate: 8.45, totalTenure: 240, tenure: 180, lastPaidDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), lastUpdated: new Date().toISOString() },
  { id: 'loan-car', type: 'car-loan', name: 'HDFC Car Loan', outstanding: 540000, emi: 11800, rate: 9.15, totalTenure: 60, tenure: 48, lastPaidDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), lastUpdated: new Date().toISOString() }
];

const SAMPLE_BORROW_LENT = [
  { id: 'bl-1', type: 'lent', person: 'Amit Sharma', amount: 15000, outstanding: 9000, date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], notes: 'Business advance helper', status: 'active', payments: [{ date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], amount: 6000, note: 'First part payment' }] },
  { id: 'bl-2', type: 'borrowed', person: 'Rohan Gupta', amount: 20000, outstanding: 20000, date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], notes: 'Laptop purchase advance', status: 'active', payments: [] },
  { id: 'bl-3', type: 'lent', person: 'Vikram Singh', amount: 5000, outstanding: 0, date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], notes: 'Emergency medical cash', status: 'paid', payments: [{ date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], amount: 5000, note: 'Settled full outstanding' }] }
];

const SAMPLE_SALARIES = [
  { id: 'sal-1', month: '2025-06', inhand: 85000, deduction: 15000, notes: 'Joining salary' },
  { id: 'sal-2', month: '2025-07', inhand: 85000, deduction: 15000, notes: '' },
  { id: 'sal-3', month: '2025-08', inhand: 85000, deduction: 15000, notes: '' },
  { id: 'sal-4', month: '2025-09', inhand: 85000, deduction: 15000, notes: '' },
  { id: 'sal-5', month: '2025-10', inhand: 92000, deduction: 16200, notes: 'Increment & PF hike' },
  { id: 'sal-6', month: '2025-11', inhand: 92000, deduction: 16200, notes: '' },
  { id: 'sal-7', month: '2025-12', inhand: 105000, deduction: 18000, notes: 'Year-end performance bonus' },
  { id: 'sal-8', month: '2026-01', inhand: 92000, deduction: 16200, notes: '' },
  { id: 'sal-9', month: '2026-02', inhand: 92000, deduction: 16200, notes: '' },
  { id: 'sal-10', month: '2026-03', inhand: 92000, deduction: 16200, notes: '' },
  { id: 'sal-11', month: '2026-04', inhand: 98000, deduction: 17500, notes: 'FY appraisal' },
  { id: 'sal-12', month: '2026-05', inhand: 98000, deduction: 17500, notes: '' }
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'cat-food', name: 'Food & Dining', icon: '🍔', isDefault: true },
  { id: 'cat-shopping', name: 'Shopping', icon: '🛍️', isDefault: true },
  { id: 'cat-groceries', name: 'Groceries', icon: '🛒', isDefault: true },
  { id: 'cat-rent', name: 'Rent & Living', icon: '🏠', isDefault: true },
  { id: 'cat-utilities', name: 'Utilities & Bills', icon: '⚡', isDefault: true },
  { id: 'cat-transport', name: 'Transport & Fuel', icon: '🚗', isDefault: true },
  { id: 'cat-entertainment', name: 'Entertainment', icon: '🎬', isDefault: true },
  { id: 'cat-medical', name: 'Medical & Health', icon: '🏥', isDefault: true },
  { id: 'cat-insurance', name: 'Insurance & Taxes', icon: '🛡️', isDefault: true },
  { id: 'cat-education', name: 'Education', icon: '📚', isDefault: true },
  { id: 'cat-travel', name: 'Travel', icon: '✈️', isDefault: true },
  { id: 'cat-others', name: 'Others', icon: '🌀', isDefault: true }
];

const SAMPLE_EXPENSES = [
  { id: 'exp-1', description: 'Weekly groceries store bill', amount: 3200, date: '2026-06-02', categoryId: 'cat-groceries' },
  { id: 'exp-2', description: 'Dinner with family', amount: 1850, date: '2026-06-05', categoryId: 'cat-food' },
  { id: 'exp-3', description: 'Petrol refill', amount: 2000, date: '2026-06-08', categoryId: 'cat-transport' },
  { id: 'exp-4', description: 'Flat House Rent', amount: 15000, date: '2026-06-01', categoryId: 'cat-rent' },
  { id: 'exp-5', description: 'Electricity Bill', amount: 2450, date: '2026-06-10', categoryId: 'cat-utilities' },
  { id: 'exp-6', description: 'Netflix movie subscription', amount: 499, date: '2026-06-12', categoryId: 'cat-entertainment' },
  { id: 'exp-7', description: 'Bought new shoes', amount: 3500, date: '2026-06-14', categoryId: 'cat-shopping' },
  { id: 'exp-8', description: 'Annual Health checkup', amount: 1200, date: '2026-06-15', categoryId: 'cat-medical' },
  { id: 'exp-9', description: 'Mid-month vegetables and fruits', amount: 1500, date: '2026-06-16', categoryId: 'cat-groceries' },
  { id: 'exp-10', description: 'Books and stationery', amount: 850, date: '2026-06-17', categoryId: 'cat-education' },

  // May 2026
  { id: 'exp-101', description: 'Flat House Rent', amount: 15000, date: '2026-05-01', categoryId: 'cat-rent' },
  { id: 'exp-102', description: 'Groceries store bill', amount: 4100, date: '2026-05-03', categoryId: 'cat-groceries' },
  { id: 'exp-103', description: 'Restaurant lunch', amount: 1200, date: '2026-05-08', categoryId: 'cat-food' },
  { id: 'exp-104', description: 'Petrol refill', amount: 2000, date: '2026-05-12', categoryId: 'cat-transport' },
  { id: 'exp-105', description: 'Shopping clothes', amount: 5000, date: '2026-05-18', categoryId: 'cat-shopping' },
  { id: 'exp-106', description: 'Electricity Bill', amount: 2800, date: '2026-05-10', categoryId: 'cat-utilities' },
  { id: 'exp-107', description: 'Online course certification', amount: 3000, date: '2026-05-15', categoryId: 'cat-education' },

  // April 2026
  { id: 'exp-201', description: 'Flat House Rent', amount: 15000, date: '2026-04-01', categoryId: 'cat-rent' },
  { id: 'exp-202', description: 'Groceries store bill', amount: 3800, date: '2026-04-04', categoryId: 'cat-groceries' },
  { id: 'exp-203', description: 'Petrol refill', amount: 2000, date: '2026-04-10', categoryId: 'cat-transport' },
  { id: 'exp-204', description: 'Broadband Bill', amount: 999, date: '2026-04-11', categoryId: 'cat-utilities' },
  { id: 'exp-205', description: 'Cinema tickets', amount: 800, date: '2026-04-20', categoryId: 'cat-entertainment' },

  // March 2026
  { id: 'exp-301', description: 'Flat House Rent', amount: 15000, date: '2026-03-01', categoryId: 'cat-rent' },
  { id: 'exp-302', description: 'Groceries store bill', amount: 4500, date: '2026-03-04', categoryId: 'cat-groceries' },
  { id: 'exp-303', description: 'Weekend getaway hotel', amount: 6500, date: '2026-03-15', categoryId: 'cat-travel' },
  { id: 'exp-304', description: 'Uber taxi fare', amount: 1200, date: '2026-03-18', categoryId: 'cat-transport' }
];

const DEFAULT_ASSET_CATEGORIES = {
  'indian-stock': { label: 'Indian Stock', color: '#6366f1', colorDark: '#4f46e5', gradient: 'grad-primary' },
  'indian-mutual-fund': { label: 'Mutual Funds', color: '#a855f7', colorDark: '#7c3aed', gradient: 'grad-violet' },
  'us-stock': { label: 'US Stocks', color: '#0ea5e9', colorDark: '#0284c7', gradient: 'grad-blue' },
  'fd': { label: 'Fixed Deposits', color: '#f59e0b', colorDark: '#d97706', gradient: 'grad-amber' },
  'gold': { label: 'Gold', color: '#eab308', colorDark: '#ca8a04', gradient: 'grad-gold' },
  'bonds': { label: 'Bonds', color: '#f43f5e', colorDark: '#e11d48', gradient: 'grad-rose' },
  'epfo': { label: 'EPFO', color: '#14b8a6', colorDark: '#0d9488', gradient: 'grad-teal' },
  'savings': { label: 'Savings', color: '#3b82f6', colorDark: '#2563eb', gradient: 'grad-blue-dark' }
};

let ASSET_CATEGORIES = {};

const SUBTYPES = {
  'indian-mutual-fund': [
    { value: 'large', label: 'Large Cap' },
    { value: 'mid', label: 'Mid Cap' },
    { value: 'small', label: 'Small Cap' },
    { value: 'flexi', label: 'Flexi Cap' }
  ],
  'gold': [
    { value: 'physical', label: 'Physical Gold' },
    { value: 'etf', label: 'Gold ETF / SGB' }
  ]
};

const relativeDate = (yearsAgo) => new Date(Date.now() - yearsAgo * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// Realistic Pre-populated Demo Data
const SAMPLE_PORTFOLIO = [
  { id: 'stock-tcs', assetClass: 'indian-stock', name: 'TCS Ltd.', subtype: 'none', investedAmount: 150000, currentAmount: 185000, purchaseDate: relativeDate(2.2), lastUpdated: new Date().toISOString() },
  { id: 'stock-hdfc', assetClass: 'indian-stock', name: 'HDFC Bank Ltd.', subtype: 'none', investedAmount: 120000, currentAmount: 115000, purchaseDate: relativeDate(1.5), lastUpdated: new Date().toISOString() },
  { id: 'mf-parag', assetClass: 'indian-mutual-fund', name: 'Parag Parikh Flexi Cap Fund', subtype: 'flexi', investedAmount: 200000, currentAmount: 265000, purchaseDate: relativeDate(3.0), lastUpdated: new Date().toISOString() },
  { id: 'mf-quant', assetClass: 'indian-mutual-fund', name: 'Quant Mid Cap Fund', subtype: 'mid', investedAmount: 80000, currentAmount: 105000, purchaseDate: relativeDate(1.0), lastUpdated: new Date().toISOString() },
  { id: 'mf-nippon', assetClass: 'indian-mutual-fund', name: 'Nippon India Small Cap Fund', subtype: 'small', investedAmount: 50000, currentAmount: 72000, purchaseDate: relativeDate(0.8), lastUpdated: new Date().toISOString() },
  { id: 'us-aapl', assetClass: 'us-stock', name: 'Apple Inc. (AAPL)', subtype: 'none', investedAmount: 75000, currentAmount: 92000, purchaseDate: relativeDate(1.2), lastUpdated: new Date().toISOString() },
  { id: 'us-tsla', assetClass: 'us-stock', name: 'Tesla Inc. (TSLA)', subtype: 'none', investedAmount: 50000, currentAmount: 45000, purchaseDate: relativeDate(0.6), lastUpdated: new Date().toISOString() },
  { id: 'fd-sbi', assetClass: 'fd', name: 'SBI Fixed Deposit @ 6.8%', subtype: 'none', investedAmount: 300000, currentAmount: 318000, purchaseDate: relativeDate(0.9), lastUpdated: new Date().toISOString() },
  { id: 'gold-sgb', assetClass: 'gold', name: 'Sovereign Gold Bonds 2021', subtype: 'physical', investedAmount: 100000, currentAmount: 135000, purchaseDate: relativeDate(2.5), lastUpdated: new Date().toISOString() },
  { id: 'gold-bees', assetClass: 'gold', name: 'Nippon Gold ETF BeES', subtype: 'etf', investedAmount: 50000, currentAmount: 62000, purchaseDate: relativeDate(1.1), lastUpdated: new Date().toISOString() },
  { id: 'bonds-nhai', assetClass: 'bonds', name: 'NHAI Tax Free Bonds', subtype: 'none', investedAmount: 100000, currentAmount: 105000, purchaseDate: relativeDate(1.8), lastUpdated: new Date().toISOString() },
  { id: 'epf-acct', assetClass: 'epfo', name: 'EPFO Employee Share', subtype: 'none', investedAmount: 250000, currentAmount: 285000, purchaseDate: relativeDate(2.0), lastUpdated: new Date().toISOString() },
  { id: 'savings-icici', assetClass: 'savings', name: 'ICICI Savings Account Balance', subtype: 'none', investedAmount: 120000, currentAmount: 120000, purchaseDate: relativeDate(0.5), lastUpdated: new Date().toISOString() }
];

// Helper Functions for Safe Element Creation
function createSVGElement(tag) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

function clearContainer(container) {
  if (container) {
    if (container.tagName === 'SELECT') {
      container.options.length = 0;
    } else {
      container.replaceChildren();
    }
  }
}

// Format numbers as currency
// Format numbers as currency shorthand (K, L, Cr)
function formatCurrency(amount) {
  const num = Number(amount);
  if (isNaN(num)) return '₹0.00';
  const sign = num < 0 ? '-' : '';
  const absNum = Math.abs(num);

  let formatted = '';
  if (absNum >= 10000000) {
    // Crores
    formatted = (absNum / 10000000).toFixed(2) + 'Cr';
  } else if (absNum >= 100000) {
    // Lakhs
    formatted = (absNum / 100000).toFixed(2) + 'L';
  } else if (absNum >= 1000) {
    // Thousands
    formatted = (absNum / 1000).toFixed(2) + 'K';
  } else {
    // Less than 1000
    formatted = absNum.toFixed(2);
  }

  return `${sign}₹${formatted}`;
}

function formatPercent(val) {
  return (val >= 0 ? '+' : '') + val.toFixed(2) + '%';
}

// Generate secure dynamic gradient definition
function appendSVGDefs(svgEl) {
  const defs = createSVGElement('defs');

  // Define color gradients matching JS setup
  Object.keys(ASSET_CATEGORIES).forEach(key => {
    const cat = ASSET_CATEGORIES[key];
    const grad = createSVGElement('linearGradient');
    grad.setAttribute('id', `grad-${key}`);
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '100%');

    const stop1 = createSVGElement('stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', cat.color);

    const stop2 = createSVGElement('stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', cat.colorDark);

    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
  });

  // Extra gradient definitions for general purposes
  const upGrad = createSVGElement('linearGradient');
  upGrad.setAttribute('id', 'grad-up');
  upGrad.setAttribute('x1', '0%'); upGrad.setAttribute('y1', '0%');
  upGrad.setAttribute('x2', '0%'); upGrad.setAttribute('y2', '100%');
  const upStop1 = createSVGElement('stop'); upStop1.setAttribute('offset', '0%'); upStop1.setAttribute('stop-color', '#10b981');
  const upStop2 = createSVGElement('stop'); upStop2.setAttribute('offset', '100%'); upStop2.setAttribute('stop-color', '#059669');
  upGrad.appendChild(upStop1); upGrad.appendChild(upStop2);
  defs.appendChild(upGrad);

  const downGrad = createSVGElement('linearGradient');
  downGrad.setAttribute('id', 'grad-down');
  downGrad.setAttribute('x1', '0%'); downGrad.setAttribute('y1', '0%');
  downGrad.setAttribute('x2', '0%'); downGrad.setAttribute('y2', '100%');
  const downStop1 = createSVGElement('stop'); downStop1.setAttribute('offset', '0%'); downStop1.setAttribute('stop-color', '#f43f5e');
  const downStop2 = createSVGElement('stop'); downStop2.setAttribute('offset', '100%'); downStop2.setAttribute('stop-color', '#e11d48');
  downGrad.appendChild(downStop1); downGrad.appendChild(downStop2);
  defs.appendChild(downGrad);

  const projAreaGrad = createSVGElement('linearGradient');
  projAreaGrad.setAttribute('id', 'grad-proj-area');
  projAreaGrad.setAttribute('x1', '0%'); projAreaGrad.setAttribute('y1', '0%');
  projAreaGrad.setAttribute('x2', '0%'); projAreaGrad.setAttribute('y2', '100%');
  const pStop1 = createSVGElement('stop'); pStop1.setAttribute('offset', '0%'); pStop1.setAttribute('stop-color', '#6366f1'); pStop1.setAttribute('stop-opacity', '0.25');
  const pStop2 = createSVGElement('stop'); pStop2.setAttribute('offset', '100%'); pStop2.setAttribute('stop-color', '#6366f1'); pStop2.setAttribute('stop-opacity', '0.00');
  projAreaGrad.appendChild(pStop1); projAreaGrad.appendChild(pStop2);
  defs.appendChild(projAreaGrad);

  svgEl.appendChild(defs);
}

// Cryptographic Verification Public Key
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEZLQCrPf3rUAAIXcBFo+82T
F/CUICY4OrcgPMmin/WXrMbvz4VH5tNXrSY2TzWmg9ENBltDOWG/UCXcVF
3HBC+w==
-----END PUBLIC KEY-----`;

function str2ab(str) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

async function importPublicKey(pem) {
  const pemHeader = "-----BEGIN PUBLIC KEY-----";
  const pemFooter = "-----END PUBLIC KEY-----";
  const pemContents = pem.substring(pemHeader.length, pem.length - pemFooter.length).replace(/\s/g, '');
  const binaryDerString = window.atob(pemContents);
  const binaryDer = str2ab(binaryDerString);

  return await window.crypto.subtle.importKey(
    "spki",
    binaryDer,
    {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    true,
    ["verify"]
  );
}

async function verifySignature(dataText, signatureBase64) {
  try {
    const publicKey = await importPublicKey(PUBLIC_KEY_PEM);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(dataText);
    const signatureBuffer = Uint8Array.from(window.atob(signatureBase64), c => c.charCodeAt(0));

    return await window.crypto.subtle.verify(
      {
        name: "ECDSA",
        hash: { name: "SHA-256" }
      },
      publicKey,
      signatureBuffer,
      dataBuffer
    );
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

// Strict JSON Schema Validation
function validateBackupSchema(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Backup data must be a JSON object.');
  }

  // Core required fields
  if (!Array.isArray(data.investments)) {
    throw new Error('Backup must contain an "investments" array.');
  }
  if (!Array.isArray(data.liabilities)) {
    throw new Error('Backup must contain a "liabilities" array.');
  }

  // Validate investments
  if (data.assetCategories !== undefined) {
    if (typeof data.assetCategories !== 'object' || data.assetCategories === null || Array.isArray(data.assetCategories)) {
      throw new Error('Backup "assetCategories" must be an object.');
    }
  }
  const schemaAssetCategories = data.assetCategories || ASSET_CATEGORIES;
  const validAssetClasses = Object.keys(schemaAssetCategories);
  data.investments.forEach((inv, index) => {
    if (typeof inv !== 'object' || inv === null) {
      throw new Error(`Investment at index ${index} must be an object.`);
    }
    if (typeof inv.id !== 'string' || !inv.id) {
      throw new Error(`Investment at index ${index} must have a valid string "id".`);
    }
    if (typeof inv.name !== 'string' || !inv.name) {
      throw new Error(`Investment "${inv.id || index}" must have a valid string "name".`);
    }
    if (typeof inv.assetClass !== 'string' || !validAssetClasses.includes(inv.assetClass)) {
      throw new Error(`Investment "${inv.name}" has an invalid assetClass "${inv.assetClass}".`);
    }
    if (typeof inv.investedAmount !== 'number' || isNaN(inv.investedAmount) || inv.investedAmount < 0) {
      throw new Error(`Investment "${inv.name}" must have a non-negative "investedAmount".`);
    }
    if (typeof inv.currentAmount !== 'number' || isNaN(inv.currentAmount) || inv.currentAmount < 0) {
      throw new Error(`Investment "${inv.name}" must have a non-negative "currentAmount".`);
    }
  });

  // Validate liabilities
  const validLiabilityTypes = Object.keys(LIABILITY_TYPES);
  data.liabilities.forEach((l, index) => {
    if (typeof l !== 'object' || l === null) {
      throw new Error(`Liability at index ${index} must be an object.`);
    }
    if (typeof l.id !== 'string' || !l.id) {
      throw new Error(`Liability at index ${index} must have a valid string "id".`);
    }
    if (typeof l.name !== 'string' || !l.name) {
      throw new Error(`Liability "${l.id || index}" must have a valid string "name".`);
    }
    if (typeof l.type !== 'string' || !validLiabilityTypes.includes(l.type)) {
      throw new Error(`Liability "${l.name}" has an invalid type "${l.type}".`);
    }
    if (typeof l.outstanding !== 'number' || isNaN(l.outstanding) || l.outstanding < 0) {
      throw new Error(`Liability "${l.name}" must have a non-negative "outstanding" amount.`);
    }
    if (typeof l.emi !== 'number' || isNaN(l.emi) || l.emi < 0) {
      throw new Error(`Liability "${l.name}" must have a non-negative "emi".`);
    }
    if (typeof l.rate !== 'number' || isNaN(l.rate) || l.rate < 0) {
      throw new Error(`Liability "${l.name}" must have a non-negative interest "rate".`);
    }
    if (typeof l.totalTenure !== 'number' || isNaN(l.totalTenure) || l.totalTenure < 0) {
      throw new Error(`Liability "${l.name}" must have a non-negative "totalTenure".`);
    }
    if (typeof l.tenure !== 'number' || isNaN(l.tenure) || l.tenure < 0) {
      throw new Error(`Liability "${l.name}" must have a non-negative "tenure".`);
    }
  });

  // Validate borrowLent if present
  if (data.borrowLent !== undefined) {
    if (!Array.isArray(data.borrowLent)) {
      throw new Error('"borrowLent" must be an array.');
    }
    data.borrowLent.forEach((bl, index) => {
      if (typeof bl !== 'object' || bl === null) {
        throw new Error(`Borrow/Lent entry at index ${index} must be an object.`);
      }
      if (typeof bl.id !== 'string' || !bl.id) {
        throw new Error(`Borrow/Lent entry at index ${index} must have a valid string "id".`);
      }
      if (bl.type !== 'lent' && bl.type !== 'borrowed') {
        throw new Error(`Borrow/Lent entry "${bl.id || index}" must have type "lent" or "borrowed".`);
      }
      if (typeof bl.person !== 'string' || !bl.person) {
        throw new Error(`Borrow/Lent entry "${bl.id || index}" must have a valid string "person".`);
      }
      if (typeof bl.amount !== 'number' || isNaN(bl.amount) || bl.amount < 0) {
        throw new Error(`Borrow/Lent entry "${bl.id || index}" must have a non-negative "amount".`);
      }
      if (typeof bl.outstanding !== 'number' || isNaN(bl.outstanding) || bl.outstanding < 0) {
        throw new Error(`Borrow/Lent entry "${bl.id || index}" must have a non-negative "outstanding" amount.`);
      }
      if (typeof bl.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(bl.date)) {
        throw new Error(`Borrow/Lent entry "${bl.id || index}" must have a valid date in YYYY-MM-DD format.`);
      }
      if (bl.status !== 'active' && bl.status !== 'paid') {
        throw new Error(`Borrow/Lent entry "${bl.id || index}" must have status "active" or "paid".`);
      }
      if (!Array.isArray(bl.payments)) {
        throw new Error(`Borrow/Lent entry "${bl.id || index}" must have a "payments" array.`);
      }
      bl.payments.forEach((p, pIndex) => {
        if (typeof p !== 'object' || p === null) {
          throw new Error(`Payment at index ${pIndex} in Borrow/Lent entry "${bl.id}" must be an object.`);
        }
        if (typeof p.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
          throw new Error(`Payment at index ${pIndex} in Borrow/Lent entry "${bl.id}" must have a valid date in YYYY-MM-DD format.`);
        }
        if (typeof p.amount !== 'number' || isNaN(p.amount) || p.amount < 0) {
          throw new Error(`Payment at index ${pIndex} in Borrow/Lent entry "${bl.id}" must have a non-negative "amount".`);
        }
      });
    });
  }

  // Validate salaries if present
  if (data.salaries !== undefined) {
    if (!Array.isArray(data.salaries)) {
      throw new Error('"salaries" must be an array.');
    }
    data.salaries.forEach((s, index) => {
      if (typeof s !== 'object' || s === null) {
        throw new Error(`Salary at index ${index} must be an object.`);
      }
      if (typeof s.id !== 'string' || !s.id) {
        throw new Error(`Salary at index ${index} must have a valid string "id".`);
      }
      if (typeof s.month !== 'string' || !/^\d{4}-\d{2}$/.test(s.month)) {
        throw new Error(`Salary "${s.id || index}" must have a valid "month" in YYYY-MM format.`);
      }
      if (typeof s.inhand !== 'number' || isNaN(s.inhand) || s.inhand < 0) {
        throw new Error(`Salary "${s.id || index}" must have a non-negative "inhand" amount.`);
      }
      if (typeof s.deduction !== 'number' || isNaN(s.deduction) || s.deduction < 0) {
        throw new Error(`Salary "${s.id || index}" must have a non-negative "deduction" amount.`);
      }
    });
  }

  // Validate expenses if present
  if (data.expenses !== undefined) {
    if (!Array.isArray(data.expenses)) {
      throw new Error('"expenses" must be an array.');
    }
    data.expenses.forEach((e, index) => {
      if (typeof e !== 'object' || e === null) {
        throw new Error(`Expense at index ${index} must be an object.`);
      }
      if (typeof e.id !== 'string' || !e.id) {
        throw new Error(`Expense at index ${index} must have a valid string "id".`);
      }
      if (typeof e.description !== 'string') {
        throw new Error(`Expense "${e.id || index}" must have a string "description".`);
      }
      if (typeof e.amount !== 'number' || isNaN(e.amount) || e.amount < 0) {
        throw new Error(`Expense "${e.id || index}" must have a non-negative "amount".`);
      }
      if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
        throw new Error(`Expense "${e.id || index}" must have a valid "date" in YYYY-MM-DD format.`);
      }
      if (typeof e.categoryId !== 'string' || !e.categoryId) {
        throw new Error(`Expense "${e.id || index}" must have a valid string "categoryId".`);
      }
    });
  }

  // Validate expenseCategories if present
  if (data.expenseCategories !== undefined) {
    if (!Array.isArray(data.expenseCategories)) {
      throw new Error('"expenseCategories" must be an array.');
    }
    data.expenseCategories.forEach((ec, index) => {
      if (typeof ec !== 'object' || ec === null) {
        throw new Error(`Expense category at index ${index} must be an object.`);
      }
      if (typeof ec.id !== 'string' || !ec.id) {
        throw new Error(`Expense category at index ${index} must have a valid string "id".`);
      }
      if (typeof ec.name !== 'string' || !ec.name) {
        throw new Error(`Expense category "${ec.id || index}" must have a valid string "name".`);
      }
      if (typeof ec.icon !== 'string' || !ec.icon) {
        throw new Error(`Expense category "${ec.id || index}" must have a valid string "icon".`);
      }
    });
  }

  // Validate budgets
  if (data.globalBudget !== undefined) {
    if (typeof data.globalBudget !== 'number' || isNaN(data.globalBudget) || data.globalBudget < 0) {
      throw new Error('"globalBudget" must be a non-negative number.');
    }
  }
  if (data.monthlyBudgets !== undefined) {
    if (typeof data.monthlyBudgets !== 'object' || data.monthlyBudgets === null || Array.isArray(data.monthlyBudgets)) {
      throw new Error('"monthlyBudgets" must be an object.');
    }
    Object.keys(data.monthlyBudgets).forEach(month => {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        throw new Error(`Budget month key "${month}" must be in YYYY-MM format.`);
      }
      const val = data.monthlyBudgets[month];
      if (typeof val !== 'number' || isNaN(val) || val < 0) {
        throw new Error(`Budget value for "${month}" must be a non-negative number.`);
      }
    });
  }

  return true;
}

// Local Storage Handlers
function saveToStorage() {
  localStorage.setItem('moyeniz_investments', JSON.stringify(investments));
  localStorage.setItem('moyeniz_liabilities', JSON.stringify(liabilities));
  localStorage.setItem('moyeniz_borrow_lent', JSON.stringify(borrowLent));
  localStorage.setItem('moyeniz_salaries', JSON.stringify(salaries));
  localStorage.setItem('moyeniz_expenses', JSON.stringify(expenses));
  localStorage.setItem('moyeniz_expense_categories', JSON.stringify(expenseCategories));
  localStorage.setItem('moyeniz_global_budget', globalBudget.toString());
  localStorage.setItem('moyeniz_monthly_budgets', JSON.stringify(monthlyBudgets));
  localStorage.setItem('moyeniz_asset_categories', JSON.stringify(ASSET_CATEGORIES));
  
  scheduleDebouncedAutoSync();
}

function adjustDefaultSavingsBalance(amount) {
  const defaultSavings = investments.find(inv => inv.assetClass === 'savings' && inv.isDefaultSavings);
  if (defaultSavings) {
    defaultSavings.investedAmount = defaultSavings.investedAmount + amount;
    defaultSavings.currentAmount = defaultSavings.currentAmount + amount;
    defaultSavings.lastUpdated = new Date().toISOString();
  }
}

function darkenColor(hex) {
  let color = hex.replace('#', '');
  let r = parseInt(color.substring(0, 2), 16);
  let g = parseInt(color.substring(2, 4), 16);
  let b = parseInt(color.substring(4, 6), 16);

  r = Math.max(0, Math.round(r * 0.8));
  g = Math.max(0, Math.round(g * 0.8));
  b = Math.max(0, Math.round(b * 0.8));

  const toHex = x => {
    const s = x.toString(16);
    return s.length === 1 ? '0' + s : s;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function updateAssetClassDropdown(selectedId = '') {
  const select = document.getElementById('input-asset-class');
  if (!select) return;
  clearContainer(select);

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.disabled = true;
  defaultOpt.selected = !selectedId;
  defaultOpt.textContent = 'Select Class';
  select.appendChild(defaultOpt);

  Object.keys(ASSET_CATEGORIES).forEach(key => {
    const cat = ASSET_CATEGORIES[key];
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = cat.label;
    if (key === selectedId) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

function renderAssetFilterChips() {
  const container = document.getElementById('asset-filters-container');
  if (!container) return;
  clearContainer(container);

  const allChip = document.createElement('button');
  allChip.className = `filter-chip${currentFilter === 'all' ? ' active' : ''}`;
  allChip.setAttribute('data-filter', 'all');
  allChip.textContent = 'All Assets';
  allChip.addEventListener('click', () => {
    container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    allChip.classList.add('active');
    currentFilter = 'all';
    renderInvestments();
  });
  container.appendChild(allChip);

  Object.keys(ASSET_CATEGORIES).forEach(key => {
    const cat = ASSET_CATEGORIES[key];
    const chip = document.createElement('button');
    chip.className = `filter-chip${currentFilter === key ? ' active' : ''}`;
    chip.setAttribute('data-filter', key);
    chip.textContent = cat.label;
    chip.addEventListener('click', () => {
      container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = key;
      renderInvestments();
    });
    container.appendChild(chip);
  });
}

function getVariationColor(baseHex, index, total) {
  let hex = baseHex.replace('#', '');
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  // Cohesive HSL shifts
  h = (h + (index * 0.08)) % 1.0;
  l = Math.max(0.3, Math.min(0.7, l + (index % 2 === 0 ? 0.05 : -0.05)));

  const hslToRgb = (h, s, l) => {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  const [r2, g2, b2] = hslToRgb(h, s, l);
  const toHex = x => {
    const s = x.toString(16);
    return s.length === 1 ? '0' + s : s;
  };
  return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
}

function renderBreakdownChart(assetClass) {
  const container = document.getElementById('breakdown-chart-container');
  const legend = document.getElementById('breakdown-legend');
  const title = document.getElementById('breakdown-title');
  const column = document.getElementById('breakdown-column');

  if (!container || !legend || !title || !column) return;

  const category = ASSET_CATEGORIES[assetClass];
  if (!category) {
    column.style.display = 'none';
    return;
  }

  const filtered = investments.filter(inv => inv.assetClass === assetClass);
  let totalVal = 0;
  filtered.forEach(inv => {
    totalVal += Number(inv.currentAmount) || 0;
  });

  if (totalVal === 0 || filtered.length === 0) {
    column.style.display = 'none';
    return;
  }

  filtered.sort((a, b) => (Number(b.currentAmount) || 0) - (Number(a.currentAmount) || 0));

  column.style.display = 'flex';
  title.textContent = `Breakdown: ${category.label} (${formatCurrency(totalVal)})`;

  clearContainer(container);
  clearContainer(legend);

  const items = filtered.map((inv, index) => {
    const val = Number(inv.currentAmount) || 0;
    const color = getVariationColor(category.color, index, filtered.length);
    const colorDark = getVariationColor(category.colorDark, index, filtered.length);
    return {
      key: inv.id,
      label: inv.name,
      value: val,
      pct: (val / totalVal) * 100,
      color: color,
      colorDark: colorDark,
      invested: Number(inv.investedAmount) || 0,
      current: val
    };
  });

  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const r_out = 145;
  const r_in = 85;

  const svg = createSVGElement('svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.classList.add('svg-chart');
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.maxWidth = '250px';
  svg.style.maxHeight = '250px';

  const defs = createSVGElement('defs');
  items.forEach(item => {
    const grad = createSVGElement('linearGradient');
    grad.setAttribute('id', `grad-breakdown-${item.key}`);
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '100%');

    const stop1 = createSVGElement('stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', item.color);

    const stop2 = createSVGElement('stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', item.colorDark);

    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
  });
  svg.appendChild(defs);

  const slicesGroup = createSVGElement('g');
  svg.appendChild(slicesGroup);

  const resetAllSlices = () => {
    slicesGroup.querySelectorAll('.chart-slice').forEach(p => {
      p.style.transform = '';
      p.style.filter = '';
    });
    legend.querySelectorAll('.legend-item').forEach(li => {
      li.style.transform = '';
      li.style.backgroundColor = '';
    });
  };

  svg.addEventListener('mouseleave', resetAllSlices);
  legend.addEventListener('mouseleave', resetAllSlices);

  let currentAngle = -Math.PI / 2;

  items.forEach(item => {
    let angleRange = (item.pct / 100) * 2 * Math.PI;
    if (item.pct >= 99.99) {
      angleRange = 2 * Math.PI - 0.0001;
    }
    const endAngle = currentAngle + angleRange;

    const path = createSVGElement('path');
    path.classList.add('chart-slice');

    const x1_out = cx + r_out * Math.cos(currentAngle);
    const y1_out = cy + r_out * Math.sin(currentAngle);
    const x2_out = cx + r_out * Math.cos(endAngle);
    const y2_out = cy + r_out * Math.sin(endAngle);

    const x1_in = cx + r_in * Math.cos(currentAngle);
    const y1_in = cy + r_in * Math.sin(currentAngle);
    const x2_in = cx + r_in * Math.cos(endAngle);
    const y2_in = cy + r_in * Math.sin(endAngle);

    const largeArc = angleRange > Math.PI ? 1 : 0;
    const d = `M ${x1_out} ${y1_out} A ${r_out} ${r_out} 0 ${largeArc} 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${r_in} ${r_in} 0 ${largeArc} 0 ${x1_in} ${y1_in} Z`;

    path.setAttribute('d', d);
    path.setAttribute('fill', `url(#grad-breakdown-${item.key})`);

    const midAngle = currentAngle + angleRange / 2;
    const popDistance = 8;
    const dx = popDistance * Math.cos(midAngle);
    const dy = popDistance * Math.sin(midAngle);

    path.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s ease';
    path.style.transformOrigin = 'center';

    const gain = item.current - item.invested;
    const returnPct = item.invested > 0 ? (gain / item.invested) * 100 : 0;

    path.addEventListener('mouseenter', (e) => {
      resetAllSlices();
      path.style.transform = `translate(${dx}px, ${dy}px)`;
      path.style.filter = `drop-shadow(0px 6px 12px ${item.color}66)`;
      showTooltip(e, item.label, item.invested, item.current, gain, returnPct);
    });

    path.addEventListener('mousemove', (e) => {
      showTooltip(e, item.label, item.invested, item.current, gain, returnPct);
    });

    path.addEventListener('mouseleave', () => {
      path.style.transform = '';
      path.style.filter = '';
      hideTooltip();
    });

    slicesGroup.appendChild(path);
    currentAngle = endAngle;

    const legItem = document.createElement('div');
    legItem.classList.add('legend-item');
    legItem.style.transition = 'transform 0.2s ease, background-color 0.2s ease';
    legItem.style.borderRadius = '6px';
    legItem.style.padding = '4px 6px';

    const infoCol = document.createElement('div');
    infoCol.classList.add('legend-info');

    const dot = document.createElement('span');
    dot.classList.add('legend-color-box');
    dot.style.background = `linear-gradient(135deg, ${item.color}, ${item.colorDark})`;

    const textLabel = document.createElement('span');
    textLabel.classList.add('legend-name');
    textLabel.textContent = item.label;

    infoCol.appendChild(dot);
    infoCol.appendChild(textLabel);

    const valCol = document.createElement('div');
    valCol.classList.add('legend-val');

    const numSpan = document.createElement('span');
    numSpan.textContent = formatCurrency(item.value);

    const pctSpan = document.createElement('span');
    pctSpan.classList.add('legend-pct');
    pctSpan.textContent = item.pct.toFixed(1) + '%';

    valCol.appendChild(numSpan);
    valCol.appendChild(pctSpan);

    legItem.appendChild(infoCol);
    legItem.appendChild(valCol);

    legItem.addEventListener('mouseenter', (e) => {
      resetAllSlices();
      path.style.transform = `translate(${dx}px, ${dy}px)`;
      path.style.filter = `drop-shadow(0px 6px 12px ${item.color}66)`;
      legItem.style.transform = 'translateX(4px)';
      legItem.style.backgroundColor = 'var(--bg-light)';
      showTooltip(e, item.label, item.invested, item.current, gain, returnPct);
    });

    legItem.addEventListener('mousemove', (e) => {
      showTooltip(e, item.label, item.invested, item.current, gain, returnPct);
    });

    legItem.addEventListener('mouseleave', () => {
      path.style.transform = '';
      path.style.filter = '';
      legItem.style.transform = '';
      legItem.style.backgroundColor = '';
      hideTooltip();
    });

    legend.appendChild(legItem);
  });

  const innerCircle = createSVGElement('circle');
  innerCircle.setAttribute('cx', cx.toString());
  innerCircle.setAttribute('cy', cy.toString());
  innerCircle.setAttribute('r', (r_in - 2).toString());
  innerCircle.setAttribute('fill', 'var(--bg-inner-circle, #ffffff)');
  svg.appendChild(innerCircle);

  container.appendChild(svg);
}

async function loadFromStorage() {
  const acData = localStorage.getItem('moyeniz_asset_categories');
  ASSET_CATEGORIES = acData !== null ? JSON.parse(acData) : {...DEFAULT_ASSET_CATEGORIES};

  const data = localStorage.getItem('moyeniz_investments');
  const lData = localStorage.getItem('moyeniz_liabilities');
  const blData = localStorage.getItem('moyeniz_borrow_lent');
  const sData = localStorage.getItem('moyeniz_salaries');
  const eData = localStorage.getItem('moyeniz_expenses');
  const ecData = localStorage.getItem('moyeniz_expense_categories');
  const gbData = localStorage.getItem('moyeniz_global_budget');
  const mbData = localStorage.getItem('moyeniz_monthly_budgets');

  if (data !== null && lData !== null) {
    investments = JSON.parse(data);
    liabilities = JSON.parse(lData);
    borrowLent = blData !== null ? JSON.parse(blData) : [];
    salaries = sData !== null ? JSON.parse(sData) : [];
    expenses = eData !== null ? JSON.parse(eData) : [];
    expenseCategories = ecData !== null ? JSON.parse(ecData) : [...DEFAULT_EXPENSE_CATEGORIES];
    globalBudget = gbData !== null ? Number(gbData) : 40000;
    try {
      monthlyBudgets = mbData !== null ? JSON.parse(mbData) : {};
    } catch (e) {
      monthlyBudgets = {};
    }
    saveToStorage();
    return;
  }

  // Try to fetch custom "moyeniz.json" from server root (optional feature for self-hosted installs)
  // A 404 on GitHub Pages is expected and is intentionally silenced.
  try {
    const response = await fetch('moyeniz.json', { method: 'GET', cache: 'no-store' });
    if (response.status === 200) {
      const responseText = await response.text();
      let signatureVerified = false;
      try {
        const sigResponse = await fetch('moyeniz.json.sig', { method: 'GET', cache: 'no-store' });
        if (sigResponse.status === 200) {
          const sigText = (await sigResponse.text()).trim();
          signatureVerified = await verifySignature(responseText, sigText);
        }
      } catch (sigErr) {
        console.error("Error reading signature file:", sigErr);
      }

      if (!signatureVerified) {
        console.error("Cryptographic signature verification failed for remote moyeniz.json! Blocking load.");
        alert("CRITICAL SECURITY ALERT: Remote moyeniz.json failed cryptographic verification (missing or invalid signature). It was blocked from loading.");
        return;
      }

      const backup = JSON.parse(responseText);
      validateBackupSchema(backup);

      investments = backup.investments;
      liabilities = backup.liabilities;
      borrowLent = Array.isArray(backup.borrowLent) ? backup.borrowLent : [];
      salaries = Array.isArray(backup.salaries) ? backup.salaries : [];
      expenses = Array.isArray(backup.expenses) ? backup.expenses : [];
      expenseCategories = Array.isArray(backup.expenseCategories) ? backup.expenseCategories : [...DEFAULT_EXPENSE_CATEGORIES];
      globalBudget = typeof backup.globalBudget === 'number' ? backup.globalBudget : 40000;
      monthlyBudgets = backup.monthlyBudgets && typeof backup.monthlyBudgets === 'object' ? backup.monthlyBudgets : {};
      ASSET_CATEGORIES = backup.assetCategories && typeof backup.assetCategories === 'object' ? backup.assetCategories : {...DEFAULT_ASSET_CATEGORIES};
      saveToStorage();
    }
    // Any non-200 (e.g. 404) is silently ignored; file is optional.
  } catch (_err) {
    // Network failure (offline, CORS, etc.) — silently ignored.
  }
}

// Update Visibility of Top Action Buttons (Download Portfolio / Add Investment)
function updateTopActions(tabName) {
  const btnDownloadTop = document.getElementById('btn-sync-portfolio');
  const btnDownloadPdfTop = document.getElementById('btn-download-pdf-top');
  const btnAddInvestment = document.getElementById('btn-add-investment');
  const dataInitialized = localStorage.getItem('moyeniz_investments') !== null;

  if (btnDownloadTop) {
    if (tabName === 'dashboard' && dataInitialized) {
      btnDownloadTop.style.display = 'inline-flex';
    } else {
      btnDownloadTop.style.display = 'none';
      const syncModal = document.getElementById('sync-portfolio-modal');
      if (syncModal) syncModal.classList.remove('active-modal');
    }
  }

  if (btnDownloadPdfTop) {
    if (tabName === 'dashboard' && dataInitialized) {
      btnDownloadPdfTop.style.display = 'inline-flex';
    } else {
      btnDownloadPdfTop.style.display = 'none';
    }
  }

  if (btnAddInvestment) {
    if (tabName === 'investments') {
      btnAddInvestment.style.display = 'inline-flex';
    } else {
      btnAddInvestment.style.display = 'none';
    }
  }
}

// Tab Navigation logic
function initNavigation() {
  const links = document.querySelectorAll('.nav-link');
  const views = document.querySelectorAll('.page-view');
  const viewTitle = document.getElementById('view-title');
  const viewSubtitle = document.getElementById('view-subtitle');

  links.forEach(link => {
    link.addEventListener('click', () => {
      const tabName = link.getAttribute('data-tab');

      // Toggle active link
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Toggle active viewport
      views.forEach(v => v.classList.remove('active-view'));
      const activeView = document.getElementById(`view-${tabName}`);
      if (activeView) activeView.classList.add('active-view');

      // Reset scroll position on tab switch
      const mainWrap = document.querySelector('.main-wrapper');
      if (mainWrap) mainWrap.scrollTop = 0;
      window.scrollTo(0, 0);

      // Update headings
      if (tabName === 'dashboard') {
        viewTitle.textContent = 'Dashboard';
        // viewSubtitle.textContent = 'An overview of your complete financial portfolio.';
        renderDashboard();
      } else if (tabName === 'investments') {
        viewTitle.textContent = 'Investments';
        // viewSubtitle.textContent = 'View, filter, and manage individual assets.';
        renderInvestments();
      } else if (tabName === 'liabilities') {
        viewTitle.textContent = 'Liabilities & EMIs';
        // viewSubtitle.textContent = 'Track your loans, monthly outflows, and overall leverage.';
        renderLiabilities();
      } else if (tabName === 'borrow-lent') {
        viewTitle.textContent = 'Borrow & Lent';
        // viewSubtitle.textContent = 'Track personal borrowings and lendings, payments, and histories.';
        renderBorrowLent();
      } else if (tabName === 'salary') {
        viewTitle.textContent = 'Salary Tracker';
        // viewSubtitle.textContent = 'Track salary trends, credits, deductions, and increments over time.';
        renderSalaries();
      } else if (tabName === 'expenses') {
        viewTitle.textContent = 'Expense Tracker';
        renderExpenses();
      } else if (tabName === 'account' || tabName === 'settings') {
        viewTitle.textContent = 'Account';
        renderAccount();
      }

      updateTopActions(tabName);
    });
  });
}

// Calculations and Summaries
function getPortfolioSummary() {
  let totalInvested = 0;
  let currentVal = 0;

  investments.forEach(inv => {
    totalInvested += Number(inv.investedAmount);
    currentVal += Number(inv.currentAmount);
  });

  const totalGain = currentVal - totalInvested;
  const returnPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  return {
    totalInvested,
    currentValue: currentVal,
    totalGain,
    returnPct
  };
}

// Dashboard Page Rendering
function renderDashboard() {
  const dataInitialized = localStorage.getItem('moyeniz_investments') !== null;

  const activeContent = document.getElementById('dashboard-active-content');
  const emptyContent = document.getElementById('dashboard-empty-content');
  const btnDownloadTop = document.getElementById('btn-sync-portfolio');

  if (!dataInitialized) {
    if (activeContent) activeContent.style.display = 'none';
    if (emptyContent) emptyContent.style.display = 'block';
    if (btnDownloadTop) btnDownloadTop.style.display = 'none';
    const btnDownloadPdfTop = document.getElementById('btn-download-pdf-top');
    if (btnDownloadPdfTop) btnDownloadPdfTop.style.display = 'none';
    return;
  } else {
    if (activeContent) activeContent.style.display = 'block';
    if (emptyContent) emptyContent.style.display = 'none';
    const activeTabLink = document.querySelector('.nav-link.active');
    const activeTabName = activeTabLink ? activeTabLink.getAttribute('data-tab') : 'dashboard';
    if (btnDownloadTop) {
      btnDownloadTop.style.display = activeTabName === 'dashboard' ? 'inline-flex' : 'none';
      if (activeTabName !== 'dashboard') {
        const syncModal = document.getElementById('sync-portfolio-modal');
        if (syncModal) syncModal.classList.remove('active-modal');
      }
    }
    const btnDownloadPdfTop = document.getElementById('btn-download-pdf-top');
    if (btnDownloadPdfTop) {
      btnDownloadPdfTop.style.display = activeTabName === 'dashboard' ? 'inline-flex' : 'none';
    }
  }

  const summary = getPortfolioSummary();

  // Bind simple text properties
  document.getElementById('val-total-invested').textContent = formatCurrency(summary.totalInvested);
  document.getElementById('val-current-value').textContent = formatCurrency(summary.currentValue);

  // Calculate total debt and net worth for dashboard
  let totalLiabilitiesVal = 0;
  liabilities.forEach(l => {
    totalLiabilitiesVal += Number(l.outstanding);
  });

  let totalLentVal = 0;
  let totalBorrowedVal = 0;
  borrowLent.forEach(bl => {
    if (bl.status !== 'paid') {
      const outstandingAmt = Number(bl.outstanding);
      if (bl.type === 'lent') {
        totalLentVal += outstandingAmt;
      } else if (bl.type === 'borrowed') {
        totalBorrowedVal += outstandingAmt;
      }
    }
  });

  const netWorthVal = summary.currentValue + totalLentVal - totalLiabilitiesVal - totalBorrowedVal;

  document.getElementById('val-total-liabilities-dash').textContent = formatCurrency(totalLiabilitiesVal);
  document.getElementById('val-total-borrowed-dash').textContent = formatCurrency(totalBorrowedVal);
  document.getElementById('val-total-lent-dash').textContent = formatCurrency(totalLentVal);
  document.getElementById('val-net-worth').textContent = formatCurrency(netWorthVal);

  const gainEl = document.getElementById('val-total-return');
  gainEl.textContent = formatCurrency(summary.totalGain);

  const returnBadge = document.getElementById('badge-total-return-pct');
  returnBadge.textContent = formatPercent(summary.returnPct);

  // Return card status styling
  const returnCard = document.getElementById('card-total-return');
  const returnIcon = document.getElementById('icon-total-return');

  returnCard.classList.remove('success', 'warning', 'blue');
  returnBadge.classList.remove('up', 'down', 'neutral');

  if (summary.totalGain > 0) {
    returnCard.classList.add('success');
    returnBadge.classList.add('up');
    clearContainer(returnIcon);
    const arrowUp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrowUp.setAttribute('viewBox', '0 0 24 24');
    arrowUp.setAttribute('fill', 'none');
    arrowUp.setAttribute('stroke', 'currentColor');
    arrowUp.setAttribute('stroke-width', '2.5');
    arrowUp.setAttribute('width', '20');
    arrowUp.setAttribute('height', '20');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M7 7h10v10M7 17 17 7');
    arrowUp.appendChild(path);
    returnIcon.appendChild(arrowUp);
  } else if (summary.totalGain < 0) {
    returnCard.classList.add('warning');
    returnBadge.classList.add('down');
    clearContainer(returnIcon);
    const arrowDown = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrowDown.setAttribute('viewBox', '0 0 24 24');
    arrowDown.setAttribute('fill', 'none');
    arrowDown.setAttribute('stroke', 'currentColor');
    arrowDown.setAttribute('stroke-width', '2.5');
    arrowDown.setAttribute('width', '20');
    arrowDown.setAttribute('height', '20');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M7 17h10V7M17 17 7 7');
    arrowDown.appendChild(path);
    returnIcon.appendChild(arrowDown);
  } else {
    returnCard.classList.add('blue');
    returnBadge.classList.add('neutral');
    clearContainer(returnIcon);
    const dash = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    dash.setAttribute('viewBox', '0 0 24 24');
    dash.setAttribute('fill', 'none');
    dash.setAttribute('stroke', 'currentColor');
    dash.setAttribute('stroke-width', '2.5');
    dash.setAttribute('width', '20');
    dash.setAttribute('height', '20');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    path.setAttribute('x1', '5'); path.setAttribute('y1', '12');
    path.setAttribute('x2', '19'); path.setAttribute('y2', '12');
    dash.appendChild(path);
    returnIcon.appendChild(dash);
  }

  // Calculate dynamic Portfolio CAGR based on actual invested values, current values and holding periods
  let portfolioCagr = 0;
  if (summary.totalInvested > 0 && summary.currentValue > 0) {
    let weightedCagrSum = 0;
    let totalCurrentForCagr = 0;
    const now = new Date();

    investments.forEach(inv => {
      const invested = Number(inv.investedAmount);
      const current = Number(inv.currentAmount);
      if (invested > 0) {
        // Enforce fallback date if purchaseDate is missing
        const purchase = inv.purchaseDate ? new Date(inv.purchaseDate) : (inv.lastUpdated ? new Date(inv.lastUpdated) : now);
        let durationInYears = (now - purchase) / (1000 * 60 * 60 * 24 * 365.25);
        // Enforce minimum holding period of 1 month (0.083 years) to prevent extreme annualized returns on brand new entries
        durationInYears = Math.max(0.083, durationInYears);

        // Compute individual CAGR: (current / invested) ^ (1 / years) - 1
        const cagr = Math.pow(current / invested, 1 / durationInYears) - 1;

        weightedCagrSum += (cagr * current);
        totalCurrentForCagr += current;
      }
    });

    if (totalCurrentForCagr > 0) {
      portfolioCagr = (weightedCagrSum / totalCurrentForCagr) * 100;
    }
  }

  // Render calculated XIRR (CAGR Equivalent)
  const cagrEl = document.getElementById('val-portfolio-cagr');
  if (cagrEl) {
    cagrEl.textContent = (portfolioCagr >= 0 ? '+' : '') + portfolioCagr.toFixed(1) + '%';
  }

  // Render Allocation Chart
  renderAllocationChart(summary.currentValue);

  // Render Mutual Fund cap types & Savings account distribution charts
  renderMutualFundChart();
  renderSavingsChart();
  renderSipChart();

  // Render Performance Bar Chart
  renderPerformanceChart();

  // Render Wealth vs Debt History Chart
  const historyData = getPortfolioHistory();
  renderDashboardHistoryChart(historyData);

  // Render Net Worth History Chart
  const netWorthData = getNetWorthHistory();
  renderNetWorthChart(netWorthData);

  // Render Insights and Score
  renderInsights(summary);

  // Render Profit and Loss Heatmaps
  renderHeatmaps();

  // Render Projections on Dashboard
  renderProjections();

  // Calculate expenses for current month
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  let currentMonthExpenses = 0;
  expenses.forEach(e => {
    if (e.date.startsWith(currentMonthStr)) {
      currentMonthExpenses += Number(e.amount);
    }
  });

  const dashExpensesVal = document.getElementById('val-dash-expenses');
  if (dashExpensesVal) {
    dashExpensesVal.textContent = formatCurrency(currentMonthExpenses);
  }
  const dashExpensesLbl = document.getElementById('lbl-dash-expenses');
  if (dashExpensesLbl) {
    const activeMonthStr = new Date().toISOString().slice(0, 7);
    dashExpensesLbl.textContent = `Budget: ${formatCurrency(getBudgetForMonth(activeMonthStr))}`;
  }
  // Calculate today's expenses
  const todayStr = new Date().toISOString().slice(0, 10);
  let todayExpenses = 0;
  expenses.forEach(e => {
    if (e.date === todayStr) {
      todayExpenses += Number(e.amount);
    }
  });
  const dashExpensesToday = document.getElementById('lbl-dash-expenses-today');
  if (dashExpensesToday) {
    dashExpensesToday.textContent = `Today: ${formatCurrency(todayExpenses)}`;
  }
  const dashExpensesCard = document.getElementById('card-dash-expenses');
  if (dashExpensesCard) {
    dashExpensesCard.onclick = () => {
      const tabExpenses = document.getElementById('tab-expenses');
      if (tabExpenses) tabExpenses.click();
    };
  }
}

// Generate custom SVG Doughnut Pie Chart
function renderAllocationChart(totalPortfolioVal) {
  const container = document.getElementById('allocation-chart-container');
  const legend = document.getElementById('allocation-legend');
  clearContainer(container);
  clearContainer(legend);

  if (totalPortfolioVal === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.textContent = 'No asset allocation data available.';
    emptyMsg.style.color = 'var(--text-muted)';
    container.appendChild(emptyMsg);
    return;
  }

  // Calculate allocation sizes by class
  const classTotals = {};
  investments.forEach(inv => {
    const val = Number(inv.currentAmount);
    classTotals[inv.assetClass] = (classTotals[inv.assetClass] || 0) + val;
  });

  const sortedClasses = Object.keys(classTotals).map(key => ({
    key,
    value: classTotals[key],
    pct: (classTotals[key] / totalPortfolioVal) * 100
  })).sort((a, b) => b.value - a.value);

  // Build SVG Doughnut (expanded radii to reduce blank space and maximize size)
  const size = 400;
  const cx = size / 2;
  const cy = size / 2;
  const r_out = 190;
  const r_in = 110;

  const svg = createSVGElement('svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.classList.add('svg-chart');
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.maxWidth = '370px';
  svg.style.maxHeight = '370px';

  appendSVGDefs(svg);

  // Create slices group for z-index layering
  const slicesGroup = createSVGElement('g');
  svg.appendChild(slicesGroup);

  const resetAllSlices = () => {
    slicesGroup.querySelectorAll('.chart-slice').forEach(p => {
      p.style.transform = '';
      p.style.filter = '';
    });
    legend.querySelectorAll('.legend-item').forEach(li => {
      li.style.transform = '';
      li.style.backgroundColor = '';
    });
  };

  svg.addEventListener('mouseleave', resetAllSlices);
  legend.addEventListener('mouseleave', resetAllSlices);

  let currentAngle = -Math.PI / 2; // start from top

  sortedClasses.forEach((catData) => {
    const category = ASSET_CATEGORIES[catData.key];
    let angleRange = (catData.pct / 100) * 2 * Math.PI;
    if (catData.pct >= 99.99) {
      angleRange = 2 * Math.PI - 0.0001;
    }
    const endAngle = currentAngle + angleRange;

    // Draw doughnut slice
    const path = createSVGElement('path');
    path.classList.add('chart-slice');

    // Math coordinates
    const x1_out = cx + r_out * Math.cos(currentAngle);
    const y1_out = cy + r_out * Math.sin(currentAngle);
    const x2_out = cx + r_out * Math.cos(endAngle);
    const y2_out = cy + r_out * Math.sin(endAngle);

    const x1_in = cx + r_in * Math.cos(currentAngle);
    const y1_in = cy + r_in * Math.sin(currentAngle);
    const x2_in = cx + r_in * Math.cos(endAngle);
    const y2_in = cy + r_in * Math.sin(endAngle);

    const largeArc = angleRange > Math.PI ? 1 : 0;

    const d = `M ${x1_out} ${y1_out} A ${r_out} ${r_out} 0 ${largeArc} 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${r_in} ${r_in} 0 ${largeArc} 0 ${x1_in} ${y1_in} Z`;

    path.setAttribute('d', d);
    path.setAttribute('fill', `url(#grad-${catData.key})`);

    // Calculate category investments details for tooltip
    let catInvested = 0;
    let catCurrent = 0;
    investments.forEach(inv => {
      if (inv.assetClass === catData.key) {
        catInvested += Number(inv.investedAmount);
        catCurrent += Number(inv.currentAmount);
      }
    });

    const catGain = catCurrent - catInvested;
    const catReturnPct = catInvested > 0 ? (catGain / catInvested) * 100 : 0;

    // Dynamic Pop Out calculations
    const midAngle = currentAngle + angleRange / 2;
    const popDistance = 12;
    const dx = popDistance * Math.cos(midAngle);
    const dy = popDistance * Math.sin(midAngle);

    path.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s ease';
    path.style.transformOrigin = 'center';

    // Hover listeners for the slice
    path.addEventListener('mouseenter', (e) => {
      resetAllSlices();
      path.style.transform = `translate(${dx}px, ${dy}px)`;
      path.style.filter = `drop-shadow(0px 8px 16px ${category.color}66)`;
      showTooltip(e, category.label, catInvested, catCurrent, catGain, catReturnPct);
    });
    path.addEventListener('mouseleave', () => {
      path.style.transform = '';
      path.style.filter = '';
    });

    // Event bindings for Tooltip
    path.style.cursor = 'pointer';
    path.addEventListener('mousemove', (e) => {
      showTooltip(e, category.label, catInvested, catCurrent, catGain, catReturnPct);
    });
    path.addEventListener('mouseleave', hideTooltip);
    path.addEventListener('click', () => {
      activeBreakdownClass = catData.key;
      renderBreakdownChart(catData.key);
    });

    slicesGroup.appendChild(path);
    currentAngle = endAngle;

    // Append Legend Item
    const legItem = document.createElement('div');
    legItem.classList.add('legend-item');
    legItem.style.cursor = 'pointer';

    const infoCol = document.createElement('div');
    infoCol.classList.add('legend-info');

    const dot = document.createElement('span');
    dot.classList.add('legend-color-box');
    dot.style.background = `linear-gradient(135deg, ${category.color}, ${category.colorDark})`;

    const textLabel = document.createElement('span');
    textLabel.classList.add('legend-name');
    textLabel.textContent = category.label;

    infoCol.appendChild(dot);
    infoCol.appendChild(textLabel);

    const valCol = document.createElement('div');
    valCol.classList.add('legend-val');

    const numSpan = document.createElement('span');
    numSpan.textContent = formatCurrency(catData.value);

    const pctSpan = document.createElement('span');
    pctSpan.classList.add('legend-pct');
    pctSpan.textContent = catData.pct.toFixed(1) + '%';

    valCol.appendChild(numSpan);
    valCol.appendChild(pctSpan);

    legItem.appendChild(infoCol);
    legItem.appendChild(valCol);

    // Legend hover interactions
    legItem.style.transition = 'transform 0.2s ease, background-color 0.2s ease';
    legItem.style.borderRadius = '6px';
    legItem.style.padding = '4px 6px';

    legItem.addEventListener('mouseenter', (e) => {
      resetAllSlices();
      path.style.transform = `translate(${dx}px, ${dy}px)`;
      path.style.filter = `drop-shadow(0px 8px 16px ${category.color}66)`;
      legItem.style.transform = 'translateX(4px)';
      legItem.style.backgroundColor = 'var(--bg-light)';
      showTooltip(e, category.label, catInvested, catCurrent, catGain, catReturnPct);
    });
    legItem.addEventListener('mousemove', (e) => {
      showTooltip(e, category.label, catInvested, catCurrent, catGain, catReturnPct);
    });
    legItem.addEventListener('mouseleave', () => {
      path.style.transform = '';
      path.style.filter = '';
      legItem.style.transform = '';
      legItem.style.backgroundColor = '';
      hideTooltip();
    });
    legItem.addEventListener('click', () => {
      activeBreakdownClass = catData.key;
      renderBreakdownChart(catData.key);
    });

    legend.appendChild(legItem);
  });

  // Center circle helper (glassmorphic overlay inside)
  const innerCircle = createSVGElement('circle');
  innerCircle.setAttribute('cx', cx.toString());
  innerCircle.setAttribute('cy', cy.toString());
  innerCircle.setAttribute('r', (r_in - 2).toString());
  innerCircle.setAttribute('fill', 'var(--bg-inner-circle, #ffffff)');
  svg.appendChild(innerCircle);

  container.appendChild(svg);

  // Render breakdown dynamically
  if (!activeBreakdownClass && sortedClasses.length > 0) {
    activeBreakdownClass = sortedClasses[0].key;
  }
  if (activeBreakdownClass) {
    renderBreakdownChart(activeBreakdownClass);
  }
}

// Reusable Doughnut Chart Generator with 3D Pop-out Hover Animations
function renderReusableDoughnut(container, legend, items, totalVal, idPrefix, titlePrefix) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const r_out = 145;
  const r_in = 85;

  const svg = createSVGElement('svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.classList.add('svg-chart');
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.maxWidth = '250px';
  svg.style.maxHeight = '250px';

  const defs = createSVGElement('defs');
  items.forEach(item => {
    const grad = createSVGElement('linearGradient');
    grad.setAttribute('id', `grad-${idPrefix}-${item.key}`);
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '100%');

    const stop1 = createSVGElement('stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', item.color);

    const stop2 = createSVGElement('stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', item.colorDark);

    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
  });
  svg.appendChild(defs);

  const slicesGroup = createSVGElement('g');
  svg.appendChild(slicesGroup);

  const resetAllSlices = () => {
    slicesGroup.querySelectorAll('.chart-slice').forEach(p => {
      p.style.transform = '';
      p.style.filter = '';
    });
    legend.querySelectorAll('.legend-item').forEach(li => {
      li.style.transform = '';
      li.style.backgroundColor = '';
    });
  };

  svg.addEventListener('mouseleave', resetAllSlices);
  legend.addEventListener('mouseleave', resetAllSlices);

  let currentAngle = -Math.PI / 2; // start from top

  items.forEach((item) => {
    let angleRange = (item.pct / 100) * 2 * Math.PI;
    if (item.pct >= 99.99) {
      angleRange = 2 * Math.PI - 0.0001;
    }
    const endAngle = currentAngle + angleRange;

    // Draw doughnut slice
    const path = createSVGElement('path');
    path.classList.add('chart-slice');

    // Math coordinates
    const x1_out = cx + r_out * Math.cos(currentAngle);
    const y1_out = cy + r_out * Math.sin(currentAngle);
    const x2_out = cx + r_out * Math.cos(endAngle);
    const y2_out = cy + r_out * Math.sin(endAngle);

    const x1_in = cx + r_in * Math.cos(currentAngle);
    const y1_in = cy + r_in * Math.sin(currentAngle);
    const x2_in = cx + r_in * Math.cos(endAngle);
    const y2_in = cy + r_in * Math.sin(endAngle);

    const largeArc = angleRange > Math.PI ? 1 : 0;

    const d = `M ${x1_out} ${y1_out} A ${r_out} ${r_out} 0 ${largeArc} 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${r_in} ${r_in} 0 ${largeArc} 0 ${x1_in} ${y1_in} Z`;

    path.setAttribute('d', d);
    path.setAttribute('fill', `url(#grad-${idPrefix}-${item.key})`);

    // Dynamic Pop Out calculations
    const midAngle = currentAngle + angleRange / 2;
    const popDistance = 8;
    const dx = popDistance * Math.cos(midAngle);
    const dy = popDistance * Math.sin(midAngle);

    path.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s ease';
    path.style.transformOrigin = 'center';

    // Tooltip statistics
    let groupInvested = 0;
    let groupCurrent = item.value;

    if (idPrefix === 'mf-subtype') {
      investments.forEach(inv => {
        if (inv.assetClass === 'indian-mutual-fund' && (inv.subtype || 'none') === item.key) {
          groupInvested += Number(inv.investedAmount) || 0;
        }
      });
    } else {
      groupInvested = item.value;
    }

    const groupGain = groupCurrent - groupInvested;
    const groupReturnPct = groupInvested > 0 ? (groupGain / groupInvested) * 100 : 0;

    // Hover listeners for the slice
    path.addEventListener('mouseenter', (e) => {
      resetAllSlices();
      path.style.transform = `translate(${dx}px, ${dy}px)`;
      path.style.filter = `drop-shadow(0px 6px 12px ${item.color}66)`;
      if (idPrefix === 'mf-sip') {
        const targetInv = investments.find(inv => inv.name === item.label && inv.assetClass === 'indian-mutual-fund');
        const sipTotalInvested = targetInv ? Number(targetInv.investedAmount) : 0;
        const sipTotalCurrent = targetInv ? Number(targetInv.currentAmount) : 0;
        const pl = sipTotalCurrent - sipTotalInvested;
        const pct = sipTotalInvested > 0 ? (pl / sipTotalInvested) * 100 : 0;
        showTooltip(e, `${titlePrefix}: ${item.label}`, item.value, sipTotalInvested, pl, pct, ['SIP Amount:', 'Total Invested:', 'P&L:']);
      } else {
        showTooltip(e, `${titlePrefix}: ${item.label}`, groupInvested, groupCurrent, groupGain, groupReturnPct);
      }
    });
    path.addEventListener('mouseleave', () => {
      path.style.transform = '';
      path.style.filter = '';
    });

    path.addEventListener('mousemove', (e) => {
      if (idPrefix === 'mf-sip') {
        const targetInv = investments.find(inv => inv.name === item.label && inv.assetClass === 'indian-mutual-fund');
        const sipTotalInvested = targetInv ? Number(targetInv.investedAmount) : 0;
        const sipTotalCurrent = targetInv ? Number(targetInv.currentAmount) : 0;
        const pl = sipTotalCurrent - sipTotalInvested;
        const pct = sipTotalInvested > 0 ? (pl / sipTotalInvested) * 100 : 0;
        showTooltip(e, `${titlePrefix}: ${item.label}`, item.value, sipTotalInvested, pl, pct, ['SIP Amount:', 'Total Invested:', 'P&L:']);
      } else {
        showTooltip(e, `${titlePrefix}: ${item.label}`, groupInvested, groupCurrent, groupGain, groupReturnPct);
      }
    });
    path.addEventListener('mouseleave', hideTooltip);

    slicesGroup.appendChild(path);
    currentAngle = endAngle;

    // Append Legend Item
    const legItem = document.createElement('div');
    legItem.classList.add('legend-item');

    const infoCol = document.createElement('div');
    infoCol.classList.add('legend-info');

    const dot = document.createElement('span');
    dot.classList.add('legend-color-box');
    dot.style.background = `linear-gradient(135deg, ${item.color}, ${item.colorDark})`;

    const textLabel = document.createElement('span');
    textLabel.classList.add('legend-name');
    textLabel.textContent = item.label;

    infoCol.appendChild(dot);
    infoCol.appendChild(textLabel);

    const valCol = document.createElement('div');
    valCol.classList.add('legend-val');

    const numSpan = document.createElement('span');
    numSpan.textContent = formatCurrency(item.value);

    const pctSpan = document.createElement('span');
    pctSpan.classList.add('legend-pct');
    pctSpan.textContent = item.pct.toFixed(1) + '%';

    valCol.appendChild(numSpan);
    valCol.appendChild(pctSpan);

    legItem.appendChild(infoCol);
    legItem.appendChild(valCol);

    legItem.style.transition = 'transform 0.2s ease, background-color 0.2s ease';
    legItem.style.borderRadius = '6px';
    legItem.style.padding = '4px 6px';

    legItem.addEventListener('mouseenter', (e) => {
      resetAllSlices();
      path.style.transform = `translate(${dx}px, ${dy}px)`;
      path.style.filter = `drop-shadow(0px 6px 12px ${item.color}66)`;
      legItem.style.transform = 'translateX(4px)';
      legItem.style.backgroundColor = 'var(--bg-light)';

      if (idPrefix === 'mf-sip') {
        const targetInv = investments.find(inv => inv.name === item.label && inv.assetClass === 'indian-mutual-fund');
        const sipTotalInvested = targetInv ? Number(targetInv.investedAmount) : 0;
        const sipTotalCurrent = targetInv ? Number(targetInv.currentAmount) : 0;
        const pl = sipTotalCurrent - sipTotalInvested;
        const pct = sipTotalInvested > 0 ? (pl / sipTotalInvested) * 100 : 0;
        showTooltip(e, `${titlePrefix}: ${item.label}`, item.value, sipTotalInvested, pl, pct, ['SIP Amount:', 'Total Invested:', 'P&L:']);
      } else {
        showTooltip(e, `${titlePrefix}: ${item.label}`, groupInvested, groupCurrent, groupGain, groupReturnPct);
      }
    });

    legItem.addEventListener('mousemove', (e) => {
      if (idPrefix === 'mf-sip') {
        const targetInv = investments.find(inv => inv.name === item.label && inv.assetClass === 'indian-mutual-fund');
        const sipTotalInvested = targetInv ? Number(targetInv.investedAmount) : 0;
        const sipTotalCurrent = targetInv ? Number(targetInv.currentAmount) : 0;
        const pl = sipTotalCurrent - sipTotalInvested;
        const pct = sipTotalInvested > 0 ? (pl / sipTotalInvested) * 100 : 0;
        showTooltip(e, `${titlePrefix}: ${item.label}`, item.value, sipTotalInvested, pl, pct, ['SIP Amount:', 'Total Invested:', 'P&L:']);
      } else {
        showTooltip(e, `${titlePrefix}: ${item.label}`, groupInvested, groupCurrent, groupGain, groupReturnPct);
      }
    });

    legItem.addEventListener('mouseleave', () => {
      path.style.transform = '';
      path.style.filter = '';
      legItem.style.transform = '';
      legItem.style.backgroundColor = '';
      hideTooltip();
    });

    legend.appendChild(legItem);
  });

  const innerCircle = createSVGElement('circle');
  innerCircle.setAttribute('cx', cx.toString());
  innerCircle.setAttribute('cy', cy.toString());
  innerCircle.setAttribute('r', (r_in - 2).toString());
  innerCircle.setAttribute('fill', 'var(--bg-inner-circle, #ffffff)');
  svg.appendChild(innerCircle);

  container.appendChild(svg);
}

// Generate Mutual Fund subtype Doughnut Chart
function renderMutualFundChart() {
  const container = document.getElementById('mf-chart-container');
  const legend = document.getElementById('mf-legend');
  clearContainer(container);
  clearContainer(legend);

  const mfInvestments = investments.filter(inv => inv.assetClass === 'indian-mutual-fund');
  let totalMFVal = 0;
  const subtypeTotals = {};

  mfInvestments.forEach(inv => {
    const val = Number(inv.currentAmount) || 0;
    totalMFVal += val;
    const subtype = inv.subtype || 'none';
    subtypeTotals[subtype] = (subtypeTotals[subtype] || 0) + val;
  });

  if (totalMFVal === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.textContent = 'No mutual fund allocation data available.';
    emptyMsg.style.color = 'var(--text-muted)';
    emptyMsg.style.fontSize = '0.85rem';
    emptyMsg.style.padding = '20px';
    emptyMsg.style.textAlign = 'center';
    container.appendChild(emptyMsg);
    return;
  }

  const mfSubtypeMap = {
    'large': { label: 'Large Cap', color: '#3b82f6', colorDark: '#1d4ed8' },
    'mid': { label: 'Mid Cap', color: '#10b981', colorDark: '#047857' },
    'small': { label: 'Small Cap', color: '#f43f5e', colorDark: '#be123c' },
    'flexi': { label: 'Flexi Cap', color: '#a855f7', colorDark: '#6d28d9' },
    'none': { label: 'Unspecified', color: '#64748b', colorDark: '#475569' }
  };

  const sortedSubtypes = Object.keys(subtypeTotals).map(key => {
    const info = mfSubtypeMap[key] || { label: key.charAt(0).toUpperCase() + key.slice(1), color: '#8b5cf6', colorDark: '#5b21b6' };
    return {
      key,
      label: info.label,
      value: subtypeTotals[key],
      pct: (subtypeTotals[key] / totalMFVal) * 100,
      color: info.color,
      colorDark: info.colorDark
    };
  }).sort((a, b) => b.value - a.value);

  renderReusableDoughnut(container, legend, sortedSubtypes, totalMFVal, 'mf-subtype', 'Mutual Fund');
}

// Generate Bank-wise Savings Account balances Doughnut Chart
function renderSavingsChart() {
  const container = document.getElementById('savings-chart-container');
  const legend = document.getElementById('savings-legend');
  clearContainer(container);
  clearContainer(legend);

  const savingsInvestments = investments.filter(inv => inv.assetClass === 'savings');
  let totalSavingsVal = 0;
  const bankTotals = {};

  savingsInvestments.forEach(inv => {
    const val = Number(inv.currentAmount) || 0;
    totalSavingsVal += val;
    const name = inv.name || 'Savings Account';
    bankTotals[name] = (bankTotals[name] || 0) + val;
  });

  if (totalSavingsVal === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.textContent = 'No savings account balance data available.';
    emptyMsg.style.color = 'var(--text-muted)';
    emptyMsg.style.fontSize = '0.85rem';
    emptyMsg.style.padding = '20px';
    emptyMsg.style.textAlign = 'center';
    container.appendChild(emptyMsg);
    return;
  }

  const bankColors = [
    { color: '#3b82f6', colorDark: '#1d4ed8' },
    { color: '#0ea5e9', colorDark: '#0284c7' },
    { color: '#10b981', colorDark: '#047857' },
    { color: '#14b8a6', colorDark: '#0d9488' },
    { color: '#a855f7', colorDark: '#6d28d9' },
    { color: '#f59e0b', colorDark: '#d97706' },
    { color: '#f43f5e', colorDark: '#be123c' },
    { color: '#6366f1', colorDark: '#4f46e5' }
  ];

  const sortedBanks = Object.keys(bankTotals).map((name, idx) => {
    const colorInfo = bankColors[idx % bankColors.length];
    return {
      key: `bank-${idx}`,
      label: name,
      value: bankTotals[name],
      pct: (bankTotals[name] / totalSavingsVal) * 100,
      color: colorInfo.color,
      colorDark: colorInfo.colorDark
    };
  }).sort((a, b) => b.value - a.value);

  renderReusableDoughnut(container, legend, sortedBanks, totalSavingsVal, 'savings-bank', 'Savings');
}

function recordSipPaid(id) {
  const inv = investments.find(i => i.id === id);
  if (inv && Number(inv.sipAmount) > 0) {
    const sip = Number(inv.sipAmount);
    inv.investedAmount = Number(inv.investedAmount) + sip;
    inv.currentAmount = Number(inv.currentAmount) + sip;
    inv.lastUpdated = new Date().toISOString();
    saveToStorage();
    renderInvestments();
  }
}

// Generate SIP Contributions per Fund Doughnut Chart
function renderSipChart() {
  const container = document.getElementById('sip-chart-container');
  const legend = document.getElementById('sip-legend');
  clearContainer(container);
  clearContainer(legend);

  const mfSipInvestments = investments.filter(inv => inv.assetClass === 'indian-mutual-fund' && Number(inv.sipAmount) > 0);
  let totalSipVal = 0;
  const sipTotals = {};

  mfSipInvestments.forEach(inv => {
    const val = Number(inv.sipAmount) || 0;
    totalSipVal += val;
    sipTotals[inv.name] = (sipTotals[inv.name] || 0) + val;
  });

  if (totalSipVal === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.textContent = 'No active mutual fund SIP contributions found.';
    emptyMsg.style.color = 'var(--text-muted)';
    emptyMsg.style.fontSize = '0.85rem';
    emptyMsg.style.padding = '20px';
    emptyMsg.style.textAlign = 'center';
    container.appendChild(emptyMsg);
    return;
  }

  const sipColors = [
    { color: '#a855f7', colorDark: '#6d28d9' },
    { color: '#3b82f6', colorDark: '#1d4ed8' },
    { color: '#10b981', colorDark: '#047857' },
    { color: '#f59e0b', colorDark: '#d97706' },
    { color: '#ec4899', colorDark: '#be185d' },
    { color: '#0ea5e9', colorDark: '#0284c7' },
    { color: '#f43f5e', colorDark: '#be123c' },
    { color: '#6366f1', colorDark: '#4f46e5' }
  ];

  const sortedSips = Object.keys(sipTotals).map((name, idx) => {
    const colorInfo = sipColors[idx % sipColors.length];
    return {
      key: `sip-${idx}`,
      label: name,
      value: sipTotals[name],
      pct: (sipTotals[name] / totalSipVal) * 100,
      color: colorInfo.color,
      colorDark: colorInfo.colorDark
    };
  }).sort((a, b) => b.value - a.value);

  renderReusableDoughnut(container, legend, sortedSips, totalSipVal, 'mf-sip', 'Monthly SIP');
}

// Generate Grouped SVG Bar Chart SVG Element
function generatePerformanceChartSVG(isMobile, isPrint = false) {
  // Calculate performance by class
  const classData = {};
  Object.keys(ASSET_CATEGORIES).forEach(key => {
    classData[key] = { invested: 0, current: 0 };
  });

  investments.forEach(inv => {
    if (classData[inv.assetClass]) {
      classData[inv.assetClass].invested += Number(inv.investedAmount);
      classData[inv.assetClass].current += Number(inv.currentAmount);
    }
  });

  // Filter out classes with 0 invested
  const activeKeys = Object.keys(classData).filter(key => classData[key].invested > 0);

  if (activeKeys.length === 0) {
    return null;
  }

  // SVG setups
  const svgWidth = isPrint ? 960 : (isMobile ? 480 : 840);
  const svgHeight = isPrint ? 260 : (isMobile ? 240 : 280);
  const margin = isPrint
    ? { top: 20, right: 20, bottom: 45, left: 70 }
    : (isMobile
      ? { top: 15, right: 10, bottom: 30, left: 45 }
      : { top: 20, right: 20, bottom: 40, left: 65 });
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  const svg = createSVGElement('svg');
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  svg.classList.add('svg-chart');

  appendSVGDefs(svg);

  // Find max value to scale Y axis
  let maxVal = 0;
  activeKeys.forEach(key => {
    maxVal = Math.max(maxVal, classData[key].invested, classData[key].current);
  });
  // Pad the max value for aesthetics
  maxVal = maxVal * 1.15;
  if (maxVal === 0) maxVal = 10000;

  // Draw Y grid lines and ticks
  const ticksCount = 4;
  for (let i = 0; i <= ticksCount; i++) {
    const ratio = i / ticksCount;
    const yVal = maxVal * ratio;
    const y = margin.top + chartHeight - (ratio * chartHeight);

    // Grid Line
    if (i > 0) {
      const grid = createSVGElement('line');
      grid.setAttribute('x1', margin.left.toString());
      grid.setAttribute('y1', y.toString());
      grid.setAttribute('x2', (margin.left + chartWidth).toString());
      grid.setAttribute('y2', y.toString());
      grid.classList.add('chart-grid-line');
      svg.appendChild(grid);
    }

    // Y Label
    const text = createSVGElement('text');
    text.setAttribute('x', (margin.left - 10).toString());
    text.setAttribute('y', (y + 4).toString());
    text.setAttribute('text-anchor', 'end');
    text.classList.add('chart-axis-text');

    // Custom compact labeling
    let cleanText = '';
    if (yVal >= 10000000) {
      cleanText = '₹' + (yVal / 10000000).toFixed(1) + 'Cr';
    } else if (yVal >= 100000) {
      cleanText = '₹' + (yVal / 100000).toFixed(0) + 'L';
    } else if (yVal >= 1000) {
      cleanText = '₹' + (yVal / 1000).toFixed(0) + 'k';
    } else {
      cleanText = '₹' + yVal.toFixed(0);
    }
    text.textContent = cleanText;
    svg.appendChild(text);
  }

  // X axis line
  const xAxis = createSVGElement('line');
  xAxis.setAttribute('x1', margin.left.toString());
  xAxis.setAttribute('y1', (margin.top + chartHeight).toString());
  xAxis.setAttribute('x2', (margin.left + chartWidth).toString());
  xAxis.setAttribute('y2', (margin.top + chartHeight).toString());
  xAxis.classList.add('chart-axis-line');
  svg.appendChild(xAxis);

  // Draw bars
  const groupCount = activeKeys.length;
  const groupWidth = chartWidth / groupCount;
  const barPadding = (isMobile && !isPrint) ? 2 : 4;

  // Cap max bar width to prevent bloated bars on wide layouts
  let barWidth = (groupWidth - ((isMobile && !isPrint) ? 10 : 24)) / 2;
  const maxBarWidth = (isMobile && !isPrint) ? 20 : 36;
  if (barWidth > maxBarWidth) {
    barWidth = maxBarWidth;
  }

  activeKeys.forEach((key, idx) => {
    const label = ASSET_CATEGORIES[key].label;
    const invested = classData[key].invested;
    const current = classData[key].current;

    // Center the bar pair inside the category group space
    const groupInsideWidth = (barWidth * 2) + barPadding;
    const offset = (groupWidth - groupInsideWidth) / 2;
    const xGroupStart = margin.left + (idx * groupWidth) + offset;

    // Heights
    const hInvested = (invested / maxVal) * chartHeight;
    const hCurrent = (current / maxVal) * chartHeight;

    // Bar coordinates
    const xInvested = xGroupStart;
    const yInvested = margin.top + chartHeight - hInvested;

    const xCurrent = xGroupStart + barWidth + barPadding;
    const yCurrent = margin.top + chartHeight - hCurrent;

    // Draw Invested Bar (Linear Gradient Slate Gray / Indigo Mix)
    const rectInv = createSVGElement('rect');
    rectInv.setAttribute('x', xInvested.toString());
    rectInv.setAttribute('y', yInvested.toString());
    rectInv.setAttribute('width', barWidth.toString());
    rectInv.setAttribute('height', Math.max(2, hInvested).toString());
    rectInv.setAttribute('rx', '4');
    rectInv.setAttribute('fill', 'url(#grad-indian-stock)'); // Indigo gradient
    rectInv.classList.add('chart-bar');

    // Draw Current Bar (Green Gradient if gain, Rose Gradient if loss)
    const rectCur = createSVGElement('rect');
    rectCur.setAttribute('x', xCurrent.toString());
    rectCur.setAttribute('y', yCurrent.toString());
    rectCur.setAttribute('width', barWidth.toString());
    rectCur.setAttribute('height', Math.max(2, hCurrent).toString());
    rectCur.setAttribute('rx', '4');
    rectCur.setAttribute('fill', current >= invested ? 'url(#grad-up)' : 'url(#grad-down)');
    rectCur.classList.add('chart-bar');

    // Tooltip event attachments
    if (!isPrint) {
      const plAmount = current - invested;
      const plPct = invested > 0 ? (plAmount / invested) * 100 : 0;

      rectInv.addEventListener('mousemove', (e) => {
        showTooltip(e, `${label} (Invested)`, invested, current, plAmount, plPct);
      });
      rectInv.addEventListener('mouseleave', hideTooltip);

      rectCur.addEventListener('mousemove', (e) => {
        showTooltip(e, `${label} (Current)`, invested, current, plAmount, plPct);
      });
      rectCur.addEventListener('mouseleave', hideTooltip);
    }

    svg.appendChild(rectInv);
    svg.appendChild(rectCur);

    // X Label text
    const labelText = createSVGElement('text');
    labelText.setAttribute('x', (xGroupStart + barWidth + (barPadding / 2)).toString());
    labelText.setAttribute('y', (margin.top + chartHeight + ((isMobile && !isPrint) ? 16 : 20)).toString());
    labelText.setAttribute('text-anchor', 'middle');
    labelText.classList.add('chart-axis-text');
    labelText.textContent = label;

    // Apply rotation to labels if printing or if we have > 5 active asset classes to prevent overlaps
    if (isPrint || activeKeys.length > 5) {
      const cx_lbl = xGroupStart + barWidth + (barPadding / 2);
      const cy_lbl = margin.top + chartHeight + ((isMobile && !isPrint) ? 16 : 20);
      labelText.setAttribute('transform', `rotate(-12, ${cx_lbl}, ${cy_lbl})`);
    }

    svg.appendChild(labelText);
  });

  return svg;
}

// Generate Grouped SVG Bar Chart
function renderPerformanceChart() {
  const container = document.getElementById('performance-chart-container');
  clearContainer(container);

  const isMobile = window.innerWidth < 600;
  const svg = generatePerformanceChartSVG(isMobile, false);

  if (!svg) {
    const emptyMsg = document.createElement('div');
    emptyMsg.textContent = 'No performance data available.';
    emptyMsg.style.color = 'var(--text-muted)';
    container.appendChild(emptyMsg);
    return;
  }

  container.appendChild(svg);
}

// Generate Historical Trend Chart data walking backward 6 months
function getPortfolioHistory() {
  const history = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    const fullMonthLabel = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    // Reconstruct investments
    let totalInvestments = 0;
    investments.forEach(inv => {
      const currentAmount = Number(inv.currentAmount) || 0;
      let monthlyRate = 0.008; // default to stocks/MF
      const assetClass = inv.assetClass;

      if (assetClass === 'fd' || assetClass === 'savings') {
        monthlyRate = 0.005;
      } else if (assetClass === 'gold' || assetClass === 'bonds' || assetClass === 'epfo') {
        monthlyRate = 0.006;
      }

      const val = currentAmount / Math.pow(1 + monthlyRate, i);
      totalInvestments += val;
    });

    // Reconstruct liabilities
    let totalLiabilities = 0;
    liabilities.forEach(l => {
      const outstandingCurrent = Number(l.outstanding) || 0;
      const emi = Number(l.emi) || 0;
      const annualRate = Number(l.rate) || 0;
      const monthlyRate = (annualRate / 100) / 12;
      const totalTenure = Number(l.totalTenure || l.tenure || 1);
      const tenureLeft = Number(l.tenure) || 0;

      let outstanding = outstandingCurrent;
      for (let step = 1; step <= i; step++) {
        if (tenureLeft + step > totalTenure) {
          outstanding = 0;
          break;
        }
        outstanding = (outstanding + emi) / (1 + monthlyRate);
      }
      totalLiabilities += outstanding;
    });

    history.push({
      monthLabel,
      fullMonthLabel,
      investments: Math.round(totalInvestments),
      liabilities: Math.round(totalLiabilities),
      netWorth: Math.round(totalInvestments - totalLiabilities)
    });
  }

  return history;
}

// Render Wealth vs Debt Trend Chart
function renderDashboardHistoryChart(historyData) {
  const container = document.getElementById('history-chart-container');
  if (!container) return;
  clearContainer(container);

  if (!historyData || historyData.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.textContent = 'No historical data available.';
    emptyMsg.style.color = 'var(--text-muted)';
    container.appendChild(emptyMsg);
    return;
  }

  const isMobile = window.innerWidth < 600;
  const svgWidth = isMobile ? 480 : 840;
  const svgHeight = isMobile ? 240 : 280;
  const margin = isMobile
    ? { top: 15, right: 10, bottom: 30, left: 45 }
    : { top: 20, right: 20, bottom: 40, left: 75 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  const svg = createSVGElement('svg');
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  svg.classList.add('svg-chart');

  // Custom Area Fill Gradients
  const defs = createSVGElement('defs');

  const invGrad = createSVGElement('linearGradient');
  invGrad.setAttribute('id', 'grad-inv-trend-area');
  invGrad.setAttribute('x1', '0%'); invGrad.setAttribute('y1', '0%');
  invGrad.setAttribute('x2', '0%'); invGrad.setAttribute('y2', '100%');
  const invStop1 = createSVGElement('stop'); invStop1.setAttribute('offset', '0%'); invStop1.setAttribute('stop-color', '#6366f1'); invStop1.setAttribute('stop-opacity', '0.15');
  const invStop2 = createSVGElement('stop'); invStop2.setAttribute('offset', '100%'); invStop2.setAttribute('stop-color', '#6366f1'); invStop2.setAttribute('stop-opacity', '0.00');
  invGrad.appendChild(invStop1); invGrad.appendChild(invStop2);
  defs.appendChild(invGrad);

  const liabGrad = createSVGElement('linearGradient');
  liabGrad.setAttribute('id', 'grad-liab-trend-area');
  liabGrad.setAttribute('x1', '0%'); liabGrad.setAttribute('y1', '0%');
  liabGrad.setAttribute('x2', '0%'); liabGrad.setAttribute('y2', '100%');
  const liabStop1 = createSVGElement('stop'); liabStop1.setAttribute('offset', '0%'); liabStop1.setAttribute('stop-color', '#f43f5e'); liabStop1.setAttribute('stop-opacity', '0.12');
  const liabStop2 = createSVGElement('stop'); liabStop2.setAttribute('offset', '100%'); liabStop2.setAttribute('stop-color', '#f43f5e'); liabStop2.setAttribute('stop-opacity', '0.00');
  liabGrad.appendChild(liabStop1); liabGrad.appendChild(liabStop2);
  defs.appendChild(liabGrad);

  svg.appendChild(defs);

  // Find maximum value for scaling Y
  let maxVal = 0;
  historyData.forEach(d => {
    if (d.investments > maxVal) maxVal = d.investments;
    if (d.liabilities > maxVal) maxVal = d.liabilities;
  });
  maxVal = Math.max(10000, maxVal * 1.15); // 15% padding, min 10k

  // Draw Y grid and labels
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const ratio = i / ticks;
    const yVal = maxVal * ratio;
    const y = margin.top + chartHeight - (ratio * chartHeight);

    if (i > 0) {
      const line = createSVGElement('line');
      line.setAttribute('x1', margin.left.toString());
      line.setAttribute('y1', y.toString());
      line.setAttribute('x2', (margin.left + chartWidth).toString());
      line.setAttribute('y2', y.toString());
      line.classList.add('chart-grid-line');
      svg.appendChild(line);
    }

    const text = createSVGElement('text');
    text.setAttribute('x', (margin.left - 10).toString());
    text.setAttribute('y', (y + 4).toString());
    text.setAttribute('text-anchor', 'end');
    text.classList.add('chart-axis-text');

    let label = '';
    if (yVal >= 10000000) {
      label = '₹' + (yVal / 10000000).toFixed(1) + 'Cr';
    } else if (yVal >= 100000) {
      label = '₹' + (yVal / 100000).toFixed(1) + 'L';
    } else if (yVal >= 1000) {
      label = '₹' + (yVal / 1000).toFixed(0) + 'k';
    } else {
      label = '₹' + yVal.toFixed(0);
    }
    text.textContent = label;
    svg.appendChild(text);
  }

  const pointsCount = historyData.length;

  // Draw X axis grid and labels
  historyData.forEach((d, idx) => {
    const rx = pointsCount > 1 ? idx / (pointsCount - 1) : 0.5;
    const x = margin.left + (rx * chartWidth);

    // Vertical dotted lines (grid)
    if (idx > 0 && idx < pointsCount - 1) {
      const line = createSVGElement('line');
      line.setAttribute('x1', x.toString());
      line.setAttribute('y1', margin.top.toString());
      line.setAttribute('x2', x.toString());
      line.setAttribute('y2', (margin.top + chartHeight).toString());
      line.classList.add('chart-grid-line');
      svg.appendChild(line);
    }

    const text = createSVGElement('text');
    text.setAttribute('x', x.toString());
    text.setAttribute('y', (margin.top + chartHeight + (isMobile ? 16 : 20)).toString());
    text.setAttribute('text-anchor', 'middle');
    text.classList.add('chart-axis-text');
    text.textContent = d.monthLabel;
    svg.appendChild(text);
  });

  // Coordinate scaling logic
  const scalePoint = (d, idx) => {
    const rx = pointsCount > 1 ? idx / (pointsCount - 1) : 0.5;
    const ryInv = d.investments / maxVal;
    const ryLiab = d.liabilities / maxVal;

    return {
      x: margin.left + (rx * chartWidth),
      yInv: margin.top + chartHeight - (ryInv * chartHeight),
      yLiab: margin.top + chartHeight - (ryLiab * chartHeight),
      investments: d.investments,
      liabilities: d.liabilities,
      netWorth: d.netWorth,
      monthLabel: d.monthLabel,
      fullMonthLabel: d.fullMonthLabel
    };
  };

  const mapped = historyData.map(scalePoint);

  if (pointsCount > 1) {
    // Area fill under Investments
    const areaPathInv = `M ${mapped[0].x} ${margin.top + chartHeight} ` +
      mapped.map(p => `L ${p.x} ${p.yInv}`).join(' ') +
      ` L ${mapped[mapped.length - 1].x} ${margin.top + chartHeight} Z`;
    const areaInv = createSVGElement('path');
    areaInv.setAttribute('d', areaPathInv);
    areaInv.setAttribute('fill', 'url(#grad-inv-trend-area)');
    svg.appendChild(areaInv);

    // Area fill under Liabilities
    const areaPathLiab = `M ${mapped[0].x} ${margin.top + chartHeight} ` +
      mapped.map(p => `L ${p.x} ${p.yLiab}`).join(' ') +
      ` L ${mapped[mapped.length - 1].x} ${margin.top + chartHeight} Z`;
    const areaLiab = createSVGElement('path');
    areaLiab.setAttribute('d', areaPathLiab);
    areaLiab.setAttribute('fill', 'url(#grad-liab-trend-area)');
    svg.appendChild(areaLiab);

    // Polyline coordinates
    const polylineStrInv = mapped.map(p => `${p.x},${p.yInv}`).join(' ');
    const polylineStrLiab = mapped.map(p => `${p.x},${p.yLiab}`).join(' ');

    // Draw Investments Line (Indigo)
    const lineInv = createSVGElement('polyline');
    lineInv.setAttribute('points', polylineStrInv);
    lineInv.setAttribute('fill', 'none');
    lineInv.setAttribute('stroke', '#6366f1');
    lineInv.setAttribute('stroke-width', '3');
    svg.appendChild(lineInv);

    // Draw Liabilities Line (Rose)
    const lineLiab = createSVGElement('polyline');
    lineLiab.setAttribute('points', polylineStrLiab);
    lineLiab.setAttribute('fill', 'none');
    lineLiab.setAttribute('stroke', '#f43f5e');
    lineLiab.setAttribute('stroke-width', '3');
    svg.appendChild(lineLiab);
  }

  // Draw points/dots and tooltips
  mapped.forEach(p => {
    // Investments Point
    const dotInv = createSVGElement('circle');
    dotInv.setAttribute('cx', p.x.toString());
    dotInv.setAttribute('cy', p.yInv.toString());
    dotInv.setAttribute('r', '5');
    dotInv.setAttribute('fill', '#6366f1');
    dotInv.setAttribute('stroke', '#070913');
    dotInv.setAttribute('stroke-width', '2');
    dotInv.style.cursor = 'pointer';
    dotInv.style.transition = 'transform 0.15s ease';

    dotInv.addEventListener('mouseenter', () => dotInv.setAttribute('r', '7'));
    dotInv.addEventListener('mouseleave', () => {
      dotInv.setAttribute('r', '5');
      hideTooltip();
    });

    dotInv.addEventListener('mousemove', (e) => {
      showCustomTooltip(
        e,
        p.fullMonthLabel,
        'Total Investments:',
        formatCurrency(p.investments),
        'Liabilities:',
        formatCurrency(p.liabilities),
        'Net Worth:',
        formatCurrency(p.netWorth)
      );
      const tPl = document.getElementById('chart-tooltip-pl');
      if (tPl) {
        tPl.className = 'chart-tooltip-value ' + (p.netWorth >= 0 ? 'positive' : 'negative');
      }
    });
    svg.appendChild(dotInv);

    // Liabilities Point
    const dotLiab = createSVGElement('circle');
    dotLiab.setAttribute('cx', p.x.toString());
    dotLiab.setAttribute('cy', p.yLiab.toString());
    dotLiab.setAttribute('r', '5');
    dotLiab.setAttribute('fill', '#f43f5e');
    dotLiab.setAttribute('stroke', '#070913');
    dotLiab.setAttribute('stroke-width', '2');
    dotLiab.style.cursor = 'pointer';
    dotLiab.style.transition = 'transform 0.15s ease';

    dotLiab.addEventListener('mouseenter', () => dotLiab.setAttribute('r', '7'));
    dotLiab.addEventListener('mouseleave', () => {
      dotLiab.setAttribute('r', '5');
      hideTooltip();
    });

    dotLiab.addEventListener('mousemove', (e) => {
      showCustomTooltip(
        e,
        p.fullMonthLabel,
        'Total Investments:',
        formatCurrency(p.investments),
        'Liabilities:',
        formatCurrency(p.liabilities),
        'Net Worth:',
        formatCurrency(p.netWorth)
      );
      const tPl = document.getElementById('chart-tooltip-pl');
      if (tPl) {
        tPl.className = 'chart-tooltip-value ' + (p.netWorth >= 0 ? 'positive' : 'negative');
      }
    });
    svg.appendChild(dotLiab);
  });

  container.appendChild(svg);
}

// Generate Net Worth History walking backward 12 months, incorporating salary credits & EMI payments
function getNetWorthHistory() {
  const history = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    const fullMonthLabel = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const monthKey = d.toISOString().slice(0, 7); // "YYYY-MM"

    // Reconstruct investments
    let totalInvestments = 0;
    investments.forEach(inv => {
      const currentAmount = Number(inv.currentAmount) || 0;
      let monthlyRate = 0.008; // default to stocks/MF
      const assetClass = inv.assetClass;

      if (assetClass === 'fd' || assetClass === 'savings') {
        monthlyRate = 0.005;
      } else if (assetClass === 'gold' || assetClass === 'bonds' || assetClass === 'epfo') {
        monthlyRate = 0.006;
      }

      const val = currentAmount / Math.pow(1 + monthlyRate, i);
      totalInvestments += val;
    });

    // Reconstruct liabilities & count active EMIs
    let totalLiabilities = 0;
    let totalEmisPaid = 0;
    liabilities.forEach(l => {
      const outstandingCurrent = Number(l.outstanding) || 0;
      const emi = Number(l.emi) || 0;
      const annualRate = Number(l.rate) || 0;
      const monthlyRate = (annualRate / 100) / 12;
      const totalTenure = Number(l.totalTenure || l.tenure || 1);
      const tenureLeft = Number(l.tenure) || 0;

      let outstanding = outstandingCurrent;
      for (let step = 1; step <= i; step++) {
        if (tenureLeft + step > totalTenure) {
          outstanding = 0;
          break;
        }
        outstanding = (outstanding + emi) / (1 + monthlyRate);
      }
      totalLiabilities += outstanding;

      // Check if this liability had EMIs paid i months ago
      if (tenureLeft + i <= totalTenure) {
        totalEmisPaid += emi;
      }
    });

    // Find salary credited in that month
    const sal = salaries.find(s => s.month === monthKey);
    const salaryCredited = sal ? Number(sal.inhand) : 0;

    history.push({
      monthLabel,
      fullMonthLabel,
      investments: Math.round(totalInvestments),
      liabilities: Math.round(totalLiabilities),
      netWorth: Math.round(totalInvestments - totalLiabilities),
      salaryCredited: Math.round(salaryCredited),
      emisPaid: Math.round(totalEmisPaid)
    });
  }

  return history;
}

// Render Net Worth Line Chart
function renderNetWorthChart(netWorthData) {
  const container = document.getElementById('networth-chart-container');
  if (!container) return;
  clearContainer(container);

  if (!netWorthData || netWorthData.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.textContent = 'No historical net worth data available.';
    emptyMsg.style.color = 'var(--text-muted)';
    container.appendChild(emptyMsg);
    return;
  }

  const isMobile = window.innerWidth < 600;
  const svgWidth = isMobile ? 480 : 840;
  const svgHeight = isMobile ? 240 : 280;
  const margin = isMobile
    ? { top: 15, right: 10, bottom: 30, left: 45 }
    : { top: 20, right: 20, bottom: 40, left: 75 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  const svg = createSVGElement('svg');
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  svg.classList.add('svg-chart');

  // Custom Area Fill Gradients
  const defs = createSVGElement('defs');

  const nwGrad = createSVGElement('linearGradient');
  nwGrad.setAttribute('id', 'grad-nw-trend-area');
  nwGrad.setAttribute('x1', '0%'); nwGrad.setAttribute('y1', '0%');
  nwGrad.setAttribute('x2', '0%'); nwGrad.setAttribute('y2', '100%');
  const nwStop1 = createSVGElement('stop'); nwStop1.setAttribute('offset', '0%'); nwStop1.setAttribute('stop-color', '#8b5cf6'); nwStop1.setAttribute('stop-opacity', '0.25');
  const nwStop2 = createSVGElement('stop'); nwStop2.setAttribute('offset', '100%'); nwStop2.setAttribute('stop-color', '#8b5cf6'); nwStop2.setAttribute('stop-opacity', '0.00');
  nwGrad.appendChild(nwStop1); nwGrad.appendChild(nwStop2);
  defs.appendChild(nwGrad);

  svg.appendChild(defs);

  // Find max and min values for Y axis scaling
  let maxVal = -Infinity;
  let minVal = Infinity;
  netWorthData.forEach(d => {
    if (d.netWorth > maxVal) maxVal = d.netWorth;
    if (d.netWorth < minVal) minVal = d.netWorth;
  });

  const range = maxVal - minVal;
  maxVal = maxVal + Math.max(10000, range * 0.1);
  minVal = minVal - Math.max(10000, range * 0.1);
  if (minVal > 0 && minVal < maxVal * 0.2) {
    minVal = 0;
  }

  // Draw Y grid and labels
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const ratio = i / ticks;
    const yVal = minVal + ratio * (maxVal - minVal);
    const y = margin.top + chartHeight - (ratio * chartHeight);

    if (i > 0 && i < ticks) {
      const line = createSVGElement('line');
      line.setAttribute('x1', margin.left.toString());
      line.setAttribute('y1', y.toString());
      line.setAttribute('x2', (margin.left + chartWidth).toString());
      line.setAttribute('y2', y.toString());
      line.classList.add('chart-grid-line');
      svg.appendChild(line);
    }

    const text = createSVGElement('text');
    text.setAttribute('x', (margin.left - 10).toString());
    text.setAttribute('y', (y + 4).toString());
    text.setAttribute('text-anchor', 'end');
    text.classList.add('chart-axis-text');
    text.textContent = formatCurrency(yVal);
    svg.appendChild(text);
  }

  const pointsCount = netWorthData.length;

  // Draw X axis grid and labels
  netWorthData.forEach((d, idx) => {
    const rx = pointsCount > 1 ? idx / (pointsCount - 1) : 0.5;
    const x = margin.left + (rx * chartWidth);

    // Vertical dotted lines (grid)
    if (idx > 0 && idx < pointsCount - 1) {
      const line = createSVGElement('line');
      line.setAttribute('x1', x.toString());
      line.setAttribute('y1', margin.top.toString());
      line.setAttribute('x2', x.toString());
      line.setAttribute('y2', (margin.top + chartHeight).toString());
      line.classList.add('chart-grid-line');
      svg.appendChild(line);
    }

    // Label X (show every 2nd label on mobile to avoid overcrowding)
    if (!isMobile || idx % 2 === 0) {
      const text = createSVGElement('text');
      text.setAttribute('x', x.toString());
      text.setAttribute('y', (margin.top + chartHeight + (isMobile ? 16 : 20)).toString());
      text.setAttribute('text-anchor', 'middle');
      text.classList.add('chart-axis-text');
      text.textContent = d.monthLabel;
      svg.appendChild(text);
    }
  });

  // Coordinate scaling logic
  const scalePoint = (d, idx) => {
    const rx = pointsCount > 1 ? idx / (pointsCount - 1) : 0.5;
    const valRatio = (d.netWorth - minVal) / (maxVal - minVal || 1);
    return {
      x: margin.left + (rx * chartWidth),
      y: margin.top + chartHeight - (valRatio * chartHeight),
      netWorth: d.netWorth,
      investments: d.investments,
      liabilities: d.liabilities,
      salaryCredited: d.salaryCredited,
      emisPaid: d.emisPaid,
      monthLabel: d.monthLabel,
      fullMonthLabel: d.fullMonthLabel
    };
  };

  const mapped = netWorthData.map(scalePoint);

  if (pointsCount > 1) {
    // Area fill under Net Worth line
    const areaPath = `M ${mapped[0].x} ${margin.top + chartHeight} ` +
      mapped.map(p => `L ${p.x} ${p.y}`).join(' ') +
      ` L ${mapped[mapped.length - 1].x} ${margin.top + chartHeight} Z`;
    const area = createSVGElement('path');
    area.setAttribute('d', areaPath);
    area.setAttribute('fill', 'url(#grad-nw-trend-area)');
    svg.appendChild(area);

    // Draw Net Worth Line (Violet)
    const polylineStr = mapped.map(p => `${p.x},${p.y}`).join(' ');
    const line = createSVGElement('polyline');
    line.setAttribute('points', polylineStr);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', '#8b5cf6');
    line.setAttribute('stroke-width', '3');
    svg.appendChild(line);
  }

  // Draw points/dots and tooltips
  mapped.forEach(p => {
    const dot = createSVGElement('circle');
    dot.setAttribute('cx', p.x.toString());
    dot.setAttribute('cy', p.y.toString());
    dot.setAttribute('r', '5');
    dot.setAttribute('fill', '#8b5cf6');
    dot.setAttribute('stroke', '#070913');
    dot.setAttribute('stroke-width', '2');
    dot.style.cursor = 'pointer';
    dot.style.transition = 'transform 0.15s ease';

    dot.addEventListener('mouseenter', () => dot.setAttribute('r', '7'));
    dot.addEventListener('mouseleave', () => {
      dot.setAttribute('r', '5');
      hideTooltip();
    });

    dot.addEventListener('mousemove', (e) => {
      showNetWorthTooltip(
        e,
        p.fullMonthLabel,
        p.netWorth,
        p.investments,
        p.liabilities,
        p.salaryCredited,
        p.emisPaid
      );
    });
    svg.appendChild(dot);
  });

  container.appendChild(svg);
}

// Show custom detailed tooltip for Net Worth Chart
function showNetWorthTooltip(event, title, netWorth, assets, liabilities, salary, emi) {
  const tooltip = document.getElementById('chart-tooltip');
  tooltip.replaceChildren();

  const tTitle = document.createElement('div');
  tTitle.className = 'chart-tooltip-title';
  tTitle.textContent = title;
  tooltip.appendChild(tTitle);

  const rows = [
    { label: 'Net Worth:', value: formatCurrency(netWorth), style: 'color: var(--color-primary); font-weight: 700;' },
    { label: 'Assets:', value: formatCurrency(assets), style: 'color: #6366f1;' },
    { label: 'Liabilities:', value: formatCurrency(liabilities), style: 'color: var(--color-danger);' },
    { label: 'Salary Credited:', value: formatCurrency(salary), style: 'color: var(--color-success);' },
    { label: 'EMIs Paid:', value: formatCurrency(emi), style: 'color: var(--color-danger);' }
  ];

  rows.forEach(r => {
    const row = document.createElement('div');
    row.className = 'chart-tooltip-row';
    const span = document.createElement('span');
    span.textContent = r.label;
    row.appendChild(span);

    const val = document.createElement('span');
    val.className = 'chart-tooltip-value';
    val.setAttribute('style', r.style);
    val.textContent = r.value;
    row.appendChild(val);

    tooltip.appendChild(row);
  });

  positionTooltip(tooltip, event);
}

function positionTooltip(tooltip, event) {
  const container = document.querySelector('.main-wrapper');
  if (!container) return;
  const rect = container.getBoundingClientRect();

  let x = event.clientX - rect.left + container.scrollLeft;
  let y = event.clientY - rect.top + container.scrollTop;

  const tooltipWidth = tooltip.offsetWidth || 180;
  const tooltipHeight = tooltip.offsetHeight || 100;

  const minX = tooltipWidth / 2 + 10;
  const maxX = container.scrollWidth - (tooltipWidth / 2) - 10;
  x = Math.max(minX, Math.min(maxX, x));

  if (y - tooltipHeight - 12 < container.scrollTop) {
    tooltip.style.transform = 'translate(-50%, 12px) scale(0.97)';
  } else {
    tooltip.style.transform = 'translate(-50%, -100%) scale(0.97)';
  }

  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
  tooltip.style.opacity = '1';
}

// Interactive Tooltip Helpers
function showTooltip(event, title, invested, current, pl, pct, customLabels = null) {
  const tooltip = document.getElementById('chart-tooltip');

  // Clear any existing children to build a fresh, secure DOM structure
  tooltip.replaceChildren();

  const tTitle = document.createElement('div');
  tTitle.id = 'chart-tooltip-title';
  tTitle.className = 'chart-tooltip-title';
  tTitle.textContent = title;
  tooltip.appendChild(tTitle);

  const labels = customLabels || ['Invested:', 'Current:', 'P&L:'];

  // Row 1
  const r1 = document.createElement('div');
  r1.className = 'chart-tooltip-row';
  const r1_lbl = document.createElement('span');
  r1_lbl.textContent = labels[0];
  const r1_val = document.createElement('span');
  r1_val.className = 'chart-tooltip-value';
  r1_val.textContent = formatCurrency(invested);
  r1.appendChild(r1_lbl);
  r1.appendChild(r1_val);
  tooltip.appendChild(r1);

  // Row 2
  const r2 = document.createElement('div');
  r2.className = 'chart-tooltip-row';
  const r2_lbl = document.createElement('span');
  r2_lbl.textContent = labels[1];
  const r2_val = document.createElement('span');
  r2_val.className = 'chart-tooltip-value';
  r2_val.textContent = formatCurrency(current);
  r2.appendChild(r2_lbl);
  r2.appendChild(r2_val);
  tooltip.appendChild(r2);

  // Row 3
  const r3 = document.createElement('div');
  r3.className = 'chart-tooltip-row';
  const r3_lbl = document.createElement('span');
  r3_lbl.textContent = labels[2];
  const r3_val = document.createElement('span');
  r3_val.className = 'chart-tooltip-value ' + (pl > 0 ? 'positive' : pl < 0 ? 'negative' : '');
  r3_val.textContent = formatCurrency(pl) + ` (${formatPercent(pct)})`;
  r3.appendChild(r3_lbl);
  r3.appendChild(r3_val);
  tooltip.appendChild(r3);

  positionTooltip(tooltip, event);
}

function hideTooltip() {
  const tooltip = document.getElementById('chart-tooltip');
  if (tooltip) tooltip.style.opacity = '0';
}

// Generate Financial Insights & Wealth Health Rating
function renderInsights(summary) {
  const insightsList = document.getElementById('insights-list-container');
  clearContainer(insightsList);

  if (investments.length === 0) {
    const emptyItem = document.createElement('div');
    emptyItem.textContent = 'Add investments to unlock wealth insights.';
    emptyItem.style.color = 'var(--text-muted)';
    emptyItem.style.fontSize = '0.9rem';
    insightsList.appendChild(emptyItem);

    // Default score
    updateHealthGauge(0, 'No Data');
    return;
  }

  const classTotals = {};
  investments.forEach(inv => {
    const cur = Number(inv.currentAmount);
    classTotals[inv.assetClass] = (classTotals[inv.assetClass] || 0) + cur;
  });

  const totalVal = summary.currentValue;

  // Calculate exposures
  const equityVal = (classTotals['indian-stock'] || 0) + (classTotals['us-stock'] || 0) + ((classTotals['indian-mutual-fund'] || 0) * 0.85); // assume 85% equity in MFs
  const debtVal = (classTotals['fd'] || 0) + (classTotals['bonds'] || 0) + (classTotals['epfo'] || 0) + (classTotals['savings'] || 0) + ((classTotals['indian-mutual-fund'] || 0) * 0.15);
  const goldVal = classTotals['gold'] || 0;

  const equityPct = totalVal > 0 ? (equityVal / totalVal) * 100 : 0;
  const goldPct = totalVal > 0 ? (goldVal / totalVal) * 100 : 0;
  const debtPct = totalVal > 0 ? (debtVal / totalVal) * 100 : 0;

  // Find top performing and bottom performing individual assets
  let bestAsset = null;
  let worstAsset = null;
  let bestPct = -Infinity;
  let worstPct = Infinity;

  investments.forEach(inv => {
    const invAmt = Number(inv.investedAmount);
    const curAmt = Number(inv.currentAmount);
    if (invAmt > 5000) { // filter out small ones
      const retPct = ((curAmt - invAmt) / invAmt) * 100;
      if (retPct > bestPct) {
        bestPct = retPct;
        bestAsset = inv;
      }
      if (retPct < worstPct) {
        worstPct = retPct;
        worstAsset = inv;
      }
    }
  });

  const insights = [];

  // Insight 1: Equity Profiling
  if (equityPct > 65) {
    insights.push({
      type: 'warning',
      title: 'Aggressive Equity Exposure',
      desc: `Equities represent ${equityPct.toFixed(0)}% of your portfolio. While great for inflation-beating long-term growth, be prepared for high volatility.`
    });
  } else if (equityPct >= 40 && equityPct <= 65) {
    insights.push({
      type: 'positive',
      title: 'Balanced Growth Profile',
      desc: `Your equity exposure is at a healthy ${equityPct.toFixed(0)}%. This provides a solid balance between capital appreciation and risk mitigation.`
    });
  } else if (equityPct > 0 && equityPct < 40) {
    insights.push({
      type: 'info',
      title: 'Conservative Wealth Profile',
      desc: `Equities make up only ${equityPct.toFixed(0)}% of your capital. Consider increasing stock/mutual fund exposure to avoid purchasing power erosion from inflation.`
    });
  }

  // Insight 2: Gold Hedge Checking
  if (goldPct >= 5 && goldPct <= 15) {
    insights.push({
      type: 'positive',
      title: 'Optimal Gold Allocation',
      desc: `Gold represents ${goldPct.toFixed(0)}% of your portfolio. This forms an excellent hedge against currency depreciation and market corrections.`
    });
  } else if (goldPct > 15) {
    insights.push({
      type: 'warning',
      title: 'Overweight in Precious Metals',
      desc: `Precious metals comprise ${goldPct.toFixed(0)}% of your assets. Gold is stable but lacks compounding yields; consider reallocating to growth assets.`
    });
  } else {
    insights.push({
      type: 'info',
      title: 'Low Inflation Hedge',
      desc: `Gold is less than 5% of your portfolio. Consider allocating a small portion (e.g. 5-10% in SGBs or Gold ETFs) as portfolio insurance.`
    });
  }

  // Insight 3: Performance Highlights
  if (bestAsset && bestPct > 10) {
    insights.push({
      type: 'positive',
      title: `Top Performer: ${bestAsset.name}`,
      desc: `Your investment has achieved a return of ${formatPercent(bestPct)}, growing to ${formatCurrency(bestAsset.currentAmount)}.`
    });
  }
  if (worstAsset && worstPct < -5) {
    insights.push({
      type: 'negative',
      title: `Underperformer Alert: ${worstAsset.name}`,
      desc: `This asset is currently down by ${formatPercent(worstPct)} (Current Value: ${formatCurrency(worstAsset.currentAmount)}). Monitor for potential changes in fundamentals.`
    });
  }

  // Insight 4: Liquidity / Cash Buffer
  const savingsVal = classTotals['savings'] || 0;
  const savingsPct = totalVal > 0 ? (savingsVal / totalVal) * 100 : 0;
  if (savingsPct > 20) {
    insights.push({
      type: 'info',
      title: 'High Liquid Cash Balance',
      desc: `Savings account represents ${savingsPct.toFixed(0)}% of your assets. Move excess liquidity to arbitrage funds or short-term FDs for higher tax-adjusted yields.`
    });
  } else if (savingsPct > 0 && savingsPct < 3) {
    insights.push({
      type: 'warning',
      title: 'Low Liquidity Buffer',
      desc: `Your cash account holds only ${savingsPct.toFixed(1)}% of your net worth. Ensure you maintain at least 3-6 months of expenses in highly liquid bank balances.`
    });
  }

  // Insight 5: Global Diversification Check
  const usStockVal = classTotals['us-stock'] || 0;
  const usStockPct = totalVal > 0 ? (usStockVal / totalVal) * 100 : 0;
  if (usStockPct > 15) {
    insights.push({
      type: 'positive',
      title: 'Strong Global Hedge',
      desc: `US stocks make up ${usStockPct.toFixed(0)}% of your portfolio, providing solid geographical diversification and protecting your wealth against local currency depreciation.`
    });
  } else if (usStockPct > 0 && usStockPct <= 15) {
    insights.push({
      type: 'info',
      title: 'International Exposure Active',
      desc: `You have a ${usStockPct.toFixed(1)}% allocation to international equities. Increasing this towards 10-15% can further lower overall portfolio correlation.`
    });
  } else {
    insights.push({
      type: 'warning',
      title: 'Zero International Diversification',
      desc: 'You have 0% allocated to global markets. Consider adding US equities or international mutual funds to hedge against geographical concentration risks.'
    });
  }

  // Insight 6: Asset Mix Check
  if (totalVal > 0) {
    insights.push({
      type: 'info',
      title: `Equity-to-Debt Mix: ${equityPct.toFixed(0)}:${debtPct.toFixed(0)}`,
      desc: `Your asset mix is ${equityPct.toFixed(0)}% equities and ${debtPct.toFixed(0)}% fixed income/debt. Ensure this fits your risk tolerance and age guidelines.`
    });
  }

  // Insight 7: Diversification Score Commentary
  const classCount = Object.keys(classTotals).length;
  if (classCount < 4) {
    insights.push({
      type: 'warning',
      title: 'Under-diversified Portfolio',
      desc: `Your capital spans only ${classCount} distinct asset classes. Spreading allocations into fixed deposits, gold, or debt mutual funds can reduce volatility.`
    });
  } else if (classCount >= 6) {
    insights.push({
      type: 'positive',
      title: 'Excellent Asset Class Variety',
      desc: `Your holdings are spread over ${classCount} different asset classes, creating a robust shield against major single-sector corrections.`
    });
  }

  // Liabilities and Debt Insights
  let totalLiabilitiesVal = 0;
  let totalMonthlyEMIs = 0;
  let weightedInterestSum = 0;

  liabilities.forEach(l => {
    totalLiabilitiesVal += Number(l.outstanding);
    totalMonthlyEMIs += Number(l.emi);
    weightedInterestSum += (Number(l.outstanding) * Number(l.rate));
  });

  const avgDebtRate = totalLiabilitiesVal > 0 ? (weightedInterestSum / totalLiabilitiesVal) : 0;
  const debtAssetRatio = totalVal > 0 ? (totalLiabilitiesVal / totalVal) * 100 : 0;

  // Insight 8: Debt-to-Asset Leverage
  if (totalLiabilitiesVal > 0) {
    if (debtAssetRatio > 50) {
      insights.push({
        type: 'negative',
        title: `High Debt Leverage (${debtAssetRatio.toFixed(0)}%)`,
        desc: `Your outstanding debt is over 50% of your current asset value. Consider minimizing discretionary expenses and prepaying high-interest loans.`
      });
    } else if (debtAssetRatio >= 20 && debtAssetRatio <= 50) {
      insights.push({
        type: 'warning',
        title: `Moderate Debt Leverage (${debtAssetRatio.toFixed(0)}%)`,
        desc: `Your debt-to-asset ratio is at a moderate level of ${debtAssetRatio.toFixed(0)}%. Avoid acquiring new liabilities and focus on paying down existing loans.`
      });
    } else {
      insights.push({
        type: 'positive',
        title: `Healthy Debt Leverage (${debtAssetRatio.toFixed(0)}%)`,
        desc: `Your debt-to-asset ratio is a very healthy ${debtAssetRatio.toFixed(0)}%. Excellent capital leverage safety.`
      });
    }
  } else {
    insights.push({
      type: 'positive',
      title: '100% Debt-Free Portfolio',
      desc: 'You have no outstanding liabilities or loan EMIs. Your assets represent pure wealth, maximizing your compounding growth potential.'
    });
  }

  // Insight 9: Emergency Reserve EMI Coverage
  let liquidAssets = 0;
  investments.forEach(inv => {
    if (inv.assetClass === 'savings' || inv.assetClass === 'fd') {
      liquidAssets += Number(inv.currentAmount);
    }
  });

  if (totalMonthlyEMIs > 0) {
    const monthsCoverage = liquidAssets / totalMonthlyEMIs;
    if (monthsCoverage < 3) {
      insights.push({
        type: 'negative',
        title: 'Critical Emergency Cover',
        desc: `Your liquid reserves (Savings + FD: ${formatCurrency(liquidAssets)}) cover less than 3 months of your loan EMIs (${formatCurrency(totalMonthlyEMIs)}/mo). Build up emergency savings immediately.`
      });
    } else if (monthsCoverage >= 3 && monthsCoverage < 6) {
      insights.push({
        type: 'warning',
        title: 'Low Emergency Buffer',
        desc: `Your liquid reserves cover ${monthsCoverage.toFixed(1)} months of loan EMIs. It is recommended to maintain at least 6 months of EMI coverage (${formatCurrency(totalMonthlyEMIs * 6)}).`
      });
    } else {
      insights.push({
        type: 'positive',
        title: 'Solid Emergency Cover',
        desc: `Your liquid reserves cover ${monthsCoverage.toFixed(0)} months of EMIs, providing a strong safety net against income disruptions.`
      });
    }
  }

  // Insight 10: High-cost Debt Refinancing alert
  if (totalLiabilitiesVal > 0 && avgDebtRate > 9.0) {
    insights.push({
      type: 'warning',
      title: `High Average Debt Cost (${avgDebtRate.toFixed(2)}%)`,
      desc: `Your weighted average interest rate is high. Consider making lump-sum prepayments or looking for lower-interest balance transfer options.`
    });
  }

  // Bind insights list to the DOM safely
  insights.forEach(insight => {
    const item = document.createElement('div');
    item.className = `insight-item ${insight.type}`;

    const iconWrapper = document.createElement('div');
    iconWrapper.classList.add('insight-icon');

    // Custom inline SVGs for insight alert icons
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    if (insight.type === 'positive') {
      path.setAttribute('d', 'M22 11.08V12a10 10 0 1 1-5.93-9.14');
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      poly.setAttribute('points', '22 4 12 14.01 9 11.01');
      svg.appendChild(path);
      svg.appendChild(poly);
    } else if (insight.type === 'warning' || insight.type === 'negative') {
      path.setAttribute('d', 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z');
      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('x1', '12'); line1.setAttribute('y1', '9'); line1.setAttribute('x2', '12'); line1.setAttribute('y2', '13');
      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('x1', '12'); line2.setAttribute('y1', '17'); line2.setAttribute('x2', '12.01'); line2.setAttribute('y2', '17');
      svg.appendChild(path);
      svg.appendChild(line1);
      svg.appendChild(line2);
    } else {
      path.setAttribute('d', 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z');
      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('x1', '12'); line1.setAttribute('y1', '16'); line1.setAttribute('x2', '12'); line1.setAttribute('y2', '12');
      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('x1', '12'); line2.setAttribute('y1', '8'); line2.setAttribute('x2', '12.01'); line2.setAttribute('y2', '8');
      svg.appendChild(path);
      svg.appendChild(line1);
      svg.appendChild(line2);
    }

    iconWrapper.appendChild(svg);

    const textCol = document.createElement('div');
    textCol.classList.add('insight-text-wrapper');

    const labelTitle = document.createElement('span');
    labelTitle.classList.add('insight-title');
    labelTitle.textContent = insight.title;

    const labelDesc = document.createElement('span');
    labelDesc.classList.add('insight-desc');
    labelDesc.textContent = insight.desc;

    textCol.appendChild(labelTitle);
    textCol.appendChild(labelDesc);

    item.appendChild(iconWrapper);
    item.appendChild(textCol);
    insightsList.appendChild(item);
  });

  // Calculate Wealth Diversification Score
  // Logic: points given for distribution + asset count
  let score = classCount * 10; // e.g., 6 classes = 60 points

  // Check concentration (no single class should exceed 45%)
  let maxConc = 0;
  Object.keys(classTotals).forEach(key => {
    maxConc = Math.max(maxConc, (classTotals[key] / totalVal) * 100);
  });

  if (maxConc <= 30) {
    score += 40;
  } else if (maxConc <= 45) {
    score += 25;
  } else if (maxConc <= 60) {
    score += 10;
  }

  // Cap at 100
  score = Math.min(100, score);

  let healthDescText = '';
  if (score > 80) {
    healthDescText = 'Your portfolio is <span>Highly Diversified</span>, minimizing category-specific shocks.';
  } else if (score >= 50) {
    healthDescText = 'Your portfolio is <span>Moderately Diversified</span>. Consider spreading new allocations.';
  } else {
    healthDescText = 'Your portfolio is <span>Concentrated</span>. High risk of volatility due to cluster holdings.';
  }

  updateHealthGauge(score, healthDescText);
}

// Update the dynamic SVG circle gauge
function updateHealthGauge(score, descHTMLText) {
  const gaugeFill = document.getElementById('health-gauge-fill');
  const scoreText = document.getElementById('health-score-text');
  const scoreDesc = document.getElementById('health-score-desc');

  scoreText.textContent = score.toString();

  // Wait, standard XSS check: description contains html (span). We can insert span securely by creating it, or parsing safely.
  // Instead of innerHTML, let's parse description string or set via secure element helpers
  clearContainer(scoreDesc);
  const parts = descHTMLText.split('<span>');
  if (parts.length > 1) {
    const beforeText = document.createTextNode(parts[0]);
    const highlightParts = parts[1].split('</span>');
    const span = document.createElement('span');
    span.textContent = highlightParts[0];
    span.style.color = score > 80 ? 'var(--color-success)' : score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';
    const afterText = document.createTextNode(highlightParts[1]);

    scoreDesc.appendChild(beforeText);
    scoreDesc.appendChild(span);
    scoreDesc.appendChild(afterText);
  } else {
    scoreDesc.textContent = descHTMLText;
  }

  // Circle circumference is 2 * Math.PI * r = 2 * 3.14159 * 55 = 345.57
  const circumference = 345.57;
  const strokeOffset = circumference - (score / 100) * circumference;

  gaugeFill.style.strokeDasharray = circumference.toString();
  gaugeFill.style.strokeDashoffset = strokeOffset.toString();

  // Change color of gauge dynamically
  if (score > 80) {
    gaugeFill.style.stroke = 'var(--color-success)';
  } else if (score >= 50) {
    gaugeFill.style.stroke = 'var(--color-warning)';
  } else {
    gaugeFill.style.stroke = 'var(--color-danger)';
  }
}

// Investments List View Rendering
let currentFilter = 'all';
let searchQuery = '';

function renderInvestments() {
  const container = document.getElementById('investments-list-container');
  clearContainer(container);

  // Filter investments
  const filtered = investments.filter(inv => {
    const matchesFilter = currentFilter === 'all' || inv.assetClass === currentFilter;
    const matchesSearch = inv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ((ASSET_CATEGORIES[inv.assetClass] && ASSET_CATEGORIES[inv.assetClass].label) || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (filtered.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.classList.add('empty-state');

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.5');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    icon.classList.add('empty-icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z');
    icon.appendChild(path);

    const title = document.createElement('h4');
    title.classList.add('empty-title');
    title.textContent = 'No investments found';

    const desc = document.createElement('p');
    desc.classList.add('empty-desc');
    desc.textContent = investments.length === 0
      ? 'Start by adding your stocks, mutual funds, gold, fixed deposits, and other savings.'
      : 'No active holdings match your filter criteria or search query.';

    const cta = document.createElement('button');
    cta.classList.add('btn', 'btn-primary');
    cta.textContent = 'Add Investment';
    cta.addEventListener('click', () => openModal());

    emptyState.appendChild(icon);
    emptyState.appendChild(title);
    emptyState.appendChild(desc);
    if (investments.length === 0) {
      emptyState.appendChild(cta);
    }

    container.appendChild(emptyState);
    return;
  }

  // Generate list cards
  filtered.forEach(inv => {
    const card = document.createElement('div');
    card.classList.add('investment-card');

    // Main column
    const colMain = document.createElement('div');
    colMain.classList.add('asset-main-info');

    const badgeRow = document.createElement('div');
    badgeRow.style.display = 'flex';
    badgeRow.style.alignItems = 'center';
    badgeRow.style.gap = '8px';

    const badge = document.createElement('span');
    badge.className = `asset-badge ${inv.assetClass}`;
    badge.textContent = (ASSET_CATEGORIES[inv.assetClass] && ASSET_CATEGORIES[inv.assetClass].label) || inv.assetClass;
    
    // Apply dynamic style if custom asset class
    const catObj = ASSET_CATEGORIES[inv.assetClass];
    if (catObj && !['indian-stock', 'indian-mutual-fund', 'us-stock', 'fd', 'gold', 'bonds', 'epfo', 'savings'].includes(inv.assetClass)) {
      badge.style.backgroundColor = `${catObj.color}22`;
      badge.style.color = catObj.color;
      badge.style.border = `1px solid ${catObj.color}44`;
    }
    badgeRow.appendChild(badge);

    if (inv.assetClass === 'savings' && inv.isDefaultSavings) {
      const defaultBadge = document.createElement('span');
      defaultBadge.className = 'asset-badge';
      defaultBadge.style.backgroundColor = 'var(--color-positive-subtle)';
      defaultBadge.style.color = 'var(--color-positive)';
      defaultBadge.textContent = 'Default';
      badgeRow.appendChild(defaultBadge);
    }

    if (inv.subtype && inv.subtype !== 'none') {
      const subtypeMap = {
        'large': 'Large Cap', 'mid': 'Mid Cap', 'small': 'Small Cap', 'flexi': 'Flexi Cap',
        'physical': 'Physical', 'etf': 'Gold ETF/SGB'
      };
      const subBadge = document.createElement('span');
      subBadge.classList.add('asset-badge');
      subBadge.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
      subBadge.style.color = 'var(--text-secondary)';
      subBadge.textContent = subtypeMap[inv.subtype] || inv.subtype;
      badgeRow.appendChild(subBadge);
    }

    const nameText = document.createElement('span');
    nameText.classList.add('asset-name');
    nameText.textContent = inv.name;

    colMain.appendChild(badgeRow);
    colMain.appendChild(nameText);

    // Invested Amount Column
    const colInvested = document.createElement('div');
    colInvested.classList.add('asset-data-col');
    const lblInvested = document.createElement('span');
    lblInvested.classList.add('asset-data-label');
    lblInvested.textContent = 'Invested';
    const valInvested = document.createElement('span');
    valInvested.classList.add('asset-data-value');
    valInvested.textContent = formatCurrency(inv.investedAmount);
    colInvested.appendChild(lblInvested);
    colInvested.appendChild(valInvested);

    // Current Amount Column
    const colCurrent = document.createElement('div');
    colCurrent.classList.add('asset-data-col');
    const lblCurrent = document.createElement('span');
    lblCurrent.classList.add('asset-data-label');
    lblCurrent.textContent = 'Current Value';
    const valCurrent = document.createElement('span');
    valCurrent.classList.add('asset-data-value');
    valCurrent.textContent = formatCurrency(inv.currentAmount);
    colCurrent.appendChild(lblCurrent);
    colCurrent.appendChild(valCurrent);

    // P&L Column
    const plAmt = inv.currentAmount - inv.investedAmount;
    const plPct = inv.investedAmount > 0 ? (plAmt / inv.investedAmount) * 100 : 0;

    const colPl = document.createElement('div');
    colPl.classList.add('pl-col');
    const valPl = document.createElement('span');
    valPl.className = 'pl-val ' + (plAmt > 0 ? 'positive' : plAmt < 0 ? 'negative' : 'neutral');
    valPl.textContent = formatCurrency(plAmt);

    const pctPl = document.createElement('span');
    pctPl.className = 'pl-pct ' + (plAmt > 0 ? 'positive' : plAmt < 0 ? 'negative' : 'neutral');
    pctPl.textContent = formatPercent(plPct);

    colPl.appendChild(valPl);
    colPl.appendChild(pctPl);

    // Last Updated Column
    const colDate = document.createElement('div');
    colDate.classList.add('asset-data-col');
    const lblDate = document.createElement('span');
    lblDate.classList.add('asset-data-label');
    lblDate.textContent = 'Last Updated';
    const valDate = document.createElement('span');
    valDate.style.fontSize = '0.8rem';
    valDate.style.color = 'var(--text-secondary)';
    valDate.textContent = new Date(inv.lastUpdated).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    colDate.appendChild(lblDate);
    colDate.appendChild(valDate);

    // Action column
    const colActions = document.createElement('div');
    colActions.classList.add('card-actions');

    if (inv.assetClass === 'indian-mutual-fund' && Number(inv.sipAmount) > 0) {
      // Add a sub-text under the name in colMain
      const sipSubText = document.createElement('div');
      sipSubText.style.fontSize = '0.75rem';
      sipSubText.style.color = 'var(--text-secondary)';
      sipSubText.style.marginTop = '4px';
      sipSubText.textContent = `SIP: ${formatCurrency(inv.sipAmount)} / month`;
      colMain.appendChild(sipSubText);

      // Create "+1 SIP" quick-action button
      const btnSipPaid = document.createElement('button');
      btnSipPaid.className = 'btn btn-secondary btn-sm';
      btnSipPaid.style.padding = '4px 8px';
      btnSipPaid.style.fontSize = '0.75rem';
      btnSipPaid.style.marginRight = '8px';
      btnSipPaid.textContent = '+1 SIP';
      btnSipPaid.title = `Record SIP payment of ${formatCurrency(inv.sipAmount)}`;
      btnSipPaid.addEventListener('click', (e) => {
        e.stopPropagation();
        recordSipPaid(inv.id);
      });
      colActions.appendChild(btnSipPaid);
    }

    if (inv.assetClass === 'savings') {
      const btnSetDefault = document.createElement('button');
      btnSetDefault.className = 'icon-btn';
      btnSetDefault.setAttribute('aria-label', inv.isDefaultSavings ? 'Default Savings Account' : 'Set as Default Savings');
      if (inv.isDefaultSavings) {
        btnSetDefault.style.color = '#eab308'; // Gold color for active default
      } else {
        btnSetDefault.style.color = 'var(--text-secondary)';
      }

      const starSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      starSvg.setAttribute('viewBox', '0 0 24 24');
      starSvg.setAttribute('fill', inv.isDefaultSavings ? 'currentColor' : 'none');
      starSvg.setAttribute('stroke', 'currentColor');
      starSvg.setAttribute('stroke-width', '2');
      starSvg.setAttribute('width', '16');
      starSvg.setAttribute('height', '16');

      const starPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      starPath.setAttribute('d', 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z');
      starSvg.appendChild(starPath);
      btnSetDefault.appendChild(starSvg);

      btnSetDefault.addEventListener('click', (e) => {
        e.stopPropagation();
        investments.forEach(item => {
          if (item.assetClass === 'savings') {
            item.isDefaultSavings = (item.id === inv.id);
          }
        });
        saveToStorage();
        renderInvestments();
      });
      colActions.appendChild(btnSetDefault);
    }

    const btnEdit = document.createElement('button');
    btnEdit.className = 'icon-btn';
    btnEdit.setAttribute('aria-label', 'Edit Investment');
    const editSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    editSvg.setAttribute('viewBox', '0 0 24 24');
    editSvg.setAttribute('fill', 'none');
    editSvg.setAttribute('stroke', 'currentColor');
    editSvg.setAttribute('stroke-width', '2');
    editSvg.setAttribute('width', '16');
    editSvg.setAttribute('height', '16');
    const editPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    editPath.setAttribute('d', 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z');
    editSvg.appendChild(editPath);
    btnEdit.appendChild(editSvg);
    btnEdit.addEventListener('click', () => openModal(inv));

    const btnDelete = document.createElement('button');
    btnDelete.className = 'icon-btn';
    btnDelete.setAttribute('aria-label', 'Delete Investment');
    btnDelete.style.color = 'var(--color-danger)';
    const deleteSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    deleteSvg.setAttribute('viewBox', '0 0 24 24');
    deleteSvg.setAttribute('fill', 'none');
    deleteSvg.setAttribute('stroke', 'currentColor');
    deleteSvg.setAttribute('stroke-width', '2');
    deleteSvg.setAttribute('width', '16');
    deleteSvg.setAttribute('height', '16');
    const deletePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    deletePath.setAttribute('d', 'M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2');
    deleteSvg.appendChild(deletePath);
    btnDelete.appendChild(deleteSvg);
    btnDelete.addEventListener('click', () => {
      // Direct modal confirmation not allowed, but secure custom modal is standard.
      // We will perform deletion immediately and log/notify or trigger deletion directly.
      if (confirm(`Are you sure you want to delete ${inv.name}?`)) {
        deleteInvestment(inv.id);
      }
    });

    colActions.appendChild(btnEdit);
    colActions.appendChild(btnDelete);

    // Assemble card
    card.appendChild(colMain);
    card.appendChild(colInvested);
    card.appendChild(colCurrent);
    card.appendChild(colPl);
    card.appendChild(colDate);
    card.appendChild(colActions);

    container.appendChild(card);
  });
}

function initFilterHandlers() {
  renderAssetFilterChips();

  const searchInput = document.getElementById('input-search');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderInvestments();
  });

  // Borrow & Lent filters
  const blContainer = document.getElementById('borrow-lent-filters-container');
  if (blContainer) {
    const blChips = blContainer.querySelectorAll('.filter-chip');
    blChips.forEach(chip => {
      chip.addEventListener('click', () => {
        blChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentBLFilter = chip.getAttribute('data-filter');
        renderBorrowLent();
      });
    });
  }

  const blSearch = document.getElementById('input-search-borrow-lent');
  if (blSearch) {
    blSearch.addEventListener('input', (e) => {
      searchQueryBorrowLent = e.target.value;
      renderBorrowLent();
    });
  }
}

// Add/Edit Modals logic
function openModal(invObj = null) {
  const overlay = document.getElementById('investment-modal');
  const titleText = document.getElementById('modal-title-text');

  // Form inputs
  const inputId = document.getElementById('input-id');
  const inputClass = document.getElementById('input-asset-class');
  const inputSubtype = document.getElementById('input-subtype');
  const inputName = document.getElementById('input-name');
  const inputInvested = document.getElementById('input-invested-amount');
  const inputCurrent = document.getElementById('input-current-amount');
  const inputPurchaseDate = document.getElementById('input-purchase-date');
  const inputSip = document.getElementById('input-sip-amount');
  const rowSip = document.getElementById('row-sip');

  const rowDefaultSavings = document.getElementById('row-default-savings');
  const inputDefaultSavings = document.getElementById('input-default-savings');

  if (invObj) {
    titleText.textContent = 'Edit Investment';
    inputId.value = invObj.id;
    updateAssetClassDropdown(invObj.assetClass);
    inputClass.value = invObj.assetClass;

    // Load subtypes first
    updateSubtypeOptions(invObj.assetClass);
    if (invObj.subtype && invObj.subtype !== 'none') {
      inputSubtype.value = invObj.subtype;
    }

    inputName.value = invObj.name;
    inputInvested.value = invObj.investedAmount;
    inputCurrent.value = invObj.currentAmount;
    inputPurchaseDate.value = invObj.purchaseDate || new Date().toISOString().slice(0, 10);

    if (invObj.assetClass === 'indian-mutual-fund') {
      rowSip.style.display = 'flex';
      inputSip.value = invObj.sipAmount || '';
    } else {
      rowSip.style.display = 'none';
      inputSip.value = '';
    }

    if (rowDefaultSavings && inputDefaultSavings) {
      if (invObj.assetClass === 'savings') {
        rowDefaultSavings.style.display = 'flex';
        inputDefaultSavings.checked = !!invObj.isDefaultSavings;
      } else {
        rowDefaultSavings.style.display = 'none';
        inputDefaultSavings.checked = false;
      }
    }
  } else {
    titleText.textContent = 'Add Investment';
    inputId.value = '';
    updateAssetClassDropdown('');
    inputClass.value = '';
    updateSubtypeOptions('');
    inputName.value = '';
    inputInvested.value = '';
    inputCurrent.value = '';
    inputPurchaseDate.value = new Date().toISOString().slice(0, 10);
    rowSip.style.display = 'none';
    inputSip.value = '';

    if (rowDefaultSavings && inputDefaultSavings) {
      rowDefaultSavings.style.display = 'none';
      inputDefaultSavings.checked = false;
    }
  }

  overlay.classList.add('active-modal');
}

function closeModal() {
  const overlay = document.getElementById('investment-modal');
  overlay.classList.remove('active-modal');
}

function updateSubtypeOptions(assetClass) {
  const group = document.getElementById('group-subtype');
  const select = document.getElementById('input-subtype');
  clearContainer(select);

  if (SUBTYPES[assetClass]) {
    group.style.display = 'flex';
    select.required = true;

    // Empty default option
    const def = document.createElement('option');
    def.value = '';
    def.disabled = true;
    def.selected = true;
    def.textContent = 'Select Subtype';
    select.appendChild(def);

    SUBTYPES[assetClass].forEach(opt => {
      const el = document.createElement('option');
      el.value = opt.value;
      el.textContent = opt.label;
      select.appendChild(el);
    });
  } else {
    group.style.display = 'none';
    select.required = false;
  }
}

function downloadPortfolioJSON() {
  const backupData = {
    investments: investments,
    liabilities: liabilities,
    borrowLent: borrowLent,
    salaries: salaries,
    expenses: expenses,
    expenseCategories: expenseCategories,
    globalBudget: globalBudget,
    monthlyBudgets: monthlyBudgets,
    assetCategories: ASSET_CATEGORIES
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'moyeniz.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleUploadJSON(file) {
  if (file.size > 5 * 1024 * 1024) {
    alert('File upload rejected. The backup file exceeds the 5MB size limit.');
    return;
  }
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      validateBackupSchema(data);

      investments = data.investments;
      liabilities = data.liabilities;
      borrowLent = Array.isArray(data.borrowLent) ? data.borrowLent : [];
      salaries = Array.isArray(data.salaries) ? data.salaries : [];
      expenses = Array.isArray(data.expenses) ? data.expenses : [];
      expenseCategories = Array.isArray(data.expenseCategories) ? data.expenseCategories : [...DEFAULT_EXPENSE_CATEGORIES];
      globalBudget = typeof data.globalBudget === 'number' ? data.globalBudget : 40000;
      monthlyBudgets = data.monthlyBudgets && typeof data.monthlyBudgets === 'object' ? data.monthlyBudgets : {};
      ASSET_CATEGORIES = data.assetCategories && typeof data.assetCategories === 'object' ? data.assetCategories : {...DEFAULT_ASSET_CATEGORIES};
      saveToStorage();

      // Close welcome wizard if open
      const welcome = document.getElementById('welcome-overlay');
      if (welcome) {
        welcome.classList.remove('active-modal');
      }

      // Re-render currently active view
      const activeTab = document.querySelector('.nav-link.active').getAttribute('data-tab');
      if (activeTab === 'dashboard') renderDashboard();
      if (activeTab === 'investments') renderInvestments();
      if (activeTab === 'liabilities') renderLiabilities();
      if (activeTab === 'borrow-lent') renderBorrowLent();
      if (activeTab === 'salary') renderSalaries();
      if (activeTab === 'expenses') renderExpenses();

      updateTopActions(activeTab);

      alert('Portfolio data loaded successfully!');
    } catch (err) {
      alert('Error parsing/validating JSON backup: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function initModalHandlers() {
  const btnClose = document.getElementById('btn-close-modal');
  const btnCancel = document.getElementById('btn-cancel-modal');
  const addBtn = document.getElementById('btn-add-investment');
  const selectClass = document.getElementById('input-asset-class');
  const form = document.getElementById('investment-form');

  // Dashboard Header PDF Report Action
  const btnDownloadPdfTop = document.getElementById('btn-download-pdf-top');
  if (btnDownloadPdfTop) {
    btnDownloadPdfTop.addEventListener('click', () => {
      generatePDFReport();
    });
  }

  // Inline Setup panel file dropper triggers
  const setupDropper = document.getElementById('setup-dropper');
  const setupFileInput = document.getElementById('setup-file-input');

  if (setupDropper && setupFileInput) {
    setupDropper.addEventListener('click', () => {
      setupFileInput.click();
    });

    setupFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleUploadJSON(e.target.files[0]);
      }
    });

    setupDropper.addEventListener('dragover', (e) => {
      e.preventDefault();
      setupDropper.classList.add('dragover');
    });

    setupDropper.addEventListener('dragleave', () => {
      setupDropper.classList.remove('dragover');
    });

    setupDropper.addEventListener('drop', (e) => {
      e.preventDefault();
      setupDropper.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        handleUploadJSON(e.dataTransfer.files[0]);
      }
    });
  }

  // Load sample data trigger
  const btnSetupSample = document.getElementById('setup-btn-sample');
  if (btnSetupSample) {
    btnSetupSample.addEventListener('click', () => {
      investments = [...SAMPLE_PORTFOLIO];
      liabilities = [...SAMPLE_LIABILITIES];
      borrowLent = [...SAMPLE_BORROW_LENT];
      salaries = [...SAMPLE_SALARIES];
      expenses = [...SAMPLE_EXPENSES];
      expenseCategories = [...DEFAULT_EXPENSE_CATEGORIES];
      ASSET_CATEGORIES = {...DEFAULT_ASSET_CATEGORIES};
      globalBudget = 40000;
      saveToStorage();
      renderAssetFilterChips();
      renderDashboard();
      updateTopActions('dashboard');
    });
  }

  // Start scratch trigger
  const btnSetupScratch = document.getElementById('setup-btn-scratch');
  if (btnSetupScratch) {
    btnSetupScratch.addEventListener('click', () => {
      investments = [];
      liabilities = [];
      borrowLent = [];
      salaries = [];
      expenses = [];
      expenseCategories = [...DEFAULT_EXPENSE_CATEGORIES];
      ASSET_CATEGORIES = {...DEFAULT_ASSET_CATEGORIES};
      globalBudget = 40000;
      saveToStorage();
      renderAssetFilterChips();
      renderDashboard();
      updateTopActions('dashboard');
    });
  }

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);
  if (addBtn) addBtn.addEventListener('click', () => openModal());
  const addBtnFloat = document.getElementById('btn-add-investment-float');
  if (addBtnFloat) addBtnFloat.addEventListener('click', () => openModal());

  // Custom Asset Class quick-add modal triggers
  const btnAddAssetClassQuick = document.getElementById('btn-add-asset-class-quick');
  const modalAssetClass = document.getElementById('asset-class-modal');
  const btnCloseAssetClass = document.getElementById('btn-close-asset-class-modal');
  const btnCancelAssetClass = document.getElementById('btn-cancel-asset-class-modal');
  const formAssetClass = document.getElementById('asset-class-form');

  if (btnAddAssetClassQuick) {
    btnAddAssetClassQuick.addEventListener('click', () => {
      if (modalAssetClass) modalAssetClass.classList.add('active-modal');
      const inputName = document.getElementById('input-asset-class-name');
      if (inputName) {
        inputName.value = '';
        inputName.focus();
      }
    });
  }

  const closeAssetClassModal = () => {
    if (modalAssetClass) modalAssetClass.classList.remove('active-modal');
  };

  if (btnCloseAssetClass) btnCloseAssetClass.addEventListener('click', closeAssetClassModal);
  if (btnCancelAssetClass) btnCancelAssetClass.addEventListener('click', closeAssetClassModal);

  if (formAssetClass) {
    formAssetClass.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputName = document.getElementById('input-asset-class-name');
      const inputColor = document.getElementById('input-asset-class-color');
      if (!inputName || !inputColor) return;

      const name = inputName.value.trim();
      const color = inputColor.value;
      if (!name) return;

      const key = 'custom-' + name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      
      // Save custom class
      ASSET_CATEGORIES[key] = {
        label: name,
        color: color,
        colorDark: darkenColor(color),
        gradient: `grad-${key}`
      };
      saveToStorage();

      // Populate dropdown with new class selected
      updateAssetClassDropdown(key);
      
      // Update the asset filter chips in the main list view
      renderAssetFilterChips();

      // Hide subtype row since custom class doesn't have default subtypes
      const groupSubtype = document.getElementById('group-subtype');
      if (groupSubtype) groupSubtype.style.display = 'none';
      const rowSip = document.getElementById('row-sip');
      if (rowSip) rowSip.style.display = 'none';
      const rowDefaultSavings = document.getElementById('row-default-savings');
      if (rowDefaultSavings) rowDefaultSavings.style.display = 'none';

      closeAssetClassModal();
    });
  }

  selectClass.addEventListener('change', (e) => {
    updateSubtypeOptions(e.target.value);
    const rowSip = document.getElementById('row-sip');
    if (e.target.value === 'indian-mutual-fund') {
      rowSip.style.display = 'flex';
    } else {
      rowSip.style.display = 'none';
      document.getElementById('input-sip-amount').value = '';
    }

    const rowDefaultSavings = document.getElementById('row-default-savings');
    if (rowDefaultSavings) {
      if (e.target.value === 'savings') {
        rowDefaultSavings.style.display = 'flex';
      } else {
        rowDefaultSavings.style.display = 'none';
        const checkbox = document.getElementById('input-default-savings');
        if (checkbox) checkbox.checked = false;
      }
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveInvestmentForm();
  });

  // Liability Modal Handlers
  const btnCloseL = document.getElementById('btn-close-liability-modal');
  const btnCancelL = document.getElementById('btn-cancel-liability-modal');
  const btnAddL = document.getElementById('btn-add-liability');
  const formL = document.getElementById('liability-form');

  if (btnCloseL) btnCloseL.addEventListener('click', closeLiabilityModal);
  if (btnCancelL) btnCancelL.addEventListener('click', closeLiabilityModal);
  if (btnAddL) btnAddL.addEventListener('click', () => openLiabilityModal());
  if (formL) {
    formL.addEventListener('submit', (e) => {
      e.preventDefault();
      saveLiabilityForm();
    });
  }

  const searchL = document.getElementById('input-search-liabilities');
  if (searchL) {
    searchL.addEventListener('input', (e) => {
      searchQueryLiabilities = e.target.value;
      renderLiabilities();
    });
  }

  // Borrow & Lent modal bindings
  const btnCloseBL = document.getElementById('btn-close-borrow-lent-modal');
  const btnCancelBL = document.getElementById('btn-cancel-borrow-lent-modal');
  const btnAddBL = document.getElementById('btn-add-borrow-lent');
  const formBL = document.getElementById('borrow-lent-form');

  if (btnCloseBL) btnCloseBL.addEventListener('click', closeBorrowLentModal);
  if (btnCancelBL) btnCancelBL.addEventListener('click', closeBorrowLentModal);
  if (btnAddBL) btnAddBL.addEventListener('click', () => openBorrowLentModal());
  if (formBL) {
    formBL.addEventListener('submit', (e) => {
      e.preventDefault();
      saveBorrowLentForm();
    });
  }

  // Payment log modal bindings
  const btnClosePay = document.getElementById('btn-close-payment-modal');
  const btnCancelPay = document.getElementById('btn-cancel-payment-modal');
  const formPay = document.getElementById('payment-log-form');

  if (btnClosePay) btnClosePay.addEventListener('click', closePaymentModal);
  if (btnCancelPay) btnCancelPay.addEventListener('click', closePaymentModal);
  if (formPay) {
    formPay.addEventListener('submit', (e) => {
      e.preventDefault();
      savePaymentForm();
    });
  }

  // Salary Modal Handlers
  const btnCloseS = document.getElementById('btn-close-salary-modal');
  const btnCancelS = document.getElementById('btn-cancel-salary-modal');
  const btnAddS = document.getElementById('btn-add-salary');
  const formS = document.getElementById('salary-form');

  if (btnCloseS) btnCloseS.addEventListener('click', closeSalaryModal);
  if (btnCancelS) btnCancelS.addEventListener('click', closeSalaryModal);
  if (btnAddS) btnAddS.addEventListener('click', () => openSalaryModal());
  if (formS) {
    formS.addEventListener('submit', (e) => {
      e.preventDefault();
      saveSalaryForm();
    });
  }

  const searchS = document.getElementById('input-search-salaries');
  if (searchS) {
    searchS.addEventListener('input', (e) => {
      searchQuerySalaries = e.target.value;
      renderSalaries();
    });
  }

  // Expense Modal Handlers
  const btnCloseE = document.getElementById('btn-close-expense-modal');
  const btnCancelEStep1 = document.getElementById('btn-cancel-expense-modal-step1');
  const btnCancelEStep2 = document.getElementById('btn-cancel-expense-modal-step2');
  const btnAddE = document.getElementById('btn-add-expense');
  const formE = document.getElementById('expense-form');
  const btnAddCatQuick = document.getElementById('btn-add-category-quick');
  const btnCalcBack = document.getElementById('btn-calc-back-to-step1');
  const btnCalcNext = document.getElementById('btn-calc-next');

  if (btnCloseE) btnCloseE.addEventListener('click', closeExpenseModal);
  if (btnCancelEStep1) btnCancelEStep1.addEventListener('click', closeExpenseModal);
  if (btnCancelEStep2) btnCancelEStep2.addEventListener('click', closeExpenseModal);
  if (btnAddE) btnAddE.addEventListener('click', () => openExpenseModal());
  if (formE) {
    formE.addEventListener('submit', (e) => {
      e.preventDefault();
      saveExpenseForm();
    });
  }
  if (btnAddCatQuick) btnAddCatQuick.addEventListener('click', () => openCategoryModal());

  // Calculator wizard buttons
  if (btnCalcBack) {
    btnCalcBack.addEventListener('click', () => {
      showExpenseWizardStep(1);
    });
  }

  if (btnCalcNext) {
    btnCalcNext.addEventListener('click', () => {
      try {
        const amount = evaluateExpression(currentCalcExpression);
        if (amount <= 0 || isNaN(amount)) {
          showCalculatorError('Amount must be > 0');
          return;
        }
        const inputAmount = document.getElementById('input-expense-amount');
        const finalAmtLabel = document.getElementById('calc-final-amount-label');
        if (inputAmount) inputAmount.value = amount;
        if (finalAmtLabel) finalAmtLabel.textContent = `₹${amount}`;
        showExpenseWizardStep(2);
      } catch (err) {
        showCalculatorError('Error: ' + err.message);
      }
    });
  }

  // Calculator grid buttons
  document.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-val');
      if (val) {
        handleCalculatorInput(val);
      }
    });
  });

  // Keyboard support for calculator step
  window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('expense-modal');
    const step1 = document.getElementById('expense-wizard-step-1');
    if (modal && modal.classList.contains('active-modal') && step1 && step1.style.display !== 'none') {
      const key = e.key;

      // Stop typing from propagating to inputs/selects
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }

      if (['Backspace', 'Enter', '/', '*'].includes(key)) {
        e.preventDefault();
      }

      if ('0123456789'.includes(key)) {
        handleCalculatorInput(key);
      } else if (key === '.') {
        handleCalculatorInput('.');
      } else if (['+', '-', '*', '/'].includes(key)) {
        handleCalculatorInput(key);
      } else if (key === 'Backspace') {
        handleCalculatorInput('back');
      } else if (key === 'Escape') {
        closeExpenseModal();
      } else if (key === 'Enter') {
        if (btnCalcNext) btnCalcNext.click();
      } else if (key.toLowerCase() === 'c') {
        handleCalculatorInput('C');
      }
    }
  });

  // Expense History Collapse Toggle
  const btnToggleHistory = document.getElementById('btn-toggle-expense-history');
  const historyContent = document.getElementById('expense-history-collapse-content');
  const arrowToggle = document.getElementById('arrow-toggle-expense-history');
  const labelToggle = document.getElementById('toggle-history-label');

  if (btnToggleHistory && historyContent && arrowToggle && labelToggle) {
    btnToggleHistory.addEventListener('click', () => {
      const isCollapsed = historyContent.style.display === 'none';
      if (isCollapsed) {
        historyContent.style.display = 'block';
        arrowToggle.style.transform = 'rotate(180deg)';
        labelToggle.textContent = 'Hide';
      } else {
        historyContent.style.display = 'none';
        arrowToggle.style.transform = 'rotate(0deg)';
        labelToggle.textContent = 'Show';
        // Scroll toggle button into view to reset scroll height and fix empty bottom space
        btnToggleHistory.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  // Category Modal Handlers
  const btnCloseC = document.getElementById('btn-close-category-modal');
  const btnCancelC = document.getElementById('btn-cancel-category-modal');
  const btnManageCatMain = document.getElementById('btn-manage-categories-main');
  const formC = document.getElementById('category-form');
  const emojiGrid = document.getElementById('category-emoji-grid');
  const inputEmoji = document.getElementById('input-category-emoji');

  if (btnCloseC) btnCloseC.addEventListener('click', closeCategoryModal);
  if (btnCancelC) btnCancelC.addEventListener('click', closeCategoryModal);
  if (btnManageCatMain) btnManageCatMain.addEventListener('click', () => openCategoryModal());
  if (formC) {
    formC.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCategoryForm();
    });
  }

  if (emojiGrid) {
    emojiGrid.addEventListener('click', (e) => {
      const item = e.target.closest('.emoji-item');
      if (item) {
        document.querySelectorAll('.emoji-item').forEach(el => el.classList.remove('active-emoji'));
        item.classList.add('active-emoji');
        if (inputEmoji) inputEmoji.value = item.getAttribute('data-emoji');
      }
    });
  }

  if (inputEmoji) {
    inputEmoji.addEventListener('input', (e) => {
      const val = e.target.value;
      document.querySelectorAll('.emoji-item').forEach(el => el.classList.remove('active-emoji'));
      const match = document.querySelector(`.emoji-item[data-emoji="${val}"]`);
      if (match) match.classList.add('active-emoji');
    });
  }

  // Budget Modal Handlers
  const btnEditBudget = document.getElementById('btn-edit-budget');
  const btnCloseB = document.getElementById('btn-close-budget-modal');
  const btnCancelB = document.getElementById('btn-cancel-budget-modal');
  const formB = document.getElementById('budget-form');

  if (btnEditBudget) btnEditBudget.addEventListener('click', () => openBudgetModal());
  if (btnCloseB) btnCloseB.addEventListener('click', closeBudgetModal);
  if (btnCancelB) btnCancelB.addEventListener('click', closeBudgetModal);
  if (formB) {
    formB.addEventListener('submit', (e) => {
      e.preventDefault();
      saveBudgetForm();
    });
  }

  // Filters and Search for Expenses
  const filterExpenseMonth = document.getElementById('input-expense-month');
  if (filterExpenseMonth) {
    filterExpenseMonth.addEventListener('change', (e) => {
      selectedExpenseMonth = e.target.value;
      renderExpenses();
    });
  }

  const searchExpenses = document.getElementById('input-search-expenses');
  if (searchExpenses) {
    searchExpenses.addEventListener('input', (e) => {
      searchQueryExpenses = e.target.value;
      renderExpenses();
    });
  }
}

function saveInvestmentForm() {
  const id = document.getElementById('input-id').value;
  const assetClass = document.getElementById('input-asset-class').value;
  const subtype = document.getElementById('input-subtype').value || 'none';
  const name = document.getElementById('input-name').value;
  const investedAmount = Number(document.getElementById('input-invested-amount').value);
  const currentAmount = Number(document.getElementById('input-current-amount').value);
  const purchaseDate = document.getElementById('input-purchase-date').value || new Date().toISOString().slice(0, 10);
  const sipAmount = assetClass === 'indian-mutual-fund' ? Number(document.getElementById('input-sip-amount').value) || 0 : 0;

  const checkbox = document.getElementById('input-default-savings');
  const isDefaultSavings = (assetClass === 'savings' && checkbox) ? checkbox.checked : false;

  let savedId = id;
  if (id) {
    // Edit mode
    const idx = investments.findIndex(inv => inv.id === id);
    if (idx !== -1) {
      investments[idx] = {
        ...investments[idx],
        assetClass,
        subtype,
        name,
        investedAmount,
        currentAmount,
        purchaseDate,
        sipAmount,
        isDefaultSavings,
        lastUpdated: new Date().toISOString()
      };
    }
  } else {
    // Add mode
    const newId = crypto.randomUUID ? crypto.randomUUID() : 'rand-' + Math.random().toString(36).substring(2, 9);
    savedId = newId;
    investments.push({
      id: newId,
      assetClass,
      subtype,
      name,
      investedAmount,
      currentAmount,
      purchaseDate,
      sipAmount,
      isDefaultSavings,
      lastUpdated: new Date().toISOString()
    });
  }

  // Clear default status from other accounts
  if (isDefaultSavings) {
    investments.forEach(inv => {
      if (inv.id !== savedId && inv.assetClass === 'savings') {
        inv.isDefaultSavings = false;
      }
    });
  }

  saveToStorage();
  closeModal();

  // Re-render current active view
  const activeTab = document.querySelector('.nav-link.active').getAttribute('data-tab');
  if (activeTab === 'dashboard') renderDashboard();
  if (activeTab === 'investments') renderInvestments();
}

function deleteInvestment(id) {
  investments = investments.filter(inv => inv.id !== id);
  saveToStorage();
  renderInvestments();
}

// Projections Page Compound Calculator Line Chart
function renderProjections() {
  const summary = getPortfolioSummary();
  const baseAmt = summary.currentValue;

  document.getElementById('span-proj-base-amt').textContent = formatCurrency(baseAmt);

  const sipAmt = Number(document.getElementById('slider-sip').value);
  const years = Number(document.getElementById('slider-years').value);
  const ror = Number(document.getElementById('slider-ror').value);

  // Update numerical labels
  document.getElementById('val-sip-amt').textContent = formatCurrency(sipAmt);
  document.getElementById('val-years').textContent = `${years} Year${years > 1 ? 's' : ''}`;
  document.getElementById('val-ror').textContent = `${ror}%`;

  // Compound Math
  const monthlyRate = ror / 100 / 12;
  const totalMonths = years * 12;

  let currentProj = baseAmt;
  let currentInvested = baseAmt;
  const pointsProj = [{ year: 0, value: baseAmt }];
  const pointsInvested = [{ year: 0, value: baseAmt }];

  for (let month = 1; month <= totalMonths; month++) {
    currentProj = currentProj * (1 + monthlyRate) + sipAmt;
    currentInvested += sipAmt;

    // Log data boundaries annually
    if (month % 12 === 0) {
      pointsProj.push({ year: month / 12, value: currentProj });
      pointsInvested.push({ year: month / 12, value: currentInvested });
    }
  }

  const totalProjVal = currentProj;
  const totalInvestedVal = currentInvested;
  const wealthGains = totalProjVal - totalInvestedVal;

  document.getElementById('val-proj-invested').textContent = formatCurrency(totalInvestedVal);
  document.getElementById('val-proj-gains').textContent = formatCurrency(wealthGains);
  document.getElementById('val-proj-total').textContent = formatCurrency(totalProjVal);

  // Render Line Chart
  renderProjectionLineChart(pointsProj, pointsInvested, years);
}

function renderProjectionLineChart(projData, investedData, maxYears) {
  const container = document.getElementById('projection-chart-container');
  clearContainer(container);

  const isMobile = window.innerWidth < 600;
  const svgWidth = isMobile ? 480 : 600;
  const svgHeight = isMobile ? 240 : 280;
  const margin = isMobile
    ? { top: 15, right: 10, bottom: 30, left: 45 }
    : { top: 20, right: 20, bottom: 40, left: 70 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  const svg = createSVGElement('svg');
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  svg.classList.add('svg-chart');

  appendSVGDefs(svg);

  // Max Y value
  const maxVal = projData[projData.length - 1].value * 1.05;

  // Draw Y grid and labels
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const ratio = i / ticks;
    const yVal = maxVal * ratio;
    const y = margin.top + chartHeight - (ratio * chartHeight);

    if (i > 0) {
      const line = createSVGElement('line');
      line.setAttribute('x1', margin.left.toString());
      line.setAttribute('y1', y.toString());
      line.setAttribute('x2', (margin.left + chartWidth).toString());
      line.setAttribute('y2', y.toString());
      line.classList.add('chart-grid-line');
      svg.appendChild(line);
    }

    const text = createSVGElement('text');
    text.setAttribute('x', (margin.left - 10).toString());
    text.setAttribute('y', (y + 4).toString());
    text.setAttribute('text-anchor', 'end');
    text.classList.add('chart-axis-text');

    let label = '';
    if (yVal >= 10000000) {
      label = '₹' + (yVal / 10000000).toFixed(1) + 'Cr';
    } else if (yVal >= 100000) {
      label = '₹' + (yVal / 100000).toFixed(0) + 'L';
    } else if (yVal >= 1000) {
      label = '₹' + (yVal / 1000).toFixed(0) + 'k';
    } else {
      label = '₹' + yVal.toFixed(0);
    }
    text.textContent = label;
    svg.appendChild(text);
  }

  // Draw X axis grid and labels (every 2/5 years based on total range)
  const step = maxYears <= 10 ? 1 : maxYears <= 20 ? 2 : 5;
  for (let yr = 0; yr <= maxYears; yr += step) {
    const ratio = yr / maxYears;
    const x = margin.left + (ratio * chartWidth);

    // Label X
    const text = createSVGElement('text');
    text.setAttribute('x', x.toString());
    text.setAttribute('y', (margin.top + chartHeight + (isMobile ? 16 : 20)).toString());
    text.setAttribute('text-anchor', 'middle');
    text.classList.add('chart-axis-text');
    text.textContent = `Yr ${yr}`;
    svg.appendChild(text);
  }

  // Map points to SVG coordinates
  const scalePoint = (p) => {
    const rx = p.year / maxYears;
    const ry = p.value / maxVal;
    return {
      x: margin.left + (rx * chartWidth),
      y: margin.top + chartHeight - (ry * chartHeight),
      value: p.value,
      year: p.year
    };
  };

  const mappedProj = projData.map(scalePoint);
  const mappedInvested = investedData.map(scalePoint);

  // Create Polyline string
  const polylineStr = (points) => points.map(p => `${p.x},${p.y}`).join(' ');

  // Area fill below Wealth line
  const areaPathStr = `M ${mappedProj[0].x} ${margin.top + chartHeight} ` +
    mappedProj.map(p => `L ${p.x} ${p.y}`).join(' ') +
    ` L ${mappedProj[mappedProj.length - 1].x} ${margin.top + chartHeight} Z`;

  const area = createSVGElement('path');
  area.setAttribute('d', areaPathStr);
  area.setAttribute('fill', 'url(#grad-proj-area)');
  svg.appendChild(area);

  // Invested Line (Gray dashed line)
  const lineInv = createSVGElement('polyline');
  lineInv.setAttribute('points', polylineStr(mappedInvested));
  lineInv.setAttribute('fill', 'none');
  lineInv.setAttribute('stroke', 'var(--text-muted)');
  lineInv.setAttribute('stroke-width', '2');
  lineInv.setAttribute('stroke-dasharray', '5,5');
  svg.appendChild(lineInv);

  // Projected Line (Indigo Solid Line)
  const lineProj = createSVGElement('polyline');
  lineProj.setAttribute('points', polylineStr(mappedProj));
  lineProj.setAttribute('fill', 'none');
  lineProj.setAttribute('stroke', 'var(--color-primary)');
  lineProj.setAttribute('stroke-width', '3');
  svg.appendChild(lineProj);

  // Plot dots and attach Tooltips
  mappedProj.forEach((p, idx) => {
    const dot = createSVGElement('circle');
    dot.setAttribute('cx', p.x.toString());
    dot.setAttribute('cy', p.y.toString());
    dot.setAttribute('r', '5');
    dot.setAttribute('fill', 'var(--color-primary)');
    dot.setAttribute('stroke', '#070913');
    dot.setAttribute('stroke-width', '2');
    dot.style.cursor = 'pointer';
    dot.style.transition = 'transform 0.15s ease';

    dot.addEventListener('mouseenter', () => {
      dot.setAttribute('r', '7');
    });

    // Attach Tooltip
    dot.addEventListener('mousemove', (e) => {
      const investedAtYr = mappedInvested[idx].value;
      const totalAtYr = p.value;
      const gainAtYr = totalAtYr - investedAtYr;
      const returnPct = investedAtYr > 0 ? (gainAtYr / investedAtYr) * 100 : 0;

      showTooltip(e, `Year ${p.year} Growth`, investedAtYr, totalAtYr, gainAtYr, returnPct);
    });

    dot.addEventListener('mouseleave', () => {
      dot.setAttribute('r', '5');
      hideTooltip();
    });

    svg.appendChild(dot);
  });

  container.appendChild(svg);
}

// Dynamic Heatmaps Rendering
function renderHeatmaps() {
  const profitContainer = document.getElementById('profit-heatmap-container');
  const lossContainer = document.getElementById('loss-heatmap-container');
  clearContainer(profitContainer);
  clearContainer(lossContainer);

  const profits = [];
  const losses = [];

  investments.forEach(inv => {
    const invAmt = Number(inv.investedAmount);
    const curAmt = Number(inv.currentAmount);
    if (invAmt === 0) return;

    const diff = curAmt - invAmt;
    const pct = (diff / invAmt) * 100;

    if (diff > 0) {
      profits.push({ inv, diff, pct });
    } else if (diff < 0) {
      losses.push({ inv, diff, pct });
    }
  });

  profits.sort((a, b) => b.pct - a.pct);
  losses.sort((a, b) => a.pct - b.pct);

  if (profits.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'No profitable assets.';
    empty.style.color = 'var(--text-muted)';
    empty.style.fontSize = '0.8rem';
    empty.style.gridColumn = '1 / -1';
    profitContainer.appendChild(empty);
  } else {
    profits.forEach(item => {
      const opacity = Math.min(0.85, 0.12 + (item.pct / 40) * 0.73);
      const block = document.createElement('div');
      block.className = 'heatmap-block';
      block.style.backgroundColor = `rgba(16, 185, 129, ${opacity})`;
      block.style.color = opacity > 0.45 ? '#ffffff' : 'var(--text-primary)';

      const name = document.createElement('span');
      name.className = 'heatmap-block-name';
      name.textContent = item.inv.name;

      const val = document.createElement('span');
      val.className = 'heatmap-block-val';
      val.textContent = formatCurrency(item.inv.currentAmount);

      const pct = document.createElement('span');
      pct.className = 'heatmap-block-pct';
      pct.textContent = `+${item.pct.toFixed(1)}%`;
      if (opacity > 0.45) {
        pct.style.color = '#ffffff';
      } else {
        pct.style.color = 'var(--color-success)';
      }

      block.appendChild(name);
      block.appendChild(val);
      block.appendChild(pct);

      block.addEventListener('mousemove', (e) => {
        showTooltip(e, item.inv.name, item.inv.investedAmount, item.inv.currentAmount, item.diff, item.pct);
      });
      block.addEventListener('mouseleave', hideTooltip);

      profitContainer.appendChild(block);
    });
  }

  if (losses.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'No assets in loss.';
    empty.style.color = 'var(--text-muted)';
    empty.style.fontSize = '0.8rem';
    empty.style.gridColumn = '1 / -1';
    lossContainer.appendChild(empty);
  } else {
    losses.forEach(item => {
      const absPct = Math.abs(item.pct);
      const opacity = Math.min(0.85, 0.12 + (absPct / 20) * 0.73);
      const block = document.createElement('div');
      block.className = 'heatmap-block';
      block.style.backgroundColor = `rgba(244, 63, 94, ${opacity})`;
      block.style.color = opacity > 0.45 ? '#ffffff' : 'var(--text-primary)';

      const name = document.createElement('span');
      name.className = 'heatmap-block-name';
      name.textContent = item.inv.name;

      const val = document.createElement('span');
      val.className = 'heatmap-block-val';
      val.textContent = formatCurrency(item.inv.currentAmount);

      const pct = document.createElement('span');
      pct.className = 'heatmap-block-pct';
      pct.textContent = `${item.pct.toFixed(1)}%`;
      if (opacity > 0.45) {
        pct.style.color = '#ffffff';
      } else {
        pct.style.color = 'var(--color-danger)';
      }

      block.appendChild(name);
      block.appendChild(val);
      block.appendChild(pct);

      block.addEventListener('mousemove', (e) => {
        showTooltip(e, item.inv.name, item.inv.investedAmount, item.inv.currentAmount, item.diff, item.pct);
      });
      block.addEventListener('mouseleave', hideTooltip);

      lossContainer.appendChild(block);
    });
  }
}

// Liabilities View Logic
function renderLiabilities() {
  const container = document.getElementById('liabilities-list-container');
  clearContainer(container);

  let totalOutstanding = 0;
  let totalEmi = 0;
  let weightedInterestSum = 0;

  liabilities.forEach(l => {
    totalOutstanding += Number(l.outstanding);
    totalEmi += Number(l.emi);
    weightedInterestSum += (Number(l.outstanding) * Number(l.rate));
  });

  const avgRate = totalOutstanding > 0 ? (weightedInterestSum / totalOutstanding) : 0;
  const summary = getPortfolioSummary();
  const assetsVal = summary.currentValue;
  const debtAssetRatio = assetsVal > 0 ? (totalOutstanding / assetsVal) * 100 : 0;

  document.getElementById('val-total-liabilities').textContent = formatCurrency(totalOutstanding);
  document.getElementById('val-total-emis').textContent = formatCurrency(totalEmi);
  document.getElementById('val-debt-asset-ratio').textContent = debtAssetRatio.toFixed(1) + '%';
  document.getElementById('val-avg-debt-rate').textContent = avgRate.toFixed(2) + '%';

  const filtered = liabilities.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(searchQueryLiabilities.toLowerCase()) ||
      (LIABILITY_TYPES[l.type] || '').toLowerCase().includes(searchQueryLiabilities.toLowerCase());
    return matchesSearch;
  });

  if (filtered.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.classList.add('empty-state');

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.5');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    icon.classList.add('empty-icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6');
    icon.appendChild(path);

    const title = document.createElement('h4');
    title.classList.add('empty-title');
    title.textContent = 'No liabilities found';

    const desc = document.createElement('p');
    desc.classList.add('empty-desc');
    desc.textContent = liabilities.length === 0
      ? 'Start tracking your debts, home loans, car loans, and EMIs to monitor leverage.'
      : 'No active loans match your search criteria.';

    emptyState.appendChild(icon);
    emptyState.appendChild(title);
    emptyState.appendChild(desc);

    container.appendChild(emptyState);
    return;
  }

  filtered.forEach(l => {
    const card = document.createElement('div');
    card.classList.add('investment-card');

    const colMain = document.createElement('div');
    colMain.classList.add('asset-main-info');

    const badgeRow = document.createElement('div');
    badgeRow.style.display = 'flex';
    badgeRow.style.alignItems = 'center';
    badgeRow.style.gap = '8px';

    const badge = document.createElement('span');
    badge.className = 'asset-badge bonds';
    badge.textContent = LIABILITY_TYPES[l.type] || l.type;
    badgeRow.appendChild(badge);

    const nameText = document.createElement('span');
    nameText.classList.add('asset-name');
    nameText.textContent = l.name;

    colMain.appendChild(badgeRow);
    colMain.appendChild(nameText);

    const colOutstanding = document.createElement('div');
    colOutstanding.classList.add('asset-data-col');
    const lblOutstanding = document.createElement('span');
    lblOutstanding.classList.add('asset-data-label');
    lblOutstanding.textContent = 'Outstanding';
    const valOutstanding = document.createElement('span');
    valOutstanding.classList.add('asset-data-value');
    valOutstanding.style.color = 'var(--color-danger)';
    valOutstanding.textContent = formatCurrency(l.outstanding);
    colOutstanding.appendChild(lblOutstanding);
    colOutstanding.appendChild(valOutstanding);

    const colEmi = document.createElement('div');
    colEmi.classList.add('asset-data-col');
    const lblEmi = document.createElement('span');
    lblEmi.classList.add('asset-data-label');
    lblEmi.textContent = 'Monthly EMI';
    const valEmi = document.createElement('span');
    valEmi.classList.add('asset-data-value');
    valEmi.textContent = formatCurrency(l.emi);
    colEmi.appendChild(lblEmi);
    colEmi.appendChild(valEmi);

    const colRate = document.createElement('div');
    colRate.classList.add('asset-data-col');
    const lblRate = document.createElement('span');
    lblRate.classList.add('asset-data-label');
    lblRate.textContent = 'Interest Rate';
    const valRate = document.createElement('span');
    valRate.classList.add('asset-data-value');
    valRate.textContent = l.rate.toFixed(2) + '%';
    colRate.appendChild(lblRate);
    colRate.appendChild(valRate);

    const colTenure = document.createElement('div');
    colTenure.classList.add('asset-data-col');
    const lblTenure = document.createElement('span');
    lblTenure.classList.add('asset-data-label');
    lblTenure.textContent = 'Tenure Left';

    const tenureContainer = document.createElement('div');
    tenureContainer.style.display = 'flex';
    tenureContainer.style.alignItems = 'center';
    tenureContainer.style.gap = '8px';

    const valTenure = document.createElement('span');
    valTenure.classList.add('asset-data-value');
    valTenure.style.fontSize = '0.85rem';
    valTenure.textContent = `${l.tenure} Months`;

    const btnPayEmi = document.createElement('button');
    btnPayEmi.className = 'btn btn-secondary';
    btnPayEmi.style.padding = '2px 8px';
    btnPayEmi.style.fontSize = '0.75rem';
    btnPayEmi.style.height = 'auto';
    btnPayEmi.style.lineHeight = '1.2';
    btnPayEmi.style.borderRadius = '4px';
    btnPayEmi.style.border = '1px solid var(--border-light)';
    btnPayEmi.style.background = 'transparent';
    btnPayEmi.style.cursor = 'pointer';
    btnPayEmi.textContent = '+1 Paid';
    btnPayEmi.title = 'Mark 1 EMI as Paid';
    btnPayEmi.addEventListener('click', (e) => {
      e.stopPropagation();
      payOneEMI(l.id);
    });

    tenureContainer.appendChild(valTenure);
    if (Number(l.tenure) > 0) {
      tenureContainer.appendChild(btnPayEmi);
    }

    colTenure.appendChild(lblTenure);
    colTenure.appendChild(tenureContainer);

    const colActions = document.createElement('div');
    colActions.classList.add('card-actions');

    const btnEdit = document.createElement('button');
    btnEdit.className = 'icon-btn';
    btnEdit.setAttribute('aria-label', 'Edit Liability');
    const editSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    editSvg.setAttribute('viewBox', '0 0 24 24');
    editSvg.setAttribute('fill', 'none');
    editSvg.setAttribute('stroke', 'currentColor');
    editSvg.setAttribute('stroke-width', '2');
    editSvg.setAttribute('width', '16');
    editSvg.setAttribute('height', '16');
    const editPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    editPath.setAttribute('d', 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z');
    editSvg.appendChild(editPath);
    btnEdit.appendChild(editSvg);
    btnEdit.addEventListener('click', () => openLiabilityModal(l));

    const btnDelete = document.createElement('button');
    btnDelete.className = 'icon-btn';
    btnDelete.setAttribute('aria-label', 'Delete Liability');
    btnDelete.style.color = 'var(--color-danger)';
    const deleteSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    deleteSvg.setAttribute('viewBox', '0 0 24 24');
    deleteSvg.setAttribute('fill', 'none');
    deleteSvg.setAttribute('stroke', 'currentColor');
    deleteSvg.setAttribute('stroke-width', '2');
    deleteSvg.setAttribute('width', '16');
    deleteSvg.setAttribute('height', '16');
    const deletePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    deletePath.setAttribute('d', 'M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2');
    deleteSvg.appendChild(deletePath);
    btnDelete.appendChild(deleteSvg);
    btnDelete.addEventListener('click', () => {
      if (confirm(`Are you sure you want to delete ${l.name}?`)) {
        deleteLiability(l.id);
      }
    });

    colActions.appendChild(btnEdit);
    colActions.appendChild(btnDelete);

    card.appendChild(colMain);
    card.appendChild(colOutstanding);
    card.appendChild(colEmi);
    card.appendChild(colRate);
    card.appendChild(colTenure);
    card.appendChild(colActions);

    // Repayment progress row
    const totalTenureVal = Number(l.totalTenure || l.tenure || 1);
    const tenureLeftVal = Number(l.tenure);
    const monthsPaidVal = Math.max(0, totalTenureVal - tenureLeftVal);
    const progressPctVal = totalTenureVal > 0 ? Math.min(100, (monthsPaidVal / totalTenureVal) * 100) : 0;
    const totalRemainingVal = tenureLeftVal * Number(l.emi);

    const progressRow = document.createElement('div');
    progressRow.classList.add('loan-progress-row');

    const progressTextRow = document.createElement('div');
    progressTextRow.classList.add('loan-progress-text-row');

    const progressLabel = document.createElement('span');
    progressLabel.classList.add('loan-progress-label');
    progressLabel.textContent = `Repayment Progress: ${monthsPaidVal} of ${totalTenureVal} Months Paid (${progressPctVal.toFixed(0)}%)`;

    const progressSubLabel = document.createElement('span');
    progressSubLabel.textContent = `Remaining EMIs: ${tenureLeftVal} (${formatCurrency(totalRemainingVal)} total remaining)`;

    progressTextRow.appendChild(progressLabel);
    progressTextRow.appendChild(progressSubLabel);

    const progressTrack = document.createElement('div');
    progressTrack.classList.add('loan-progress-track');

    const progressFill = document.createElement('div');
    progressFill.classList.add('loan-progress-fill', l.type);
    progressFill.style.width = `${progressPctVal}%`;

    progressTrack.appendChild(progressFill);
    progressRow.appendChild(progressTextRow);
    progressRow.appendChild(progressTrack);

    // Last paid EMI details
    const progressMetaRow = document.createElement('div');
    progressMetaRow.style.display = 'flex';
    progressMetaRow.style.justifyContent = 'space-between';
    progressMetaRow.style.fontSize = '0.75rem';
    progressMetaRow.style.color = 'var(--text-secondary)';
    progressMetaRow.style.marginTop = '-2px';

    const lastPaidText = l.lastPaidDate ? new Date(l.lastPaidDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never';
    const lastPaidEl = document.createElement('span');
    lastPaidEl.textContent = `Last Paid EMI Date: ${lastPaidText}`;
    progressMetaRow.appendChild(lastPaidEl);
    progressRow.appendChild(progressMetaRow);

    card.appendChild(progressRow);

    container.appendChild(card);
  });
}

function openLiabilityModal(lObj = null) {
  const overlay = document.getElementById('liability-modal');
  const titleText = document.getElementById('liability-modal-title-text');

  const inputId = document.getElementById('input-liability-id');
  const inputType = document.getElementById('input-liability-type');
  const inputName = document.getElementById('input-liability-name');
  const inputOutstanding = document.getElementById('input-liability-outstanding');
  const inputEmi = document.getElementById('input-liability-emi');
  const inputRate = document.getElementById('input-liability-rate');
  const inputTotalTenure = document.getElementById('input-liability-total-tenure');
  const inputTenure = document.getElementById('input-liability-tenure');
  const inputLastPaid = document.getElementById('input-liability-last-paid');

  if (lObj) {
    titleText.textContent = 'Edit Liability';
    inputId.value = lObj.id;
    inputType.value = lObj.type;
    inputName.value = lObj.name;
    inputOutstanding.value = lObj.outstanding;
    inputEmi.value = lObj.emi;
    inputRate.value = lObj.rate;
    inputTotalTenure.value = lObj.totalTenure || lObj.tenure;
    inputTenure.value = lObj.tenure;
    inputLastPaid.value = lObj.lastPaidDate ? lObj.lastPaidDate.split('T')[0] : '';
  } else {
    titleText.textContent = 'Add Liability';
    inputId.value = '';
    inputType.value = '';
    inputName.value = '';
    inputOutstanding.value = '';
    inputEmi.value = '';
    inputRate.value = '';
    inputTotalTenure.value = '';
    inputTenure.value = '';
    inputLastPaid.value = '';
  }
  overlay.classList.add('active-modal');
}

function closeLiabilityModal() {
  const overlay = document.getElementById('liability-modal');
  overlay.classList.remove('active-modal');
}

function saveLiabilityForm() {
  const id = document.getElementById('input-liability-id').value;
  const type = document.getElementById('input-liability-type').value;
  const name = document.getElementById('input-liability-name').value;
  const outstanding = Number(document.getElementById('input-liability-outstanding').value);
  const emi = Number(document.getElementById('input-liability-emi').value);
  const rate = Number(document.getElementById('input-liability-rate').value);
  const totalTenure = Number(document.getElementById('input-liability-total-tenure').value);
  const tenure = Number(document.getElementById('input-liability-tenure').value);
  const lastPaidVal = document.getElementById('input-liability-last-paid').value;
  const lastPaidDate = lastPaidVal ? new Date(lastPaidVal).toISOString() : null;

  if (tenure > totalTenure) {
    alert("Tenure Left cannot be greater than Total Tenure!");
    return;
  }

  if (id) {
    const idx = liabilities.findIndex(l => l.id === id);
    if (idx !== -1) {
      liabilities[idx] = {
        ...liabilities[idx],
        type,
        name,
        outstanding,
        emi,
        rate,
        totalTenure,
        tenure,
        lastPaidDate,
        lastUpdated: new Date().toISOString()
      };
    }
  } else {
    const newId = crypto.randomUUID ? crypto.randomUUID() : 'loan-' + Math.random().toString(36).substring(2, 9);
    liabilities.push({
      id: newId,
      type,
      name,
      outstanding,
      emi,
      rate,
      totalTenure,
      tenure,
      lastPaidDate,
      lastUpdated: new Date().toISOString()
    });
  }

  saveToStorage();
  closeLiabilityModal();
  renderLiabilities();
}

// Mark EMI as paid and calculate new outstanding & tenure
function payOneEMI(id) {
  const l = liabilities.find(item => item.id === id);
  if (!l) return;

  const tenureLeftVal = Number(l.tenure);
  if (tenureLeftVal <= 0) {
    alert("This liability has already been fully repaid!");
    return;
  }

  const monthlyRate = (Number(l.rate) / 100) / 12;
  const interestPaid = Number(l.outstanding) * monthlyRate;
  const principalPaid = Number(l.emi) - interestPaid;

  l.outstanding = Math.max(0, Number(l.outstanding) - principalPaid);
  l.tenure = Math.max(0, tenureLeftVal - 1);
  l.lastPaidDate = new Date().toISOString();

  saveToStorage();
  renderLiabilities();
}

// Delete Liability logic
function deleteLiability(id) {
  liabilities = liabilities.filter(l => l.id !== id);
  saveToStorage();
  renderLiabilities();
}

// ==========================================
// BORROW & LENT LOGIC
// ==========================================

function openBorrowLentModal(blObj = null) {
  const overlay = document.getElementById('borrow-lent-modal');
  const titleText = document.getElementById('borrow-lent-modal-title-text');

  const inputId = document.getElementById('input-borrow-lent-id');
  const inputType = document.getElementById('input-borrow-lent-type');
  const inputPerson = document.getElementById('input-borrow-lent-person');
  const inputAmount = document.getElementById('input-borrow-lent-amount');
  const inputDate = document.getElementById('input-borrow-lent-date');
  const inputNotes = document.getElementById('input-borrow-lent-notes');

  if (blObj) {
    titleText.textContent = 'Edit Cashflow Transaction';
    inputId.value = blObj.id;
    inputType.value = blObj.type;
    inputPerson.value = blObj.person;
    inputAmount.value = blObj.amount;
    inputAmount.disabled = true;
    inputDate.value = blObj.date;
    inputNotes.value = blObj.notes || '';
  } else {
    titleText.textContent = 'Add Cashflow Transaction';
    inputId.value = '';
    inputType.value = '';
    inputPerson.value = '';
    inputAmount.value = '';
    inputAmount.disabled = false;
    inputDate.value = new Date().toISOString().split('T')[0];
    inputNotes.value = '';
  }
  overlay.classList.add('active-modal');
}

function closeBorrowLentModal() {
  const overlay = document.getElementById('borrow-lent-modal');
  overlay.classList.remove('active-modal');
}

function saveBorrowLentForm() {
  const id = document.getElementById('input-borrow-lent-id').value;
  const type = document.getElementById('input-borrow-lent-type').value;
  const person = document.getElementById('input-borrow-lent-person').value;
  const amount = Number(document.getElementById('input-borrow-lent-amount').value);
  const date = document.getElementById('input-borrow-lent-date').value;
  const notes = document.getElementById('input-borrow-lent-notes').value;

  if (id) {
    const idx = borrowLent.findIndex(bl => bl.id === id);
    if (idx !== -1) {
      const oldVal = borrowLent[idx];
      let newOutstanding = oldVal.outstanding;
      if (oldVal.amount !== amount) {
        const diff = amount - oldVal.amount;
        newOutstanding = Math.max(0, oldVal.outstanding + diff);
      }

      borrowLent[idx] = {
        ...oldVal,
        type,
        person,
        amount,
        outstanding: newOutstanding,
        date,
        notes,
        status: newOutstanding === 0 ? 'paid' : oldVal.status
      };
    }
  } else {
    const newId = 'bl-' + Math.random().toString(36).substring(2, 9);
    borrowLent.push({
      id: newId,
      type,
      person,
      amount,
      outstanding: amount,
      date,
      notes,
      status: 'active',
      payments: []
    });
  }

  saveToStorage();
  closeBorrowLentModal();
  renderBorrowLent();
}

function openPaymentModal(blId) {
  const overlay = document.getElementById('payment-log-modal');
  const bl = borrowLent.find(item => item.id === blId);
  if (!bl) return;

  const title = document.getElementById('payment-modal-title');
  const labelAmt = document.getElementById('lbl-payment-amount');

  title.textContent = bl.type === 'lent' ? 'Log Collection Received' : 'Log Repayment Paid';
  labelAmt.textContent = bl.type === 'lent' ? 'Amount Collected (₹)' : 'Amount Paid (₹)';

  document.getElementById('input-payment-bl-id').value = blId;
  document.getElementById('input-payment-amount').value = '';
  document.getElementById('input-payment-amount').max = bl.outstanding;
  document.getElementById('input-payment-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('input-payment-note').value = '';

  overlay.classList.add('active-modal');
}

function closePaymentModal() {
  const overlay = document.getElementById('payment-log-modal');
  overlay.classList.remove('active-modal');
}

function savePaymentForm() {
  const blId = document.getElementById('input-payment-bl-id').value;
  const amount = Number(document.getElementById('input-payment-amount').value);
  const date = document.getElementById('input-payment-date').value;
  const note = document.getElementById('input-payment-note').value;

  const bl = borrowLent.find(item => item.id === blId);
  if (!bl) return;

  if (amount > bl.outstanding) {
    alert(`Payment amount (₹${amount}) cannot exceed outstanding balance (₹${bl.outstanding})!`);
    return;
  }

  bl.outstanding = Math.max(0, bl.outstanding - amount);
  bl.payments.push({
    date,
    amount,
    note: note || (bl.type === 'lent' ? 'Collection' : 'Repayment')
  });

  if (bl.outstanding === 0) {
    bl.status = 'paid';
  }

  saveToStorage();
  closePaymentModal();
  renderBorrowLent();
}

function markBLAsPaid(id) {
  const bl = borrowLent.find(item => item.id === id);
  if (!bl) return;

  const remaining = bl.outstanding;
  if (remaining > 0) {
    bl.payments.push({
      date: new Date().toISOString().split('T')[0],
      amount: remaining,
      note: 'Settled full outstanding (Marked Paid)'
    });
  }
  bl.outstanding = 0;
  bl.status = 'paid';

  saveToStorage();
  renderBorrowLent();
}

function deleteBorrowLent(id) {
  borrowLent = borrowLent.filter(item => item.id !== id);
  saveToStorage();
  renderBorrowLent();
}

function renderBorrowLent() {
  const container = document.getElementById('borrow-lent-list-container');
  clearContainer(container);

  let totalLent = 0;
  let totalBorrowed = 0;

  borrowLent.forEach(bl => {
    if (bl.status !== 'paid') {
      if (bl.type === 'lent') {
        totalLent += Number(bl.outstanding);
      } else if (bl.type === 'borrowed') {
        totalBorrowed += Number(bl.outstanding);
      }
    }
  });

  const netBL = totalLent - totalBorrowed;

  // Update section stats
  document.getElementById('val-total-lent').textContent = formatCurrency(totalLent);
  document.getElementById('val-total-borrowed').textContent = formatCurrency(totalBorrowed);

  const netValEl = document.getElementById('val-net-borrow-lent');
  const netLblEl = document.getElementById('lbl-net-borrow-lent');

  netValEl.textContent = formatCurrency(Math.abs(netBL));
  if (netBL > 0) {
    netValEl.style.color = 'var(--color-success)';
    netLblEl.textContent = 'Net Receivable (People owe you)';
  } else if (netBL < 0) {
    netValEl.style.color = 'var(--color-danger)';
    netLblEl.textContent = 'Net Payable (You owe people)';
  } else {
    netValEl.style.color = 'var(--text-secondary)';
    netLblEl.textContent = 'Net Balance Settled';
  }

  // Filtering & searching
  const filtered = borrowLent.filter(bl => {
    const matchesSearch = bl.person.toLowerCase().includes(searchQueryBorrowLent.toLowerCase()) ||
      (bl.notes || '').toLowerCase().includes(searchQueryBorrowLent.toLowerCase());

    let matchesFilter = true;
    if (currentBLFilter === 'lent') {
      matchesFilter = bl.type === 'lent' && bl.status !== 'paid';
    } else if (currentBLFilter === 'borrowed') {
      matchesFilter = bl.type === 'borrowed' && bl.status !== 'paid';
    } else if (currentBLFilter === 'history') {
      matchesFilter = bl.status === 'paid';
    } else {
      matchesFilter = bl.status !== 'paid';
    }

    return matchesSearch && matchesFilter;
  });

  if (filtered.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.classList.add('empty-state');

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.5');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    icon.classList.add('empty-icon');

    // shoulders
    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path1.setAttribute('d', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2');

    // head (aligned at cx=9)
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '9');
    circle.setAttribute('cy', '7');
    circle.setAttribute('r', '4');

    // plus icon (lines)
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', '19');
    line1.setAttribute('x2', '19');
    line1.setAttribute('y1', '8');
    line1.setAttribute('y2', '14');

    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', '16');
    line2.setAttribute('x2', '22');
    line2.setAttribute('y1', '11');
    line2.setAttribute('y2', '11');

    icon.appendChild(path1);
    icon.appendChild(circle);
    icon.appendChild(line1);
    icon.appendChild(line2);
    emptyState.appendChild(icon);

    const title = document.createElement('h4');
    title.classList.add('empty-title');
    title.textContent = 'No cashflow entries found';
    emptyState.appendChild(title);

    const desc = document.createElement('p');
    desc.classList.add('empty-desc');
    desc.textContent = borrowLent.length === 0
      ? 'Start logging personal borrowings and lendings to keep track of your cash flows.'
      : 'No active cashflow records match the selected filter/search.';
    emptyState.appendChild(desc);

    container.appendChild(emptyState);
    return;
  }

  filtered.forEach(bl => {
    const card = document.createElement('div');
    card.classList.add('investment-card');
    if (bl.status === 'paid') {
      card.style.opacity = '0.75';
    }

    // Column 1: Info & Type Badge
    const colMain = document.createElement('div');
    colMain.classList.add('asset-main-info');

    const badgeRow = document.createElement('div');
    badgeRow.style.display = 'flex';
    badgeRow.style.alignItems = 'center';
    badgeRow.style.gap = '8px';

    const typeBadge = document.createElement('span');
    typeBadge.className = bl.type === 'lent' ? 'asset-badge savings' : 'asset-badge bonds';
    typeBadge.textContent = bl.type === 'lent' ? 'LENT' : 'BORROWED';
    badgeRow.appendChild(typeBadge);

    if (bl.status === 'paid') {
      const paidBadge = document.createElement('span');
      paidBadge.className = 'asset-badge gold';
      paidBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
      paidBadge.style.color = 'var(--color-success)';
      paidBadge.textContent = 'SETTLED';
      badgeRow.appendChild(paidBadge);
    }

    const personName = document.createElement('span');
    personName.classList.add('asset-name');
    personName.textContent = bl.person;

    colMain.appendChild(badgeRow);
    colMain.appendChild(personName);

    // Column 2: Principal
    const colAmt = document.createElement('div');
    colAmt.classList.add('asset-data-col');
    const lblAmt = document.createElement('span');
    lblAmt.classList.add('asset-data-label');
    lblAmt.textContent = 'Principal';
    const valAmt = document.createElement('span');
    valAmt.classList.add('asset-data-value');
    valAmt.textContent = formatCurrency(bl.amount);
    colAmt.appendChild(lblAmt);
    colAmt.appendChild(valAmt);

    // Column 3: Outstanding Balance
    const colOutstanding = document.createElement('div');
    colOutstanding.classList.add('asset-data-col');
    const lblOutstanding = document.createElement('span');
    lblOutstanding.classList.add('asset-data-label');
    lblOutstanding.textContent = 'Outstanding';
    const valOutstanding = document.createElement('span');
    valOutstanding.classList.add('asset-data-value');
    valOutstanding.style.fontWeight = '700';
    if (bl.status === 'paid') {
      valOutstanding.style.color = 'var(--text-muted)';
      valOutstanding.textContent = '₹0';
    } else {
      valOutstanding.style.color = bl.type === 'lent' ? 'var(--color-success)' : 'var(--color-danger)';
      valOutstanding.textContent = formatCurrency(bl.outstanding);
    }
    colOutstanding.appendChild(lblOutstanding);
    colOutstanding.appendChild(valOutstanding);

    // Column 4: Date
    const colDate = document.createElement('div');
    colDate.classList.add('asset-data-col');
    const lblDate = document.createElement('span');
    lblDate.classList.add('asset-data-label');
    lblDate.textContent = 'Date Initiated';
    const valDate = document.createElement('span');
    valDate.style.fontSize = '0.8rem';
    valDate.style.color = 'var(--text-secondary)';
    valDate.textContent = new Date(bl.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    colDate.appendChild(lblDate);
    colDate.appendChild(valDate);

    // Column 5: Card Actions (Edit, Delete, Pay, Mark Paid)
    const colActions = document.createElement('div');
    colActions.classList.add('card-actions');

    if (bl.status !== 'paid') {
      const btnPay = document.createElement('button');
      btnPay.className = 'btn btn-secondary';
      btnPay.style.padding = '4px 8px';
      btnPay.style.fontSize = '0.75rem';
      btnPay.style.height = 'auto';
      btnPay.style.borderRadius = '4px';
      btnPay.textContent = bl.type === 'lent' ? '+ Collect' : '+ Repay';
      btnPay.addEventListener('click', () => openPaymentModal(bl.id));
      colActions.appendChild(btnPay);

      const btnSettle = document.createElement('button');
      btnSettle.className = 'btn btn-secondary';
      btnSettle.style.padding = '4px 8px';
      btnSettle.style.fontSize = '0.75rem';
      btnSettle.style.height = 'auto';
      btnSettle.style.borderRadius = '4px';
      btnSettle.textContent = 'Mark Paid';
      btnSettle.addEventListener('click', () => {
        if (confirm(`Mark transaction with ${bl.person} as fully settled?`)) {
          markBLAsPaid(bl.id);
        }
      });
      colActions.appendChild(btnSettle);
    }

    const btnEdit = document.createElement('button');
    btnEdit.className = 'icon-btn';
    btnEdit.setAttribute('aria-label', 'Edit Transaction');
    const editSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    editSvg.setAttribute('viewBox', '0 0 24 24');
    editSvg.setAttribute('fill', 'none');
    editSvg.setAttribute('stroke', 'currentColor');
    editSvg.setAttribute('stroke-width', '2');
    editSvg.setAttribute('width', '16');
    editSvg.setAttribute('height', '16');
    const editPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    editPath.setAttribute('d', 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z');
    editSvg.appendChild(editPath);
    btnEdit.appendChild(editSvg);
    btnEdit.addEventListener('click', () => openBorrowLentModal(bl));
    colActions.appendChild(btnEdit);

    const btnDelete = document.createElement('button');
    btnDelete.className = 'icon-btn';
    btnDelete.setAttribute('aria-label', 'Delete Transaction');
    btnDelete.style.color = 'var(--color-danger)';
    const deleteSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    deleteSvg.setAttribute('viewBox', '0 0 24 24');
    deleteSvg.setAttribute('fill', 'none');
    deleteSvg.setAttribute('stroke', 'currentColor');
    deleteSvg.setAttribute('stroke-width', '2');
    deleteSvg.setAttribute('width', '16');
    deleteSvg.setAttribute('height', '16');
    const deletePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    deletePath.setAttribute('d', 'M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2');
    deleteSvg.appendChild(deletePath);
    btnDelete.appendChild(deleteSvg);
    btnDelete.addEventListener('click', () => {
      if (confirm(`Delete cashflow record with ${bl.person}?`)) {
        deleteBorrowLent(bl.id);
      }
    });
    colActions.appendChild(btnDelete);

    card.appendChild(colMain);
    card.appendChild(colAmt);
    card.appendChild(colOutstanding);
    card.appendChild(colDate);
    card.appendChild(colActions);

    // Collapsible payment logs & history
    const historyWrapper = document.createElement('div');
    historyWrapper.classList.add('loan-progress-row');
    historyWrapper.style.marginTop = '16px';
    historyWrapper.style.paddingTop = '12px';
    historyWrapper.style.borderTop = '1px solid var(--border-light)';

    const historyHeader = document.createElement('div');
    historyHeader.style.display = 'flex';
    historyHeader.style.justifyContent = 'space-between';
    historyHeader.style.alignItems = 'center';
    historyHeader.style.fontSize = '0.8rem';
    historyHeader.style.fontWeight = '600';
    historyHeader.style.color = 'var(--text-primary)';
    historyHeader.style.cursor = 'pointer';
    historyHeader.style.userSelect = 'none';

    const historyTitle = document.createElement('span');
    historyTitle.textContent = `Transaction Logs (${bl.payments.length} Payments)`;

    const arrowIcon = document.createElement('span');
    arrowIcon.style.fontSize = '0.7rem';
    arrowIcon.style.transition = 'transform 0.2s';
    arrowIcon.textContent = '▼';

    historyHeader.appendChild(historyTitle);
    historyHeader.appendChild(arrowIcon);

    const historyList = document.createElement('div');
    historyList.style.display = 'none';
    historyList.style.flexDirection = 'column';
    historyList.style.gap = '6px';
    historyList.style.marginTop = '8px';

    if (bl.payments.length === 0) {
      const noPayments = document.createElement('div');
      noPayments.style.fontSize = '0.75rem';
      noPayments.style.color = 'var(--text-muted)';
      noPayments.textContent = 'No payments/collections logged yet.';
      historyList.appendChild(noPayments);
    } else {
      bl.payments.forEach(p => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.fontSize = '0.75rem';
        item.style.color = 'var(--text-secondary)';
        item.style.padding = '4px 8px';
        item.style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
        item.style.borderRadius = '4px';

        const left = document.createElement('span');
        const amtBold = document.createElement('strong');
        amtBold.textContent = formatCurrency(p.amount);
        left.appendChild(amtBold);
        left.appendChild(document.createTextNode(` - ${p.note}`));

        const right = document.createElement('span');
        right.textContent = new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

        item.appendChild(left);
        item.appendChild(right);
        historyList.appendChild(item);
      });
    }

    historyHeader.addEventListener('click', () => {
      const isVisible = historyList.style.display === 'flex';
      historyList.style.display = isVisible ? 'none' : 'flex';
      arrowIcon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
    });

    historyWrapper.appendChild(historyHeader);
    historyWrapper.appendChild(historyList);

    if (bl.notes) {
      const notesDiv = document.createElement('div');
      notesDiv.style.fontSize = '0.75rem';
      notesDiv.style.color = 'var(--text-secondary)';
      notesDiv.style.marginTop = '8px';
      notesDiv.style.fontStyle = 'italic';
      notesDiv.textContent = `Note: ${bl.notes}`;
      card.appendChild(notesDiv);
    }

    card.appendChild(historyWrapper);
    container.appendChild(card);
  });
}

// ==========================================
// SALARY TRACKER LOGIC
// ==========================================

function formatMonthLabel(monthStr) {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatMonthShort(monthStr) {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function showCustomTooltip(event, title, label1, val1, label2, val2, label3, val3) {
  const tooltip = document.getElementById('chart-tooltip');
  tooltip.replaceChildren();

  const tTitle = document.createElement('div');
  tTitle.id = 'chart-tooltip-title';
  tTitle.className = 'chart-tooltip-title';
  tTitle.textContent = title;
  tooltip.appendChild(tTitle);

  const rows = [
    { labelId: 'chart-tooltip-label-1', valId: 'chart-tooltip-invested', label: label1, value: val1 },
    { labelId: 'chart-tooltip-label-2', valId: 'chart-tooltip-current', label: label2, value: val2 },
    { labelId: 'chart-tooltip-label-3', valId: 'chart-tooltip-pl', label: label3, value: val3 }
  ];

  rows.forEach(r => {
    const row = document.createElement('div');
    row.className = 'chart-tooltip-row';
    if (!r.label) {
      row.style.display = 'none';
    }

    const span = document.createElement('span');
    span.id = r.labelId;
    span.textContent = r.label || '';
    row.appendChild(span);

    const val = document.createElement('span');
    val.id = r.valId;
    val.className = 'chart-tooltip-value';
    val.textContent = r.value || '';
    row.appendChild(val);

    tooltip.appendChild(row);
  });

  positionTooltip(tooltip, event);
}

function openSalaryModal(sObj = null) {
  const overlay = document.getElementById('salary-modal');
  const titleText = document.getElementById('salary-modal-title-text');

  const inputId = document.getElementById('input-salary-id');
  const inputMonth = document.getElementById('input-salary-month');
  const inputInhand = document.getElementById('input-salary-inhand');
  const inputDeduction = document.getElementById('input-salary-deduction');
  const inputNotes = document.getElementById('input-salary-notes');

  if (sObj) {
    titleText.textContent = 'Edit Salary Entry';
    inputId.value = sObj.id;
    inputMonth.value = sObj.month;
    inputInhand.value = sObj.inhand;
    inputDeduction.value = sObj.deduction;
    inputNotes.value = sObj.notes || '';
  } else {
    titleText.textContent = 'Add Salary Entry';
    inputId.value = '';
    const now = new Date();
    const monthStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    inputMonth.value = monthStr;
    inputInhand.value = '';
    inputDeduction.value = '';
    inputNotes.value = '';
  }
  overlay.classList.add('active-modal');
}

function closeSalaryModal() {
  const overlay = document.getElementById('salary-modal');
  overlay.classList.remove('active-modal');
}

function saveSalaryForm() {
  const id = document.getElementById('input-salary-id').value;
  const month = document.getElementById('input-salary-month').value;
  const inhand = Number(document.getElementById('input-salary-inhand').value);
  const deduction = Number(document.getElementById('input-salary-deduction').value);
  const notes = document.getElementById('input-salary-notes').value;

  if (!month) {
    alert('Please select a month!');
    return;
  }

  if (id) {
    const idx = salaries.findIndex(s => s.id === id);
    if (idx !== -1) {
      const oldInhand = salaries[idx].inhand;
      salaries[idx] = {
        ...salaries[idx],
        month,
        inhand,
        deduction,
        notes
      };
      adjustDefaultSavingsBalance(inhand - oldInhand);
    }
  } else {
    const duplicate = salaries.find(s => s.month === month);
    if (duplicate) {
      // TODO(security): Standard browser confirm dialog is used here due to pure client-side vanilla JS architecture constraints.
      if (!confirm(`An entry for ${formatMonthLabel(month)} already exists. Do you want to update it instead?`)) {
        return;
      }
      const oldInhand = duplicate.inhand;
      duplicate.inhand = inhand;
      duplicate.deduction = deduction;
      duplicate.notes = notes;
      adjustDefaultSavingsBalance(inhand - oldInhand);
    } else {
      const newId = 'sal-' + Math.random().toString(36).substring(2, 9);
      salaries.push({
        id: newId,
        month,
        inhand,
        deduction,
        notes
      });
      adjustDefaultSavingsBalance(inhand);
    }
  }

  saveToStorage();
  closeSalaryModal();
  renderSalaries();
}

function deleteSalary(id) {
  // TODO(security): Standard browser confirm dialog is used here due to pure client-side vanilla JS architecture constraints.
  if (confirm('Are you sure you want to delete this salary entry?')) {
    const target = salaries.find(s => s.id === id);
    if (target) {
      adjustDefaultSavingsBalance(-target.inhand);
    }
    salaries = salaries.filter(s => s.id !== id);
    saveToStorage();
    renderSalaries();
  }
}

function renderSalaries() {
  const container = document.getElementById('salary-list-container');
  clearContainer(container);

  let totalGross = 0;
  let totalInhand = 0;
  let totalDeductions = 0;

  salaries.forEach(s => {
    totalInhand += Number(s.inhand);
    totalDeductions += Number(s.deduction);
    totalGross += (Number(s.inhand) + Number(s.deduction));
  });

  const count = salaries.length;
  const avgInhand = count > 0 ? (totalInhand / count) : 0;

  document.getElementById('val-total-gross-salary').textContent = formatCurrency(totalGross);
  document.getElementById('val-total-inhand-salary').textContent = formatCurrency(totalInhand);
  document.getElementById('val-total-deductions-salary').textContent = formatCurrency(totalDeductions);
  document.getElementById('val-avg-inhand-salary').textContent = formatCurrency(avgInhand);

  const filtered = salaries.filter(s => {
    const monthLabel = formatMonthLabel(s.month).toLowerCase();
    const notesMatch = (s.notes || '').toLowerCase().includes(searchQuerySalaries.toLowerCase());
    return monthLabel.includes(searchQuerySalaries.toLowerCase()) || notesMatch;
  });

  filtered.sort((a, b) => b.month.localeCompare(a.month));

  if (filtered.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.classList.add('empty-state');

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.5');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    icon.classList.add('empty-icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6');
    icon.appendChild(path);

    const title = document.createElement('h4');
    title.classList.add('empty-title');
    title.textContent = 'No salary entries found';

    const desc = document.createElement('p');
    desc.classList.add('empty-desc');
    desc.textContent = salaries.length === 0
      ? 'Start tracking your monthly credits and deductions by clicking "Add Salary Entry".'
      : 'No active salary records match your search.';

    emptyState.appendChild(icon);
    emptyState.appendChild(title);
    emptyState.appendChild(desc);

    container.appendChild(emptyState);

    // Clear chart too
    const chartContainer = document.getElementById('salary-chart-container');
    clearContainer(chartContainer);
    return;
  }

  filtered.forEach(s => {
    const gross = s.inhand + s.deduction;
    const inhandPct = gross > 0 ? (s.inhand / gross) * 100 : 0;

    const card = document.createElement('div');
    card.classList.add('investment-card');

    const colMain = document.createElement('div');
    colMain.classList.add('asset-main-info');

    const monthText = document.createElement('span');
    monthText.classList.add('asset-name');
    monthText.textContent = formatMonthLabel(s.month);
    colMain.appendChild(monthText);

    if (s.notes) {
      const noteText = document.createElement('span');
      noteText.style.fontSize = '0.75rem';
      noteText.style.color = 'var(--text-secondary)';
      noteText.style.fontStyle = 'italic';
      noteText.style.marginTop = '4px';
      noteText.textContent = s.notes;
      colMain.appendChild(noteText);
    }

    const colGross = document.createElement('div');
    colGross.classList.add('asset-data-col');
    const lblGross = document.createElement('span');
    lblGross.classList.add('asset-data-label');
    lblGross.textContent = 'Gross Salary';
    const valGross = document.createElement('span');
    valGross.classList.add('asset-data-value');
    valGross.textContent = formatCurrency(gross);
    colGross.appendChild(lblGross);
    colGross.appendChild(valGross);

    const colInhand = document.createElement('div');
    colInhand.classList.add('asset-data-col');
    const lblInhand = document.createElement('span');
    lblInhand.classList.add('asset-data-label');
    lblInhand.textContent = 'In-hand Credited';
    const valInhand = document.createElement('span');
    valInhand.classList.add('asset-data-value');
    valInhand.style.color = 'var(--color-success)';
    valInhand.textContent = formatCurrency(s.inhand);
    colInhand.appendChild(lblInhand);
    colInhand.appendChild(valInhand);

    const colDed = document.createElement('div');
    colDed.classList.add('asset-data-col');
    const lblDed = document.createElement('span');
    lblDed.classList.add('asset-data-label');
    lblDed.textContent = 'Deductions';
    const valDed = document.createElement('span');
    valDed.classList.add('asset-data-value');
    valDed.style.color = 'var(--color-danger)';
    valDed.textContent = formatCurrency(s.deduction);
    colDed.appendChild(lblDed);
    colDed.appendChild(valDed);

    const colActions = document.createElement('div');
    colActions.classList.add('card-actions');

    const btnEdit = document.createElement('button');
    btnEdit.className = 'icon-btn';
    btnEdit.setAttribute('aria-label', 'Edit Salary Entry');
    const editSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    editSvg.setAttribute('viewBox', '0 0 24 24');
    editSvg.setAttribute('fill', 'none');
    editSvg.setAttribute('stroke', 'currentColor');
    editSvg.setAttribute('stroke-width', '2');
    editSvg.setAttribute('width', '16');
    editSvg.setAttribute('height', '16');
    const editPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    editPath.setAttribute('d', 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z');
    editSvg.appendChild(editPath);
    btnEdit.appendChild(editSvg);
    btnEdit.addEventListener('click', () => openSalaryModal(s));

    const btnDelete = document.createElement('button');
    btnDelete.className = 'icon-btn';
    btnDelete.setAttribute('aria-label', 'Delete Salary Entry');
    btnDelete.style.color = 'var(--color-danger)';
    const deleteSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    deleteSvg.setAttribute('viewBox', '0 0 24 24');
    deleteSvg.setAttribute('fill', 'none');
    deleteSvg.setAttribute('stroke', 'currentColor');
    deleteSvg.setAttribute('stroke-width', '2');
    deleteSvg.setAttribute('width', '16');
    deleteSvg.setAttribute('height', '16');
    const deletePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    deletePath.setAttribute('d', 'M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2');
    deleteSvg.appendChild(deletePath);
    btnDelete.appendChild(deleteSvg);
    btnDelete.addEventListener('click', () => deleteSalary(s.id));

    colActions.appendChild(btnEdit);
    colActions.appendChild(btnDelete);

    card.appendChild(colMain);
    card.appendChild(colGross);
    card.appendChild(colInhand);
    card.appendChild(colDed);
    card.appendChild(colActions);

    // Progress/Ratio Bar Row
    const progressRow = document.createElement('div');
    progressRow.classList.add('loan-progress-row');

    const progressTextRow = document.createElement('div');
    progressTextRow.classList.add('loan-progress-text-row');

    const progressLabel = document.createElement('span');
    progressLabel.classList.add('loan-progress-label');
    progressLabel.textContent = `Ratio: In-hand ${inhandPct.toFixed(0)}% vs. Deductions ${(100 - inhandPct).toFixed(0)}%`;
    progressTextRow.appendChild(progressLabel);

    const progressTrack = document.createElement('div');
    progressTrack.classList.add('loan-progress-track');

    const progressFill = document.createElement('div');
    progressFill.classList.add('loan-progress-fill');
    progressFill.style.width = `${inhandPct}%`;
    progressFill.style.background = 'var(--grad-emerald)';

    progressTrack.appendChild(progressFill);
    progressRow.appendChild(progressTextRow);
    progressRow.appendChild(progressTrack);

    card.appendChild(progressRow);
    container.appendChild(card);
  });

  // Render dual line chart
  renderSalaryChart(salaries);
}

function renderSalaryChart(data) {
  const container = document.getElementById('salary-chart-container');
  clearContainer(container);

  if (data.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.textContent = 'No salary chart data available.';
    emptyMsg.style.color = 'var(--text-muted)';
    container.appendChild(emptyMsg);
    return;
  }

  // Sort oldest first for linear time progression
  const chartData = [...data].sort((a, b) => a.month.localeCompare(b.month));

  const isMobile = window.innerWidth < 600;
  const svgWidth = isMobile ? 480 : 740;
  const svgHeight = isMobile ? 240 : 280;
  const margin = isMobile
    ? { top: 15, right: 10, bottom: 30, left: 45 }
    : { top: 20, right: 30, bottom: 40, left: 70 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  const svg = createSVGElement('svg');
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  svg.classList.add('svg-chart');

  // Custom Area Fill Gradients
  const defs = createSVGElement('defs');

  const inhandGrad = createSVGElement('linearGradient');
  inhandGrad.setAttribute('id', 'grad-inhand-area');
  inhandGrad.setAttribute('x1', '0%'); inhandGrad.setAttribute('y1', '0%');
  inhandGrad.setAttribute('x2', '0%'); inhandGrad.setAttribute('y2', '100%');
  const ihStop1 = createSVGElement('stop'); ihStop1.setAttribute('offset', '0%'); ihStop1.setAttribute('stop-color', '#10b981'); ihStop1.setAttribute('stop-opacity', '0.15');
  const ihStop2 = createSVGElement('stop'); ihStop2.setAttribute('offset', '100%'); ihStop2.setAttribute('stop-color', '#10b981'); ihStop2.setAttribute('stop-opacity', '0.00');
  inhandGrad.appendChild(ihStop1); inhandGrad.appendChild(ihStop2);
  defs.appendChild(inhandGrad);

  const dedGrad = createSVGElement('linearGradient');
  dedGrad.setAttribute('id', 'grad-ded-area');
  dedGrad.setAttribute('x1', '0%'); dedGrad.setAttribute('y1', '0%');
  dedGrad.setAttribute('x2', '0%'); dedGrad.setAttribute('y2', '100%');
  const dedStop1 = createSVGElement('stop'); dedStop1.setAttribute('offset', '0%'); dedStop1.setAttribute('stop-color', '#f43f5e'); dedStop1.setAttribute('stop-opacity', '0.12');
  const dedStop2 = createSVGElement('stop'); dedStop2.setAttribute('offset', '100%'); dedStop2.setAttribute('stop-color', '#f43f5e'); dedStop2.setAttribute('stop-opacity', '0.00');
  dedGrad.appendChild(dedStop1); dedGrad.appendChild(dedStop2);
  defs.appendChild(dedGrad);

  svg.appendChild(defs);

  // Find maximum values for Y axis scaling
  let maxVal = 0;
  chartData.forEach(s => {
    if (s.inhand > maxVal) maxVal = s.inhand;
    if (s.dedRules > maxVal) maxVal = s.dedRules;
    if (s.deduction > maxVal) maxVal = s.deduction;
  });
  maxVal = Math.max(10000, maxVal * 1.1); // Add a 10% safety margin and enforce minimum Y-bound

  // Draw Y grid lines and labels
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const ratio = i / ticks;
    const yVal = maxVal * ratio;
    const y = margin.top + chartHeight - (ratio * chartHeight);

    if (i > 0) {
      const line = createSVGElement('line');
      line.setAttribute('x1', margin.left.toString());
      line.setAttribute('y1', y.toString());
      line.setAttribute('x2', (margin.left + chartWidth).toString());
      line.setAttribute('y2', y.toString());
      line.classList.add('chart-grid-line');
      svg.appendChild(line);
    }

    const text = createSVGElement('text');
    text.setAttribute('x', (margin.left - 10).toString());
    text.setAttribute('y', (y + 4).toString());
    text.setAttribute('text-anchor', 'end');
    text.classList.add('chart-axis-text');

    let label = '';
    if (yVal >= 100000) {
      label = '₹' + (yVal / 100000).toFixed(1) + 'L';
    } else if (yVal >= 1000) {
      label = '₹' + (yVal / 1000).toFixed(0) + 'k';
    } else {
      label = '₹' + yVal.toFixed(0);
    }
    text.textContent = label;
    svg.appendChild(text);
  }

  const pointsCount = chartData.length;

  // Draw X axis grid and labels
  chartData.forEach((s, idx) => {
    const rx = pointsCount > 1 ? idx / (pointsCount - 1) : 0.5;
    const x = margin.left + (rx * chartWidth);

    // Label X (limit to maximum 6 labels for clean aesthetic spacing)
    const labelStep = Math.max(1, Math.ceil(pointsCount / 6));
    if (idx % labelStep === 0) {
      const text = createSVGElement('text');
      text.setAttribute('x', x.toString());
      text.setAttribute('y', (margin.top + chartHeight + (isMobile ? 16 : 20)).toString());
      text.setAttribute('text-anchor', 'middle');
      text.classList.add('chart-axis-text');
      text.textContent = formatMonthShort(s.month);
      svg.appendChild(text);
    }
  });

  // Coordinate scaling logic
  const scalePoint = (s, idx) => {
    const rx = pointsCount > 1 ? idx / (pointsCount - 1) : 0.5;
    const ryInhand = s.inhand / maxVal;
    const ryDed = s.deduction / maxVal;

    return {
      x: margin.left + (rx * chartWidth),
      yInhand: margin.top + chartHeight - (ryInhand * chartHeight),
      yDed: margin.top + chartHeight - (ryDed * chartHeight),
      inhand: s.inhand,
      deduction: s.deduction,
      month: s.month,
      notes: s.notes
    };
  };

  const mapped = chartData.map(scalePoint);

  if (pointsCount > 1) {
    // Area fill under Inhand
    const areaPathInhand = `M ${mapped[0].x} ${margin.top + chartHeight} ` +
      mapped.map(p => `L ${p.x} ${p.yInhand}`).join(' ') +
      ` L ${mapped[mapped.length - 1].x} ${margin.top + chartHeight} Z`;
    const areaInhand = createSVGElement('path');
    areaInhand.setAttribute('d', areaPathInhand);
    areaInhand.setAttribute('fill', 'url(#grad-inhand-area)');
    svg.appendChild(areaInhand);

    // Area fill under Deductions
    const areaPathDed = `M ${mapped[0].x} ${margin.top + chartHeight} ` +
      mapped.map(p => `L ${p.x} ${p.yDed}`).join(' ') +
      ` L ${mapped[mapped.length - 1].x} ${margin.top + chartHeight} Z`;
    const areaDed = createSVGElement('path');
    areaDed.setAttribute('d', areaPathDed);
    areaDed.setAttribute('fill', 'url(#grad-ded-area)');
    svg.appendChild(areaDed);

    // Polyline coordinates
    const polylineStrInhand = mapped.map(p => `${p.x},${p.yInhand}`).join(' ');
    const polylineStrDed = mapped.map(p => `${p.x},${p.yDed}`).join(' ');

    // Draw In-hand Line (Emerald)
    const lineInhand = createSVGElement('polyline');
    lineInhand.setAttribute('points', polylineStrInhand);
    lineInhand.setAttribute('fill', 'none');
    lineInhand.setAttribute('stroke', '#10b981');
    lineInhand.setAttribute('stroke-width', '3');
    svg.appendChild(lineInhand);

    // Draw Deductions Line (Rose)
    const lineDed = createSVGElement('polyline');
    lineDed.setAttribute('points', polylineStrDed);
    lineDed.setAttribute('fill', 'none');
    lineDed.setAttribute('stroke', '#f43f5e');
    lineDed.setAttribute('stroke-width', '3');
    svg.appendChild(lineDed);
  }

  // Draw points/dots and tooltips
  mapped.forEach(p => {
    // In-hand Point
    const dotInhand = createSVGElement('circle');
    dotInhand.setAttribute('cx', p.x.toString());
    dotInhand.setAttribute('cy', p.yInhand.toString());
    dotInhand.setAttribute('r', '5');
    dotInhand.setAttribute('fill', '#10b981');
    dotInhand.setAttribute('stroke', '#070913');
    dotInhand.setAttribute('stroke-width', '2');
    dotInhand.style.cursor = 'pointer';
    dotInhand.style.transition = 'transform 0.15s ease';

    dotInhand.addEventListener('mouseenter', () => dotInhand.setAttribute('r', '7'));
    dotInhand.addEventListener('mouseleave', () => {
      dotInhand.setAttribute('r', '5');
      hideTooltip();
    });

    dotInhand.addEventListener('mousemove', (e) => {
      const title = formatMonthLabel(p.month);
      const gross = p.inhand + p.deduction;
      const ratio = gross > 0 ? ((p.deduction / gross) * 100).toFixed(0) + '%' : '0%';
      showCustomTooltip(e, title, 'In-hand Credited:', formatCurrency(p.inhand), 'Deductions:', formatCurrency(p.deduction), `Gross Income: ${formatCurrency(gross)} (${ratio} deductions)`);
    });

    svg.appendChild(dotInhand);

    // Deduction Point
    const dotDed = createSVGElement('circle');
    dotDed.setAttribute('cx', p.x.toString());
    dotDed.setAttribute('cy', p.yDed.toString());
    dotDed.setAttribute('r', '5');
    dotDed.setAttribute('fill', '#f43f5e');
    dotDed.setAttribute('stroke', '#070913');
    dotDed.setAttribute('stroke-width', '2');
    dotDed.style.cursor = 'pointer';
    dotDed.style.transition = 'transform 0.15s ease';

    dotDed.addEventListener('mouseenter', () => dotDed.setAttribute('r', '7'));
    dotDed.addEventListener('mouseleave', () => {
      dotDed.setAttribute('r', '5');
      hideTooltip();
    });

    dotDed.addEventListener('mousemove', (e) => {
      const title = formatMonthLabel(p.month);
      const gross = p.inhand + p.deduction;
      const ratio = gross > 0 ? ((p.deduction / gross) * 100).toFixed(0) + '%' : '0%';
      showCustomTooltip(e, title, 'In-hand Credited:', formatCurrency(p.inhand), 'Deductions:', formatCurrency(p.deduction), `Gross Income: ${formatCurrency(gross)} (${ratio} deductions)`);
    });

    svg.appendChild(dotDed);
  });

  container.appendChild(svg);
}

// ==========================================
// EXPENSE TRACKER LOGIC
// ==========================================

function updateExpenseCategoryDropdown(selectedId = '') {
  const select = document.getElementById('input-expense-category');
  if (!select) return;
  clearContainer(select);

  expenseCategories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.name}`;
    if (cat.id === selectedId) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

function evaluateExpression(expr) {
  // Clean up spaces and replace × and ÷ if present
  expr = expr.replace(/×/g, '*').replace(/÷/g, '/');
  // Remove any invalid characters (only keep numbers, ., +, -, *, /, parentheses, spaces)
  expr = expr.replace(/[^0-9.+\-*/()\s]/g, '');

  if (!expr) return 0;

  try {
    const result = math.evaluate(expr);
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      throw new Error("Invalid result");
    }
    return Math.round(result * 100) / 100;
  } catch (err) {
    throw new Error("Invalid expression");
  }
}

function showExpenseWizardStep(stepNum) {
  const step1 = document.getElementById('expense-wizard-step-1');
  const step2 = document.getElementById('expense-wizard-step-2');
  if (stepNum === 1) {
    if (step1) step1.style.display = 'block';
    if (step2) step2.style.display = 'none';
  } else if (stepNum === 2) {
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'block';
  }
}

function showCalculatorError(msg) {
  const displayExpr = document.getElementById('calc-expression');
  if (displayExpr) {
    displayExpr.textContent = msg;
    displayExpr.style.color = 'var(--color-negative)';
  }
}

function clearCalculatorError() {
  const displayExpr = document.getElementById('calc-expression');
  if (displayExpr) {
    displayExpr.style.color = 'var(--color-text-muted)';
  }
}

function updateCalculatorUI() {
  const displayVal = document.getElementById('calc-display-val');
  const displayExpr = document.getElementById('calc-expression');
  if (!displayVal || !displayExpr) return;

  displayExpr.textContent = currentCalcExpression
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ')
    .replace(/\+/g, ' + ')
    .replace(/-/g, ' - ');

  if (!currentCalcExpression) {
    displayVal.textContent = '₹0';
  } else {
    const parts = currentCalcExpression.split(/[\+\-\*\/]/);
    const lastPart = parts[parts.length - 1];
    if (lastPart === '' && parts.length > 1) {
      displayVal.textContent = currentCalcExpression[currentCalcExpression.length - 1];
    } else {
      displayVal.textContent = lastPart ? '₹' + lastPart : '₹0';
    }
  }
}

function handleCalculatorInput(val) {
  clearCalculatorError();
  if (val === 'C') {
    currentCalcExpression = '';
  } else if (val === 'back') {
    if (currentCalcExpression.length > 0) {
      currentCalcExpression = currentCalcExpression.slice(0, -1);
    }
  } else if ('+-*/'.includes(val)) {
    if (currentCalcExpression.length > 0) {
      const lastChar = currentCalcExpression[currentCalcExpression.length - 1];
      if ('+-*/'.includes(lastChar)) {
        currentCalcExpression = currentCalcExpression.slice(0, -1) + val;
      } else {
        currentCalcExpression += val;
      }
    }
  } else if (val === '.') {
    const parts = currentCalcExpression.split(/[\+\-\*\/]/);
    const lastPart = parts[parts.length - 1];
    if (!lastPart.includes('.')) {
      if (lastPart === '') {
        currentCalcExpression += '0.';
      } else {
        currentCalcExpression += '.';
      }
    }
  } else {
    currentCalcExpression += val;
  }
  updateCalculatorUI();
}

function openExpenseModal(eObj = null) {
  const overlay = document.getElementById('expense-modal');
  const titleText = document.getElementById('expense-modal-title-text');

  const inputId = document.getElementById('input-expense-id');
  const inputAmount = document.getElementById('input-expense-amount');
  const inputDate = document.getElementById('input-expense-date');
  const inputCategory = document.getElementById('input-expense-category');
  const inputNotes = document.getElementById('input-expense-notes');

  updateExpenseCategoryDropdown(eObj ? eObj.categoryId : '');
  clearCalculatorError();

  if (eObj) {
    titleText.textContent = 'Edit Expense';
    inputId.value = eObj.id;
    inputAmount.value = eObj.amount;
    inputDate.value = eObj.date;
    inputCategory.value = eObj.categoryId;
    inputNotes.value = eObj.description || '';

    const finalAmtLabel = document.getElementById('calc-final-amount-label');
    if (finalAmtLabel) finalAmtLabel.textContent = `₹${eObj.amount}`;
    currentCalcExpression = eObj.amount.toString();
    updateCalculatorUI();

    showExpenseWizardStep(2);
  } else {
    titleText.textContent = 'Add Expense';
    inputId.value = '';
    inputAmount.value = '';

    const todayStr = new Date().toISOString().split('T')[0];
    if (inputDate) inputDate.value = todayStr;

    if (inputNotes) inputNotes.value = '';

    currentCalcExpression = '';
    updateCalculatorUI();
    showExpenseWizardStep(1);
  }
  if (overlay) overlay.classList.add('active-modal');
}

function closeExpenseModal() {
  const overlay = document.getElementById('expense-modal');
  if (overlay) overlay.classList.remove('active-modal');
}

function openCategoryModal() {
  const overlay = document.getElementById('category-modal');

  // Clear name input
  const nameInput = document.getElementById('input-category-name');
  if (nameInput) nameInput.value = '';

  // Reset emoji selection
  document.querySelectorAll('.emoji-item').forEach(el => el.classList.remove('active-emoji'));
  const firstEmoji = document.querySelector('.emoji-item');
  if (firstEmoji) {
    firstEmoji.classList.add('active-emoji');
    const inputEmoji = document.getElementById('input-category-emoji');
    if (inputEmoji) inputEmoji.value = firstEmoji.getAttribute('data-emoji');
  }

  if (overlay) overlay.classList.add('active-modal');
}

function closeCategoryModal() {
  const overlay = document.getElementById('category-modal');
  if (overlay) overlay.classList.remove('active-modal');
}

function openBudgetModal() {
  const overlay = document.getElementById('budget-modal');
  const inputBudget = document.getElementById('input-budget-amount');
  if (inputBudget) {
    inputBudget.value = getBudgetForMonth(selectedExpenseMonth);
  }
  if (overlay) overlay.classList.add('active-modal');
}

function closeBudgetModal() {
  const overlay = document.getElementById('budget-modal');
  if (overlay) overlay.classList.remove('active-modal');
}

function saveExpenseForm() {
  const id = document.getElementById('input-expense-id').value;
  const amount = Number(document.getElementById('input-expense-amount').value);
  const date = document.getElementById('input-expense-date').value;
  const categoryId = document.getElementById('input-expense-category').value;
  const description = document.getElementById('input-expense-notes').value;

  if (!amount || !date || !categoryId) {
    alert('Please fill out all required fields!');
    return;
  }

  if (id) {
    const idx = expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      const oldAmount = expenses[idx].amount;
      expenses[idx] = {
        ...expenses[idx],
        amount,
        date,
        categoryId,
        description
      };
      adjustDefaultSavingsBalance(oldAmount - amount);
    }
  } else {
    const newId = 'exp-' + Math.random().toString(36).substring(2, 9);
    expenses.push({
      id: newId,
      amount,
      date,
      categoryId,
      description
    });
    adjustDefaultSavingsBalance(-amount);
  }

  saveToStorage();
  closeExpenseModal();
  renderExpenses();
}

function deleteExpense(id) {
  // TODO(security): Standard browser confirm dialog is used here due to pure client-side vanilla JS architecture constraints.
  if (confirm('Are you sure you want to delete this expense?')) {
    const target = expenses.find(e => e.id === id);
    if (target) {
      adjustDefaultSavingsBalance(target.amount);
    }
    expenses = expenses.filter(e => e.id !== id);
    saveToStorage();
    renderExpenses();
  }
}

function saveCategoryForm() {
  const name = document.getElementById('input-category-name').value.trim();
  const icon = document.getElementById('input-category-emoji').value.trim() || '🌀';

  if (!name) {
    alert('Category name is required!');
    return;
  }

  // Check duplicate
  const duplicate = expenseCategories.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    alert('A category with this name already exists!');
    return;
  }

  const catId = 'cat-' + Math.random().toString(36).substring(2, 9);
  expenseCategories.push({
    id: catId,
    name,
    icon,
    isDefault: false
  });

  saveToStorage();
  closeCategoryModal();

  // Re-populate dropdown and auto select new category
  updateExpenseCategoryDropdown(catId);
}

function saveBudgetForm() {
  const amount = Number(document.getElementById('input-budget-amount').value);
  if (amount < 0 || isNaN(amount)) {
    alert('Budget amount must be a positive number!');
    return;
  }

  if (selectedExpenseMonth) {
    monthlyBudgets[selectedExpenseMonth] = amount;
  } else {
    globalBudget = amount;
  }

  saveToStorage();
  closeBudgetModal();
  renderExpenses();
}

function renderExpenses() {
  const container = document.getElementById('expense-list-container');
  clearContainer(container);

  // Default filter month to latest month in expenses or current month if empty
  const filterMonthInput = document.getElementById('input-expense-month');
  if (filterMonthInput) {
    if (!selectedExpenseMonth) {
      // Try to find latest month in expenses
      if (expenses.length > 0) {
        // Sort newest first
        const sortedDates = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
        selectedExpenseMonth = sortedDates[0].date.slice(0, 7); // YYYY-MM
      } else {
        const now = new Date();
        selectedExpenseMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      }
      filterMonthInput.value = selectedExpenseMonth;
    } else {
      filterMonthInput.value = selectedExpenseMonth;
    }
  }

  // Filter expenses by selected month
  const monthlyExpenses = expenses.filter(e => e.date.startsWith(selectedExpenseMonth));

  // Compute Total Month Spent
  let totalSpent = 0;
  monthlyExpenses.forEach(e => {
    totalSpent += Number(e.amount);
  });

  // Calculate remaining budget
  const currentBudget = getBudgetForMonth(selectedExpenseMonth);
  const remainingBudget = currentBudget - totalSpent;
  const remainingBudgetCard = document.getElementById('card-remaining-budget');

  // Find salary entry for this month
  const salaryEntry = salaries.find(s => s.month === selectedExpenseMonth);
  const salaryInhand = salaryEntry ? Number(salaryEntry.inhand) : 0;
  const salarySurplus = salaryInhand - totalSpent;

  // Render stats texts
  document.getElementById('val-total-expenses').textContent = formatCurrency(totalSpent);
  document.getElementById('val-monthly-budget').textContent = formatCurrency(currentBudget);
  document.getElementById('val-remaining-budget').textContent = formatCurrency(remainingBudget);

  // Compute Today's Expenses
  const todayStr = new Date().toISOString().slice(0, 10);
  let todaySpent = 0;
  expenses.forEach(e => {
    if (e.date === todayStr) {
      todaySpent += Number(e.amount);
    }
  });
  const todayExpensesVal = document.getElementById('val-today-expenses');
  if (todayExpensesVal) {
    todayExpensesVal.textContent = formatCurrency(todaySpent);
  }

  const valSurplus = document.getElementById('val-salary-balance');
  const lblSurplus = document.getElementById('lbl-salary-balance');
  const cardSurplus = document.getElementById('card-salary-balance');

  if (salaryEntry) {
    valSurplus.textContent = formatCurrency(salarySurplus);
    lblSurplus.textContent = `Surplus of ${formatMonthShort(selectedExpenseMonth)} Salary`;
    if (salarySurplus >= 0) {
      cardSurplus.className = 'metric-card success';
    } else {
      cardSurplus.className = 'metric-card danger';
    }
  } else {
    valSurplus.textContent = '₹0';
    lblSurplus.textContent = 'No salary entry this month';
    cardSurplus.className = 'metric-card blue';
  }

  // Update budget card visual indicators
  if (remainingBudget >= 0) {
    if (remainingBudgetCard) remainingBudgetCard.className = 'metric-card success';
  } else {
    if (remainingBudgetCard) remainingBudgetCard.className = 'metric-card danger';
  }

  // Filter based on search query
  const filteredExpenses = monthlyExpenses.filter(e => {
    const cat = expenseCategories.find(c => c.id === e.categoryId) || { name: 'Others', icon: '🌀' };
    const notesMatch = (e.description || '').toLowerCase().includes(searchQueryExpenses.toLowerCase());
    const catMatch = cat.name.toLowerCase().includes(searchQueryExpenses.toLowerCase());
    return notesMatch || catMatch;
  });

  // Sort newest first
  filteredExpenses.sort((a, b) => b.date.localeCompare(a.date));

  // Update count badge
  const historyCount = document.getElementById('expense-history-count');
  if (historyCount) {
    historyCount.textContent = `${filteredExpenses.length} item${filteredExpenses.length === 1 ? '' : 's'}`;
  }

  // Render list cards
  if (filteredExpenses.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.classList.add('empty-state');

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.5');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    icon.classList.add('empty-icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z');
    icon.appendChild(path);

    const title = document.createElement('h4');
    title.classList.add('empty-title');
    title.textContent = 'No expenses found';

    const desc = document.createElement('p');
    desc.classList.add('empty-desc');
    desc.textContent = monthlyExpenses.length === 0
      ? 'Track your spending for this month by clicking "Add Expense".'
      : 'No active expense entries match your search query.';

    emptyState.appendChild(icon);
    emptyState.appendChild(title);
    emptyState.appendChild(desc);
    container.appendChild(emptyState);
  } else {
    filteredExpenses.forEach(e => {
      const cat = expenseCategories.find(c => c.id === e.categoryId) || { name: 'Others', icon: '🌀' };

      const card = document.createElement('div');
      card.classList.add('investment-card');

      const colMain = document.createElement('div');
      colMain.classList.add('asset-main-info');
      colMain.style.flexDirection = 'row';
      colMain.style.alignItems = 'center';
      colMain.style.gap = '12px';
      colMain.style.minWidth = '180px';

      const iconBox = document.createElement('div');
      iconBox.classList.add('expense-category-icon');
      iconBox.textContent = cat.icon;
      colMain.appendChild(iconBox);

      const infoText = document.createElement('div');
      infoText.style.display = 'flex';
      infoText.style.flexDirection = 'column';

      const catText = document.createElement('span');
      catText.classList.add('asset-name');
      catText.textContent = cat.name;

      const dateText = document.createElement('span');
      dateText.style.fontSize = '0.73rem';
      dateText.style.color = 'var(--text-muted)';
      dateText.textContent = e.date;

      infoText.appendChild(catText);
      infoText.appendChild(dateText);
      colMain.appendChild(infoText);

      const colDesc = document.createElement('div');
      colDesc.classList.add('asset-data-col');
      colDesc.style.flexGrow = '1';
      colDesc.style.textAlign = 'left';

      const lblDesc = document.createElement('span');
      lblDesc.classList.add('asset-data-label');
      lblDesc.textContent = 'Description';

      const valDesc = document.createElement('span');
      valDesc.classList.add('asset-data-value');
      valDesc.style.fontWeight = 'normal';
      valDesc.style.color = 'var(--color-text-secondary)';
      valDesc.textContent = e.description || '—';

      colDesc.appendChild(lblDesc);
      colDesc.appendChild(valDesc);

      const colAmt = document.createElement('div');
      colAmt.classList.add('asset-data-col');
      colAmt.style.minWidth = '90px';
      colAmt.style.textAlign = 'right';

      const lblAmt = document.createElement('span');
      lblAmt.classList.add('asset-data-label');
      lblAmt.textContent = 'Spent';

      const valAmt = document.createElement('span');
      valAmt.classList.add('asset-data-value');
      valAmt.style.color = 'var(--color-negative)';
      valAmt.style.fontWeight = '700';
      valAmt.textContent = formatCurrency(e.amount);

      colAmt.appendChild(lblAmt);
      colAmt.appendChild(valAmt);

      // Actions Column
      const colActions = document.createElement('div');
      colActions.classList.add('card-actions');

      const btnEdit = document.createElement('button');
      btnEdit.className = 'icon-btn';
      btnEdit.setAttribute('aria-label', 'Edit Expense Entry');
      const editSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      editSvg.setAttribute('viewBox', '0 0 24 24');
      editSvg.setAttribute('fill', 'none');
      editSvg.setAttribute('stroke', 'currentColor');
      editSvg.setAttribute('stroke-width', '2');
      editSvg.setAttribute('width', '16');
      editSvg.setAttribute('height', '16');
      const editPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      editPath.setAttribute('d', 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z');
      editSvg.appendChild(editPath);
      btnEdit.appendChild(editSvg);
      btnEdit.addEventListener('click', () => openExpenseModal(e));

      const btnDelete = document.createElement('button');
      btnDelete.className = 'icon-btn';
      btnDelete.setAttribute('aria-label', 'Delete Expense Entry');
      btnDelete.style.color = 'var(--color-danger)';
      const deleteSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      deleteSvg.setAttribute('viewBox', '0 0 24 24');
      deleteSvg.setAttribute('fill', 'none');
      deleteSvg.setAttribute('stroke', 'currentColor');
      deleteSvg.setAttribute('stroke-width', '2');
      deleteSvg.setAttribute('width', '16');
      deleteSvg.setAttribute('height', '16');
      const deletePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      deletePath.setAttribute('d', 'M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2');
      deleteSvg.appendChild(deletePath);
      btnDelete.appendChild(deleteSvg);
      btnDelete.addEventListener('click', () => deleteExpense(e.id));

      colActions.appendChild(btnEdit);
      colActions.appendChild(btnDelete);

      card.appendChild(colMain);
      card.appendChild(colDesc);
      card.appendChild(colAmt);
      card.appendChild(colActions);

      container.appendChild(card);
    });
  }

  // Draw Charts
  renderExpenseCategoryChart(monthlyExpenses, totalSpent);
  renderExpenseDailyTrendChart(monthlyExpenses);
  renderExpenseTrendChart();
}

function renderExpenseCategoryChart(monthlyExpenses, totalSpent) {
  const container = document.getElementById('expense-category-chart-container');
  const legend = document.getElementById('expense-category-legend');
  clearContainer(container);
  clearContainer(legend);
  const currentBudget = getBudgetForMonth(selectedExpenseMonth);

  if (totalSpent === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.textContent = 'No expenses this month.';
    emptyMsg.style.color = 'var(--text-muted)';
    emptyMsg.style.fontSize = '0.82rem';
    container.appendChild(emptyMsg);
    return;
  }

  // Aggregate by category
  const categoryTotals = {};
  monthlyExpenses.forEach(e => {
    categoryTotals[e.categoryId] = (categoryTotals[e.categoryId] || 0) + Number(e.amount);
  });

  const items = Object.keys(categoryTotals).map(catId => {
    const cat = expenseCategories.find(c => c.id === catId) || { name: 'Others', icon: '🌀' };
    return {
      key: catId,
      name: cat.name,
      icon: cat.icon,
      value: categoryTotals[catId],
      pct: (categoryTotals[catId] / totalSpent) * 100
    };
  }).sort((a, b) => b.value - a.value);

  // Generate color palette based on standard colors for categories
  const colors = [
    '#f43f5e', '#a855f7', '#6366f1', '#0ea5e9', '#14b8a6', '#10b981',
    '#f59e0b', '#eab308', '#ec4899', '#3b82f6', '#84cc16', '#64748b'
  ];

  items.forEach((item, idx) => {
    item.color = colors[idx % colors.length];
    item.colorDark = colors[idx % colors.length];
  });

  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const r_out = 140;
  const r_in = 80;

  const svg = createSVGElement('svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.classList.add('svg-chart');
  svg.style.width = '100%';
  svg.style.height = 'auto';
  svg.style.maxWidth = '220px';
  svg.style.maxHeight = '220px';

  // Custom Defs for dynamic linear gradients matching item color
  const defs = createSVGElement('defs');
  items.forEach(item => {
    const grad = createSVGElement('linearGradient');
    grad.setAttribute('id', `grad-expense-${item.key}`);
    grad.setAttribute('x1', '0%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y2', '100%');

    const stop1 = createSVGElement('stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', item.color);

    const stop2 = createSVGElement('stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', item.color);

    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
  });
  svg.appendChild(defs);

  const slicesGroup = createSVGElement('g');
  svg.appendChild(slicesGroup);

  const resetAllSlices = () => {
    slicesGroup.querySelectorAll('.chart-slice').forEach(p => {
      p.style.transform = '';
      p.style.filter = '';
    });
    legend.querySelectorAll('.legend-item').forEach(li => {
      li.style.transform = '';
      li.style.backgroundColor = '';
    });
  };

  svg.addEventListener('mouseleave', resetAllSlices);
  legend.addEventListener('mouseleave', resetAllSlices);

  let currentAngle = -Math.PI / 2;

  items.forEach((item) => {
    let angleRange = (item.pct / 100) * 2 * Math.PI;
    if (item.pct >= 99.99) {
      angleRange = 2 * Math.PI - 0.0001;
    }
    const endAngle = currentAngle + angleRange;

    const path = createSVGElement('path');
    path.classList.add('chart-slice');

    const x1_out = cx + r_out * Math.cos(currentAngle);
    const y1_out = cy + r_out * Math.sin(currentAngle);
    const x2_out = cx + r_out * Math.cos(endAngle);
    const y2_out = cy + r_out * Math.sin(endAngle);

    const x1_in = cx + r_in * Math.cos(currentAngle);
    const y1_in = cy + r_in * Math.sin(currentAngle);
    const x2_in = cx + r_in * Math.cos(endAngle);
    const y2_in = cy + r_in * Math.sin(endAngle);

    const largeArc = angleRange > Math.PI ? 1 : 0;
    const d = `M ${x1_out} ${y1_out} A ${r_out} ${r_out} 0 ${largeArc} 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${r_in} ${r_in} 0 ${largeArc} 0 ${x1_in} ${y1_in} Z`;

    path.setAttribute('d', d);
    path.setAttribute('fill', `url(#grad-expense-${item.key})`);

    const midAngle = currentAngle + angleRange / 2;
    const popDistance = 10;
    const dx = popDistance * Math.cos(midAngle);
    const dy = popDistance * Math.sin(midAngle);

    path.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s ease';
    path.style.transformOrigin = 'center';

    path.addEventListener('mouseenter', () => {
      resetAllSlices();
      slicesGroup.appendChild(path);
      path.style.transform = `translate(${dx}px, ${dy}px)`;
      path.style.filter = `drop-shadow(0px 6px 12px ${item.color}66)`;
    });

    path.addEventListener('mouseleave', () => {
      path.style.transform = '';
      path.style.filter = '';
    });

    path.addEventListener('mousemove', (e) => {
      showCustomTooltip(e, `${item.icon} ${item.name}`, 'Amount Spent:', formatCurrency(item.value), 'Share of Month:', item.pct.toFixed(1) + '%', 'Monthly Budget: ' + formatCurrency(currentBudget));
    });
    path.addEventListener('mouseleave', hideTooltip);

    slicesGroup.appendChild(path);
    currentAngle = endAngle;

    // Legend item
    const legItem = document.createElement('div');
    legItem.classList.add('legend-item');
    legItem.style.display = 'flex';
    legItem.style.justifyContent = 'space-between';
    legItem.style.alignItems = 'center';
    legItem.style.padding = '4px 6px';
    legItem.style.borderRadius = 'var(--radius-sm)';
    legItem.style.transition = 'transform 0.2s, background-color 0.2s';
    legItem.style.cursor = 'default';

    const infoCol = document.createElement('div');
    infoCol.classList.add('legend-info');

    const dot = document.createElement('span');
    dot.classList.add('legend-color-box');
    dot.style.background = item.color;
    dot.style.width = '10px';
    dot.style.height = '10px';
    dot.style.borderRadius = '50%';
    dot.style.display = 'inline-block';
    dot.style.marginRight = '8px';

    const textLabel = document.createElement('span');
    textLabel.classList.add('legend-name');
    textLabel.textContent = `${item.icon} ${item.name}`;

    infoCol.appendChild(dot);
    infoCol.appendChild(textLabel);

    const valCol = document.createElement('div');
    valCol.classList.add('legend-val');
    valCol.style.display = 'flex';
    valCol.style.alignItems = 'center';

    const numSpan = document.createElement('span');
    numSpan.textContent = formatCurrency(item.value);

    const pctSpan = document.createElement('span');
    pctSpan.classList.add('legend-pct-expenses');
    pctSpan.textContent = `(${item.pct.toFixed(0)}%)`;

    valCol.appendChild(numSpan);
    valCol.appendChild(pctSpan);

    legItem.appendChild(infoCol);
    legItem.appendChild(valCol);

    legItem.addEventListener('mouseenter', (e) => {
      resetAllSlices();
      slicesGroup.appendChild(path);
      path.style.transform = `translate(${dx}px, ${dy}px)`;
      path.style.filter = `drop-shadow(0px 6px 12px ${item.color}66)`;
      legItem.style.transform = 'translateX(4px)';
      legItem.style.backgroundColor = 'var(--bg-light)';
      showCustomTooltip(e, `${item.icon} ${item.name}`, 'Amount Spent:', formatCurrency(item.value), 'Share of Month:', item.pct.toFixed(1) + '%', 'Monthly Budget: ' + formatCurrency(currentBudget));
    });

    legItem.addEventListener('mousemove', (e) => {
      showCustomTooltip(e, `${item.icon} ${item.name}`, 'Amount Spent:', formatCurrency(item.value), 'Share of Month:', item.pct.toFixed(1) + '%', 'Monthly Budget: ' + formatCurrency(currentBudget));
    });

    legItem.addEventListener('mouseleave', () => {
      path.style.transform = '';
      path.style.filter = '';
      legItem.style.transform = '';
      legItem.style.backgroundColor = '';
      hideTooltip();
    });

    legend.appendChild(legItem);
  });

  const innerCircle = createSVGElement('circle');
  innerCircle.setAttribute('cx', cx.toString());
  innerCircle.setAttribute('cy', cy.toString());
  innerCircle.setAttribute('r', (r_in - 2).toString());
  innerCircle.setAttribute('fill', 'var(--color-surface)');
  svg.appendChild(innerCircle);

  container.appendChild(svg);
}

function renderExpenseTrendChart() {
  const container = document.getElementById('expense-trend-chart-container');
  clearContainer(container);

  if (expenses.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.textContent = 'No expense trend data available.';
    emptyMsg.style.color = 'var(--text-muted)';
    emptyMsg.style.fontSize = '0.82rem';
    container.appendChild(emptyMsg);
    return;
  }

  const trendMonths = [];
  const [selYear, selMonth] = selectedExpenseMonth.split('-').map(Number);
  for (let i = 5; i >= 0; i--) {
    let year = selYear;
    let month = selMonth - i;
    if (month <= 0) {
      month += 12;
      year -= 1;
    }
    trendMonths.push(`${year}-${String(month).padStart(2, '0')}`);
  }

  const trendData = trendMonths.map(m => {
    let total = 0;
    expenses.forEach(e => {
      if (e.date.startsWith(m)) {
        total += Number(e.amount);
      }
    });
    return { month: m, amount: total };
  });

  const isMobile = window.innerWidth < 600;
  const svgWidth = isMobile ? 420 : 640;
  const svgHeight = 280;
  const margin = { top: 25, right: 20, bottom: 40, left: 60 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  const svg = createSVGElement('svg');
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  svg.classList.add('svg-chart');

  // Gradient definitions
  const defs = createSVGElement('defs');
  const barGrad = createSVGElement('linearGradient');
  barGrad.setAttribute('id', 'grad-expense-bar');
  barGrad.setAttribute('x1', '0%'); barGrad.setAttribute('y1', '0%');
  barGrad.setAttribute('x2', '0%'); barGrad.setAttribute('y2', '100%');
  const stop1 = createSVGElement('stop'); stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', '#f43f5e');
  const stop2 = createSVGElement('stop'); stop2.setAttribute('offset', '100%'); stop2.setAttribute('stop-color', '#e11d48');
  barGrad.appendChild(stop1); barGrad.appendChild(stop2);
  defs.appendChild(barGrad);
  svg.appendChild(defs);

  let maxVal = 0;
  trendData.forEach(d => {
    if (d.amount > maxVal) maxVal = d.amount;
  });
  const currentBudget = getBudgetForMonth(selectedExpenseMonth);
  maxVal = Math.max(currentBudget, maxVal);
  maxVal = Math.max(10000, maxVal * 1.15);

  // Draw Y grid lines & labels
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const ratio = i / ticks;
    const yVal = maxVal * ratio;
    const y = margin.top + chartHeight - (ratio * chartHeight);

    if (i > 0) {
      const line = createSVGElement('line');
      line.setAttribute('x1', margin.left.toString());
      line.setAttribute('y1', y.toString());
      line.setAttribute('x2', (margin.left + chartWidth).toString());
      line.setAttribute('y2', y.toString());
      line.classList.add('chart-grid-line');
      svg.appendChild(line);
    }

    const text = createSVGElement('text');
    text.setAttribute('x', (margin.left - 10).toString());
    text.setAttribute('y', (y + 4).toString());
    text.setAttribute('text-anchor', 'end');
    text.classList.add('chart-axis-text');
    text.textContent = formatCurrency(yVal);
    svg.appendChild(text);
  }

  // Draw Budget Line
  const budgetY = margin.top + chartHeight - ((currentBudget / maxVal) * chartHeight);
  if (budgetY >= margin.top && budgetY <= margin.top + chartHeight) {
    const bLine = createSVGElement('line');
    bLine.setAttribute('x1', margin.left.toString());
    bLine.setAttribute('y1', budgetY.toString());
    bLine.setAttribute('x2', (margin.left + chartWidth).toString());
    bLine.setAttribute('y2', budgetY.toString());
    bLine.setAttribute('stroke', '#a855f7');
    bLine.setAttribute('stroke-width', '2');
    bLine.setAttribute('stroke-dasharray', '5 4');
    svg.appendChild(bLine);

    const bText = createSVGElement('text');
    bText.setAttribute('x', (margin.left + chartWidth - 5).toString());
    bText.setAttribute('y', (budgetY - 5).toString());
    bText.setAttribute('text-anchor', 'end');
    bText.setAttribute('fill', '#a855f7');
    bText.style.fontSize = '9px';
    bText.style.fontWeight = 'bold';
    bText.textContent = `Budget: ${formatCurrency(currentBudget)}`;
    svg.appendChild(bText);
  }

  // Draw bars
  const barWidth = (chartWidth / trendData.length) * 0.55;
  const groupWidth = chartWidth / trendData.length;

  trendData.forEach((d, idx) => {
    const x = margin.left + (idx * groupWidth) + (groupWidth - barWidth) / 2;
    const barHeight = (d.amount / maxVal) * chartHeight;
    const y = margin.top + chartHeight - barHeight;

    const rect = createSVGElement('rect');
    rect.setAttribute('x', x.toString());
    rect.setAttribute('y', y.toString());
    rect.setAttribute('width', barWidth.toString());
    rect.setAttribute('height', Math.max(2, barHeight).toString());
    rect.setAttribute('rx', '4');
    rect.setAttribute('ry', '4');
    rect.setAttribute('fill', 'url(#grad-expense-bar)');
    rect.style.cursor = 'pointer';
    rect.style.transition = 'opacity 0.2s';

    rect.addEventListener('mouseenter', () => rect.style.opacity = '0.8');
    rect.addEventListener('mouseleave', () => {
      rect.style.opacity = '1';
      hideTooltip();
    });

    rect.addEventListener('mousemove', (e) => {
      const title = formatMonthLabel(d.month);
      const mBudget = getBudgetForMonth(d.month);
      const percentOfBudget = mBudget > 0 ? ((d.amount / mBudget) * 100).toFixed(0) + '%' : 'N/A';
      showCustomTooltip(e, title, 'Total Spent:', formatCurrency(d.amount), 'Budget Usage:', percentOfBudget, 'Monthly Limit: ' + formatCurrency(mBudget));
    });

    svg.appendChild(rect);

    const text = createSVGElement('text');
    text.setAttribute('x', (x + barWidth / 2).toString());
    text.setAttribute('y', (margin.top + chartHeight + 18).toString());
    text.setAttribute('text-anchor', 'middle');
    text.classList.add('chart-axis-text');
    text.textContent = formatMonthShort(d.month);
    svg.appendChild(text);

    if (d.amount > 0) {
      const valText = createSVGElement('text');
      valText.setAttribute('x', (x + barWidth / 2).toString());
      valText.setAttribute('y', (y - 6).toString());
      valText.setAttribute('text-anchor', 'middle');
      valText.classList.add('chart-bar-value');
      valText.style.fontSize = '8px';
      valText.textContent = formatCurrency(d.amount);
      svg.appendChild(valText);
    }
  });

  container.appendChild(svg);
}

function formatChartLabel(amount) {
  const num = Number(amount);
  if (isNaN(num)) return '₹0';
  const sign = num < 0 ? '-' : '';
  const absNum = Math.abs(num);

  let formatted = '';
  if (absNum >= 10000000) {
    formatted = (absNum / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
  } else if (absNum >= 100000) {
    formatted = (absNum / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  } else if (absNum >= 1000) {
    formatted = (absNum / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  } else {
    formatted = Math.round(absNum).toString();
  }
  return `${sign}₹${formatted}`;
}

function renderExpenseDailyTrendChart(monthlyExpenses) {
  const container = document.getElementById('expense-daily-trend-chart-container');
  if (!container) return;
  clearContainer(container);

  if (monthlyExpenses.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.textContent = 'No daily trend data available.';
    emptyMsg.style.color = 'var(--text-muted)';
    emptyMsg.style.fontSize = '0.82rem';
    container.appendChild(emptyMsg);
    return;
  }

  const [yearStr, monthStr] = selectedExpenseMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const numDays = new Date(year, month, 0).getDate();

  // Initialize daily totals
  const dailyTotals = Array(numDays).fill(0);
  monthlyExpenses.forEach(e => {
    const d = new Date(e.date);
    if (!isNaN(d.getTime())) {
      const dayNum = d.getDate();
      if (dayNum >= 1 && dayNum <= numDays) {
        dailyTotals[dayNum - 1] += Number(e.amount);
      }
    }
  });

  const isMobile = window.innerWidth < 600;
  const svgWidth = isMobile ? 420 : 640;
  const svgHeight = 280;
  const margin = { top: 25, right: 15, bottom: 40, left: 55 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;

  const svg = createSVGElement('svg');
  svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
  svg.classList.add('svg-chart');

  // Gradients
  const defs = createSVGElement('defs');
  const barGrad = createSVGElement('linearGradient');
  barGrad.setAttribute('id', 'grad-expense-daily-bar');
  barGrad.setAttribute('x1', '0%'); barGrad.setAttribute('y1', '0%');
  barGrad.setAttribute('x2', '0%'); barGrad.setAttribute('y2', '100%');

  const stop1 = createSVGElement('stop'); stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', 'var(--color-accent)');
  const stop2 = createSVGElement('stop'); stop2.setAttribute('offset', '100%'); stop2.setAttribute('stop-color', 'var(--color-accent-dark)');
  barGrad.appendChild(stop1); barGrad.appendChild(stop2);
  defs.appendChild(barGrad);
  svg.appendChild(defs);

  // Find max value
  let maxVal = Math.max(...dailyTotals);
  maxVal = Math.max(1000, maxVal * 1.15); // Add padding on top

  // Y-Axis Gridlines and Labels
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const val = (maxVal / yTicks) * i;
    const y = margin.top + chartHeight - (val / maxVal) * chartHeight;

    // Gridline
    if (i > 0) {
      const gridline = createSVGElement('line');
      gridline.setAttribute('x1', margin.left.toString());
      gridline.setAttribute('y1', y.toString());
      gridline.setAttribute('x2', (margin.left + chartWidth).toString());
      gridline.setAttribute('y2', y.toString());
      gridline.setAttribute('stroke', 'var(--color-border)');
      gridline.setAttribute('stroke-dasharray', '3,3');
      svg.appendChild(gridline);
    }

    // Label
    const label = createSVGElement('text');
    label.setAttribute('x', (margin.left - 8).toString());
    label.setAttribute('y', (y + 4).toString());
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('fill', 'var(--color-text-muted)');
    label.style.fontSize = '0.68rem';
    label.style.fontFamily = 'var(--font-body)';
    label.textContent = formatChartLabel(val);
    svg.appendChild(label);
  }

  // X-Axis Labels
  const dayStep = isMobile ? 10 : 5;
  for (let d = 1; d <= numDays; d++) {
    if (d === 1 || d % dayStep === 0 || d === numDays) {
      const x = margin.left + ((d - 0.5) / numDays) * chartWidth;
      const label = createSVGElement('text');
      label.setAttribute('x', x.toString());
      label.setAttribute('y', (margin.top + chartHeight + 18).toString());
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', 'var(--color-text-muted)');
      label.style.fontSize = '0.68rem';
      label.style.fontFamily = 'var(--font-body)';
      label.textContent = d.toString();
      svg.appendChild(label);
    }
  }

  // Draw bars
  const barGapFactor = 0.25;
  const daySpace = chartWidth / numDays;
  const barWidth = daySpace * (1 - barGapFactor);

  for (let i = 0; i < numDays; i++) {
    const dayVal = dailyTotals[i];
    if (dayVal === 0) continue;

    const barHeight = (dayVal / maxVal) * chartHeight;
    const x = margin.left + i * daySpace + (daySpace - barWidth) / 2;
    const y = margin.top + chartHeight - barHeight;

    const rect = createSVGElement('rect');
    rect.setAttribute('x', x.toString());
    rect.setAttribute('y', y.toString());
    rect.setAttribute('width', barWidth.toString());
    rect.setAttribute('height', Math.max(2, barHeight).toString());
    rect.setAttribute('rx', Math.min(3, barWidth / 2).toString());
    rect.setAttribute('fill', 'url(#grad-expense-daily-bar)');

    rect.style.transition = 'opacity 0.2s ease, filter 0.2s ease';
    rect.style.cursor = 'pointer';

    rect.addEventListener('mouseenter', (e) => {
      rect.style.opacity = '0.85';
      rect.style.filter = 'drop-shadow(0px 2px 4px var(--color-accent))';
      const formattedDate = `${yearStr}-${monthStr}-${String(i + 1).padStart(2, '0')}`;
      showCustomTooltip(e, `Date: ${formattedDate}`, 'Daily Expenses:', formatCurrency(dayVal));
    });

    rect.addEventListener('mousemove', (e) => {
      const formattedDate = `${yearStr}-${monthStr}-${String(i + 1).padStart(2, '0')}`;
      showCustomTooltip(e, `Date: ${formattedDate}`, 'Daily Expenses:', formatCurrency(dayVal));
    });

    rect.addEventListener('mouseleave', () => {
      rect.style.opacity = '1';
      rect.style.filter = '';
      hideTooltip();
    });

    svg.appendChild(rect);
  }

  // X-Axis baseline
  const baseline = createSVGElement('line');
  baseline.setAttribute('x1', margin.left.toString());
  baseline.setAttribute('y1', (margin.top + chartHeight).toString());
  baseline.setAttribute('x2', (margin.left + chartWidth).toString());
  baseline.setAttribute('y2', (margin.top + chartHeight).toString());
  baseline.setAttribute('stroke', 'var(--color-border)');
  baseline.setAttribute('stroke-width', '1');
  svg.appendChild(baseline);

  container.appendChild(svg);
}

function initCalculatorSliders() {
  const sSip = document.getElementById('slider-sip');
  const sYears = document.getElementById('slider-years');
  const sRor = document.getElementById('slider-ror');

  const handleUpdate = () => {
    renderProjections();
  };

  sSip.addEventListener('input', handleUpdate);
  sYears.addEventListener('input', handleUpdate);
  sRor.addEventListener('input', handleUpdate);
}

function initMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const toggleBtn = document.getElementById('btn-sidebar-toggle');
  const closeBtn = document.getElementById('btn-sidebar-close');
  const navLinks = document.querySelectorAll('.nav-link');

  const openSidebar = () => {
    if (sidebar) sidebar.classList.add('sidebar-open');
    if (overlay) overlay.classList.add('active');
  };

  const closeSidebar = () => {
    if (sidebar) sidebar.classList.remove('sidebar-open');
    if (overlay) overlay.classList.remove('active');
  };

  if (toggleBtn) {
    toggleBtn.addEventListener('click', openSidebar);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeSidebar);
  }

  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  // Auto-close sidebar on mobile when a navigation link is clicked
  navLinks.forEach(link => {
    link.addEventListener('click', closeSidebar);
  });
}

// Debounced resize event listener to re-render charts when screen changes dimensions
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const activeTabLink = document.querySelector('.nav-link.active');
    const activeTabName = activeTabLink ? activeTabLink.getAttribute('data-tab') : 'dashboard';

    if (activeTabName === 'dashboard') {
      const totalPortfolioVal = investments.reduce((sum, inv) => sum + (Number(inv.currentAmount) || 0), 0);
      if (totalPortfolioVal > 0) {
        renderAllocationChart(totalPortfolioVal);
        renderPerformanceChart();
        renderDashboardHistoryChart(getPortfolioHistory());
        renderNetWorthChart(getNetWorthHistory());
      }
      renderProjections();
    } else if (activeTabName === 'salary') {
      renderSalaryChart(salaries);
    }
  }, 150);
});

function initDashboardSectionToggles() {
  const headers = document.querySelectorAll('.dashboard-section .section-header');
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const parent = header.closest('.dashboard-section');
      if (parent) {
        parent.classList.toggle('collapsed');
      }
    });
  });

  const insightsHeader = document.querySelector('.insights-header');
  if (insightsHeader) {
    insightsHeader.addEventListener('click', () => {
      const parent = insightsHeader.closest('.insights-card');
      if (parent) {
        parent.classList.toggle('collapsed');
      }
    });
  }
}

// Generate Standalone PDF Portfolio Wealth Report
function generatePDFReport() {
  const summary = getPortfolioSummary();
  const now = new Date();
  const dateString = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Calculate Net Worth Metrics
  let totalLiabilitiesVal = 0;
  liabilities.forEach(l => {
    totalLiabilitiesVal += Number(l.outstanding);
  });

  let totalLentVal = 0;
  let totalBorrowedVal = 0;
  borrowLent.forEach(bl => {
    if (bl.status !== 'paid') {
      const outstandingAmt = Number(bl.outstanding);
      if (bl.type === 'lent') {
        totalLentVal += outstandingAmt;
      } else if (bl.type === 'borrowed') {
        totalBorrowedVal += outstandingAmt;
      }
    }
  });

  const netWorthVal = summary.currentValue + totalLentVal - totalLiabilitiesVal - totalBorrowedVal;
  const portfolioCagrText = document.getElementById('val-portfolio-cagr')?.textContent || '0.0%';

  // SVG Allocation Pie chart HTML extraction
  const pieChartContainer = document.getElementById('allocation-chart-container');
  let pieChartSvgHtml = '';
  if (pieChartContainer) {
    const svgEl = pieChartContainer.querySelector('svg');
    if (svgEl) {
      const clonedSvg = svgEl.cloneNode(true);
      clonedSvg.removeAttribute('style');
      clonedSvg.style.width = '240px';
      clonedSvg.style.height = '240px';
      pieChartSvgHtml = clonedSvg.outerHTML;
    }
  }

  // SVG Performance Bar chart HTML generation (print-optimized)
  let performanceSvgHtml = '';
  const perfSvg = generatePerformanceChartSVG(false, true); // isMobile = false, isPrint = true
  if (perfSvg) {
    perfSvg.removeAttribute('style');
    perfSvg.style.width = '100%';
    perfSvg.style.height = 'auto';
    perfSvg.style.maxHeight = '230px';
    performanceSvgHtml = perfSvg.outerHTML;
  }

  // Calculate Profit and Loss Heatmaps
  const profits = [];
  const losses = [];
  investments.forEach(inv => {
    const invAmt = Number(inv.investedAmount);
    const curAmt = Number(inv.currentAmount);
    if (invAmt === 0) return;
    const diff = curAmt - invAmt;
    const pct = (diff / invAmt) * 100;
    if (diff > 0) {
      profits.push({ name: inv.name, currentAmount: inv.currentAmount, diff, pct });
    } else if (diff < 0) {
      losses.push({ name: inv.name, currentAmount: inv.currentAmount, diff, pct });
    }
  });
  profits.sort((a, b) => b.pct - a.pct);
  losses.sort((a, b) => a.pct - b.pct);

  let profitHeatmapHtml = '';
  if (profits.length === 0) {
    profitHeatmapHtml = '<div style="color: var(--text-muted); font-size: 0.8rem; grid-column: 1 / -1; text-align: center; padding: 20px; background-color: var(--bg-light); border-radius: 6px; border: 1px solid var(--border-color);">No profitable assets.</div>';
  } else {
    profits.forEach(item => {
      const opacity = Math.min(0.85, 0.12 + (item.pct / 40) * 0.73);
      const bg = `rgba(16, 185, 129, ${opacity})`;
      const textCol = opacity > 0.45 ? '#ffffff' : 'var(--text-main)';
      const pctCol = opacity > 0.45 ? '#ffffff' : 'var(--color-success)';
      profitHeatmapHtml += `
        <div style="background-color: ${bg}; color: ${textCol}; padding: 10px 6px; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 64px; border: 1px solid rgba(16, 185, 129, 0.15); page-break-inside: avoid;">
          <span style="font-size: 0.75rem; font-weight: 600; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">${item.name}</span>
          <span style="font-size: 0.75rem; font-weight: 500; margin-top: 1px; display: block;">${formatCurrency(item.currentAmount)}</span>
          <span style="font-size: 0.75rem; font-weight: 700; color: ${pctCol}; margin-top: 1px; display: block;">+${item.pct.toFixed(1)}%</span>
        </div>
      `;
    });
  }

  let lossHeatmapHtml = '';
  if (losses.length === 0) {
    lossHeatmapHtml = '<div style="color: var(--text-muted); font-size: 0.8rem; grid-column: 1 / -1; text-align: center; padding: 20px; background-color: var(--bg-light); border-radius: 6px; border: 1px solid var(--border-color);">No assets in loss.</div>';
  } else {
    losses.forEach(item => {
      const absPct = Math.abs(item.pct);
      const opacity = Math.min(0.85, 0.12 + (absPct / 20) * 0.73);
      const bg = `rgba(244, 63, 94, ${opacity})`;
      const textCol = opacity > 0.45 ? '#ffffff' : 'var(--text-main)';
      const pctCol = opacity > 0.45 ? '#ffffff' : 'var(--color-danger)';
      lossHeatmapHtml += `
        <div style="background-color: ${bg}; color: ${textCol}; padding: 10px 6px; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 64px; border: 1px solid rgba(244, 63, 94, 0.15); page-break-inside: avoid;">
          <span style="font-size: 0.75rem; font-weight: 600; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">${item.name}</span>
          <span style="font-size: 0.75rem; font-weight: 500; margin-top: 1px; display: block;">${formatCurrency(item.currentAmount)}</span>
          <span style="font-size: 0.75rem; font-weight: 700; color: ${pctCol}; margin-top: 1px; display: block;">${item.pct.toFixed(1)}%</span>
        </div>
      `;
    });
  }

  // Calculate Asset Class allocations
  const classTotals = {};
  investments.forEach(inv => {
    const val = Number(inv.currentAmount);
    classTotals[inv.assetClass] = (classTotals[inv.assetClass] || 0) + val;
  });

  const sortedClasses = Object.keys(classTotals).map(key => ({
    key,
    value: classTotals[key],
    pct: summary.currentValue > 0 ? (classTotals[key] / summary.currentValue) * 100 : 0
  })).sort((a, b) => b.value - a.value);

  // Calculate Wealth Diversification Score for PDF Report
  const classCount = Object.keys(classTotals).length;
  const totalVal = summary.currentValue;
  let divScore = classCount * 10;
  let maxConc = 0;
  Object.keys(classTotals).forEach(key => {
    if (totalVal > 0) {
      maxConc = Math.max(maxConc, (classTotals[key] / totalVal) * 100);
    }
  });

  if (maxConc <= 30) {
    divScore += 40;
  } else if (maxConc <= 45) {
    divScore += 25;
  } else if (maxConc <= 60) {
    divScore += 10;
  }
  divScore = Math.min(100, divScore);

  let ratingLabel = '';
  let ratingColor = '';
  let ratingDesc = '';
  if (divScore > 80) {
    ratingLabel = 'Highly Diversified';
    ratingColor = '#10b981'; // Success Green
    ratingDesc = 'Your portfolio is Highly Diversified, minimizing category-specific shocks.';
  } else if (divScore >= 50) {
    ratingLabel = 'Moderately Diversified';
    ratingColor = '#f59e0b'; // Warning Amber
    ratingDesc = 'Your portfolio is Moderately Diversified. Consider spreading new allocations.';
  } else {
    ratingLabel = 'Concentrated';
    ratingColor = '#f43f5e'; // Danger Rose
    ratingDesc = 'Your portfolio is Concentrated. High risk of volatility due to cluster holdings.';
  }

  let allocationTableHtml = '';
  sortedClasses.forEach(c => {
    const cat = ASSET_CATEGORIES[c.key];
    const label = cat ? cat.label : c.key;
    const color = cat ? cat.color : '#6366f1';
    allocationTableHtml += `
      <tr>
        <td style="font-weight: 500;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${color}; margin-right: 6px;"></span>
          ${label}
        </td>
        <td style="text-align: right; font-weight: 500;">${formatCurrency(c.value)}</td>
        <td style="text-align: right; font-weight: 600; color: var(--color-primary);">${c.pct.toFixed(1)}%</td>
      </tr>
    `;
  });

  // Calculate emergency fund coverage / active liabilities emi
  let liquidAssets = 0;
  investments.forEach(inv => {
    if (inv.assetClass === 'savings' || inv.assetClass === 'fd') {
      liquidAssets += Number(inv.currentAmount);
    }
  });

  let totalMonthlyEMIs = 0;
  liabilities.forEach(l => {
    totalMonthlyEMIs += Number(l.emi);
  });

  // Build Insights List
  const insights = [];
  const equityVal = (classTotals['indian-stock'] || 0) + (classTotals['us-stock'] || 0) + ((classTotals['indian-mutual-fund'] || 0) * 0.85);
  const debtVal = (classTotals['fd'] || 0) + (classTotals['bonds'] || 0) + (classTotals['epfo'] || 0) + (classTotals['savings'] || 0) + ((classTotals['indian-mutual-fund'] || 0) * 0.15);
  const goldVal = classTotals['gold'] || 0;

  const equityPct = totalVal > 0 ? (equityVal / totalVal) * 100 : 0;
  const goldPct = totalVal > 0 ? (goldVal / totalVal) * 100 : 0;
  const debtPct = totalVal > 0 ? (debtVal / totalVal) * 100 : 0;

  let bestAsset = null;
  let worstAsset = null;
  let bestPct = -Infinity;
  let worstPct = Infinity;

  investments.forEach(inv => {
    const invAmt = Number(inv.investedAmount);
    const curAmt = Number(inv.currentAmount);
    if (invAmt > 5000) {
      const retPct = ((curAmt - invAmt) / invAmt) * 100;
      if (retPct > bestPct) {
        bestPct = retPct;
        bestAsset = inv;
      }
      if (retPct < worstPct) {
        worstPct = retPct;
        worstAsset = inv;
      }
    }
  });

  if (equityPct > 65) {
    insights.push({ type: 'warning', title: 'Aggressive Equity Exposure', desc: `Equities represent ${equityPct.toFixed(0)}% of your portfolio. While great for inflation-beating long-term growth, be prepared for high volatility.` });
  } else if (equityPct >= 40 && equityPct <= 65) {
    insights.push({ type: 'positive', title: 'Balanced Growth Profile', desc: `Your equity exposure is at a healthy ${equityPct.toFixed(0)}%. This provides a solid balance between capital appreciation and risk mitigation.` });
  } else if (equityPct > 0 && equityPct < 40) {
    insights.push({ type: 'info', title: 'Conservative Wealth Profile', desc: `Equities make up only ${equityPct.toFixed(0)}% of your capital. Consider increasing stock/mutual fund exposure to avoid purchasing power erosion from inflation.` });
  }

  if (goldPct >= 5 && goldPct <= 15) {
    insights.push({ type: 'positive', title: 'Optimal Gold Allocation', desc: `Gold represents ${goldPct.toFixed(0)}% of your portfolio. This forms an excellent hedge against currency depreciation and market corrections.` });
  } else if (goldPct > 15) {
    insights.push({ type: 'warning', title: 'Overweight in Precious Metals', desc: `Precious metals comprise ${goldPct.toFixed(0)}% of your assets. Gold is stable but lacks compounding yields; consider reallocating to growth assets.` });
  } else {
    insights.push({ type: 'info', title: 'Low Inflation Hedge', desc: `Gold is less than 5% of your portfolio. Consider allocating a small portion (e.g. 5-10% in SGBs or Gold ETFs) as portfolio insurance.` });
  }

  if (bestAsset && bestPct > 10) {
    insights.push({ type: 'positive', title: `Top Performer: ${bestAsset.name}`, desc: `Your investment has achieved a return of ${formatPercent(bestPct)}, growing to ${formatCurrency(bestAsset.currentAmount)}.` });
  }
  if (worstAsset && worstPct < -5) {
    insights.push({ type: 'negative', title: `Underperformer Alert: ${worstAsset.name}`, desc: `This asset is currently down by ${formatPercent(worstPct)} (Current Value: ${formatCurrency(worstAsset.currentAmount)}). Monitor for potential changes in fundamentals.` });
  }

  const savingsVal = classTotals['savings'] || 0;
  const savingsPct = totalVal > 0 ? (savingsVal / totalVal) * 100 : 0;
  if (savingsPct > 20) {
    insights.push({ type: 'info', title: 'High Liquid Cash Balance', desc: `Savings account represents ${savingsPct.toFixed(0)}% of your assets. Move excess liquidity to arbitrage funds or short-term FDs for higher tax-adjusted yields.` });
  } else if (savingsPct > 0 && savingsPct < 3) {
    insights.push({ type: 'warning', title: 'Low Liquidity Buffer', desc: `Your cash account holds only ${savingsPct.toFixed(1)}% of your net worth. Ensure you maintain at least 3-6 months of expenses in highly liquid bank balances.` });
  }

  const usStockVal = classTotals['us-stock'] || 0;
  const usStockPct = totalVal > 0 ? (usStockVal / totalVal) * 100 : 0;
  if (usStockPct > 15) {
    insights.push({ type: 'positive', title: 'Strong Global Hedge', desc: `US stocks make up ${usStockPct.toFixed(0)}% of your portfolio, providing geographical diversification and protecting your wealth against local currency depreciation.` });
  } else if (usStockPct > 0 && usStockPct <= 15) {
    insights.push({ type: 'info', title: 'International Exposure Active', desc: `You have a ${usStockPct.toFixed(1)}% allocation to international equities. Increasing this towards 10-15% can further lower overall portfolio correlation.` });
  } else {
    insights.push({ type: 'warning', title: 'Zero International Diversification', desc: `You have 0% allocated to global markets. Consider adding US equities or international mutual funds to hedge against geographical concentration risks.` });
  }

  if (totalVal > 0) {
    insights.push({ type: 'info', title: `Equity-to-Debt Mix: ${equityPct.toFixed(0)}:${debtPct.toFixed(0)}`, desc: `Your asset mix is ${equityPct.toFixed(0)}% equities and ${debtPct.toFixed(0)}% fixed income/debt. Ensure this fits your risk tolerance.` });
  }

  if (classCount < 4) {
    insights.push({ type: 'warning', title: 'Under-diversified Portfolio', desc: `Your capital spans only ${classCount} distinct asset classes. Spreading allocations into fixed deposits, gold, or debt mutual funds can reduce volatility.` });
  } else if (classCount >= 6) {
    insights.push({ type: 'positive', title: 'Excellent Asset Class Variety', desc: `Your holdings are spread over ${classCount} different asset classes, creating a robust shield against major single-sector corrections.` });
  }

  const debtAssetRatio = totalVal > 0 ? (totalLiabilitiesVal / totalVal) * 100 : 0;
  if (totalLiabilitiesVal > 0) {
    if (debtAssetRatio > 50) {
      insights.push({ type: 'negative', title: `High Debt Leverage (${debtAssetRatio.toFixed(0)}%)`, desc: `Your outstanding debt is over 50% of your current asset value. Consider prepaying high-interest loans.` });
    } else if (debtAssetRatio >= 20 && debtAssetRatio <= 50) {
      insights.push({ type: 'warning', title: `Moderate Debt Leverage (${debtAssetRatio.toFixed(0)}%)`, desc: `Your debt-to-asset ratio is at a moderate level of ${debtAssetRatio.toFixed(0)}%. Focus on paying down existing loans.` });
    } else {
      insights.push({ type: 'positive', title: `Healthy Debt Leverage (${debtAssetRatio.toFixed(0)}%)`, desc: `Your debt-to-asset ratio is a very healthy ${debtAssetRatio.toFixed(0)}%.` });
    }
  } else {
    insights.push({ type: 'positive', title: '100% Debt-Free Portfolio', desc: 'You have no outstanding liabilities or loan EMIs. Your assets represent pure wealth.' });
  }

  if (totalMonthlyEMIs > 0) {
    const monthsCoverage = liquidAssets / totalMonthlyEMIs;
    if (monthsCoverage < 3) {
      insights.push({ type: 'negative', title: 'Emergency Reserve Gap', desc: `Your liquid reserves (Savings + FDs) cover only ${monthsCoverage.toFixed(1)} months of EMIs. Build up liquid assets to cover at least 6 months.` });
    } else if (monthsCoverage >= 6) {
      insights.push({ type: 'positive', title: 'Robust Emergency Buffer', desc: `Your liquid assets cover ${monthsCoverage.toFixed(0)} months of EMI commitments. Solid emergency security.` });
    }
  }

  let insightsHtml = '';
  insights.forEach(ins => {
    let typeClass = '';
    let emoji = '';
    if (ins.type === 'positive') {
      typeClass = 'insight-positive';
      emoji = '🟢';
    } else if (ins.type === 'warning') {
      typeClass = 'insight-warning';
      emoji = '🟡';
    } else if (ins.type === 'negative') {
      typeClass = 'insight-negative';
      emoji = '🔴';
    } else {
      typeClass = 'insight-info';
      emoji = '🔵';
    }
    insightsHtml += `
      <div class="insight-item ${typeClass}" style="margin-bottom: 8px; padding: 10px 14px; border-radius: 6px; border-left: 4px solid; line-height: 1.4;">
        <strong style="display: block; font-size: 0.9rem; margin-bottom: 2px;">${emoji} ${ins.title}</strong>
        <span style="font-size: 0.8rem; color: #475569;">${ins.desc}</span>
      </div>
    `;
  });

  // Group holdings summary rows
  let holdingsTableRowsHtml = '';
  const sortedInvestments = [...investments].sort((a, b) => {
    if (a.assetClass !== b.assetClass) {
      return a.assetClass.localeCompare(b.assetClass);
    }
    return Number(b.investedAmount) - Number(a.investedAmount);
  });

  sortedInvestments.forEach(inv => {
    const cat = ASSET_CATEGORIES[inv.assetClass];
    const categoryLabel = cat ? cat.label : inv.assetClass;
    const invested = Number(inv.investedAmount);
    const current = Number(inv.currentAmount);
    const returns = current - invested;
    const returnPct = invested > 0 ? (returns / invested) * 100 : 0;
    const colorClass = returns >= 0 ? 'color-success' : 'color-danger';
    const returnSign = returns >= 0 ? '+' : '';

    holdingsTableRowsHtml += `
      <tr>
        <td style="font-weight: 600; color: #334155;">${inv.name}</td>
        <td>${categoryLabel}</td>
        <td style="text-align: right; font-family: monospace;">${formatCurrency(invested)}</td>
        <td style="text-align: right; font-family: monospace;">${formatCurrency(current)}</td>
        <td style="text-align: right; font-weight: 600; font-family: monospace;" class="${colorClass}">${returnSign}${formatCurrency(returns)} (${returnSign}${returnPct.toFixed(1)}%)</td>
      </tr>
    `;
  });

  // Liabilities block
  let liabilitiesHtml = '';
  if (liabilities.length > 0) {
    let liabilitiesTableRowsHtml = '';
    liabilities.forEach(l => {
      const rate = Number(l.rate);
      const emi = Number(l.emi);
      const outstanding = Number(l.outstanding);
      liabilitiesTableRowsHtml += `
        <tr>
          <td style="font-weight: 600; color: #334155;">${l.name}</td>
          <td>${l.type === 'loan' ? 'Loan / EMI' : 'Credit Card Outstanding'}</td>
          <td style="text-align: right;">${rate.toFixed(1)}%</td>
          <td style="text-align: right; font-family: monospace;">${formatCurrency(emi)}</td>
          <td style="text-align: right; font-weight: 600; font-family: monospace; color: #f43f5e;">${formatCurrency(outstanding)}</td>
        </tr>
      `;
    });

    liabilitiesHtml = `
      <div style="margin-top: 24px;">
        <h2 class="section-title">Liabilities & EMI Commitments</h2>
        <table class="report-table">
          <thead>
            <tr>
              <th style="text-align: left;">Liability Name</th>
              <th style="text-align: left;">Type</th>
              <th style="text-align: right;">Interest Rate</th>
              <th style="text-align: right;">Monthly EMI</th>
              <th style="text-align: right;">Outstanding Principal</th>
            </tr>
          </thead>
          <tbody>
            ${liabilitiesTableRowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  // Borrow/Lent block
  let borrowLentHtml = '';
  const activeBL = borrowLent.filter(bl => bl.status !== 'paid');
  if (activeBL.length > 0) {
    let blTableRowsHtml = '';
    activeBL.forEach(bl => {
      const outstanding = Number(bl.outstanding);
      const typeLabel = bl.type === 'lent' ? 'Lent (Receivable)' : 'Borrowed (Payable)';
      const typeColor = bl.type === 'lent' ? '#10b981' : '#f43f5e';
      blTableRowsHtml += `
        <tr>
          <td style="font-weight: 600; color: #334155;">${bl.person}</td>
          <td style="color: ${typeColor}; font-weight: 600;">${typeLabel}</td>
          <td>${bl.date}</td>
          <td style="text-align: right; font-family: monospace; font-weight: 600;">${formatCurrency(outstanding)}</td>
        </tr>
      `;
    });

    borrowLentHtml = `
      <div style="margin-top: 24px;">
        <h2 class="section-title">Personal Borrow & Lent Accounts</h2>
        <table class="report-table">
          <thead>
            <tr>
              <th style="text-align: left;">Contact / Person Name</th>
              <th style="text-align: left;">Transaction Type</th>
              <th style="text-align: left;">Date Logged</th>
              <th style="text-align: right;">Receivable / Payable Amount</th>
            </tr>
          </thead>
          <tbody>
            ${blTableRowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  // Compile final HTML
  const reportHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Moyeniz Portfolio Report</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap" rel="stylesheet">
      <style>
        :root {
          --color-primary: #6366f1;
          --color-success: #10b981;
          --color-danger: #f43f5e;
          --color-info: #0ea5e9;
          --color-warning: #f59e0b;
          --text-main: #1e293b;
          --text-muted: #64748b;
          --border-color: #e2e8f0;
          --bg-light: #f8fafc;
        }
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: 'Inter', sans-serif;
          color: var(--text-main);
          background-color: #ffffff;
          padding: 24px;
          line-height: 1.5;
          font-size: 13px;
        }
        
        @page {
          size: A4 portrait;
          margin: 12mm;
        }
        
        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-bottom: 2.5px solid var(--color-primary);
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        
        .logo-area h1 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.7rem;
          font-weight: 700;
          color: var(--color-primary);
        }
        
        .logo-area p {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        
        .meta-area {
          text-align: right;
          font-size: 0.8rem;
          color: var(--text-muted);
          line-height: 1.4;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        
        .metric-card {
          background-color: var(--bg-light);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 12px;
        }
        
        .metric-label {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 4px;
        }
        
        .metric-value {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 2px;
        }
        
        .metric-footer {
          font-size: 0.75rem;
          font-weight: 500;
        }
        
        .allocation-section {
          display: flex;
          gap: 24px;
          margin-bottom: 24px;
        }
        
        .allocation-chart-wrapper {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          background-color: var(--bg-light);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 12px;
          max-width: 280px;
        }
        
        .allocation-details {
          flex: 1.5;
        }
        
        h2.section-title {
          font-family: 'Outfit', sans-serif;
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-primary);
          margin-bottom: 10px;
          border-bottom: 1.5px solid var(--border-color);
          padding-bottom: 4px;
        }
        
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
          font-size: 0.8rem;
        }
        
        .report-table th, .report-table td {
          padding: 8px 10px;
          border-bottom: 1px solid var(--border-color);
        }
        
        .report-table th {
          background-color: var(--bg-light);
          font-weight: 600;
          color: var(--text-muted);
        }
        
        .insight-item.insight-positive {
          border-left-color: var(--color-success);
          background-color: #f0fdf4;
        }
        
        .insight-item.insight-warning {
          border-left-color: var(--color-warning);
          background-color: #fffbeb;
        }
        
        .insight-item.insight-negative {
          border-left-color: var(--color-danger);
          background-color: #fff1f2;
        }
        
        .insight-item.insight-info {
          border-left-color: var(--color-info);
          background-color: #f0f9ff;
        }
        
        .color-success { color: var(--color-success) !important; }
        .color-danger { color: var(--color-danger) !important; }
        
        .chart-axis-text {
          fill: var(--text-muted);
          font-family: 'Inter', sans-serif;
          font-size: 9px;
        }
        
        .chart-grid-line {
          stroke: var(--border-color);
          stroke-dasharray: 4,4;
        }
        
        .chart-axis-line {
          stroke: var(--border-color);
        }

        .chart-bar {
          transition: opacity 0.2s;
        }
        
        .page-break {
          page-break-before: always;
        }
        
        .report-footer {
          margin-top: 30px;
          border-top: 1px solid var(--border-color);
          padding-top: 10px;
          text-align: center;
          font-size: 0.75rem;
          color: var(--text-muted);
        }
      </style>
    </head>
    <body>
      <header class="report-header">
        <div class="logo-area">
          <h1>Moyeniz</h1>
          <p>Privacy-First Portfolio Analytics</p>
        </div>
        <div class="meta-area">
          <strong>Portfolio Wealth Report</strong><br>
          Generated: ${dateString}<br>
        </div>
      </header>

      <section class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Net Worth</div>
          <div class="metric-value" style="color: var(--color-primary);">${formatCurrency(netWorthVal)}</div>
          <div class="metric-footer" style="color: var(--text-muted);">Assets minus Liabilities</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total Assets</div>
          <div class="metric-value">${formatCurrency(summary.currentValue + totalLentVal)}</div>
          <div class="metric-footer" style="color: var(--text-muted);">Invested + Personal Receivables</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total Return</div>
          <div class="metric-value ${summary.totalGain >= 0 ? 'color-success' : 'color-danger'}">
            ${summary.totalGain >= 0 ? '+' : ''}${formatCurrency(summary.totalGain)}
          </div>
          <div class="metric-footer ${summary.totalGain >= 0 ? 'color-success' : 'color-danger'}">
            ${summary.totalGain >= 0 ? '+' : ''}${summary.returnPct.toFixed(1)}%
          </div>
        </div>
        <div class="metric-card">
          <div class="metric-label">CAGR / XIRR</div>
          <div class="metric-value" style="color: var(--color-info);">${portfolioCagrText}</div>
          <div class="metric-footer" style="color: var(--text-muted);">Annualized Growth Rate</div>
        </div>
      </section>

      <div class="allocation-section" style="page-break-inside: avoid;">
        <div class="allocation-chart-wrapper">
          ${pieChartSvgHtml || '<div style="color: var(--text-muted);">Chart Preview</div>'}
        </div>
        <div class="allocation-details">
          <h2 class="section-title">Asset Category Allocations</h2>
          <table class="report-table">
            <thead>
              <tr>
                <th style="text-align: left;">Category Class</th>
                <th style="text-align: right;">Current Value</th>
                <th style="text-align: right;">Allocation</th>
              </tr>
            </thead>
            <tbody>
              ${allocationTableHtml}
            </tbody>
          </table>
        </div>
      </div>

      <div style="margin-top: 10px; margin-bottom: 15px; page-break-inside: avoid;">
        <h2 class="section-title">Asset Class Performance</h2>
        <div style="background-color: var(--bg-light); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: flex; justify-content: center;">
          ${performanceSvgHtml || '<div style="color: var(--text-muted); font-size: 0.85rem;">No performance chart available.</div>'}
        </div>
      </div>

      <div style="margin-top: 10px; page-break-inside: avoid;">
        <h2 class="section-title" style="margin-bottom: 6px;">Portfolio Diversification</h2>
        <div style="background-color: var(--bg-light); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; gap: 16px;">
          <div style="flex-shrink: 0; width: 42px; height: 42px; border-radius: 50%; background-color: ${ratingColor}15; border: 2.5px solid ${ratingColor}; display: flex; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 700; color: ${ratingColor};">
            ${divScore}
          </div>
          <div>
            <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-main); margin-bottom: 2px;">
              Rating: <span style="color: ${ratingColor}; font-weight: 700;">${ratingLabel}</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.3;">
              ${ratingDesc}
            </div>
          </div>
        </div>
      </div>

      <div class="page-break"></div>

      <header class="report-header">
        <div class="logo-area">
          <h1>Moyeniz</h1>
          <p>Detailed Asset Breakdown</p>
        </div>
        <div class="meta-area">
          <strong>Portfolio Holdings Details</strong><br>
          Generated: ${dateString}
        </div>
      </header>

      <div>
        <h2 class="section-title">Individual Holdings & Valuation</h2>
        <table class="report-table">
          <thead>
            <tr>
              <th style="text-align: left;">Asset Name</th>
              <th style="text-align: left;">Category</th>
              <th style="text-align: right;">Invested Amount</th>
              <th style="text-align: right;">Current Value</th>
              <th style="text-align: right;">Total Return / Gain</th>
            </tr>
          </thead>
          <tbody>
            ${holdingsTableRowsHtml || '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No assets recorded in portfolio.</td></tr>'}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 24px; margin-bottom: 24px; page-break-inside: avoid;">
        <h2 class="section-title">Asset Profit & Loss Heatmaps</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <h3 style="font-size: 0.85rem; font-weight: 600; color: #10b981; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Profit Heatmap</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
              ${profitHeatmapHtml}
            </div>
          </div>
          <div>
            <h3 style="font-size: 0.85rem; font-weight: 600; color: #f43f5e; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Loss Heatmap</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;">
              ${lossHeatmapHtml}
            </div>
          </div>
        </div>
      </div>

      ${liabilitiesHtml}
      ${borrowLentHtml}

      <div style="margin-top: 24px; margin-bottom: 10px; page-break-inside: avoid;">
        <h2 class="section-title">Portfolio Insights & Recommendations</h2>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
          <div>
            ${insights.slice(0, Math.ceil(insights.length / 2)).length > 0 ?
      insights.slice(0, Math.ceil(insights.length / 2)).map(ins => {
        let typeClass = '';
        let emoji = '';
        if (ins.type === 'positive') { typeClass = 'insight-positive'; emoji = '🟢'; }
        else if (ins.type === 'warning') { typeClass = 'insight-warning'; emoji = '🟡'; }
        else if (ins.type === 'negative') { typeClass = 'insight-negative'; emoji = '🔴'; }
        else { typeClass = 'insight-info'; emoji = '🔵'; }
        return `
                  <div class="insight-item ${typeClass}" style="margin-bottom: 8px; padding: 10px 14px; border-radius: 6px; border-left: 4px solid; line-height: 1.4;">
                    <strong style="display: block; font-size: 0.9rem; margin-bottom: 2px;">${emoji} ${ins.title}</strong>
                    <span style="font-size: 0.8rem; color: #475569;">${ins.desc}</span>
                  </div>
                `;
      }).join('') : '<div style="color: var(--text-muted); font-size: 0.85rem;">No insights available.</div>'
    }
          </div>
          <div>
            ${insights.slice(Math.ceil(insights.length / 2)).length > 0 ?
      insights.slice(Math.ceil(insights.length / 2)).map(ins => {
        let typeClass = '';
        let emoji = '';
        if (ins.type === 'positive') { typeClass = 'insight-positive'; emoji = '🟢'; }
        else if (ins.type === 'warning') { typeClass = 'insight-warning'; emoji = '🟡'; }
        else if (ins.type === 'negative') { typeClass = 'insight-negative'; emoji = '🔴'; }
        else { typeClass = 'insight-info'; emoji = '🔵'; }
        return `
                  <div class="insight-item ${typeClass}" style="margin-bottom: 8px; padding: 10px 14px; border-radius: 6px; border-left: 4px solid; line-height: 1.4;">
                    <strong style="display: block; font-size: 0.9rem; margin-bottom: 2px;">${emoji} ${ins.title}</strong>
                    <span style="font-size: 0.8rem; color: #475569;">${ins.desc}</span>
                  </div>
                `;
      }).join('') : ''
    }
          </div>
        </div>
      </div>

      <footer class="report-footer">
        <p>This report was generated locally inside your web browser. Moyeniz does not store, transmit, or process your portfolio data on external servers.</p>
        <p style="margin-top: 4px; font-weight: 500; color: var(--color-primary);">dpnkrpl.github.io/moyeniz/ &copy; ${now.getFullYear()}</p>
      </footer>
    </body>
    </html>
  `;

  // Create iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.write(reportHtml);
  doc.close();

  // Print execution
  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    // Clean up
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 600);
}


// Initializer
document.addEventListener('DOMContentLoaded', async () => {
  await loadFromStorage();
  initNavigation();
  initMobileSidebar();
  initDashboardSectionToggles();
  initFilterHandlers();
  initModalHandlers();
  initAccountHandlers();
  initCalculatorSliders();
  initGoogleDriveSync();

  // Periodically update relative time for last synced display
  if (!relativeTimeIntervalId) {
    relativeTimeIntervalId = setInterval(updateLastSyncedDisplay, 30000);
  }

  // Render active view
  const activeTabLink = document.querySelector('.nav-link.active');
  const activeTabName = activeTabLink ? activeTabLink.getAttribute('data-tab') : 'dashboard';
  if (activeTabName === 'dashboard') renderDashboard();
  else if (activeTabName === 'investments') renderInvestments();
  else if (activeTabName === 'liabilities') renderLiabilities();
  else if (activeTabName === 'borrow-lent') renderBorrowLent();
  else if (activeTabName === 'salary') renderSalaries();
  else if (activeTabName === 'expenses') renderExpenses();
  else if (activeTabName === 'account' || activeTabName === 'settings') renderAccount();

  updateTopActions(activeTabName);
});


// Google Drive Sync & Periodic Auto-Sync Engine
let gdriveRestoreConfirmTimeout = null;

// Helper to mask PII email addresses
function maskEmail(email) {
  if (!email || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}${local[1]}***${local[local.length - 1]}@${domain}`;
}

// Relative time formatter
function formatRelativeTime(timestamp) {
  if (!timestamp || timestamp === 0) return 'Never';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 30) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// Update Last Synced element
function updateLastSyncedDisplay() {
  const lastSyncEl = document.getElementById('account-last-synced-time');
  if (lastSyncEl) {
    lastSyncEl.textContent = formatRelativeTime(lastSyncedTimestamp);
  }
}

// Update Top / Status indicator
function updateSyncIndicator(text, isError = false, isSpinning = false) {
  const syncIcon = document.getElementById('icon-account-sync');
  const authStatus = document.getElementById('account-auth-status');

  if (authStatus) {
    if (text && text !== 'Idle') {
      authStatus.style.display = 'block';
      authStatus.textContent = text;
      authStatus.style.color = isError ? 'var(--color-negative)' : (isSpinning ? 'var(--color-primary)' : 'var(--color-text-secondary)');
    } else {
      authStatus.style.display = 'none';
    }
  }

  if (syncIcon) {
    if (isSpinning) {
      syncIcon.classList.add('sync-icon-spin');
    } else {
      syncIcon.classList.remove('sync-icon-spin');
    }
  }
}

// Render Account Page
function renderAccount() {
  const connectedPanel = document.getElementById('account-connected-panel');
  const disconnectedPanel = document.getElementById('account-disconnected-panel');
  const userEmailEl = document.getElementById('account-user-email');
  const avatarCharEl = document.getElementById('account-avatar-char');
  const selectAutoSync = document.getElementById('select-account-auto-sync');
  const inputClientId = document.getElementById('input-account-client-id');
  const originDisplay = document.getElementById('account-current-origin');

  const isConnected = (googleAccessToken || localStorage.getItem('moyeniz_gdrive_connected') === 'true') && googleUserEmail;

  if (originDisplay) {
    originDisplay.textContent = window.location.origin;
  }

  if (inputClientId) {
    inputClientId.value = localStorage.getItem('moyeniz_custom_client_id') || '';
  }

  if (isConnected) {
    if (connectedPanel) connectedPanel.style.display = 'flex';
    if (disconnectedPanel) disconnectedPanel.style.display = 'none';
    if (userEmailEl) userEmailEl.textContent = googleUserEmail;
    if (avatarCharEl) avatarCharEl.textContent = googleUserEmail.charAt(0).toUpperCase() || 'G';
    if (selectAutoSync) selectAutoSync.value = autoSyncMinutes.toString();
  } else {
    if (connectedPanel) connectedPanel.style.display = 'none';
    if (disconnectedPanel) disconnectedPanel.style.display = 'flex';
  }

  updateLastSyncedDisplay();
}

// Backward compatibility alias
function renderSettings() {
  renderAccount();
}

// Start periodic background auto-sync timer
function startAutoSyncTimer() {
  if (autoSyncIntervalId) {
    clearInterval(autoSyncIntervalId);
    autoSyncIntervalId = null;
  }

  if (autoSyncMinutes > 0 && localStorage.getItem('moyeniz_gdrive_connected') === 'true') {
    const intervalMs = autoSyncMinutes * 60 * 1000;
    autoSyncIntervalId = setInterval(async () => {
      if (!isSyncingToGDrive && localStorage.getItem('moyeniz_gdrive_connected') === 'true') {
        if (!googleAccessToken || Date.now() > googleTokenExpiresAt - 60000) {
          if (googleTokenClient) {
            pendingGDriveAction = 'sync';
            try {
              googleTokenClient.requestAccessToken({ prompt: 'none' });
            } catch (e) {
              console.warn('Auto-sync silent token request failed:', e);
            }
          }
        } else {
          await performGDriveSync(true);
        }
      }
    }, intervalMs);
  }
}

// Schedule debounced auto-sync after user edits
function scheduleDebouncedAutoSync() {
  if (autoSyncMinutes > 0 && localStorage.getItem('moyeniz_gdrive_connected') === 'true') {
    if (autoSyncDebounceTimer) clearTimeout(autoSyncDebounceTimer);
    autoSyncDebounceTimer = setTimeout(async () => {
      if (googleAccessToken && !isSyncingToGDrive) {
        await performGDriveSync(true);
      }
    }, 4000);
  }
}

// Initializer for Google Identity Services client with detailed error handling
function initGoogleDriveSync() {
  const clientId = getGoogleClientId();

  if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
    try {
      googleTokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email https://www.googleapis.com/auth/drive.appdata',
        callback: async (tokenResponse) => {
          if (tokenResponse.error !== undefined) {
            console.error('OAuth token client error:', tokenResponse);
            let userMsg = tokenResponse.error_description || tokenResponse.error || 'Authentication failed';
            
            if (tokenResponse.error === 'popup_closed_by_user') {
              userMsg = 'Sign-in popup was closed before completing.';
            } else if (tokenResponse.error === 'access_denied') {
              userMsg = 'Access Denied: If your Google Cloud project is in Testing mode, ensure your Gmail account is added under "Test users" in Google Cloud Console.';
            } else if (tokenResponse.error === 'origin_mismatch' || tokenResponse.error === 'idpiframe_initialization_failed') {
              userMsg = `Origin mismatch: Add "${window.location.origin}" to Authorized JavaScript origins in Google Cloud Console.`;
            }

            updateSyncIndicator(userMsg, true, false);
            alert(`Google Sign-In Error:\n${userMsg}`);
            isSyncingToGDrive = false;
            return;
          }

          googleAccessToken = tokenResponse.access_token;
          googleTokenExpiresAt = Date.now() + (parseInt(tokenResponse.expires_in, 10) || 3600) * 1000;
          localStorage.setItem('moyeniz_gdrive_connected', 'true');

          await fetchGoogleUserEmail();
          startAutoSyncTimer();
          renderAccount();

          if (pendingGDriveAction) {
            const action = pendingGDriveAction;
            pendingGDriveAction = null;
            if (action === 'backup') {
              await performGDriveBackup();
            } else if (action === 'restore') {
              await performGDriveRestore();
            } else if (action === 'sync') {
              await performGDriveSync();
            }
          }
        },
        error_callback: (err) => {
          console.error('Google Identity Service error_callback:', err);
          let msg = 'Google Sign-In failed.';
          if (err && err.type === 'popup_failed_to_open') {
            msg = 'Google Sign-In popup could not open.\n\nTroubleshooting steps:\n1. Check if an ad blocker or privacy extension is blocking accounts.google.com.\n2. Ensure your Vercel URL is added under "Authorized JavaScript origins" in Google Cloud Console.\n3. Make sure third-party cookies or popups are not blocked for Google.';
          } else if (err && err.type === 'popup_closed') {
            msg = 'Sign-in popup was closed before completing.';
          }
          updateSyncIndicator(msg, true, false);
          alert(msg);
        }
      });

      // Auto-reconnect silently if previously connected
      if (localStorage.getItem('moyeniz_gdrive_connected') === 'true') {
        startAutoSyncTimer();
        if (!googleAccessToken) {
          try {
            googleTokenClient.requestAccessToken({ prompt: 'none' });
          } catch (e) {
            console.log('Silent re-auth skipped or not supported:', e);
          }
        }
      }

      renderAccount();
    } catch (err) {
      console.error('Failed to initialize Google token client:', err);
      updateSyncIndicator('Google API Init Error', true, false);
    }
  } else {
    // Retry if script is still downloading
    setTimeout(() => {
      if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
        initGoogleDriveSync();
      } else {
        updateSyncIndicator('Google Identity script not loaded', true, false);
      }
    }, 800);
  }
}

// Fetch Google User Email to display in account status
async function fetchGoogleUserEmail() {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });
    if (response.ok) {
      const data = await response.json();
      googleUserEmail = data.email || '';
      localStorage.setItem('moyeniz_gdrive_email', googleUserEmail);
      renderAccount();
    }
  } catch (err) {
    console.error('Error fetching user email:', err);
  }
}

// Perform Intelligent Sync (Auto / Manual)
async function performGDriveSync(isBackground = false) {
  if (isSyncingToGDrive) return;
  isSyncingToGDrive = true;
  updateSyncIndicator('Syncing with Google Drive...', false, true);

  try {
    await performGDriveBackup(true);

    lastSyncedTimestamp = Date.now();
    localStorage.setItem('moyeniz_last_synced_at', lastSyncedTimestamp.toString());
    updateLastSyncedDisplay();
    updateSyncIndicator('Up to date', false, false);

    if (!isBackground) {
      alert('Portfolio successfully synced with Google Drive!');
      renderAccount();
    }
  } catch (err) {
    console.error('Sync failed:', err);
    updateSyncIndicator('Sync failed', true, false);
    if (!isBackground) {
      alert('Sync failed. Check your internet connection or Google Drive permissions.');
    }
  } finally {
    isSyncingToGDrive = false;
    updateSyncIndicator('', false, false);
  }
}

// Perform Google Drive Backup (Upload)
async function performGDriveBackup(silent = false) {
  if (!silent) updateSyncIndicator('Backing up to Drive...', false, true);
  try {
    // 1. Search for existing file in appDataFolder
    const searchUrl = 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name=%27moyeniz_backup.json%27';
    const searchResponse = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });

    if (searchResponse.status === 401) {
      pendingGDriveAction = 'backup';
      if (googleTokenClient) googleTokenClient.requestAccessToken({ prompt: 'consent' });
      return;
    }

    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const fileId = searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;

    // 2. Prepare payload
    const payload = {
      investments,
      liabilities,
      borrowLent,
      salaries,
      expenses,
      expenseCategories,
      globalBudget,
      monthlyBudgets,
      backupDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });

    if (fileId) {
      // Overwrite existing file (PATCH)
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        throw new Error(`Update failed: ${updateResponse.status}`);
      }
    } else {
      // Create new file (POST multipart)
      const metadata = {
        name: 'moyeniz_backup.json',
        parents: ['appDataFolder']
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      const createResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${googleAccessToken}` },
        body: form
      });

      if (!createResponse.ok) {
        throw new Error(`Creation failed: ${createResponse.status}`);
      }
    }

    lastSyncedTimestamp = Date.now();
    localStorage.setItem('moyeniz_last_synced_at', lastSyncedTimestamp.toString());
    updateLastSyncedDisplay();

    if (!silent) {
      alert('Backup to Google Drive succeeded!');
      renderAccount();
    }
  } catch (err) {
    console.error('Backup error:', err);
    if (!silent) {
      alert(`Backup failed: ${err.message || 'Unknown error'}`);
    }
    throw err;
  } finally {
    if (!silent) updateSyncIndicator('', false, false);
  }
}

// Perform Google Drive Restore (Download)
async function performGDriveRestore() {
  updateSyncIndicator('Restoring from Google Drive...', false, true);
  try {
    // 1. Search for file in appDataFolder
    const searchUrl = 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name=%27moyeniz_backup.json%27';
    const searchResponse = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });

    if (searchResponse.status === 401) {
      pendingGDriveAction = 'restore';
      if (googleTokenClient) googleTokenClient.requestAccessToken({ prompt: 'consent' });
      return;
    }

    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const fileId = searchData.files && searchData.files.length > 0 ? searchData.files[0].id : null;

    if (!fileId) {
      alert('No backup file found in your Google Drive AppData folder.');
      updateSyncIndicator('', false, false);
      return;
    }

    // 2. Fetch file content
    const restoreUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const restoreResponse = await fetch(restoreUrl, {
      headers: { 'Authorization': `Bearer ${googleAccessToken}` }
    });

    if (!restoreResponse.ok) {
      throw new Error(`Fetch failed: ${restoreResponse.status}`);
    }

    const data = await restoreResponse.json();
    validateBackupSchema(data);

    // 3. Load & render data
    investments = data.investments;
    liabilities = data.liabilities || [];
    borrowLent = data.borrowLent || [];
    salaries = data.salaries || [];
    expenses = data.expenses || [];
    expenseCategories = data.expenseCategories || [...DEFAULT_EXPENSE_CATEGORIES];
    globalBudget = typeof data.globalBudget === 'number' ? data.globalBudget : 40000;
    monthlyBudgets = data.monthlyBudgets && typeof data.monthlyBudgets === 'object' ? data.monthlyBudgets : {};

    saveToStorage();

    lastSyncedTimestamp = Date.now();
    localStorage.setItem('moyeniz_last_synced_at', lastSyncedTimestamp.toString());
    updateLastSyncedDisplay();

    // Render currently active tab
    const activeTabLink = document.querySelector('.nav-link.active');
    const activeTabName = activeTabLink ? activeTabLink.getAttribute('data-tab') : 'dashboard';
    if (activeTabName === 'dashboard') renderDashboard();
    else if (activeTabName === 'investments') renderInvestments();
    else if (activeTabName === 'liabilities') renderLiabilities();
    else if (activeTabName === 'borrow-lent') renderBorrowLent();
    else if (activeTabName === 'salary') renderSalaries();
    else if (activeTabName === 'expenses') renderExpenses();
    else if (activeTabName === 'account') renderAccount();

    alert('Portfolio restored successfully from Google Drive!');
  } catch (err) {
    console.error('Restore error:', err);
    alert(`Restore failed: ${err.message || 'Invalid or corrupted file'}`);
  } finally {
    updateSyncIndicator('', false, false);
  }
}

async function handleGDriveBackupClick() {
  if (!googleTokenClient) {
    alert('Google Identity script is not loaded yet. Check your internet connection.');
    return;
  }
  if (!googleAccessToken) {
    pendingGDriveAction = 'backup';
    googleTokenClient.requestAccessToken({ prompt: 'select_account' });
  } else {
    await performGDriveBackup();
  }
}

async function handleGDriveRestoreClick(noConfirm = false) {
  if (!googleTokenClient) {
    alert('Google Identity script is not loaded yet. Check your internet connection.');
    return;
  }
  if (noConfirm || confirm('This will overwrite current local data with the backup from Google Drive. Proceed?')) {
    if (!googleAccessToken) {
      pendingGDriveAction = 'restore';
      googleTokenClient.requestAccessToken({ prompt: 'select_account' });
    } else {
      await performGDriveRestore();
    }
  }
}

async function handleGDriveSyncClick() {
  if (!googleTokenClient) {
    alert('Google Identity script is not loaded yet. Check your internet connection.');
    return;
  }
  if (!googleAccessToken) {
    pendingGDriveAction = 'sync';
    googleTokenClient.requestAccessToken({ prompt: 'select_account' });
  } else {
    await performGDriveSync(false);
  }
}

// Initialize Account page handlers
function initAccountHandlers() {
  // Sync portfolio popup modal toggle
  const btnSyncPortfolio = document.getElementById('btn-sync-portfolio');
  const syncModal = document.getElementById('sync-portfolio-modal');

  if (btnSyncPortfolio && syncModal) {
    btnSyncPortfolio.addEventListener('click', () => {
      syncModal.classList.add('active-modal');
    });

    const btnCloseSync = document.getElementById('btn-close-sync-modal');
    if (btnCloseSync) {
      btnCloseSync.addEventListener('click', () => {
        syncModal.classList.remove('active-modal');
      });
    }

    const btnCancelSync = document.getElementById('btn-cancel-sync-modal');
    if (btnCancelSync) {
      btnCancelSync.addEventListener('click', () => {
        syncModal.classList.remove('active-modal');
      });
    }

    const btnPopupDownload = document.getElementById('btn-popup-download-json');
    if (btnPopupDownload) {
      btnPopupDownload.addEventListener('click', () => {
        syncModal.classList.remove('active-modal');
        downloadPortfolioJSON();
      });
    }

    const btnPopupSyncGDrive = document.getElementById('btn-popup-sync-gdrive');
    if (btnPopupSyncGDrive) {
      btnPopupSyncGDrive.addEventListener('click', async () => {
        syncModal.classList.remove('active-modal');
        await handleGDriveSyncClick();
      });
    }
  }

  // Dashboard Empty setup GDrive restore button
  const btnSetupGDrive = document.getElementById('setup-btn-gdrive');
  if (btnSetupGDrive) {
    btnSetupGDrive.addEventListener('click', async () => {
      await handleGDriveRestoreClick(true);
    });
  }

  // Account Page: Google Connect Button
  const btnConnect = document.getElementById('btn-account-connect');
  if (btnConnect) {
    btnConnect.addEventListener('click', () => {
      if (googleTokenClient) {
        googleTokenClient.requestAccessToken({ prompt: 'select_account' });
      } else {
        initGoogleDriveSync();
        if (googleTokenClient) {
          googleTokenClient.requestAccessToken({ prompt: 'select_account' });
        } else {
          alert('Google Identity service is not ready. Check your connection or Content Security Policy.');
        }
      }
    });
  }

  // Account Page: Google Disconnect Button
  const btnDisconnect = document.getElementById('btn-account-disconnect');
  if (btnDisconnect) {
    btnDisconnect.addEventListener('click', () => {
      if (confirm('Disconnect your Google account from this device? (Local data will NOT be deleted).')) {
        googleAccessToken = null;
        googleUserEmail = '';
        localStorage.removeItem('moyeniz_gdrive_connected');
        localStorage.removeItem('moyeniz_gdrive_email');
        if (autoSyncIntervalId) {
          clearInterval(autoSyncIntervalId);
          autoSyncIntervalId = null;
        }
        renderAccount();
      }
    });
  }

  // Account Page: Sync Now
  const btnSyncNow = document.getElementById('btn-account-sync-now');
  if (btnSyncNow) {
    btnSyncNow.addEventListener('click', async () => {
      await handleGDriveSyncClick();
    });
  }

  // Account Page: Backup & Restore
  const btnBackup = document.getElementById('btn-account-backup');
  if (btnBackup) {
    btnBackup.addEventListener('click', async () => {
      await handleGDriveBackupClick();
    });
  }

  const btnRestore = document.getElementById('btn-account-restore');
  if (btnRestore) {
    btnRestore.addEventListener('click', async () => {
      await handleGDriveRestoreClick();
    });
  }

  // Auto-sync interval selector
  const selectAutoSync = document.getElementById('select-account-auto-sync');
  if (selectAutoSync) {
    selectAutoSync.addEventListener('change', (e) => {
      autoSyncMinutes = parseInt(e.target.value, 10);
      localStorage.setItem('moyeniz_auto_sync_interval', autoSyncMinutes.toString());
      startAutoSyncTimer();
    });
  }

  // OAuth Config accordion toggle
  const btnToggleOAuthConfig = document.getElementById('btn-toggle-oauth-config');
  const panelOAuthConfig = document.getElementById('panel-oauth-config');
  if (btnToggleOAuthConfig && panelOAuthConfig) {
    btnToggleOAuthConfig.addEventListener('click', () => {
      const isExpanded = panelOAuthConfig.classList.toggle('active');
      btnToggleOAuthConfig.setAttribute('aria-expanded', isExpanded.toString());
    });
  }

  // Copy Origin Button
  const btnCopyOrigin = document.getElementById('btn-copy-origin');
  if (btnCopyOrigin) {
    btnCopyOrigin.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.origin);
        const prevText = btnCopyOrigin.textContent;
        btnCopyOrigin.textContent = 'Copied!';
        setTimeout(() => { btnCopyOrigin.textContent = prevText; }, 2000);
      } catch (e) {
        prompt('Copy this origin to clipboard:', window.location.origin);
      }
    });
  }

  // Custom Client ID save & reset
  const btnSaveClientId = document.getElementById('btn-save-account-client-id');
  const btnResetClientId = document.getElementById('btn-reset-account-client-id');
  const inputClientId = document.getElementById('input-account-client-id');

  if (btnSaveClientId && inputClientId) {
    btnSaveClientId.addEventListener('click', () => {
      const val = inputClientId.value.trim();
      if (val) {
        localStorage.setItem('moyeniz_custom_client_id', val);
        alert('Custom Google OAuth Client ID saved! Reinitializing connection...');
      } else {
        localStorage.removeItem('moyeniz_custom_client_id');
        alert('Cleared custom Client ID. Reverting to default.');
      }
      initGoogleDriveSync();
    });
  }

  if (btnResetClientId && inputClientId) {
    btnResetClientId.addEventListener('click', () => {
      localStorage.removeItem('moyeniz_custom_client_id');
      inputClientId.value = '';
      alert('Reset to default Google OAuth Client ID.');
      initGoogleDriveSync();
    });
  }

  // Local Data: Download JSON Backup
  const btnDownloadJson = document.getElementById('btn-account-download-json');
  if (btnDownloadJson) {
    btnDownloadJson.addEventListener('click', () => {
      downloadPortfolioJSON();
    });
  }

  // Local Data: Import JSON
  const fileInput = document.getElementById('account-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleUploadJSON(e.target.files[0]);
      }
    });
  }

  // Local Data: Reset Demo Sample Data
  const btnResetSample = document.getElementById('btn-account-reset-sample');
  if (btnResetSample) {
    btnResetSample.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Load demo portfolio? This will replace current investments, debts, and budgets with sample demonstration items.')) {
        investments = [...SAMPLE_PORTFOLIO];
        liabilities = [...SAMPLE_LIABILITIES];
        borrowLent = [...SAMPLE_BORROW_LENT];
        salaries = [...SAMPLE_SALARIES];
        expenses = [...SAMPLE_EXPENSES];
        expenseCategories = [...DEFAULT_EXPENSE_CATEGORIES];
        globalBudget = 40000;
        monthlyBudgets = {};
        saveToStorage();
        renderAccount();
        alert('Demo sample portfolio loaded successfully!');
      }
    });
  }

  // Local Data: Clean Erase All Data
  const btnClearData = document.getElementById('btn-account-clear-data');
  if (btnClearData) {
    btnClearData.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('DANGER: Permanently erase ALL portfolio data (investments, liabilities, cashflows, budgets) from this browser?\n\nThis leaves a 100% clean, blank slate. Proceed?')) {
        investments = [];
        liabilities = [];
        borrowLent = [];
        salaries = [];
        expenses = [];
        expenseCategories = [...DEFAULT_EXPENSE_CATEGORIES];
        globalBudget = 40000;
        monthlyBudgets = {};
        lastSyncedTimestamp = 0;

        // Save empty state cleanly to local storage
        saveToStorage();
        localStorage.removeItem('moyeniz_last_synced_at');

        renderAccount();

        // Redirect to dashboard
        const links = document.querySelectorAll('.nav-link');
        const views = document.querySelectorAll('.page-view');
        const viewTitle = document.getElementById('view-title');

        links.forEach(l => l.classList.remove('active'));
        const tabDash = document.getElementById('tab-dashboard');
        if (tabDash) tabDash.classList.add('active');

        views.forEach(v => v.classList.remove('active-view'));
        const activeView = document.getElementById('view-dashboard');
        if (activeView) activeView.classList.add('active-view');

        if (viewTitle) viewTitle.textContent = 'Dashboard';
        renderDashboard();
        alert('All local portfolio data has been completely erased. Clean blank slate ready!');
      }
    });
  }
}

// Backward compatibility alias
function initSettingsHandlers() {
  initAccountHandlers();
}
