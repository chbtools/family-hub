/* Family Hub calculations shared by the browser and the tests.
   Code.gs stores the same collections. Keep FIELDS in step with COLUMNS there.
   Dates are yyyy-MM-dd strings so a phone and the sheet agree on the calendar day. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HubLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const FIELDS = {
    users: ["id", "name", "role", "active", "createdAt"],
    settings: ["id", "randyName", "partnerName", "farmName", "location", "digestEmails", "digestHour", "calendarId", "calendarSync", "mileageRate", "billLeadDays", "taxRate", "eggMargin", "wearRate", "createdAt"],
    accounts: ["id", "name", "type", "book", "balance", "institution", "notes", "updatedAt"],
    transactions: ["id", "date", "accountId", "amount", "type", "categoryId", "book", "payee", "memo", "refType", "refId", "externalId", "receiptId", "createdBy", "createdAt"],
    categories: ["id", "name", "book", "kind", "monthly", "scheduleF", "sort", "active"],
    budgets: ["id", "categoryId", "month", "amount"],
    bills: ["id", "name", "payee", "amount", "dueDay", "startMonth", "book", "categoryId", "accountId", "autopay", "assignedTo", "active", "notes"],
    billPayments: ["id", "billId", "dueDate", "paidDate", "amount", "paidBy", "accountId", "transactionId"],
    subscriptions: ["id", "name", "amount", "cadence", "nextDate", "book", "categoryId", "assignedTo", "active", "notes"],
    debts: ["id", "name", "principal", "apr", "payment", "book", "kind", "notes"],
    snapshots: ["id", "date", "assets", "liabilities", "net", "note"],
    goals: ["id", "name", "kind", "scope", "owner", "targetAmount", "currentAmount", "targetDate", "status", "notes"],
    milestones: ["id", "goalId", "name", "done", "dueDate", "sort"],
    projects: ["id", "name", "area", "status", "budget", "spent", "owner", "startDate", "targetDate", "notes"],
    tasks: ["id", "projectId", "title", "assignee", "status", "dueDate", "notes"],
    events: ["id", "title", "date", "time", "endTime", "owner", "category", "source", "sourceId", "notes", "gcalId"],
    lists: ["id", "name", "kind", "sort"],
    listItems: ["id", "listId", "name", "aisle", "qty", "checked", "staple", "addedBy", "createdAt"],
    chores: ["id", "title", "assignee", "dueDate", "cadence", "status", "area", "notes", "doneAt", "doneBy"],
    meals: ["id", "date", "slot", "title", "notes"],
    mealItems: ["id", "mealId", "name", "qty", "aisle"],
    eggs: ["id", "date", "species", "count", "notes", "loggedBy"],
    eggSales: ["id", "date", "customerId", "species", "dozens", "price", "total", "paid", "notes", "transactionId"],
    customers: ["id", "name", "phone", "email", "kind", "notes"],
    jobs: ["id", "number", "customerId", "customerName", "service", "status", "date", "address", "description", "hours", "rate", "amount", "mileage", "paidDate", "notes", "assignedTo", "transactionId"],
    equipment: ["id", "name", "type", "hours", "status", "notes"],
    serviceLogs: ["id", "equipmentId", "upkeepId", "date", "hours", "what", "cost", "notes", "by"],
    flock: ["id", "species", "breed", "count", "acquired", "status", "notes"],
    mileage: ["id", "date", "vehicle", "miles", "hours", "purpose", "book", "jobId", "notes"],
    trips: ["id", "name", "destination", "startDate", "endDate", "departTime", "travelers", "budget", "spent", "trackMoney", "notes"],
    itinerary: ["id", "tripId", "date", "time", "kind", "title", "address", "confirmation", "notes", "sort"],
    tripItems: ["id", "tripId", "listName", "kind", "assignee", "text", "done", "sort"],
    templates: ["id", "name", "kind", "notes"],
    templateItems: ["id", "templateId", "text", "assignee", "sort"],
    layouts: ["id", "userId", "body", "updatedAt"],
    merchantRules: ["id", "pattern", "categoryId", "book"],
    routines: ["id", "name", "steps", "active"],
    upkeep: ["id", "name", "kind", "everyDays", "everyHours", "everyMiles", "lastDate", "lastReading", "notes"],
    docs: ["id", "name", "category", "owner", "expires", "link", "notes"],
    wins: ["id", "goalId", "title", "date", "note"]
  };

  const WIDGETS = [
    ["vacation", "Next trip", "lg"],
    ["weather", "Weather", "md"],
    ["bills", "Bills", "md"],
    ["money", "Money", "md"],
    ["farm", "Farm", "md"],
    ["chores", "Chores", "md"],
    ["shopping", "Shopping", "md"],
    ["events", "Calendar", "md"],
    ["budgets", "Budgets", "md"],
    ["upkeep", "Upkeep", "md"],
    ["routines", "Routines", "md"],
    ["wins", "Wins", "sm"],
    ["goals", "Goals", "sm"],
    ["devices", "House", "lg"],
    ["prices", "Egg prices", "sm", false],
    ["tax", "Quarterly tax", "sm", false],
    ["docs", "Documents", "sm", false]
  ];

  const NUMERIC = [
    "balance", "amount", "monthly", "sort", "dueDay", "digestHour", "mileageRate",
    "principal", "apr", "payment", "assets", "liabilities", "net", "targetAmount",
    "currentAmount", "budget", "spent", "count", "dozens", "price", "total",
    "hours", "rate", "mileage", "miles", "cost", "billLeadDays", "taxRate", "eggMargin", "wearRate",
    "everyDays", "everyHours", "everyMiles", "lastReading"
  ];

  const SERVICES = [
    ["driveway", "Driveway maintenance"],
    ["bushhog", "Bush hogging"],
    ["grading", "Grading"],
    ["brush", "Brush cleanup"],
    ["stump", "Stump grinding"],
    ["other", "Other"]
  ];

  const SPECIES = ["duck", "chicken", "quail"];

  function emptyState() {
    const state = {};
    Object.keys(FIELDS).forEach(function (name) { state[name] = []; });
    return state;
  }

  function normalize(state) {
    const base = emptyState();
    Object.keys(base).forEach(function (name) {
      base[name] = state && Array.isArray(state[name]) ? state[name] : [];
    });
    return base;
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function today(d) {
    const x = d ? new Date(d) : new Date();
    return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate());
  }

  function parts(iso) {
    const s = String(iso || "");
    return { y: +s.slice(0, 4), m: +s.slice(5, 7), d: +s.slice(8, 10) };
  }

  function iso(y, m, d) { return y + "-" + pad(m) + "-" + pad(d); }

  function utc(isoDate) {
    const p = parts(isoDate);
    return Date.UTC(p.y, p.m - 1, p.d);
  }

  function fromUtc(ms) {
    const d = new Date(ms);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  function addDays(isoDate, n) {
    return fromUtc(utc(isoDate) + n * 86400000);
  }

  function diffDays(from, to) {
    return Math.round((utc(to) - utc(from)) / 86400000);
  }

  function monthKey(isoDate) { return String(isoDate || "").slice(0, 7); }

  function addMonths(isoDate, n) {
    const p = parts(isoDate);
    const dt = new Date(Date.UTC(p.y, p.m - 1 + n, 1));
    return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1).slice(0, 7);
  }

  function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  function cycleDate(month, dueDay) {
    const y = +String(month).slice(0, 4);
    const m = +String(month).slice(5, 7);
    const last = daysInMonth(y, m);
    const day = Math.max(1, Math.min(last, parseInt(dueDay, 10) || 1));
    return iso(y, m, day);
  }

  function inPeriod(date, period) {
    if (!date || !period) return false;
    return String(date).slice(0, String(period).length) === String(period);
  }

  function num(v) {
    if (v === "" || v === null || v === undefined) return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    const s = String(v).replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
    const n = Number(s);
    return isFinite(n) ? n : 0;
  }

  function round2(n) { return Math.round((num(n) + 1e-9) * 100) / 100; }

  function money(n) {
    const v = round2(n);
    const sign = v < 0 ? "-" : "";
    return sign + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function uid(prefix) {
    const raw = String(prefix || "id") + "_" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    return raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  }

  function okId(id) { return /^[A-Za-z0-9_-]{4,40}$/.test(String(id || "")); }

  function byId(rows, id) {
    for (let i = 0; i < (rows || []).length; i++) if (rows[i].id === id) return rows[i];
    return null;
  }

  function serviceName(key) {
    for (let i = 0; i < SERVICES.length; i++) if (SERVICES[i][0] === key) return SERVICES[i][1];
    return key || "Service";
  }

  /* First unpaid due date on or after the bill's start month, within a year. */
  function openCycle(bill, payments, day) {
    if (!bill || String(bill.active) === "no") return null;
    const paid = {};
    (payments || []).forEach(function (p) {
      if (p.billId === bill.id && p.dueDate) paid[p.dueDate] = true;
    });
    let month = bill.startMonth || monthKey(day);
    if (!/^\d{4}-\d{2}$/.test(month)) month = monthKey(day);
    for (let i = 0; i < 14; i++) {
      const due = cycleDate(month, bill.dueDay);
      if (!paid[due]) return due;
      month = addMonths(month + "-01", 1);
    }
    return null;
  }

  function billView(bill, payments, day) {
    const due = openCycle(bill, payments, day);
    if (!due) return { due: "", days: null, status: "none" };
    const days = diffDays(day, due);
    let status = "later";
    if (days < 0) status = "overdue";
    else if (days <= 7) status = "soon";
    return { due: due, days: days, status: status };
  }

  function budgetAmount(state, categoryId, month) {
    const rows = state.budgets || [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].categoryId === categoryId && rows[i].month === month && rows[i].amount !== "" && rows[i].amount != null) {
        return round2(rows[i].amount);
      }
    }
    const cat = byId(state.categories, categoryId);
    if (!cat || cat.monthly === "" || cat.monthly == null) return 0;
    return round2(cat.monthly);
  }

  function categorySpend(state, categoryId, month) {
    let total = 0;
    (state.transactions || []).forEach(function (t) {
      if (t.categoryId !== categoryId) return;
      if (!inPeriod(t.date, month)) return;
      if (t.type === "transfer") return;
      if (num(t.amount) < 0) total += Math.abs(num(t.amount));
    });
    return round2(total);
  }

  function budgetRows(state, month) {
    return (state.categories || [])
      .filter(function (c) { return c.kind === "expense" && String(c.active) !== "no"; })
      .map(function (c) {
        const limit = budgetAmount(state, c.id, month);
        const spent = categorySpend(state, c.id, month);
        const pct = limit > 0 ? spent / limit : 0;
        let status = "none";
        if (limit > 0 && pct >= 1) status = "over";
        else if (limit > 0 && pct >= 0.8) status = "warn";
        else if (limit > 0) status = "ok";
        return { id: c.id, name: c.name, book: c.book, limit: limit, spent: spent, pct: pct, status: status };
      })
      .filter(function (row) { return row.limit > 0 || row.spent > 0; })
      .sort(function (a, b) { return (b.pct || 0) - (a.pct || 0); });
  }

  /* Months until the balance is gone. never=true when the payment does not cover interest. */
  function payoff(principal, aprPercent, monthlyPayment) {
    let bal = round2(principal);
    const r = num(aprPercent) / 100 / 12;
    const pay = round2(monthlyPayment);
    if (bal <= 0) return { months: 0, interest: 0, never: false, payoffDate: "" };
    if (pay <= 0) return { months: null, interest: null, never: true, payoffDate: "" };
    if (r > 0 && pay <= round2(bal * r)) return { months: null, interest: null, never: true, payoffDate: "" };
    let months = 0;
    let interest = 0;
    while (bal > 0.009 && months < 600) {
      const interestPart = bal * r;
      let thisPay = pay;
      if (thisPay > bal + interestPart) thisPay = bal + interestPart;
      interest += interestPart;
      bal = bal + interestPart - thisPay;
      months++;
    }
    const never = months >= 600 && bal > 0.05;
    return { months: never ? null : months, interest: never ? null : round2(interest), never: never, payoffDate: "" };
  }

  function payoffDate(day, months) {
    if (months == null) return "";
    return addMonths(monthKey(day) + "-01", months) + "-01";
  }

  function accountSides(accounts) {
    let assets = 0;
    let liabilities = 0;
    (accounts || []).forEach(function (a) {
      const bal = num(a.balance);
      if (a.type === "credit" || a.type === "loan") liabilities += bal;
      else assets += bal;
    });
    return { assets: round2(assets), liabilities: round2(liabilities), net: round2(assets - liabilities) };
  }

  function monthFlow(state, month) {
    const out = {
      personalIn: 0, personalOut: 0, farmIn: 0, farmOut: 0
    };
    (state.transactions || []).forEach(function (t) {
      if (!inPeriod(t.date, month) || t.type === "transfer") return;
      const amt = num(t.amount);
      const farm = t.book === "Farm";
      if (amt >= 0) {
        if (farm) out.farmIn += amt; else out.personalIn += amt;
      } else if (farm) out.farmOut += Math.abs(amt);
      else out.personalOut += Math.abs(amt);
    });
    ["personalIn", "personalOut", "farmIn", "farmOut"].forEach(function (k) { out[k] = round2(out[k]); });
    return out;
  }

  /* Cash-basis farm profit. A sale or paid job that already has a transaction is not counted twice. */
  function farmPL(state, period) {
    const byCat = {};
    function add(kind, category, amount, label) {
      const key = kind + "|" + category;
      if (!byCat[key]) byCat[key] = { kind: kind, category: category, amount: 0, count: 0 };
      byCat[key].amount = round2(byCat[key].amount + amount);
      byCat[key].count++;
    }
    (state.transactions || []).forEach(function (t) {
      if (t.book !== "Farm" || t.type === "transfer" || !inPeriod(t.date, period)) return;
      const cat = byId(state.categories, t.categoryId);
      const name = (cat && cat.name) || "Uncategorized";
      const amt = num(t.amount);
      if (amt > 0) add("income", name, amt);
      else if (amt < 0) add("expense", name, Math.abs(amt));
    });
    (state.eggSales || []).forEach(function (s) {
      if (s.transactionId || !inPeriod(s.date, period)) return;
      add("income", "Egg sales", num(s.total));
    });
    (state.jobs || []).forEach(function (j) {
      if (j.transactionId || j.status !== "paid" || !inPeriod(j.paidDate || j.date, period)) return;
      add("income", "Tractor services", num(j.amount));
    });
    (state.serviceLogs || []).forEach(function (row) {
      if (!inPeriod(row.date, period) || !num(row.cost)) return;
      const linked = (state.transactions || []).some(function (t) { return t.refType === "service" && t.refId === row.id; });
      if (linked) return;
      add("expense", "Equipment", num(row.cost));
    });
    const lines = Object.keys(byCat).map(function (k) { return byCat[k]; });
    lines.sort(function (a, b) {
      if (a.kind !== b.kind) return a.kind === "income" ? -1 : 1;
      return b.amount - a.amount;
    });
    let income = 0;
    let expense = 0;
    lines.forEach(function (line) {
      if (line.kind === "income") income += line.amount;
      else expense += line.amount;
    });
    return { lines: lines, income: round2(income), expense: round2(expense), profit: round2(income - expense) };
  }

  function eggTotals(eggs, from, to) {
    const out = { duck: 0, chicken: 0, quail: 0, total: 0 };
    (eggs || []).forEach(function (row) {
      if (from && row.date < from) return;
      if (to && row.date > to) return;
      const species = SPECIES.indexOf(row.species) >= 0 ? row.species : "chicken";
      out[species] += num(row.count);
      out.total += num(row.count);
    });
    return out;
  }

  /* IRS business standard mileage. 2026 is split mid-year. A saved rate overrides this. */
  function irsBusinessRate(isoDate) {
    const y = parts(isoDate).y;
    const m = parts(isoDate).m;
    if (y === 2026) return m >= 7 ? 0.76 : 0.725;
    if (y === 2025) return 0.70;
    if (y > 2026) return 0.76;
    return 0.67;
  }

  function mileageValue(rows, rateOverride) {
    let miles = 0;
    let hours = 0;
    let deduction = 0;
    (rows || []).forEach(function (row) {
      const m = num(row.miles);
      miles += m;
      hours += num(row.hours);
      const rate = rateOverride !== "" && rateOverride != null && isFinite(Number(rateOverride))
        ? Number(rateOverride)
        : irsBusinessRate(row.date || "2026-01-01");
      deduction += m * rate;
    });
    return { miles: round2(miles), hours: round2(hours), deduction: round2(deduction) };
  }

  function calendarEntries(state, from, to) {
    const items = [];
    (state.events || []).forEach(function (ev) {
      if (!ev.date || ev.date < from || ev.date > to) return;
      items.push({
        id: ev.id, date: ev.date, time: ev.time || "", title: ev.title, owner: ev.owner || "",
        category: ev.category || "family", source: ev.source || "manual", sourceId: ev.id, notes: ev.notes || ""
      });
    });
    (state.bills || []).forEach(function (bill) {
      if (String(bill.active) === "no") return;
      let month = bill.startMonth || monthKey(from);
      for (let i = 0; i < 18; i++) {
        const due = cycleDate(month, bill.dueDay);
        if (due > to) break;
        if (due >= from) {
          const paid = (state.billPayments || []).some(function (p) { return p.billId === bill.id && p.dueDate === due; });
          items.push({
            id: "billcal_" + bill.id + "_" + due, date: due, time: "",
            title: bill.name + (paid ? " (paid)" : " due"),
            owner: bill.assignedTo || "", category: "bill", source: "bill", sourceId: bill.id,
            notes: money(bill.amount)
          });
        }
        month = addMonths(month + "-01", 1);
      }
    });
    (state.jobs || []).forEach(function (job) {
      if (!job.date || job.date < from || job.date > to) return;
      if (job.status === "cancelled" || job.status === "quote") return;
      items.push({
        id: "jobcal_" + job.id, date: job.date, time: "",
        title: serviceName(job.service) + (job.customerName ? " · " + job.customerName : ""),
        owner: job.assignedTo || "", category: "job", source: "job", sourceId: job.id,
        notes: job.address || ""
      });
    });
    (state.trips || []).forEach(function (trip) {
      if (!trip.startDate || !trip.endDate || trip.startDate > to || trip.endDate < from) return;
      let date = trip.startDate < from ? from : trip.startDate;
      const last = trip.endDate > to ? to : trip.endDate;
      let guard = 0;
      while (date <= last && guard < 45) {
        const edge = date === trip.startDate ? "depart" : (date === trip.endDate ? "return" : "");
        items.push({
          id: "tripcal_" + trip.id + "_" + date, date: date,
          time: edge === "depart" ? (trip.departTime || "") : "",
          title: (trip.name || "Trip") + (trip.destination ? " · " + trip.destination : ""),
          owner: "", category: "trip", source: "trip", sourceId: trip.id, notes: edge
        });
        date = addDays(date, 1);
        guard++;
      }
    });
    (state.upkeep || []).forEach(function (item) {
      const view = upkeepView(item, from);
      if (!view.due || view.due < from || view.due > to) return;
      items.push({ id: "upkeep_" + item.id, date: view.due, time: "", title: (item.name || "Service") + " due", owner: "", category: "upkeep", source: "upkeep", sourceId: item.id, notes: item.kind || "" });
    });
    (state.docs || []).forEach(function (doc) {
      if (!doc.expires || doc.expires < from || doc.expires > to) return;
      items.push({ id: "doc_" + doc.id, date: doc.expires, time: "", title: (doc.name || "Document") + " expires", owner: doc.owner || "", category: "doc", source: "doc", sourceId: doc.id, notes: "" });
    });
    const years = {};
    years[from.slice(0, 4)] = true;
    years[to.slice(0, 4)] = true;
    Object.keys(years).forEach(function (year) {
      quarterDates(year).forEach(function (date) {
        if (date < from || date > to) return;
        items.push({ id: "tax_" + date, date: date, time: "", title: "Estimated tax due", owner: "", category: "tax", source: "tax", sourceId: date, notes: "" });
      });
    });
    items.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return String(a.time).localeCompare(String(b.time));
    });
    return items;
  }

  function monthGrid(month) {
    const y = +month.slice(0, 4);
    const m = +month.slice(5, 7);
    const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const start = fromUtc(Date.UTC(y, m - 1, 1) - firstDow * 86400000);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const date = addDays(start, i);
      cells.push({ date: date, inMonth: date.slice(0, 7) === month });
    }
    return cells;
  }

  function weekDays(anchor) {
    const dow = new Date(utc(anchor)).getUTCDay();
    const start = addDays(anchor, -dow);
    const days = [];
    for (let i = 0; i < 7; i++) days.push(addDays(start, i));
    return days;
  }

  function userName(state, id) {
    if (!id || id === "shared") return "Shared";
    const user = byId(state.users, id);
    if (user) return user.name;
    const settings = (state.settings || [])[0] || {};
    if (id === "user_randy") return settings.randyName || "Randy Johnson";
    if (id === "user_partner") return settings.partnerName || "Partner";
    return "Household";
  }

  function dashboard(state, day, userId) {
    const month = monthKey(day);
    const bills = (state.bills || []).filter(function (b) { return String(b.active) !== "no"; }).map(function (b) {
      const view = billView(b, state.billPayments, day);
      return Object.assign({ bill: b }, view);
    });
    const attention = bills.filter(function (b) { return b.status === "overdue" || b.status === "soon"; });
    const budgets = budgetRows(state, month).filter(function (b) { return b.status === "over" || b.status === "warn"; });
    const soonEvents = calendarEntries(state, day, addDays(day, 7)).filter(function (ev) {
      if (ev.source === "bill") return false;
      if (ev.source === "trip" && ev.notes !== "depart") return false;
      return true;
    }).slice(0, 8);
    const chores = (state.chores || []).filter(function (c) { return c.status !== "done"; });
    const goals = (state.goals || []).filter(function (g) { return g.status !== "done"; }).map(function (g) {
      const target = num(g.targetAmount);
      const current = num(g.currentAmount);
      const milestones = (state.milestones || []).filter(function (m) { return m.goalId === g.id; });
      const done = milestones.filter(function (m) { return m.done === "yes"; }).length;
      const pct = target > 0 ? Math.max(0, Math.min(1, current / target)) : (milestones.length ? done / milestones.length : 0);
      return { goal: g, pct: pct, done: done, total: milestones.length };
    });
    const shopping = (state.listItems || []).filter(function (item) { return item.checked !== "yes"; }).length;
    const eggFrom = addDays(day, -6);
    const eggs = eggTotals(state.eggs, eggFrom, day);
    const openJobs = (state.jobs || []).filter(function (j) {
      return j.status !== "paid" && j.status !== "cancelled";
    });
    const flow = monthFlow(state, month);
    const net = accountSides(state.accounts);
    function mine(owner) {
      return !owner || owner === userId || owner === "shared";
    }
    const people = (state.users || []).filter(function (u) { return String(u.active) !== "no"; }).map(function (u) {
      return {
        user: u,
        bills: attention.filter(function (b) { return b.bill.assignedTo === u.id; }),
        chores: chores.filter(function (c) { return c.assignee === u.id && (!c.dueDate || c.dueDate <= addDays(day, 7)); }),
        events: soonEvents.filter(function (ev) { return ev.owner === u.id; }),
        goals: goals.filter(function (g) { return g.goal.owner === u.id || (g.goal.scope === "shared" && u.id === userId); })
      };
    });
    return {
      day: day,
      month: month,
      bills: attention,
      budgets: budgets,
      events: soonEvents,
      chores: chores,
      goals: goals,
      shopping: shopping,
      eggs: eggs,
      openJobs: openJobs,
      flow: flow,
      net: net,
      people: people,
      mine: mine
    };
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    const src = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (quoted) {
        if (ch === '"') {
          if (src[i + 1] === '"') { cell += '"'; i++; }
          else quoted = false;
        } else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (ch !== "\r") cell += ch;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ""; }); });
  }

  function csvCell(v) {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCsv(rows, columns) {
    const head = columns.map(csvCell).join(",");
    const body = rows.map(function (row) {
      return columns.map(function (col) { return csvCell(row[col]); }).join(",");
    });
    return [head].concat(body).join("\n");
  }

  function importTransactions(text) {
    const table = parseCsv(text);
    if (!table.length) return [];
    const header = table[0].map(function (h) { return String(h || "").trim().toLowerCase(); });
    function col(names) {
      for (let i = 0; i < names.length; i++) {
        const idx = header.indexOf(names[i]);
        if (idx >= 0) return idx;
      }
      return -1;
    }
    const iDate = col(["date", "posted", "posted date"]);
    const iAmt = col(["amount", "amt"]);
    const iPayee = col(["payee", "description", "name", "merchant"]);
    const iMemo = col(["memo", "note", "notes"]);
    const iCat = col(["category", "cat"]);
    const iBook = col(["book", "split", "household"]);
    const iType = col(["type"]);
    const start = iDate >= 0 || iAmt >= 0 ? 1 : 0;
    const out = [];
    for (let r = start; r < table.length; r++) {
      const cells = table[r];
      const amountRaw = iAmt >= 0 ? cells[iAmt] : cells[1];
      let amount = num(amountRaw);
      const typeCell = iType >= 0 ? String(cells[iType] || "").toLowerCase() : "";
      if (typeCell.indexOf("income") >= 0 || typeCell.indexOf("credit") >= 0) amount = Math.abs(amount);
      else if (typeCell.indexOf("expense") >= 0 || typeCell.indexOf("debit") >= 0) amount = -Math.abs(amount);
      const bookCell = iBook >= 0 ? String(cells[iBook] || "") : "";
      const book = /farm/i.test(bookCell) ? "Farm" : "Personal";
      let date = iDate >= 0 ? String(cells[iDate] || "").trim() : String(cells[0] || "").trim();
      const mdY = date.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (mdY) {
        const year = mdY[3].length === 2 ? "20" + mdY[3] : mdY[3];
        date = iso(+year, +mdY[1], +mdY[2]);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !amount) continue;
      out.push({
        date: date,
        amount: round2(amount),
        payee: iPayee >= 0 ? String(cells[iPayee] || "").trim() : "",
        memo: iMemo >= 0 ? String(cells[iMemo] || "").trim() : "",
        category: iCat >= 0 ? String(cells[iCat] || "").trim() : "",
        book: book,
        type: amount >= 0 ? "income" : "expense"
      });
    }
    return out;
  }

  function searchAll(state, query) {
    const n = String(query || "").trim().toLowerCase();
    if (n.length < 2) return [];
    const hits = [];
    function push(kind, title, sub, route) {
      if (hits.length < 40) hits.push({ kind: kind, title: title, sub: sub, route: route });
    }
    function has() {
      for (let i = 0; i < arguments.length; i++) {
        if (String(arguments[i] || "").toLowerCase().indexOf(n) >= 0) return true;
      }
      return false;
    }
    (state.transactions || []).forEach(function (t) {
      if (has(t.payee, t.memo, t.book)) push("Transaction", t.payee || t.memo || "Transaction", t.date + " · " + money(t.amount), "money/transactions");
    });
    (state.bills || []).forEach(function (b) {
      if (has(b.name, b.payee, b.notes)) push("Bill", b.name, money(b.amount), "money/bills");
    });
    (state.jobs || []).forEach(function (j) {
      if (has(j.number, j.customerName, j.description, j.address, serviceName(j.service))) {
        push("Farm job", (j.number ? j.number + " · " : "") + (j.customerName || serviceName(j.service)), j.date || j.status, "farm/job/" + j.id);
      }
    });
    (state.customers || []).forEach(function (c) {
      if (has(c.name, c.phone, c.email, c.notes)) push("Customer", c.name, c.phone || c.kind || "", "farm/customers");
    });
    (state.events || []).forEach(function (ev) {
      if (has(ev.title, ev.notes, ev.category)) push("Event", ev.title, ev.date, "plan/calendar");
    });
    (state.chores || []).forEach(function (c) {
      if (has(c.title, c.notes)) push("Chore", c.title, c.dueDate || c.status, "today/chores");
    });
    (state.goals || []).forEach(function (g) {
      if (has(g.name, g.notes)) push("Goal", g.name, g.targetDate || "", "plan/goals");
    });
    (state.projects || []).forEach(function (p) {
      if (has(p.name, p.notes)) push("Project", p.name, p.area || "", "plan/project/" + p.id);
    });
    (state.tasks || []).forEach(function (t) {
      if (has(t.title, t.notes)) push("Task", t.title, t.dueDate || "", "plan/projects");
    });
    (state.listItems || []).forEach(function (item) {
      if (has(item.name, item.aisle)) push("Shopping", item.name, item.aisle || "", "today/shop");
    });
    (state.equipment || []).forEach(function (eq) {
      if (has(eq.name, eq.type, eq.notes)) push("Equipment", eq.name, eq.type || "", "farm/equipment");
    });
    (state.trips || []).forEach(function (trip) {
      if (has(trip.name, trip.destination, trip.notes)) push("Trip", trip.name, trip.destination || trip.startDate, "vacation/trip/" + trip.id);
    });
    return hits;
  }

  /* Next trip that has not ended, and the days/hours until departure or until they are home. */
  function upcomingTrip(state, day) {
    const rows = (state.trips || []).filter(function (trip) { return trip.endDate && trip.endDate >= day && trip.startDate; });
    rows.sort(function (a, b) { return a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0; });
    return rows[0] || null;
  }

  function atLocal(isoDate, time) {
    const p = parts(isoDate);
    const hm = String(time || "00:00").split(":");
    return new Date(p.y, p.m - 1, p.d, parseInt(hm[0], 10) || 0, parseInt(hm[1], 10) || 0, 0);
  }

  function countdown(trip, now) {
    if (!trip || !trip.startDate || !trip.endDate) return null;
    const clock = now || new Date();
    const start = atLocal(trip.startDate, trip.departTime || "08:00");
    const end = atLocal(trip.endDate, "18:00");
    let ms = start - clock;
    let phase = "until";
    if (clock >= start && clock <= end) { ms = end - clock; phase = "there"; }
    else if (clock > end) return null;
    if (ms < 0) ms = 0;
    return {
      phase: phase,
      days: Math.floor(ms / 86400000),
      hours: Math.floor((ms % 86400000) / 3600000),
      trip: trip
    };
  }

  function tripSpent(state, trip) {
    if (!trip) return 0;
    if (String(trip.trackMoney) === "yes") {
      let sum = 0;
      (state.transactions || []).forEach(function (row) {
        if (row.refType === "trip" && row.refId === trip.id && row.type !== "transfer" && num(row.amount) < 0) sum += Math.abs(num(row.amount));
      });
      return round2(sum);
    }
    return round2(trip.spent);
  }

  function taxRows(state, year) {
    const period = String(year);
    const rows = [];
    (state.transactions || []).forEach(function (t) {
      if (t.book !== "Farm" || t.type === "transfer" || !inPeriod(t.date, period)) return;
      const cat = byId(state.categories, t.categoryId);
      const amt = num(t.amount);
      if (!amt) return;
      rows.push({
        date: t.date,
        type: amt > 0 ? "Income" : "Expense",
        category: (cat && cat.name) || "Uncategorized",
        description: t.payee || t.memo || "",
        amount: round2(Math.abs(amt)).toFixed(2),
        source: t.refType || "transaction"
      });
    });
    (state.eggSales || []).forEach(function (s) {
      if (s.transactionId || !inPeriod(s.date, period)) return;
      rows.push({ date: s.date, type: "Income", category: "Egg sales", description: s.species + " eggs", amount: round2(s.total).toFixed(2), source: "egg sale" });
    });
    (state.jobs || []).forEach(function (j) {
      if (j.transactionId || j.status !== "paid" || !inPeriod(j.paidDate || j.date, period)) return;
      rows.push({ date: j.paidDate || j.date, type: "Income", category: "Tractor services", description: serviceName(j.service) + (j.customerName ? " · " + j.customerName : ""), amount: round2(j.amount).toFixed(2), source: "job" });
    });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return rows;
  }

  function chunkOps(ops, max) {
    const size = max || 80;
    const out = [];
    for (let i = 0; i < ops.length; i += size) out.push(ops.slice(i, i + size));
    return out;
  }

  function nextChoreDate(due, cadence, day) {
    const base = due && due >= day ? due : day;
    if (cadence === "daily") return addDays(base, 1);
    if (cadence === "weekly") return addDays(base, 7);
    if (cadence === "monthly") return addMonths(monthKey(base) + "-01", 1) + "-" + String(base).slice(8, 10);
    return "";
  }

  function subscriptionMonthly(sub) {
    const amount = num(sub.amount);
    if (sub.cadence === "yearly") return round2(amount / 12);
    if (sub.cadence === "weekly") return round2(amount * 52 / 12);
    return round2(amount);
  }

  function goalProgress(goal, milestones) {
    const target = num(goal.targetAmount);
    const current = num(goal.currentAmount);
    const rows = milestones || [];
    const done = rows.filter(function (m) { return m.done === "yes"; }).length;
    if (target > 0) return Math.max(0, Math.min(1, current / target));
    if (rows.length) return done / rows.length;
    return goal.status === "done" ? 1 : 0;
  }

  return {
    FIELDS: FIELDS,
    NUMERIC: NUMERIC,
    SERVICES: SERVICES,
    SPECIES: SPECIES,
    emptyState: emptyState,
    normalize: normalize,
    today: today,
    addDays: addDays,
    diffDays: diffDays,
    monthKey: monthKey,
    addMonths: addMonths,
    cycleDate: cycleDate,
    inPeriod: inPeriod,
    num: num,
    round2: round2,
    money: money,
    uid: uid,
    okId: okId,
    byId: byId,
    serviceName: serviceName,
    openCycle: openCycle,
    billView: billView,
    budgetAmount: budgetAmount,
    categorySpend: categorySpend,
    budgetRows: budgetRows,
    payoff: payoff,
    payoffDate: payoffDate,
    accountSides: accountSides,
    monthFlow: monthFlow,
    farmPL: farmPL,
    eggTotals: eggTotals,
    irsBusinessRate: irsBusinessRate,
    mileageValue: mileageValue,
    calendarEntries: calendarEntries,
    monthGrid: monthGrid,
    weekDays: weekDays,
    userName: userName,
    dashboard: dashboard,
    parseCsv: parseCsv,
    toCsv: toCsv,
    importTransactions: importTransactions,
    searchAll: searchAll,
    taxRows: taxRows,
    chunkOps: chunkOps,
    nextChoreDate: nextChoreDate,
    subscriptionMonthly: subscriptionMonthly,
    goalProgress: goalProgress,
    upcomingTrip: upcomingTrip,
    countdown: countdown,
    tripSpent: tripSpent,
    WIDGETS: WIDGETS,
    defaultLayout: defaultLayout,
    normalizeLayout: normalizeLayout,
    chooseLayout: chooseLayout,
    matchRule: matchRule,
    planImport: planImport,
    eggPrices: eggPrices,
    jobQuote: jobQuote,
    farmTax: farmTax,
    quarterDates: quarterDates,
    scheduleF: scheduleF,
    upkeepView: upkeepView,
    weatherCare: weatherCare
  };

  function matchRule(rules, merchant) {
    const text = String(merchant || "").toLowerCase();
    let best = null;
    (rules || []).forEach(function (rule) {
      const pattern = String(rule.pattern || "").toLowerCase();
      if (!pattern || text.indexOf(pattern) < 0) return;
      if (!best || pattern.length > String(best.pattern || "").length) best = rule;
    });
    return {
      categoryId: best ? best.categoryId || "" : "",
      book: best && best.book === "Farm" ? "Farm" : "Personal"
    };
  }

  function planImport(existingIds, rows, rules) {
    const seen = {};
    (existingIds || []).forEach(function (id) { if (id) seen[String(id)] = true; });
    const accepted = [];
    const skipped = [];
    (rows || []).forEach(function (row) {
      const externalId = String(row.externalId || row.id || "");
      if (!externalId || seen[externalId]) { skipped.push(externalId || ""); return; }
      seen[externalId] = true;
      const rule = matchRule(rules, row.merchant || row.description || "");
      const amount = round2(row.amount);
      accepted.push({
        date: String(row.date || "").slice(0, 10),
        amount: amount,
        type: amount < 0 ? "expense" : "income",
        payee: String(row.merchant || row.description || "Bank").slice(0, 120),
        account: String(row.account || ""),
        externalId: externalId,
        categoryId: rule.categoryId,
        book: rule.book
      });
    });
    return { accepted: accepted, skipped: skipped };
  }

  function eggPrices(state, from, to, marginPercent) {
    const eggs = eggTotals(state.eggs || [], from, to);
    let cost = 0;
    (state.transactions || []).forEach(function (row) {
      if (row.book !== "Farm" || row.type === "transfer" || num(row.amount) >= 0) return;
      if (from && row.date < from) return;
      if (to && row.date > to) return;
      const cat = byId(state.categories, row.categoryId);
      const name = cat ? cat.name : "";
      if (row.categoryId === "cat_feed" || /feed/i.test(name)) cost += Math.abs(num(row.amount));
    });
    const margin = marginPercent == null || marginPercent === "" ? 50 : num(marginPercent);
    function line(species) {
      const count = eggs[species] || 0;
      const dozens = count / 12;
      const share = eggs.total ? cost * (count / eggs.total) : 0;
      const perDozen = dozens ? share / dozens : 0;
      return { count: count, dozens: round2(dozens), cost: round2(share), perDozen: round2(perDozen), suggested: round2(perDozen * (1 + margin / 100)) };
    }
    return { duck: line("duck"), chicken: line("chicken"), quail: line("quail"), feedCost: round2(cost), margin: margin };
  }

  function jobQuote(input) {
    input = input || {};
    const hours = num(input.hours);
    const labor = hours * num(input.rate);
    const fuel = num(input.fuel);
    const travel = num(input.miles) * num(input.mileageRate);
    const wear = hours * num(input.wearRate);
    return { labor: round2(labor), fuel: round2(fuel), travel: round2(travel), wear: round2(wear), total: round2(labor + fuel + travel + wear) };
  }

  function farmTax(profit, ratePercent) {
    const base = num(profit);
    if (base <= 0) return 0;
    return round2(base * num(ratePercent) / 100);
  }

  function quarterDates(year) {
    const y = Number(year);
    return [y + "-04-15", y + "-06-15", y + "-09-15", (y + 1) + "-01-15"];
  }

  function scheduleF(state, year) {
    const period = String(year);
    const lines = {};
    function add(line, kind, amount) {
      const key = kind + "|" + line;
      if (!lines[key]) lines[key] = { line: String(line), kind: kind, amount: 0 };
      lines[key].amount = round2(lines[key].amount + amount);
    }
    (state.transactions || []).forEach(function (row) {
      if (row.book !== "Farm" || row.type === "transfer" || !inPeriod(row.date, period)) return;
      const cat = byId(state.categories, row.categoryId);
      const line = (cat && cat.scheduleF) || (num(row.amount) >= 0 ? "4" : "32");
      const amount = num(row.amount);
      if (!amount) return;
      add(line, amount > 0 ? "income" : "expense", Math.abs(amount));
    });
    return Object.keys(lines).map(function (key) { return lines[key]; }).sort(function (a, b) { return String(a.line).localeCompare(String(b.line), undefined, { numeric: true }); });
  }

  function upkeepView(item, day) {
    const everyDays = parseInt(item.everyDays, 10);
    const due = item.lastDate && everyDays ? addDays(item.lastDate, everyDays) : "";
    let status = "ok";
    let days = null;
    if (due) {
      days = diffDays(day, due);
      if (days < 0) status = "overdue";
      else if (days <= 14) status = "soon";
    }
    const step = num(item.everyHours) || num(item.everyMiles);
    const next = step ? round2(num(item.lastReading) + step) : "";
    return { due: due, days: days, status: status, next: next };
  }

  function weatherCare(report) {
    const notes = [];
    const periods = (report && report.periods) || [];
    const alerts = (report && report.alerts) || [];
    if (periods.some(function (p) { return num(p.temp) <= 32; })) notes.push("Freeze: check shelter and unfrozen water.");
    else if (periods.some(function (p) { return num(p.temp) <= 36; })) notes.push("Frost: cover waterers and collect eggs early.");
    if (periods.some(function (p) { return num(p.temp) >= 95; })) notes.push("Heat: extra water and shade for the birds.");
    if (alerts.some(function (a) { return /storm|thunder|tornado|wind|hurricane/i.test(String(a.event || "") + String(a.headline || "")); })) notes.push("Storm: secure the coop and bring tools in.");
    return notes;
  }

  function defaultLayout() {
    return WIDGETS.map(function (row) { return { id: row[0], size: row[2], show: row[3] !== false }; });
  }

  function normalizeLayout(input) {
    const known = {};
    WIDGETS.forEach(function (row) { known[row[0]] = row[2]; });
    const out = [];
    const seen = {};
    (Array.isArray(input) ? input : []).forEach(function (item) {
      if (!item || !known[item.id] || seen[item.id]) return;
      seen[item.id] = true;
      const size = item.size === "sm" || item.size === "lg" ? item.size : "md";
      out.push({ id: item.id, size: size, show: item.show !== false && item.show !== "no" });
    });
    WIDGETS.forEach(function (row) {
      if (!seen[row[0]]) out.push({ id: row[0], size: row[2], show: row[3] !== false });
    });
    return out;
  }

  function chooseLayout(state, userId, local) {
    const row = byId((state && state.layouts) || [], "lay_" + userId);
    let sheetItems = null;
    let sheetAt = "";
    if (row && row.body) {
      try { sheetItems = JSON.parse(row.body); } catch (e) { sheetItems = null; }
      sheetAt = String(row.updatedAt || "");
    }
    const localAt = local && local.savedAt ? String(local.savedAt) : "";
    if (local && local.items && localAt >= sheetAt) return normalizeLayout(local.items);
    if (sheetItems) return normalizeLayout(sheetItems);
    if (local && local.items) return normalizeLayout(local.items);
    return defaultLayout();
  }
});
