/* Page controller: navigation, forms, and the calls that reach the sheet. */
(function () {
  const L = function () { return globalThis.HubLogic; };
  const U = function () { return globalThis.HubUI; };
  const NAV = [
    ["home", "Home", "M3 12 L12 4 L21 12 V20 H3Z"],
    ["money", "Money", "M4 7 H20 V17 H4Z M4 11 H20"],
    ["farm", "Farm", "M4 14 L12 6 L20 14 V20 H4Z"],
    ["today", "Today", "M5 5 H19 V19 H5Z M5 9 H19"],
    ["more", "More", "M5 7 H19 M5 12 H19 M5 17 H19"]
  ];

  const App = {
    state: null,
    route: "home",
    userId: "user_randy",
    mode: "sample",
    theme: "system",
    modal: null,
    month: "",
    bookFilter: "All",
    txQuery: "",
    query: "",
    listId: "list_groc",
    calMonth: "",
    calDay: "",
    calMode: "agenda",
    devices: [],
    deviceNote: "",
    deviceError: "",
    blink: null,
    needsCode: false,
    offline: false,
    _charts: [],
    _chartObjs: []
  };
  globalThis.App = App;

  function toast(text) {
    const root = document.getElementById("toastRoot");
    root.innerHTML = '<div class="toast">' + U().esc(text) + "</div>";
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { root.innerHTML = ""; }, 3200);
  }

  function sectionOf(route) {
    if (!route || route === "home") return "home";
    if (route.indexOf("money") === 0) return "money";
    if (route.indexOf("farm") === 0) return "farm";
    if (route.indexOf("today") === 0) return "today";
    return "more";
  }

  function applyTheme() {
    const dark = App.theme === "dark" || (App.theme !== "light" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    const btn = document.getElementById("themeBtn");
    if (btn) btn.textContent = dark ? "Light" : "Dark";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#121612" : "#1f3d2a";
  }

  function paintChrome() {
    const settings = (App.state.settings || [])[0] || {};
    document.getElementById("brandSub").textContent = settings.farmName || "CW Johnson Farms";
    const who = document.getElementById("who");
    const users = (App.state.users || []).filter(function (user) { return String(user.active) !== "no"; });
    who.innerHTML = users.map(function (user) {
      return '<option value="' + U().esc(user.id) + '">' + U().esc(user.name) + "</option>";
    }).join("");
    if (!users.some(function (user) { return user.id === App.userId; }) && users[0]) App.userId = users[0].id;
    who.value = App.userId;
    const section = sectionOf(App.route);
    const links = NAV.map(function (item) {
      const on = section === item[0] ? " on" : "";
      return '<a href="#' + item[0] + '" data-go="' + item[0] + '" class="' + on.trim() + '">' + U().esc(item[1]) + "</a>";
    }).join("");
    document.getElementById("nav").innerHTML = links;
    document.getElementById("tabbar").innerHTML = NAV.map(function (item) {
      const on = section === item[0] ? " on" : "";
      return '<a href="#' + item[0] + '" data-go="' + item[0] + '" class="' + on.trim() + '"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="' + item[2] + '" fill="none" stroke="currentColor" stroke-width="2"/></svg>' + U().esc(item[1]) + "</a>";
    }).join("");
    const bits = [];
    if (App.needsCode) bits.push(["warn", "Enter the household access code to open the shared sheet."]);
    else if (App.mode === "sample") bits.push(["", "Sample data on this phone. Connect a Google Sheet when both of you should see the same lists."]);
    if (App.offline) bits.push(["warn", "Showing the last saved copy. Changes stay on this phone until the sheet answers."]);
    if (globalThis.Store.pending) bits.push(["warn", globalThis.Store.pending + " change" + (globalThis.Store.pending === 1 ? "" : "s") + " waiting to sync."]);
    document.getElementById("banner").innerHTML = bits.map(function (bit) {
      return '<div class="banner ' + bit[0] + '">' + U().esc(bit[1]) + "</div>";
    }).join("");
    document.getElementById("fab").hidden = !!App.needsCode;
  }

  function render() {
    const y = window.scrollY;
    const previous = render.route;
    const active = document.activeElement;
    const focusId = active && active.id;
    const caret = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
    applyTheme();
    paintChrome();
    if (App.state) App.layout = L().chooseLayout(App.state, App.userId, storedLayout());
    App._charts = [];
    document.getElementById("view").innerHTML = globalThis.HubView.page();
    document.getElementById("modalRoot").innerHTML = globalThis.HubView.modal();
    mountCharts();
    if (App.modal) {
      const first = document.querySelector("#modalRoot input, #modalRoot select, #modalRoot textarea");
      if (first) first.focus();
    } else if (focusId && previous === App.route) {
      const again = document.getElementById(focusId);
      if (again) {
        again.focus();
        if (caret != null && again.setSelectionRange) again.setSelectionRange(caret, caret);
      }
    }
    if (previous !== App.route) window.scrollTo(0, 0);
    else window.scrollTo(0, y);
    render.route = App.route;
    document.body.classList.toggle("editing", !!App.editing);
    mountSortable();
  }

  function storedLayout() {
    try { return JSON.parse(localStorage.getItem("hub-layout-" + App.userId) || ""); } catch (e) { return null; }
  }

  function persistLayout(items) {
    const savedAt = new Date().toISOString();
    const clean = L().normalizeLayout(items);
    App.layout = clean;
    try { localStorage.setItem("hub-layout-" + App.userId, JSON.stringify({ items: clean, savedAt: savedAt })); } catch (e) {}
    const id = "lay_" + App.userId;
    if (!App.state.layouts) App.state.layouts = [];
    change(function (api) {
      api.upsert("layouts", { id: id, userId: App.userId, body: JSON.stringify(clean), updatedAt: savedAt });
    });
  }

  function mountSortable() {
    if (App._sort) {
      try { App._sort.destroy(); } catch (e) {}
      App._sort = null;
    }
    const root = document.getElementById("widgets");
    if (!root || !App.editing || !window.Sortable) return;
    App._sort = window.Sortable.create(root, {
      animation: 180,
      delay: 220,
      delayOnTouchOnly: true,
      touchStartThreshold: 6,
      ghostClass: "drag-ghost",
      handle: ".grip",
      draggable: ".widget",
      onEnd: function () {
        const ids = Array.prototype.map.call(root.querySelectorAll(".widget"), function (node) { return node.getAttribute("data-widget"); });
        const byId = {};
        (App.layout || []).forEach(function (item) { byId[item.id] = item; });
        const next = ids.map(function (id) { return byId[id]; }).filter(Boolean);
        (App.layout || []).forEach(function (item) { if (!item.show) next.push(item); });
        persistLayout(next);
        render();
      }
    });
  }

  function mountCharts() {
    (App._chartObjs || []).forEach(function (chart) { chart.destroy(); });
    App._chartObjs = [];
    if (!window.Chart) return;
    const dark = document.documentElement.dataset.theme === "dark";
    const ink = dark ? "#f4efe4" : "#1c2416";
    const muted = dark ? "#b7c0b0" : "#5e6758";
    const grid = dark ? "rgba(244,239,228,.08)" : "rgba(28,36,22,.08)";
    const colors = ["#2f7d46", "#c4922a", "#3c7ea6", "#b5523a"];
    (App._charts || []).forEach(function (spec) {
      const canvas = document.getElementById(spec.id);
      if (!canvas) return;
      const sets = spec.sets || [{ label: spec.label || "", data: spec.data }];
      const chart = new window.Chart(canvas, {
        type: spec.type === "line" ? "line" : "bar",
        data: {
          labels: spec.labels,
          datasets: sets.map(function (set, index) {
            return {
              label: set.label || "",
              data: set.data,
              backgroundColor: spec.sets ? colors[index % colors.length] : colors,
              borderColor: colors[index % colors.length],
              tension: 0.25
            };
          })
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: !!spec.sets, labels: { color: ink } } },
          scales: {
            x: { stacked: !!spec.stacked, ticks: { color: muted }, grid: { display: false } },
            y: { stacked: !!spec.stacked, ticks: { color: muted }, grid: { color: grid }, beginAtZero: true }
          }
        }
      });
      App._chartObjs.push(chart);
    });
  }

  function go(route) {
    App.modal = null;
    App.route = route || "home";
    if (location.hash !== "#" + App.route) location.hash = App.route;
    render();
  }

  function openModal(title, html, wide) {
    App.modal = { title: title, html: html, wide: !!wide };
    render();
  }
  function closeModal() {
    App.modal = null;
    render();
  }

  function readForm(form) {
    const data = {};
    new FormData(form).forEach(function (value, key) {
      if (data[key] != null) data[key] = data[key] + "," + String(value);
      else data[key] = String(value);
    });
    return data;
  }

  function cancelRow() {
    return '<div class="row end wrap"><button class="btn" type="button" data-act="close">Cancel</button><button class="primary" type="submit">Save</button></div>';
  }

  async function change(mutator) {
    const ops = [];
    const api = {
      upsert: function (collection, data) {
        const rows = App.state[collection];
        if (!data.id) data.id = L().uid(collection.slice(0, 3));
        const index = rows.findIndex(function (row) { return row.id === data.id; });
        const full = Object.assign({}, index >= 0 ? rows[index] : {}, data);
        if (index >= 0) rows[index] = full;
        else rows.push(full);
        ops.push({ op: "set", collection: collection, id: full.id, data: full });
        return full.id;
      },
      remove: function (collection, id) {
        App.state[collection] = App.state[collection].filter(function (row) { return row.id !== id; });
        ops.push({ op: "delete", collection: collection, id: id });
      }
    };
    mutator(api);
    const result = await globalThis.Store.persist(App.state, ops);
    if (result && result.message) toast(result.message);
    else if (result && result.queued) toast("Saved on this phone. It will sync when the sheet answers.");
    return result;
  }

  function shiftAccount(api, accountId, delta) {
    const acct = L().byId(App.state.accounts, accountId);
    if (!acct || !L().num(delta)) return;
    api.upsert("accounts", { id: acct.id, balance: L().round2(L().num(acct.balance) + L().num(delta)), updatedAt: L().today() });
  }

  function bookOptions(selected) {
    return U().select("Household or farm", "book", selected || "Personal", [["Personal", "Personal"], ["Farm", "Farm"]]);
  }

  function openTx(book) {
    const accounts = U().accountOptions(App.state);
    if (!accounts.length) { toast("Add an account first."); return; }
    openModal("Transaction", '<form class="stack" data-act="save-tx">' +
      U().select("Type", "type", "expense", [["expense", "Expense"], ["income", "Income"], ["transfer", "Transfer"]]) +
      U().field("Amount", "amount", "", "number") +
      U().field("Date", "date", L().today(), "date") +
      U().field("Payee", "payee", "") +
      U().select("Account", "accountId", accounts[0][0], accounts) +
      U().select("To account (transfers)", "toAccount", accounts[0][0], accounts) +
      U().select("Category", "categoryId", "", [["" , "None"]].concat(U().categoryOptions(App.state))) +
      bookOptions(book || "Personal") +
      U().field("Memo", "memo", "") + cancelRow() + "</form>");
  }

  function openAccount() {
    openModal("Account", '<form class="stack" data-act="save-account">' +
      U().field("Name", "name", "") +
      U().select("Type", "type", "checking", [["checking", "Checking"], ["savings", "Savings"], ["cash", "Cash"], ["credit", "Credit card"], ["loan", "Loan"], ["investment", "Investment"]]) +
      bookOptions("Personal") +
      U().field("Balance", "balance", "", "number") +
      U().field("Institution", "institution", "") + cancelRow() + "</form>");
  }

  function openBill(existing) {
    const bill = existing || {};
    openModal(existing ? "Edit bill" : "Bill", '<form class="stack" data-act="save-bill">' +
      '<input type="hidden" name="id" value="' + U().esc(bill.id || "") + '">' +
      U().field("Name", "name", bill.name || "") +
      U().field("Payee", "payee", bill.payee || "") +
      U().field("Amount", "amount", bill.amount || "", "number") +
      U().field("Due day of month", "dueDay", bill.dueDay || new Date().getDate(), "number") +
      U().field("Starts", "startMonth", bill.startMonth || L().monthKey(L().today()), "month") +
      bookOptions(bill.book || "Personal") +
      U().select("Category", "categoryId", bill.categoryId || "", U().categoryOptions(App.state, "expense")) +
      U().select("Pay from", "accountId", bill.accountId || "", U().accountOptions(App.state)) +
      U().select("Whose bill", "assignedTo", bill.assignedTo || App.userId, U().userOptions(App.state)) +
      '<label class="checkline"><input type="checkbox" name="autopay" value="yes"' + (bill.autopay === "yes" ? " checked" : "") + "><span>Autopay</span></label>" +
      U().area("Notes", "notes", bill.notes || "") + cancelRow() + "</form>");
  }

  function openPay(id) {
    const bill = L().byId(App.state.bills, id);
    if (!bill) return;
    const view = L().billView(bill, App.state.billPayments, L().today());
    if (!view.due) { toast("That bill has no open due date."); return; }
    const debts = (App.state.debts || []).map(function (debt) { return [debt.id, debt.name]; });
    openModal("Mark " + bill.name + " paid", '<form class="stack" data-act="save-pay"><input type="hidden" name="id" value="' + U().esc(bill.id) + '"><p>Due ' + U().esc(U().longDate(view.due)) + " · " + U().esc(L().money(bill.amount)) + "</p>" +
      U().select("Pay from", "accountId", bill.accountId || "", U().accountOptions(App.state)) +
      (debts.length ? U().select("Also lower a loan", "debtId", "", [["", "Don't change a loan"]].concat(debts)) : "") +
      cancelRow() + "</form>");
  }

  function openDebt(existing) {
    const debt = existing || {};
    openModal(existing ? "Update debt" : "Debt", '<form class="stack" data-act="save-debt"><input type="hidden" name="id" value="' + U().esc(debt.id || "") + '">' +
      U().field("Name", "name", debt.name || "") +
      U().field("Balance owed", "principal", debt.principal || "", "number") +
      U().field("APR %", "apr", debt.apr || "", "number") +
      U().field("Monthly payment", "payment", debt.payment || "", "number") +
      bookOptions(debt.book || "Farm") +
      U().select("Kind", "kind", debt.kind || "other", [["mortgage", "Mortgage"], ["auto", "Auto"], ["card", "Card"], ["equipment", "Equipment"], ["other", "Other"]]) +
      cancelRow() + "</form>");
  }

  function openSub() {
    openModal("Subscription", '<form class="stack" data-act="save-sub">' +
      U().field("Name", "name", "") + U().field("Amount", "amount", "", "number") +
      U().select("Cadence", "cadence", "monthly", [["monthly", "Monthly"], ["yearly", "Yearly"], ["weekly", "Weekly"]]) +
      U().field("Next date", "nextDate", L().today(), "date") + bookOptions("Personal") +
      U().select("Whose", "assignedTo", App.userId, U().userOptions(App.state)) + cancelRow() + "</form>");
  }

  function openCategory() {
    openModal("Category", '<form class="stack" data-act="save-category">' +
      U().field("Name", "name", "") + bookOptions("Personal") +
      U().select("Kind", "kind", "expense", [["expense", "Expense"], ["income", "Income"]]) +
      U().field("Monthly budget", "monthly", "", "number") + cancelRow() + "</form>");
  }

  function openBudget(id) {
    const cat = L().byId(App.state.categories, id);
    if (!cat) return;
    const month = L().monthKey(L().today());
    openModal(cat.name + " budget", '<form class="stack" data-act="save-budget"><input type="hidden" name="id" value="' + U().esc(cat.id) + '">' +
      U().field("Monthly amount", "monthly", cat.monthly || "", "number") +
      '<label class="checkline"><input type="checkbox" name="onlyMonth" value="yes"><span>Only ' + U().esc(month) + "</span></label>" +
      cancelRow() + "</form>");
  }

  function openGoal(existing) {
    const goal = existing || {};
    openModal(existing ? "Update goal" : "Goal", '<form class="stack" data-act="save-goal"><input type="hidden" name="id" value="' + U().esc(goal.id || "") + '">' +
      U().field("Name", "name", goal.name || "") +
      U().select("Scope", "scope", goal.scope || "shared", [["shared", "Shared"], ["personal", "Personal"]]) +
      U().select("Kind", "kind", goal.kind || "savings", [["savings", "Savings"], ["personal", "Personal"], ["farm", "Farm"], ["home", "Home"]]) +
      U().select("Whose goal", "owner", goal.owner || "shared", [["shared", "Shared"]].concat(U().userOptions(App.state))) +
      U().field("Target amount", "targetAmount", goal.targetAmount || "", "number") +
      U().field("Saved so far", "currentAmount", goal.currentAmount || "", "number") +
      U().field("Target date", "targetDate", goal.targetDate || "", "date") +
      U().area("Notes", "notes", goal.notes || "") + cancelRow() + "</form>");
  }

  function openProject() {
    openModal("Project", '<form class="stack" data-act="save-project">' +
      U().field("Name", "name", "") +
      U().select("Area", "area", "home", [["home", "Home"], ["farm", "Farm"]]) +
      U().select("Owner", "owner", App.userId, U().userOptions(App.state, [["shared", "Shared"]])) +
      U().field("Budget", "budget", "", "number") +
      U().field("Already spent", "spent", "", "number") +
      U().field("Target date", "targetDate", "", "date") +
      U().area("Notes", "notes", "") + cancelRow() + "</form>");
  }

  function openTask(projectId) {
    openModal("Task", '<form class="stack" data-act="save-task"><input type="hidden" name="projectId" value="' + U().esc(projectId) + '">' +
      U().field("Title", "title", "") +
      U().select("Assignee", "assignee", App.userId, U().userOptions(App.state)) +
      U().field("Due", "dueDate", L().today(), "date") + cancelRow() + "</form>");
  }

  function openEvent() {
    openModal("Event", '<form class="stack" data-act="save-event">' +
      U().field("Title", "title", "") +
      U().field("Date", "date", App.calDay || L().today(), "date") +
      U().field("Start", "time", "", "time") +
      U().field("End", "endTime", "", "time") +
      U().select("Whose", "owner", App.userId, U().userOptions(App.state, [["shared", "Shared"]])) +
      U().select("Category", "category", "family", [["family", "Family"], ["farm", "Farm"], ["personal", "Personal"]]) +
      U().area("Notes", "notes", "") + cancelRow() + "</form>");
  }

  function openChore() {
    openModal("Chore", '<form class="stack" data-act="save-chore">' +
      U().field("Title", "title", "") +
      U().select("Who", "assignee", App.userId, U().userOptions(App.state)) +
      U().field("Due", "dueDate", L().today(), "date") +
      U().select("Repeats", "cadence", "once", [["once", "Once"], ["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]]) +
      U().select("Where", "area", "home", [["home", "Home"], ["farm", "Farm"]]) + cancelRow() + "</form>");
  }

  function openMeal(date, slot) {
    openModal("Meal", '<form class="stack" data-act="save-meal">' +
      U().field("Date", "date", date || L().today(), "date") +
      U().select("Slot", "slot", slot || "dinner", [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"]]) +
      U().field("What's for dinner", "title", "") + cancelRow() + "</form>");
  }

  function openIngredient(mealId) {
    openModal("Ingredient", '<form class="stack" data-act="save-ingredient"><input type="hidden" name="mealId" value="' + U().esc(mealId) + '">' +
      U().field("Ingredient", "name", "") + U().field("Qty", "qty", "") + U().field("Aisle", "aisle", "") + cancelRow() + "</form>");
  }

  function openEggs() {
    openModal("Egg count", '<form class="stack" data-act="save-eggs">' +
      U().field("Date", "date", L().today(), "date") +
      U().select("Species", "species", "chicken", [["duck", "Duck"], ["chicken", "Chicken"], ["quail", "Quail"]]) +
      U().field("Count", "count", "", "number") + cancelRow() + "</form>");
  }

  function openSale() {
    const customers = [["" , "No customer"]].concat((App.state.customers || []).map(function (c) { return [c.id, c.name]; }));
    openModal("Egg sale", '<form class="stack" data-act="save-sale">' +
      U().field("Date", "date", L().today(), "date") +
      U().select("Customer", "customerId", "", customers) +
      U().select("Species", "species", "chicken", [["duck", "Duck"], ["chicken", "Chicken"], ["quail", "Quail"], ["mixed", "Mixed"]]) +
      U().field("Dozens", "dozens", "1", "number") +
      U().field("Price per dozen", "price", "6", "number") +
      U().select("Deposit to", "accountId", farmAccount(), U().accountOptions(App.state)) +
      '<label class="checkline"><input type="checkbox" name="paid" value="yes" checked><span>Paid (records farm income)</span></label>' +
      U().area("Notes", "notes", "") + cancelRow() + "</form>");
  }

  function openCustomer() {
    openModal("Customer", '<form class="stack" data-act="save-customer">' +
      U().field("Name", "name", "") + U().field("Phone", "phone", "") + U().field("Email", "email", "") +
      U().select("Kind", "kind", "both", [["eggs", "Eggs"], ["tractor", "Tractor work"], ["both", "Both"]]) +
      U().area("Notes", "notes", "") + cancelRow() + "</form>");
  }

  function openJob(existing) {
    const job = existing || {};
    const customers = (App.state.customers || []).map(function (c) { return [c.id, c.name]; });
    openModal(existing ? "Edit job" : "Farm job", '<form class="stack" data-act="save-job"><input type="hidden" name="id" value="' + U().esc(job.id || "") + '">' +
      U().select("Customer", "customerId", job.customerId || "", customers) +
      U().field("Name on the invoice", "customerName", job.customerName || "") +
      U().select("Service", "service", job.service || "bushhog", L().SERVICES) +
      U().select("Status", "status", job.status || "quote", [["quote", "Quote"], ["scheduled", "Scheduled"], ["inprogress", "In progress"], ["invoiced", "Invoiced"], ["paid", "Paid"], ["cancelled", "Cancelled"]]) +
      U().field("Date", "date", job.date || L().today(), "date") +
      U().field("Address", "address", job.address || "") +
      U().area("Description", "description", job.description || "") +
      U().field("Hours", "hours", job.hours || "", "number") +
      U().field("Rate", "rate", job.rate || "80", "number") +
      U().field("Amount", "amount", job.amount || "", "number") +
      U().field("Miles", "mileage", job.mileage || "", "number") +
      U().select("Assigned to", "assignedTo", job.assignedTo || App.userId, U().userOptions(App.state)) +
      cancelRow() + "</form>", true);
  }

  function openEquip() {
    openModal("Equipment", '<form class="stack" data-act="save-equip">' +
      U().field("Name", "name", "") + U().field("Type", "type", "tractor") +
      U().field("Hours", "hours", "", "number") +
      U().select("Status", "status", "ready", [["ready", "Ready"], ["service", "Needs service"], ["down", "Down"]]) +
      U().area("Notes", "notes", "") + cancelRow() + "</form>");
  }

  function openService(id) {
    openModal("Service log", '<form class="stack" data-act="save-service"><input type="hidden" name="equipmentId" value="' + U().esc(id) + '">' +
      U().field("Date", "date", L().today(), "date") +
      U().field("Hours", "hours", "", "number") +
      U().field("What you did", "what", "") +
      U().field("Cost", "cost", "", "number") +
      U().area("Notes", "notes", "") + cancelRow() + "</form>");
  }

  function openFlock() {
    openModal("Birds", '<form class="stack" data-act="save-flock">' +
      U().select("Species", "species", "chicken", [["duck", "Duck"], ["chicken", "Chicken"], ["quail", "Quail"]]) +
      U().field("Breed", "breed", "") + U().field("Count", "count", "", "number") +
      U().field("Acquired", "acquired", L().today(), "date") + cancelRow() + "</form>");
  }

  function openMiles() {
    openModal("Trip", '<form class="stack" data-act="save-miles">' +
      U().field("Date", "date", L().today(), "date") +
      U().field("Vehicle", "vehicle", "Farm truck") +
      U().field("Miles", "miles", "", "number") +
      U().field("Tractor hours", "hours", "", "number") +
      U().field("Purpose", "purpose", "") +
      bookOptions("Farm") + cancelRow() + "</form>");
  }

  function openList() {
    openModal("List", '<form class="stack" data-act="save-list">' +
      U().field("Name", "name", "") +
      U().select("Kind", "kind", "grocery", [["grocery", "Grocery"], ["farm", "Farm supply"], ["hardware", "Hardware"], ["other", "Other"]]) +
      cancelRow() + "</form>");
  }

  function farmAccount() {
    const acct = (App.state.accounts || []).find(function (row) { return row.book === "Farm" && row.type === "checking"; });
    return acct ? acct.id : ((App.state.accounts || [])[0] || {}).id || "";
  }

  function nextJobNumber() {
    let max = 1000;
    (App.state.jobs || []).forEach(function (job) {
      const n = parseInt(String(job.number || "").replace(/\D/g, ""), 10);
      if (n > max) max = n;
    });
    return "JOB-" + (max + 1);
  }

  async function saveTx(data) {
    const accounts = App.state.accounts || [];
    if (!accounts.length) { toast("Add an account first."); return; }
    const type = data.type || "expense";
    const size = Math.abs(L().num(data.amount));
    if (!size) { toast("Enter an amount."); return; }
    if (type === "transfer") {
      if (data.accountId === data.toAccount) { toast("Pick two different accounts."); return; }
      const ref = L().uid("xfer");
      await change(function (api) {
        const outId = api.upsert("transactions", baseTx(data, -size, "transfer", data.accountId, ref));
        api.upsert("transactions", baseTx(data, size, "transfer", data.toAccount, ref, "Transfer in"));
        shiftAccount(api, data.accountId, -size);
        shiftAccount(api, data.toAccount, size);
        return outId;
      });
    } else {
      const signed = type === "expense" ? -size : size;
      await change(function (api) {
        api.upsert("transactions", baseTx(data, signed, type, data.accountId, ""));
        shiftAccount(api, data.accountId, signed);
      });
    }
    closeModal();
    toast("Saved.");
  }

  function baseTx(data, amount, type, accountId, ref, payee) {
    return {
      id: L().uid("tx"),
      date: data.date || L().today(),
      accountId: accountId,
      amount: L().round2(amount),
      type: type,
      categoryId: data.categoryId || "",
      book: data.book || "Personal",
      payee: payee || data.payee || "",
      memo: data.memo || "",
      refType: ref ? "transfer" : "",
      refId: ref || "",
      createdBy: App.userId,
      createdAt: new Date().toISOString()
    };
  }

  async function onSaveBill(data) {
    if (!data.name) { toast("Name the bill."); return; }
    await change(function (api) {
      api.upsert("bills", {
        id: data.id || L().uid("bill"),
        name: data.name, payee: data.payee || data.name, amount: L().round2(data.amount),
        dueDay: Math.max(1, Math.min(31, parseInt(data.dueDay, 10) || 1)),
        startMonth: data.startMonth || L().monthKey(L().today()),
        book: data.book || "Personal", categoryId: data.categoryId || "", accountId: data.accountId || "",
        autopay: data.autopay === "yes" ? "yes" : "no", assignedTo: data.assignedTo || "", active: "yes", notes: data.notes || ""
      });
    });
    closeModal();
  }

  async function onPay(data) {
    const bill = L().byId(App.state.bills, data.id);
    const view = L().billView(bill, App.state.billPayments, L().today());
    const amount = -Math.abs(L().num(bill.amount));
    const txId = L().uid("tx");
    await change(function (api) {
      api.upsert("transactions", {
        id: txId, date: L().today(), accountId: data.accountId || bill.accountId, amount: amount, type: "expense",
        categoryId: bill.categoryId || "", book: bill.book || "Personal", payee: bill.payee || bill.name,
        memo: "Paid " + view.due, refType: "bill", refId: bill.id, createdBy: App.userId, createdAt: new Date().toISOString()
      });
      api.upsert("billPayments", {
        id: L().uid("pay"), billId: bill.id, dueDate: view.due, paidDate: L().today(), amount: Math.abs(amount),
        paidBy: App.userId, accountId: data.accountId || bill.accountId, transactionId: txId
      });
      shiftAccount(api, data.accountId || bill.accountId, amount);
      if (data.debtId) {
        const debt = L().byId(App.state.debts, data.debtId);
        if (debt) api.upsert("debts", { id: debt.id, principal: L().round2(Math.max(0, L().num(debt.principal) - Math.abs(amount))) });
      }
    });
    closeModal();
    toast("Marked paid.");
  }

  async function onSale(data) {
    const dozens = L().num(data.dozens);
    const price = L().num(data.price);
    const total = L().round2(dozens * price);
    const paid = data.paid === "yes";
    const saleId = L().uid("sale");
    const txId = paid ? L().uid("tx") : "";
    await change(function (api) {
      api.upsert("eggSales", {
        id: saleId, date: data.date || L().today(), customerId: data.customerId || "", species: data.species,
        dozens: dozens, price: price, total: total, paid: paid ? "yes" : "no", notes: data.notes || "", transactionId: txId
      });
      if (paid && data.accountId) {
        api.upsert("transactions", {
          id: txId, date: data.date || L().today(), accountId: data.accountId, amount: total, type: "income",
          categoryId: "cat_eggs", book: "Farm", payee: data.notes || "Egg sale", memo: data.species + " eggs",
          refType: "eggSale", refId: saleId, createdBy: App.userId, createdAt: new Date().toISOString()
        });
        shiftAccount(api, data.accountId, total);
      }
    });
    closeModal();
  }

  async function onJob(data) {
    const customer = L().byId(App.state.customers, data.customerId);
    const hours = L().num(data.hours);
    const rate = L().num(data.rate);
    const amount = data.amount === "" || data.amount == null ? L().round2(hours * rate) : L().round2(data.amount);
    const existing = data.id ? L().byId(App.state.jobs, data.id) : null;
    await change(function (api) {
      api.upsert("jobs", {
        id: data.id || L().uid("job"),
        number: existing && existing.number ? existing.number : nextJobNumber(),
        customerId: data.customerId || "",
        customerName: data.customerName || (customer && customer.name) || "",
        service: data.service, status: data.status, date: data.date, address: data.address || "",
        description: data.description || "", hours: hours, rate: rate, amount: amount, mileage: L().num(data.mileage),
        paidDate: data.status === "paid" ? (existing && existing.paidDate) || L().today() : "",
        notes: existing ? existing.notes || "" : "",
        assignedTo: data.assignedTo || "",
        transactionId: existing ? existing.transactionId || "" : ""
      });
    });
    closeModal();
    if (!existing) go("farm/jobs");
  }

  async function payJob(id) {
    const job = L().byId(App.state.jobs, id);
    if (!job || job.transactionId) {
      await change(function (api) { api.upsert("jobs", { id: id, status: "paid", paidDate: L().today() }); });
      toast("Marked paid.");
      return;
    }
    const txId = L().uid("tx");
    await change(function (api) {
      api.upsert("transactions", {
        id: txId, date: L().today(), accountId: farmAccount(), amount: L().round2(job.amount), type: "income",
        categoryId: "cat_tractor", book: "Farm", payee: job.customerName || "Farm job", memo: L().serviceName(job.service),
        refType: "job", refId: job.id, createdBy: App.userId, createdAt: new Date().toISOString()
      });
      api.upsert("jobs", { id: job.id, status: "paid", paidDate: L().today(), transactionId: txId });
      shiftAccount(api, farmAccount(), job.amount);
    });
    toast("Payment recorded on the farm account.");
  }

  function printJob(id) {
    const job = L().byId(App.state.jobs, id);
    if (!job) return;
    const settings = (App.state.settings || [])[0] || {};
    const customer = L().byId(App.state.customers, job.customerId);
    const paid = job.status === "paid";
    document.getElementById("printArea").innerHTML =
      '<article class="invoice"><header><div><h1>' + U().esc(settings.farmName || "CW Johnson Farms LLC") + "</h1><p>" + U().esc(settings.location || "Lillington, NC") + "</p><p>Duck, chicken, and quail eggs<br>Driveway maintenance · Bush hogging · Grading<br>Brush cleanup · Stump grinding</p></div><div><h2>" + (job.status === "quote" ? "Quote" : "Invoice") + "</h2><p>" + U().esc(job.number || "") + "</p><p class=\"stamp " + (paid ? "" : "unpaid") + "\">" + (paid ? "PAID" : "UNPAID") + "</p></div></header><p><strong>Bill to</strong><br>" + U().esc(job.customerName || "") + "<br>" + U().esc((customer && customer.phone) || "") + "<br>" + U().esc(job.address || "") + "</p><p>" + U().esc(U().longDate(job.date)) + "</p><table><thead><tr><th>Description</th><th class=\"right\">Hours</th><th class=\"right\">Rate</th><th class=\"right\">Amount</th></tr></thead><tbody><tr><td>" + U().esc(L().serviceName(job.service)) + (job.description ? "<br>" + U().esc(job.description) : "") + "</td><td class=\"right\">" + U().esc(job.hours || "") + "</td><td class=\"right\">" + U().esc(L().money(job.rate || 0)) + "</td><td class=\"right\">" + U().esc(L().money(job.amount || 0)) + "</td></tr></tbody></table><p class=\"right\"><strong>Total " + U().esc(L().money(job.amount || 0)) + "</strong></p><p>Thank you.</p></article>";
    document.body.classList.add("printing");
    window.print();
    setTimeout(function () { document.body.classList.remove("printing"); }, 300);
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type: type || "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1500);
  }

  function ask(title, text, act, id) {
    openModal(title, "<p>" + U().esc(text) + '</p><div class="row end wrap"><button class="btn" type="button" data-act="close">Cancel</button><button class="primary" type="button" data-act="' + act + '" data-id="' + U().esc(id || "") + '">Confirm</button></div>');
  }

  async function removeTx(id) {
    const tx = L().byId(App.state.transactions, id);
    if (!tx) return;
    await change(function (api) {
      shiftAccount(api, tx.accountId, -L().num(tx.amount));
      (App.state.billPayments || []).filter(function (row) { return row.transactionId === id; }).forEach(function (row) { api.remove("billPayments", row.id); });
      (App.state.jobs || []).forEach(function (job) {
        if (job.transactionId === id) api.upsert("jobs", { id: job.id, transactionId: "", status: job.status === "paid" ? "invoiced" : job.status, paidDate: "" });
      });
      (App.state.eggSales || []).forEach(function (sale) {
        if (sale.transactionId === id) api.upsert("eggSales", { id: sale.id, transactionId: "", paid: "no" });
      });
      api.remove("transactions", id);
    });
    closeModal();
    toast("Transaction removed.");
  }

  async function toggleChecked(collection, id, field, on, off) {
    const row = L().byId(App.state[collection], id);
    if (!row) return;
    await change(function (api) {
      const next = {};
      next.id = id;
      next[field] = row[field] === on ? off : on;
      api.upsert(collection, next);
    });
  }

  async function deviceGo() {
    const cmd = App.command;
    closeModal();
    if (!cmd) return;
    if (App.mode !== "live") {
      const device = (App.devices || []).find(function (item) { return item.id === cmd.deviceId; });
      if (device) applyDemo(device, cmd);
      toast("Sample data: nothing was sent to the house.");
      render();
      return;
    }
    const res = await globalThis.Store.command("st", { op: "command", deviceId: cmd.deviceId, capability: cmd.capability, command: cmd.command, argument: cmd.argument });
    if (res && res.ok) {
      toast("Sent. The device may take a moment.");
      await refreshDevices(true);
    } else toast((res && res.error) || "The device command did not go through.");
  }

  function applyDemo(device, cmd) {
    const status = device.status || (device.status = {});
    if (cmd.command === "on" || cmd.command === "off") status.switch = cmd.command;
    if (cmd.command === "lock") status.lock = "locked";
    if (cmd.command === "unlock") status.lock = "unlocked";
    if (cmd.command === "volumeUp") status.volume = Math.min(100, L().num(status.volume) + 5);
    if (cmd.command === "volumeDown") status.volume = Math.max(0, L().num(status.volume) - 5);
    if (cmd.command === "setVolume") status.volume = L().num(cmd.argument);
    if (cmd.command === "mute") status.mute = "muted";
    if (cmd.command === "unmute") status.mute = "unmuted";
    if (cmd.command === "setInputSource") status.inputSource = cmd.argument;
    if (cmd.command === "setThermostatMode") status.thermostatMode = cmd.argument;
    if (cmd.command === "setHeatingSetpoint") status.heatingSetpoint = L().num(cmd.argument);
    if (cmd.command === "setCoolingSetpoint") status.coolingSetpoint = L().num(cmd.argument);
    if (cmd.command === "setThermostatFanMode") status.fanMode = cmd.argument;
  }

  async function refreshDevices(quiet) {
    if (App.mode !== "live") {
      if (!App.devices || !App.devices.length) App.devices = globalThis.HubSample.demoDevices();
      App.deviceNote = "demo";
      if (!quiet) render();
      return;
    }
    const res = await globalThis.Store.command("st", { op: "list" });
    if (res && res.ok) {
      App.devices = res.devices || [];
      App.deviceError = "";
      App.deviceNote = "";
      try { localStorage.setItem("hub-devices-v1", JSON.stringify(App.devices)); } catch (e) {}
    } else {
      App.deviceError = (res && res.error) || "Devices could not be loaded.";
      if (!quiet) toast(App.deviceError);
    }
    render();
  }

  async function blinkCall(payload) {
    const res = await globalThis.Store.command("blink", payload);
    App.blink = Object.assign({ experimental: true, configured: true }, App.blink || {}, res || {});
    if (res && res.dataUrl) App.blink.preview = res.dataUrl;
    if (res && res.ok === false && res.error) toast(res.error);
    render();
  }

  function travelerFields(selected) {
    const chosen = String(selected || "").split(",");
    return (App.state.users || []).filter(function (user) { return String(user.active) !== "no"; }).map(function (user) {
      const on = chosen.indexOf(user.id) >= 0 ? " checked" : "";
      return '<label class="checkline"><input type="checkbox" name="travelers" value="' + U().esc(user.id) + '"' + on + "><span>" + U().esc(user.name) + "</span></label>";
    }).join("");
  }

  function openTrip(existing) {
    const trip = existing || {};
    openModal(existing ? "Edit trip" : "Trip", '<form class="stack" data-act="save-trip"><input type="hidden" name="id" value="' + U().esc(trip.id || "") + '">' +
      U().field("Name", "name", trip.name || "") +
      U().field("Destination", "destination", trip.destination || "") +
      U().field("Leave", "startDate", trip.startDate || L().today(), "date") +
      U().field("Home", "endDate", trip.endDate || L().addDays(L().today(), 2), "date") +
      U().field("Depart time", "departTime", trip.departTime || "08:00", "time") +
      "<p class=\"meta\">Who is going</p>" + travelerFields(trip.travelers || App.userId) +
      U().field("Budget", "budget", trip.budget || "", "number") +
      U().field("Spent, if you are not linking Money", "spent", trip.spent || "", "number") +
      '<label class="checkline"><input type="checkbox" name="trackMoney" value="yes"' + (trip.trackMoney === "yes" ? " checked" : "") + "><span>Spent comes from Money transactions for this trip</span></label>" +
      U().area("Notes", "notes", trip.notes || "") + cancelRow() + "</form>", true);
  }

  function openStop(tripId) {
    const trip = L().byId(App.state.trips, tripId) || {};
    openModal("Itinerary", '<form class="stack" data-act="save-stop"><input type="hidden" name="tripId" value="' + U().esc(tripId) + '">' +
      U().field("Date", "date", trip.startDate || L().today(), "date") +
      U().field("Time", "time", "", "time") +
      U().select("Kind", "kind", "drive", [["flight", "Flight"], ["drive", "Drive"], ["lodging", "Lodging"], ["reservation", "Reservation"], ["activity", "Activity"], ["note", "Note"]]) +
      U().field("Title", "title", "") +
      U().field("Address", "address", "") +
      U().field("Confirmation", "confirmation", "") +
      U().area("Notes", "notes", "") + cancelRow() + "</form>");
  }

  function openTripItem(tripId) {
    openModal("Checklist item", '<form class="stack" data-act="save-trip-item"><input type="hidden" name="tripId" value="' + U().esc(tripId) + '">' +
      U().field("List name", "listName", "Packing") +
      U().select("Kind", "kind", "packing", [["packing", "Packing"], ["house", "House"], ["farm", "Farm"], ["documents", "Documents"]]) +
      U().field("Item", "text", "") +
      U().select("Who", "assignee", App.userId, U().userOptions(App.state, [["", "Anyone"], ["shared", "Shared"]])) +
      cancelRow() + "</form>");
  }

  function openTemplate() {
    openModal("Checklist template", '<form class="stack" data-act="save-template">' +
      U().field("Name", "name", "Before we leave") +
      U().select("Kind", "kind", "farm", [["packing", "Packing"], ["house", "House"], ["farm", "Farm"], ["documents", "Documents"]]) +
      U().area("Items, one per line", "lines", "Feed and water covered\nEgg collection covered\nCoop secured") +
      '<p class="meta">Apply this from a trip. Lines become checklist items you can check off.</p>' +
      cancelRow() + "</form>");
  }

  function openTripExpense(tripId) {
    const accounts = U().accountOptions(App.state);
    if (!accounts.length) { toast("Add an account in Money first."); return; }
    openModal("Trip expense", '<form class="stack" data-act="save-trip-expense"><input type="hidden" name="tripId" value="' + U().esc(tripId) + '">' +
      U().field("Amount", "amount", "", "number") +
      U().field("Payee", "payee", "") +
      U().field("Date", "date", L().today(), "date") +
      U().select("Account", "accountId", accounts[0][0], accounts) +
      bookOptions("Personal") +
      cancelRow() + "</form>");
  }

  async function onTrip(data) {
    if (!data.name) { toast("Name the trip."); return; }
    const id = data.id || L().uid("trip");
    await change(function (api) {
      api.upsert("trips", {
        id: id, name: data.name, destination: data.destination || "", startDate: data.startDate, endDate: data.endDate || data.startDate,
        departTime: data.departTime || "", travelers: data.travelers || "", budget: data.budget === "" ? "" : L().round2(data.budget),
        spent: data.spent === "" ? "" : L().round2(data.spent), trackMoney: data.trackMoney === "yes" ? "yes" : "no", notes: data.notes || ""
      });
    });
    closeModal();
    go("vacation/trip/" + id);
  }

  async function onStop(data) {
    if (!data.title) { toast("Name this stop."); return; }
    await change(function (api) {
      api.upsert("itinerary", {
        id: L().uid("it"), tripId: data.tripId, date: data.date || "", time: data.time || "", kind: data.kind,
        title: data.title, address: data.address || "", confirmation: data.confirmation || "", notes: data.notes || "", sort: 1
      });
    });
    closeModal();
  }

  async function onTripItem(data) {
    if (!data.text) { toast("Write the item."); return; }
    await change(function (api) {
      api.upsert("tripItems", {
        id: L().uid("ti"), tripId: data.tripId, listName: data.listName || "List", kind: data.kind, assignee: data.assignee || "",
        text: data.text, done: "no", sort: 1
      });
    });
    closeModal();
  }

  async function onTemplate(data) {
    const lines = String(data.lines || "").split(/\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    if (!data.name || !lines.length) { toast("Name the template and add at least one line."); return; }
    const id = L().uid("tpl");
    await change(function (api) {
      api.upsert("templates", { id: id, name: data.name, kind: data.kind, notes: "" });
      lines.forEach(function (line, index) {
        api.upsert("templateItems", { id: L().uid("tpi"), templateId: id, text: line, assignee: "", sort: index + 1 });
      });
    });
    closeModal();
    toast("Template saved.");
  }

  async function onApplyTemplate(data) {
    const tpl = L().byId(App.state.templates, data.templateId);
    if (!tpl) return;
    const items = (App.state.templateItems || []).filter(function (item) { return item.templateId === tpl.id; });
    await change(function (api) {
      items.forEach(function (item) {
        api.upsert("tripItems", {
          id: L().uid("ti"), tripId: data.tripId, listName: tpl.name, kind: tpl.kind || "packing",
          assignee: item.assignee || "", text: item.text, done: "no", sort: item.sort || 1
        });
      });
    });
    toast(items.length ? "Checklist added." : "That template has no items.");
    render();
  }

  async function onTripExpense(data) {
    const amount = -Math.abs(L().num(data.amount));
    if (!amount) { toast("Enter an amount."); return; }
    await change(function (api) {
      api.upsert("transactions", {
        id: L().uid("tx"), date: data.date || L().today(), accountId: data.accountId, amount: amount, type: "expense",
        categoryId: "cat_house", book: data.book || "Personal", payee: data.payee || "Trip", memo: "Trip expense",
        refType: "trip", refId: data.tripId, createdBy: App.userId, createdAt: new Date().toISOString()
      });
      api.upsert("trips", { id: data.tripId, trackMoney: "yes" });
      shiftAccount(api, data.accountId, amount);
    });
    closeModal();
    toast("Saved in Money and on this trip.");
  }

  function noteWin(goalId, title) {
    const goal = L().byId(App.state.goals, goalId);
    if (!goal) return;
    const target = L().num(goal.targetAmount);
    const stones = (App.state.milestones || []).filter(function (item) { return item.goalId === goalId; });
    const hit = (target > 0 && L().num(goal.currentAmount) >= target) || (stones.length && stones.every(function (item) { return item.done === "yes"; }));
    if (!hit) return;
    if ((App.state.wins || []).some(function (win) { return win.goalId === goalId; })) { celebrate(title || goal.name); return; }
    change(function (api) {
      api.upsert("wins", { id: L().uid("win"), goalId: goalId, title: title || goal.name, date: L().today(), note: "Goal reached." });
      api.upsert("goals", { id: goalId, status: "done" });
    }).then(function () { celebrate(title || goal.name); render(); });
  }

  function celebrate(title) {
    const box = document.createElement("div");
    box.className = "confetti";
    for (let i = 0; i < 18; i++) {
      const bit = document.createElement("i");
      bit.style.left = (Math.random() * 100) + "%";
      bit.style.background = ["#1f6b3a", "#c4922a", "#b5523a", "#3c7ea6"][i % 4];
      bit.style.animationDelay = (Math.random() * 0.25) + "s";
      box.appendChild(bit);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 1600);
    toast("Win: " + title);
  }

  function resizeImage(file) {
    return new Promise(function (resolve) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(""); };
      img.src = url;
    });
  }

  function openReceiptForm(guess) {
    const accounts = U().accountOptions(App.state);
    openModal("Confirm receipt", '<form class="stack" data-act="save-receipt">' +
      '<input type="hidden" name="receiptId" value="' + U().esc(guess.driveFileId || "") + '">' +
      U().field("Store", "payee", guess.merchant || "") +
      U().field("Amount", "amount", guess.amount || "", "number") +
      U().field("Date", "date", guess.date || L().today(), "date") +
      U().select("Category", "categoryId", "", [["" , "None"]].concat(U().categoryOptions(App.state, "expense"))) +
      bookOptions("Personal") +
      U().select("Account", "accountId", accounts.length ? accounts[0][0] : "", accounts) +
      '<p class="meta">' + (guess.ocr === false ? "The photo is saved. The text could not be read, so fill in the amount." : "Check the amount before saving.") + "</p>" +
      cancelRow() + "</form>");
  }

  function snapReceipt() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.onchange = function () {
      const file = input.files && input.files[0];
      if (!file) return;
      resizeImage(file).then(function (dataUrl) {
        if (App.mode !== "live") {
          openReceiptForm({ amount: "12.34", date: L().today(), merchant: "Food Lion", driveFileId: "" });
          return;
        }
        globalThis.Store.command("receipt", { dataUrl: dataUrl }).then(function (res) {
          if (!res || res.ok === false) { toast((res && res.error) || "The receipt was not saved."); return; }
          openReceiptForm(res);
        });
      });
    };
    input.click();
  }

  async function saveReceipt(data) {
    const amount = -Math.abs(L().num(data.amount));
    if (!amount) { toast("Enter the amount."); return; }
    await change(function (api) {
      api.upsert("transactions", {
        id: L().uid("tx"), date: data.date || L().today(), accountId: data.accountId, amount: amount, type: "expense",
        categoryId: data.categoryId || "", book: data.book || "Personal", payee: data.payee || "Receipt", memo: "Receipt",
        refType: "receipt", refId: "", externalId: "", receiptId: data.receiptId || "", createdBy: App.userId, createdAt: new Date().toISOString()
      });
      shiftAccount(api, data.accountId, amount);
    });
    closeModal();
    toast("Receipt saved.");
  }

  function openQuote() {
    const settings = (App.state.settings || [])[0] || {};
    const mileage = settings.mileageRate === "" || settings.mileageRate == null ? L().irsBusinessRate(L().today()) : settings.mileageRate;
    openModal("Quote calculator", '<form class="stack" data-act="save-quote">' +
      U().select("Customer", "customerId", "", [["" , "No customer"]].concat((App.state.customers || []).map(function (c) { return [c.id, c.name]; }))) +
      U().field("Name on the quote", "customerName", "") +
      U().select("Service", "service", "bushhog", L().SERVICES) +
      U().field("Hours", "hours", "3", "number") +
      U().field("Rate", "rate", "85", "number") +
      U().field("Fuel $", "fuel", "0", "number") +
      U().field("Miles", "miles", "0", "number") +
      U().field("Mileage rate", "mileageRate", mileage, "number") +
      U().field("Wear $ per hour", "wearRate", settings.wearRate === "" || settings.wearRate == null ? 8 : settings.wearRate, "number") +
      U().select("Save as", "status", "quote", [["quote", "Quote"], ["invoiced", "Invoice"]]) +
      cancelRow() + "</form>");
  }

  async function saveQuote(data) {
    const quote = L().jobQuote(data);
    const customer = L().byId(App.state.customers, data.customerId);
    await change(function (api) {
      api.upsert("jobs", {
        id: L().uid("job"), number: nextJobNumber(), customerId: data.customerId || "",
        customerName: data.customerName || (customer && customer.name) || "", service: data.service, status: data.status || "quote",
        date: L().today(), address: "", description: "Labor " + L().money(quote.labor) + ", fuel " + L().money(quote.fuel) + ", travel " + L().money(quote.travel) + ", wear " + L().money(quote.wear),
        hours: L().num(data.hours), rate: L().num(data.rate), amount: quote.total, mileage: L().num(data.miles),
        paidDate: "", notes: "", assignedTo: App.userId, transactionId: ""
      });
    });
    closeModal();
    toast("Saved " + L().money(quote.total) + ".");
    go("farm/jobs");
  }

  function openRule() {
    openModal("Merchant rule", '<form class="stack" data-act="save-rule">' +
      U().field("Merchant contains", "pattern", "") +
      U().select("Category", "categoryId", "", U().categoryOptions(App.state)) +
      bookOptions("Personal") + cancelRow() + "</form>");
  }

  async function saveRule(data) {
    if (!data.pattern) { toast("Enter the merchant text."); return; }
    await change(function (api) {
      api.upsert("merchantRules", { id: L().uid("rule"), pattern: data.pattern, categoryId: data.categoryId || "", book: data.book || "Personal" });
    });
    closeModal();
  }

  function openUpkeep() {
    openModal("Reminder", '<form class="stack" data-act="save-upkeep">' +
      U().field("Name", "name", "") +
      U().select("Kind", "kind", "house", [["house", "House"], ["truck", "Truck"], ["tractor", "Tractor"], ["equipment", "Equipment"]]) +
      U().field("Every N days", "everyDays", "", "number") +
      U().field("Every N hours", "everyHours", "", "number") +
      U().field("Every N miles", "everyMiles", "", "number") +
      U().field("Last service date", "lastDate", L().today(), "date") +
      U().field("Last hours or miles", "lastReading", "", "number") +
      cancelRow() + "</form>");
  }

  async function saveUpkeep(data) {
    if (!data.name) { toast("Name the reminder."); return; }
    await change(function (api) {
      api.upsert("upkeep", { id: L().uid("up"), name: data.name, kind: data.kind, everyDays: data.everyDays || "", everyHours: data.everyHours || "", everyMiles: data.everyMiles || "", lastDate: data.lastDate || "", lastReading: data.lastReading || "", notes: "" });
    });
    closeModal();
  }

  function openUpkeepLog(id) {
    openModal("Service done", '<form class="stack" data-act="save-upkeep-log"><input type="hidden" name="id" value="' + U().esc(id) + '">' +
      U().field("Date", "date", L().today(), "date") +
      U().field("Hours or miles now", "reading", "", "number") +
      U().field("What you did", "what", "") +
      U().field("Cost", "cost", "", "number") + cancelRow() + "</form>");
  }

  async function saveUpkeepLog(data) {
    const item = L().byId(App.state.upkeep, data.id);
    if (!item) return;
    await change(function (api) {
      api.upsert("serviceLogs", { id: L().uid("svc"), equipmentId: "", upkeepId: item.id, date: data.date, hours: L().num(data.reading), what: data.what || item.name, cost: L().round2(data.cost), notes: "", by: App.userId });
      api.upsert("upkeep", { id: item.id, lastDate: data.date, lastReading: data.reading === "" ? item.lastReading : data.reading });
    });
    closeModal();
  }

  function openDoc(link) {
    openModal("Document", '<form class="stack" data-act="save-doc">' +
      U().field("Name", "name", "") +
      U().select("Category", "category", "insurance", [["insurance", "Insurance"], ["title", "Title"], ["warranty", "Warranty"], ["manual", "Manual"], ["other", "Other"]]) +
      U().select("Whose", "owner", "shared", [["shared", "Shared"]].concat(U().userOptions(App.state))) +
      U().field("Expires", "expires", "", "date") +
      U().field("Link", "link", link || "") +
      U().area("Notes", "notes", "") +
      '<p class="meta">Store a link only. Leave account numbers and policy numbers out.</p>' +
      cancelRow() + "</form>");
  }

  function uploadDoc() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.pdf";
    input.onchange = function () {
      const file = input.files && input.files[0];
      if (!file) return;
      if (App.mode !== "live") { openDoc(""); toast("Connect the sheet to store the file in Drive. You can paste a link for now."); return; }
      resizeImage(file).then(function (dataUrl) {
        const payload = dataUrl || "";
        if (!payload) { toast("That file needs to be a photo, or paste a link."); return; }
        globalThis.Store.command("receipt", { dataUrl: payload }).then(function (res) {
          if (!res || !res.link) { toast((res && res.error) || "Upload did not finish."); return; }
          openDoc(res.link);
        });
      });
    };
    input.click();
  }

  async function saveDoc(data) {
    if (!data.name) { toast("Name the document."); return; }
    await change(function (api) {
      api.upsert("docs", { id: L().uid("doc"), name: data.name, category: data.category, owner: data.owner || "", expires: data.expires || "", link: data.link || "", notes: data.notes || "" });
    });
    closeModal();
  }

  function openRoutine() {
    const devices = (App.devices || []).map(function (device) { return [device.id, device.name]; });
    const first = devices.length ? devices[0][0] : "";
    openModal("Scene", '<form class="stack" data-act="save-routine">' +
      U().field("Name", "name", "") +
      U().field("Heat setpoint (blank to skip)", "heat", "") +
      (devices.length ? U().select("Thermostat", "thermoId", first, devices) : "") +
      '<label class="checkline"><input type="checkbox" name="tvOff" value="yes"><span>Turn the TV off</span></label>' +
      (devices.length ? U().select("TV or switch", "switchId", first, [["", "None"]].concat(devices)) : "") +
      U().select("That switch", "switchCmd", "off", [["off", "Off"], ["on", "On"]]) +
      U().select("Blink", "blink", "", [["", "Leave Blink alone"], ["arm", "Arm"], ["disarm", "Disarm"]]) +
      cancelRow() + "</form>", true);
  }

  async function saveRoutine(data) {
    if (!data.name) { toast("Name the scene."); return; }
    const steps = [];
    if (data.heat && data.thermoId) steps.push({ type: "st", deviceId: data.thermoId, capability: "thermostatHeatingSetpoint", command: "setHeatingSetpoint", argument: String(data.heat) });
    if (data.tvOff === "yes") {
      const tv = (App.devices || []).find(function (device) { return device.kind === "tv"; });
      if (tv) steps.push({ type: "st", deviceId: tv.id, capability: "switch", command: "off" });
    }
    if (data.switchId) steps.push({ type: "st", deviceId: data.switchId, capability: "switch", command: data.switchCmd || "off" });
    if (data.blink) steps.push({ type: "blink", op: data.blink });
    await change(function (api) {
      api.upsert("routines", { id: L().uid("scene"), name: data.name, steps: JSON.stringify(steps), active: "yes" });
    });
    closeModal();
  }

  async function runRoutine() {
    const scene = App.pendingRoutine;
    closeModal();
    if (!scene) return;
    let steps = [];
    try { steps = JSON.parse(scene.steps || "[]"); } catch (e) { steps = []; }
    if (App.mode !== "live") {
      steps.forEach(function (step) {
        if (step.type === "st") {
          const device = (App.devices || []).find(function (item) { return item.id === step.deviceId; });
          if (device) applyDemo(device, step);
        }
      });
      toast("Sample data: " + scene.name + " was not sent to the house.");
      render();
      return;
    }
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.type === "blink") await globalThis.Store.command("blink", { op: step.op, networkId: step.networkId || "" });
      else await globalThis.Store.command("st", { op: "command", deviceId: step.deviceId, capability: step.capability, command: step.command, argument: step.argument || "" });
    }
    toast(scene.name + " sent.");
    refreshDevices(true);
  }

  function loadWeather(force) {
    if (App.mode !== "live") { App.weather = null; if (force) render(); return; }
    globalThis.Store.command("weather", {}).then(function (res) {
      if (res && res.ok) { App.weather = res; if (force || App.route === "home" || App.route === "weather") render(); }
      else if (force) toast((res && res.error) || "Weather did not load.");
    });
  }

  function enableNotifications() {
    if (!("Notification" in window)) { toast("This browser does not show notifications."); return; }
    Notification.requestPermission().then(function (result) {
      if (result === "granted") { toast("Notifications are on while Family Hub is open."); pingNotifications(); }
      else toast("Notifications stay off.");
    });
  }

  function pingNotifications() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (sessionStorage.getItem("hub-noted") === L().today()) return;
    const day = L().today();
    const settings = (App.state.settings || [])[0] || {};
    const lead = settings.billLeadDays === "" || settings.billLeadDays == null ? 3 : Number(settings.billLeadDays);
    const due = (App.state.bills || []).filter(function (bill) {
      const view = L().billView(bill, App.state.billPayments, day);
      return view.days != null && view.days >= 0 && view.days <= lead;
    });
    if (!due.length) return;
    sessionStorage.setItem("hub-noted", day);
    try { new Notification("Family Hub", { body: due[0].name + " is due " + (due[0] ? L().billView(due[0], App.state.billPayments, day).due : "") }); } catch (e) {}
  }

  function exportScheduleF() {
    const year = String(L().today()).slice(0, 4);
    const rows = L().scheduleF(App.state, year).map(function (line) {
      return { line: line.line, kind: line.kind, amount: line.amount.toFixed(2) };
    });
    download("schedule-f-" + year + ".csv", L().toCsv(rows, ["line", "kind", "amount"]), "text/csv");
  }

  const actions = {
    close: function () { closeModal(); },
    quick: function () {
      openModal("Quick add", '<div class="stack"><button class="btn" type="button" data-act="add-tx">Expense or income</button><button class="btn" type="button" data-act="add-bill">Bill</button><button class="btn" type="button" data-act="add-shop">Shopping item</button><button class="btn" type="button" data-act="add-eggs">Egg count</button><button class="btn" type="button" data-act="add-chore">Chore</button><button class="btn" type="button" data-act="add-event">Calendar event</button><button class="btn" type="button" data-act="add-job">Farm job</button></div>');
    },
    "add-tx": function (el) { openTx(el && el.dataset ? el.dataset.book : "Personal"); },
    "add-account": openAccount,
    "add-bill": function () { openBill(); },
    "pay-bill": function (el) { openPay(el.dataset.id); },
    "add-debt": function () { openDebt(); },
    "edit-debt": function (el) { openDebt(L().byId(App.state.debts, el.dataset.id)); },
    "add-sub": openSub,
    "add-category": openCategory,
    "edit-budget": function (el) { openBudget(el.dataset.id); },
    "add-goal": function () { openGoal(); },
    "edit-goal": function (el) { openGoal(L().byId(App.state.goals, el.dataset.id)); },
    "add-milestone": function (el) {
      openModal("Milestone", '<form class="stack" data-act="save-milestone"><input type="hidden" name="goalId" value="' + U().esc(el.dataset.id) + '">' + U().field("Name", "name", "") + U().field("Due", "dueDate", "", "date") + cancelRow() + "</form>");
    },
    "add-project": openProject,
    "add-task": function (el) { openTask(el.dataset.id); },
    "add-event": openEvent,
    "add-chore": openChore,
    "add-meal": function (el) { openMeal(el.dataset.date, el.dataset.slot); },
    "add-ingredient": function (el) { openIngredient(el.dataset.id); },
    "add-eggs": openEggs,
    "add-sale": openSale,
    "add-customer": openCustomer,
    "add-job": function () { openJob(); },
    "edit-job": function (el) { openJob(L().byId(App.state.jobs, el.dataset.id)); },
    "add-equip": openEquip,
    "add-service": function (el) { openService(el.dataset.id); },
    "add-flock": openFlock,
    "add-miles": openMiles,
    "add-list": openList,
    "add-trip": function () { openTrip(); },
    "edit-trip": function (el) { openTrip(L().byId(App.state.trips, el.dataset.id)); },
    "add-stop": function (el) { openStop(el.dataset.id); },
    "add-trip-item": function (el) { openTripItem(el.dataset.id); },
    "add-template": openTemplate,
    "add-trip-expense": function (el) { openTripExpense(el.dataset.id); },
    "edit-layout": function () { App.editing = true; render(); },
    "done-layout": function () { App.editing = false; render(); },
    "reset-layout": function () { persistLayout(L().defaultLayout()); render(); },
    "hide-widget": function (el) {
      persistLayout((App.layout || []).map(function (item) {
        return item.id === el.dataset.id ? { id: item.id, size: item.size, show: false } : item;
      }));
      render();
    },
    "show-widget": function (el) {
      persistLayout((App.layout || []).map(function (item) {
        return item.id === el.dataset.id ? { id: item.id, size: item.size, show: true } : item;
      }));
      render();
    },
    "size-widget": function (el) {
      const nextSize = { sm: "md", md: "lg", lg: "sm" };
      persistLayout((App.layout || []).map(function (item) {
        return item.id === el.dataset.id ? { id: item.id, size: nextSize[item.size] || "md", show: item.show } : item;
      }));
      render();
    },
    "snap-receipt": function () { snapReceipt(); },
    "open-quote": function () { openQuote(); },
    "add-rule": function () { openRule(); },
    "add-upkeep": function () { openUpkeep(); },
    "log-upkeep": function (el) { openUpkeepLog(el.dataset.id); },
    "add-doc": function () { openDoc(); },
    "upload-doc": function () { uploadDoc(); },
    "add-routine": function () { openRoutine(); },
    "run-routine": function (el) {
      const scene = L().byId(App.state.routines, el.dataset.id);
      if (!scene) return;
      App.pendingRoutine = scene;
      ask("Run " + scene.name + "?", "This sends the saved house commands. Blink runs only if this scene includes it.", "run-routine-go");
    },
    "run-routine-go": function () { runRoutine(); },
    "refresh-weather": function () { loadWeather(true); },
    "enable-notifications": function () { enableNotifications(); },
    "export-schedule-f": function () { exportScheduleF(); },
    "add-shop": function () {
      go("today/shop");
      setTimeout(function () { const box = document.getElementById("itemName"); if (box) box.focus(); }, 50);
    },
    book: function (el) { App.bookFilter = el.dataset.book; render(); },
    "pick-list": function (el) { App.listId = el.dataset.id; render(); },
    "cal-mode": function (el) { App.calMode = el.dataset.mode; render(); },
    "cal-day": function (el) { App.calDay = el.dataset.date; render(); },
    "cal-shift": function (el) {
      const dir = Number(el.dataset.dir) || 1;
      if ((App.calMode || "month") === "month") {
        App.calMonth = L().addMonths((App.calMonth || L().monthKey(L().today())) + "-01", dir);
        App.calDay = App.calMonth + "-01";
      } else App.calDay = L().addDays(App.calDay || L().today(), dir * (App.calMode === "week" ? 7 : 14));
      render();
    },
    "bump-egg": function (el) {
      const species = el.dataset.species;
      const day = L().today();
      const found = (App.state.eggs || []).find(function (row) { return row.date === day && row.species === species; });
      change(function (api) {
        if (found) api.upsert("eggs", { id: found.id, count: L().num(found.count) + 1 });
        else api.upsert("eggs", { id: L().uid("egg"), date: day, species: species, count: 1, notes: "", loggedBy: App.userId });
      }).then(function () { render(); });
    },
    "push-grocery": function (el) {
      const mealId = el.dataset.id;
      const list = (App.state.lists || []).find(function (item) { return item.kind === "grocery"; }) || (App.state.lists || [])[0];
      if (!list) { toast("Add a grocery list first."); return; }
      const have = {};
      (App.state.listItems || []).forEach(function (item) {
        if (item.listId === list.id && item.checked !== "yes") have[String(item.name).toLowerCase()] = true;
      });
      change(function (api) {
        (App.state.mealItems || []).forEach(function (item) {
          if (item.mealId !== mealId) return;
          if (have[String(item.name).toLowerCase()]) return;
          api.upsert("listItems", { id: L().uid("li"), listId: list.id, name: item.name, aisle: item.aisle || "", qty: item.qty || "", checked: "no", staple: "no", addedBy: App.userId, createdAt: new Date().toISOString() });
        });
      }).then(function () { toast("Added to the grocery list."); });
    },
    restock: function () {
      change(function (api) {
        (App.state.listItems || []).forEach(function (item) {
          if (item.listId === App.listId && item.staple === "yes") api.upsert("listItems", { id: item.id, checked: "no" });
        });
      }).then(function () { render(); });
    },
    "clear-checked": function () {
      change(function (api) {
        (App.state.listItems || []).slice().forEach(function (item) {
          if (item.listId === App.listId && item.checked === "yes" && item.staple !== "yes") api.remove("listItems", item.id);
        });
      }).then(function () { render(); });
    },
    "delete-tx": function (el) { ask("Delete this transaction?", "The account balance will be put back.", "confirm-delete-tx", el.dataset.id); },
    "confirm-delete-tx": function (el) { removeTx(el.dataset.id); },
    "tick-dups": function (el) {
      const on = el.dataset.on === "yes";
      document.querySelectorAll('form[data-act="preview-dup-delete"] input[name="drop"]').forEach(function (box) { box.checked = on; });
    },
    "confirm-recurring": function () {
      const chosen = App.recurringAdd || [];
      App.recurringAdd = [];
      if (!chosen.length) { closeModal(); toast("Nothing selected."); return; }
      change(function (api) {
        chosen.forEach(function (row) {
          if (row.kind === "subscription") {
            api.upsert("subscriptions", {
              id: L().uid("sub"), name: row.merchant, amount: row.amount, cadence: row.cadence,
              nextDate: row.nextDate, book: "Personal", categoryId: "", assignedTo: "", active: "yes", notes: ""
            });
          } else {
            const due = parseInt(String(row.lastDate || "").slice(8, 10), 10) || 1;
            api.upsert("bills", {
              id: L().uid("bill"), name: row.merchant, payee: row.merchant, amount: row.amount,
              dueDay: Math.max(1, Math.min(31, due)), startMonth: L().monthKey(L().today()),
              book: "Personal", categoryId: "", accountId: "", autopay: "no", assignedTo: "", active: "yes", notes: ""
            });
          }
        });
      }).then(function () {
        closeModal();
        toast("Added " + chosen.length + ".");
        render();
      });
    },
    "confirm-dup-delete": function () {
      const pairs = L().duplicatePairs(App.state.transactions, App.state.accounts);
      const ids = L().cleanupIds(pairs, App.dupDeleteIds || []);
      App.dupDeleteIds = [];
      if (!ids.length) { closeModal(); toast("Nothing selected."); return; }
      change(function (api) {
        ids.forEach(function (id) {
          const tx = L().byId(App.state.transactions, id);
          if (!tx || tx.refType !== "csv") return;
          const acct = L().byId(App.state.accounts, tx.accountId);
          if (!acct || acct.source !== "bank") shiftAccount(api, tx.accountId, -L().num(tx.amount));
          api.remove("transactions", id);
        });
      }).then(function () {
        closeModal();
        toast("Removed " + ids.length + " imported " + (ids.length === 1 ? "row" : "rows") + ".");
        render();
      });
    },
    "pay-job": function (el) { payJob(el.dataset.id); },
    "print-job": function (el) { printJob(el.dataset.id); },
    "device-cmd": function (el) {
      App.command = { deviceId: el.dataset.id, capability: el.dataset.capability, command: el.dataset.command, argument: el.dataset.argument, label: el.dataset.label };
      ask("Send this to the house?", App.command.label, "device-go");
    },
    "device-go": function () { deviceGo(); },
    "device-refresh": function () { refreshDevices(false); },
    "blink-login": function () { blinkCall({ op: "login" }); },
    "blink-arm": function (el) {
      App.command = { op: el.dataset.op, networkId: el.dataset.network };
      ask(el.dataset.op === "disarm" ? "Disarm Blink?" : "Arm Blink?", "This uses the unofficial Blink API.", "blink-arm-go");
    },
    "blink-arm-go": function () {
      const cmd = App.command || {};
      closeModal();
      blinkCall({ op: cmd.op, networkId: cmd.networkId });
    },
    "blink-thumb": function (el) { blinkCall({ op: "thumbnail", networkId: el.dataset.network, cameraId: el.dataset.camera }); },
    "save-snapshot": function () {
      const net = L().accountSides(App.state.accounts);
      const month = L().monthKey(L().today());
      change(function (api) {
        api.upsert("snapshots", { id: "snap_" + month.replace("-", ""), date: L().today(), assets: net.assets, liabilities: net.liabilities, net: net.net, note: "" });
      }).then(function () { toast("Snapshot saved."); render(); });
    },
    "pick-csv": function () {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv,text/csv";
      input.onchange = function () {
        const file = input.files && input.files[0];
        if (!file) return;
        file.text().then(function (text) {
          const rows = L().importTransactions(text);
          if (!rows.length) { toast("No rows with a date and an amount were found."); return; }
          const planned = L().planCsvImport(App.state.transactions, rows, App.state.accounts);
          App.importRows = planned.accepted;
          const sign = planned.signNote ? "<p>" + U().esc(planned.signNote) + "</p>" : "";
          openModal("Import " + planned.accepted.length + " rows", '<form class="stack" data-act="save-import"><p>' + planned.accepted.length + " will be added. " + planned.skipped.length + " look like duplicates and will be skipped.</p>" + sign + "<p>A row that names an account you already have uses that account. The rest use the account you pick. Personal or Farm comes from the file when that column is present.</p>" + U().select("Account", "accountId", farmAccount(), U().accountOptions(App.state)) + cancelRow() + "</form>");
        });
      };
      input.click();
    },
    "export-json": function () {
      download("family-hub-backup.json", JSON.stringify(App.state, null, 2), "application/json");
    },
    "export-tx": function () {
      download("transactions.csv", L().toCsv(App.state.transactions || [], L().FIELDS.transactions), "text/csv");
    },
    "export-tax": function () {
      const yearInput = document.getElementById("taxYear");
      const year = (yearInput && yearInput.value) || App.taxYear || String(L().today()).slice(0, 4);
      const rows = L().taxRows(App.state, year);
      const settings = (App.state.settings || [])[0] || {};
      const miles = (App.state.mileage || []).filter(function (row) { return String(row.date || "").indexOf(year) === 0; });
      const value = L().mileageValue(miles, settings.mileageRate);
      rows.push({ date: year + "-12-31", type: "Mileage", category: "Mileage", description: value.miles + " farm miles", amount: value.deduction.toFixed(2), source: "mileage estimate" });
      download("farm-" + year + ".csv", L().toCsv(rows, ["date", "type", "category", "description", "amount", "source"]), "text/csv");
    },
    "reset-sample": function () { ask("Reset the sample household?", "This phone's practice data goes back to the starter farm. The Google Sheet is not changed.", "confirm-reset"); },
    "confirm-reset": function () {
      App.state = globalThis.Store.resetSample();
      App.devices = globalThis.HubSample.demoDevices();
      closeModal();
      toast("Sample data restored.");
    },
    "test-digest": function () {
      globalThis.Store.command("digest", {}).then(function (res) {
        if (res && res.sent) toast("Digest sent.");
        else toast((res && res.error) || "The digest was not sent.");
      });
    },
    "toggle-cal-view": function (el) {
      App.calHide = App.calHide || {};
      const id = el.dataset.id;
      if (id === "hub") App.calHide.hub = !App.calHide.hub;
      else App.calHide[id] = !App.calHide[id];
      try { localStorage.setItem("hub-cal-hide", JSON.stringify(App.calHide)); } catch (e) {}
      render();
    },
    "toggle-gcal": function (el) {
      const row = L().byId(App.state.calendars, el.dataset.id);
      if (!row) return;
      change(function (api) {
        api.upsert("calendars", { id: row.id, enabled: String(row.enabled) === "no" ? "yes" : "no" });
      }).then(function () { render(); });
    },
    "cal-sync": function () {
      if (App.mode !== "live") { toast("Calendar sync runs after the Google Sheet is connected."); return; }
      const settings = (App.state.settings || [])[0] || {};
      const op = settings.calendarSync === "push" ? "push" : "both";
      globalThis.Store.command("calendar", { op: op }).then(function (res) {
        if (res && res.ok) {
          toast("Calendar updated. Pushed " + (res.pushed || 0) + ", pulled " + (res.pulled || 0) + ".");
          return globalThis.Store.refresh();
        }
        toast((res && res.error) || "Calendar sync did not finish.");
        return null;
      }).then(function (res) {
        if (res && res.state) { App.state = res.state; render(); }
      });
    }
  };

  async function onSubmit(act, form) {
    const data = readForm(form);
    if (act === "save-tx") return saveTx(data);
    if (act === "save-account") {
      await change(function (api) {
        api.upsert("accounts", { id: L().uid("acct"), name: data.name || "Account", type: data.type, book: data.book, balance: L().round2(data.balance), institution: data.institution || "", notes: "", updatedAt: L().today() });
      });
      closeModal();
      return;
    }
    if (act === "save-bill") return onSaveBill(data);
    if (act === "save-pay") return onPay(data);
    if (act === "save-debt") {
      await change(function (api) {
        api.upsert("debts", { id: data.id || L().uid("debt"), name: data.name || "Debt", principal: L().round2(data.principal), apr: L().num(data.apr), payment: L().round2(data.payment), book: data.book, kind: data.kind, notes: "" });
      });
      closeModal();
      return;
    }
    if (act === "save-sub") {
      await change(function (api) {
        api.upsert("subscriptions", { id: L().uid("sub"), name: data.name, amount: L().round2(data.amount), cadence: data.cadence, nextDate: data.nextDate, book: data.book, categoryId: "", assignedTo: data.assignedTo, active: "yes", notes: "" });
      });
      closeModal();
      return;
    }
    if (act === "save-category") {
      await change(function (api) {
        api.upsert("categories", { id: L().uid("cat"), name: data.name || "Category", book: data.book, kind: data.kind, monthly: data.monthly === "" ? "" : L().round2(data.monthly), sort: 50, active: "yes" });
      });
      closeModal();
      return;
    }
    if (act === "save-budget") {
      const month = L().monthKey(L().today());
      await change(function (api) {
        if (data.onlyMonth === "yes") api.upsert("budgets", { id: "bud_" + data.id + "_" + month.replace("-", ""), categoryId: data.id, month: month, amount: L().round2(data.monthly) });
        else api.upsert("categories", { id: data.id, monthly: data.monthly === "" ? "" : L().round2(data.monthly) });
      });
      closeModal();
      return;
    }
    if (act === "save-goal") {
      const id = data.id || L().uid("goal");
      await change(function (api) {
        api.upsert("goals", { id: id, name: data.name, kind: data.kind, scope: data.scope, owner: data.owner, targetAmount: L().round2(data.targetAmount), currentAmount: L().round2(data.currentAmount), targetDate: data.targetDate || "", status: "active", notes: data.notes || "" });
      });
      closeModal();
      noteWin(id, data.name);
      return;
    }
    if (act === "save-milestone") {
      await change(function (api) {
        const count = (App.state.milestones || []).filter(function (row) { return row.goalId === data.goalId; }).length;
        api.upsert("milestones", { id: L().uid("ms"), goalId: data.goalId, name: data.name, done: "no", dueDate: data.dueDate || "", sort: count + 1 });
      });
      closeModal();
      return;
    }
    if (act === "save-project") {
      await change(function (api) {
        api.upsert("projects", { id: L().uid("proj"), name: data.name, area: data.area, status: "active", budget: L().round2(data.budget), spent: L().round2(data.spent), owner: data.owner, startDate: L().today(), targetDate: data.targetDate || "", notes: data.notes || "" });
      });
      closeModal();
      go("plan/projects");
      return;
    }
    if (act === "save-task") {
      await change(function (api) {
        api.upsert("tasks", { id: L().uid("task"), projectId: data.projectId, title: data.title, assignee: data.assignee, status: "open", dueDate: data.dueDate || "", notes: "" });
      });
      closeModal();
      return;
    }
    if (act === "save-event") {
      await change(function (api) {
        api.upsert("events", { id: L().uid("ev"), title: data.title || "Event", date: data.date, time: data.time || "", endTime: data.endTime || "", owner: data.owner, category: data.category, source: "manual", sourceId: "", notes: data.notes || "", gcalId: "" });
      });
      closeModal();
      return;
    }
    if (act === "save-chore") {
      await change(function (api) {
        api.upsert("chores", { id: L().uid("ch"), title: data.title, assignee: data.assignee, dueDate: data.dueDate, cadence: data.cadence, status: "open", area: data.area, notes: "", doneAt: "", doneBy: "" });
      });
      closeModal();
      return;
    }
    if (act === "save-meal") {
      const existing = (App.state.meals || []).find(function (meal) { return meal.date === data.date && meal.slot === data.slot; });
      await change(function (api) {
        api.upsert("meals", { id: existing ? existing.id : L().uid("meal"), date: data.date, slot: data.slot, title: data.title, notes: "" });
      });
      closeModal();
      return;
    }
    if (act === "save-ingredient") {
      await change(function (api) {
        api.upsert("mealItems", { id: L().uid("mi"), mealId: data.mealId, name: data.name, qty: data.qty || "", aisle: data.aisle || "" });
      });
      closeModal();
      return;
    }
    if (act === "save-eggs") return actions["bump-count"](data);
    if (act === "save-sale") return onSale(data);
    if (act === "save-customer") {
      await change(function (api) {
        api.upsert("customers", { id: L().uid("cust"), name: data.name, phone: data.phone || "", email: data.email || "", kind: data.kind, notes: data.notes || "" });
      });
      closeModal();
      return;
    }
    if (act === "save-job") return onJob(data);
    if (act === "save-equip") {
      await change(function (api) {
        api.upsert("equipment", { id: L().uid("eq"), name: data.name, type: data.type || "", hours: L().num(data.hours), status: data.status, notes: data.notes || "" });
      });
      closeModal();
      return;
    }
    if (act === "save-service") {
      await change(function (api) {
        api.upsert("serviceLogs", { id: L().uid("svc"), equipmentId: data.equipmentId, date: data.date, hours: L().num(data.hours), what: data.what, cost: L().round2(data.cost), notes: data.notes || "", by: App.userId });
        if (data.hours) api.upsert("equipment", { id: data.equipmentId, hours: L().num(data.hours) });
      });
      closeModal();
      return;
    }
    if (act === "save-flock") {
      await change(function (api) {
        api.upsert("flock", { id: L().uid("fl"), species: data.species, breed: data.breed || data.species, count: L().num(data.count), acquired: data.acquired, status: "active", notes: "" });
      });
      closeModal();
      return;
    }
    if (act === "save-miles") {
      await change(function (api) {
        api.upsert("mileage", { id: L().uid("mi"), date: data.date, vehicle: data.vehicle, miles: L().num(data.miles), hours: L().num(data.hours), purpose: data.purpose || "", book: data.book, jobId: "", notes: "" });
      });
      closeModal();
      return;
    }
    if (act === "save-list") {
      const id = L().uid("list");
      await change(function (api) {
        api.upsert("lists", { id: id, name: data.name || "List", kind: data.kind, sort: (App.state.lists || []).length + 1 });
      });
      App.listId = id;
      closeModal();
      return;
    }
    if (act === "add-item") {
      if (!data.name) return;
      await change(function (api) {
        api.upsert("listItems", { id: L().uid("li"), listId: App.listId, name: data.name, aisle: data.aisle || "", qty: data.qty || "", checked: "no", staple: "no", addedBy: App.userId, createdAt: new Date().toISOString() });
      });
      render();
      const box = document.getElementById("itemName");
      if (box) box.focus();
      return;
    }
    if (act === "save-receipt") return saveReceipt(data);
    if (act === "save-quote") return saveQuote(data);
    if (act === "save-rule") return saveRule(data);
    if (act === "save-upkeep") return saveUpkeep(data);
    if (act === "save-upkeep-log") return saveUpkeepLog(data);
    if (act === "save-doc") return saveDoc(data);
    if (act === "save-routine") return saveRoutine(data);
    if (act === "add-gcal") {
      const id = String(data.calendarId || "").trim();
      if (!id) { toast("Enter a calendar id."); return; }
      const color = /^#[0-9A-Fa-f]{6}$/.test(data.color || "") ? data.color : "#3c7ea6";
      await change(function (api) {
        api.upsert("calendars", { id: L().uid("cal"), calendarId: id, name: data.name || (id.toLowerCase() === "primary" ? "Primary" : id), color: color, owner: data.owner || "shared", enabled: "yes" });
      });
      toast("Calendar added. Sync now to pull its events.");
      render();
      return;
    }
    if (act === "save-settings") {
      await change(function (api) {
        api.upsert("users", { id: "user_randy", name: data.randyName || "Randy Johnson" });
        api.upsert("users", { id: "user_partner", name: data.partnerName || "Partner" });
      });
      const saved = await change(function (api) {
        api.upsert("settings", {
          id: "hub", randyName: data.randyName, partnerName: data.partnerName, farmName: data.farmName,
          location: data.location, digestEmails: data.digestEmails || "", digestHour: parseInt(data.digestHour, 10) || 6,
          calendarId: data.calendarId || "", calendarSync: data.calendarSync || "off", mileageRate: data.mileageRate || "",
          billLeadDays: data.billLeadDays === "" ? 3 : parseInt(data.billLeadDays, 10) || 0,
          taxRate: data.taxRate === "" ? 15 : L().num(data.taxRate),
          eggMargin: data.eggMargin === "" ? 50 : L().num(data.eggMargin),
          wearRate: data.wearRate === "" ? 8 : L().num(data.wearRate)
        });
      });
      if (!saved || saved.ok !== false) toast("Settings saved.");
      render();
      return;
    }
    if (act === "preview-recurring") {
      const candidates = L().recurringCharges(App.state.transactions, App.state.bills, App.state.subscriptions);
      const kinds = {};
      candidates.forEach(function (row) { kinds[row.id] = data["kind_" + row.id]; });
      const chosen = L().chosenRecurring(candidates, data.pick || "", kinds);
      if (!chosen.length) { toast("Tick the charges to add. Nothing was added."); return; }
      App.recurringAdd = chosen;
      const bills = chosen.filter(function (row) { return row.kind !== "subscription"; }).length;
      const subs = chosen.length - bills;
      ask("Add " + chosen.length + "?", bills + " as bills and " + subs + " as subscriptions. Nothing else is added.", "confirm-recurring");
      return;
    }
    if (act === "preview-dup-delete") {
      const pairs = L().duplicatePairs(App.state.transactions, App.state.accounts);
      const ids = L().cleanupIds(pairs, data.drop || "");
      if (!ids.length) { toast("Tick the imported rows to remove. Nothing was deleted."); return; }
      App.dupDeleteIds = ids;
      ask("Delete " + ids.length + " imported " + (ids.length === 1 ? "row" : "rows") + "?", "Only the ticked imported rows are removed. The bank rows stay.", "confirm-dup-delete");
      return;
    }
    if (act === "save-import") {
      const planned = L().planCsvImport(App.state.transactions, App.importRows || [], App.state.accounts);
      await change(function (api) {
        planned.accepted.forEach(function (row) {
          let accountId = data.accountId;
          if (row.accountName) {
            const named = (App.state.accounts || []).find(function (acct) { return String(acct.name || "").trim().toLowerCase() === String(row.accountName).trim().toLowerCase(); });
            if (named) accountId = named.id;
          }
          const cat = (App.state.categories || []).find(function (item) { return String(item.name).toLowerCase() === String(row.category || "").toLowerCase(); });
          const acct = L().byId(App.state.accounts, accountId);
          api.upsert("transactions", {
            id: L().uid("tx"), date: row.date, accountId: accountId, amount: row.amount, type: row.type,
            categoryId: cat ? cat.id : "", book: row.book, payee: row.payee, memo: row.memo, refType: "csv", refId: "",
            externalId: "", receiptId: "", accountName: row.accountName || "",
            createdBy: App.userId, createdAt: new Date().toISOString()
          });
          if (!acct || acct.source !== "bank") shiftAccount(api, accountId, row.amount);
        });
      });
      App.importRows = [];
      closeModal();
      toast("Imported " + planned.accepted.length + ". Skipped " + planned.skipped.length + " duplicates.");
      return;
    }
    if (act === "save-trip") return onTrip(data);
    if (act === "save-stop") return onStop(data);
    if (act === "save-trip-item") return onTripItem(data);
    if (act === "save-template") return onTemplate(data);
    if (act === "apply-template") return onApplyTemplate(data);
    if (act === "save-trip-expense") return onTripExpense(data);
    if (act === "save-url") {
      try {
        const url = String(data.url || "").trim();
        if (url) localStorage.setItem("hub-script-url", url);
        else localStorage.removeItem("hub-script-url");
      } catch (e) {}
      location.reload();
      return;
    }
    if (act === "login") {
      globalThis.Store.saveCode(data.code || "");
      const res = await globalThis.Store.refresh();
      if (!res.ok) {
        App.needsCode = true;
        toast(res.unauthorized ? "That access code was not accepted." : "The sheet did not answer.");
        render();
        return;
      }
      App.state = res.state;
      App.needsCode = false;
      App.offline = false;
      closeModal();
      toast("Signed in.");
      refreshDevices(true);
      return;
    }
    if (act === "blink-verify") {
      await blinkCall({ op: "verify", pin: data.pin });
    }
  }

  actions["bump-count"] = function (data) {
    return change(function (api) {
      api.upsert("eggs", { id: L().uid("egg"), date: data.date || L().today(), species: data.species, count: L().num(data.count), notes: "", loggedBy: App.userId });
    }).then(function () { closeModal(); });
  };

  document.body.addEventListener("click", function (event) {
    if (event.target && event.target.id === "modalBack") { closeModal(); return; }
    const goEl = event.target.closest("[data-go]");
    if (goEl && event.target.closest("#view, #nav, #tabbar, .modal, #banner")) {
      event.preventDefault();
      go(goEl.getAttribute("data-go"));
      return;
    }
    const actEl = event.target.closest("[data-act]");
    if (!actEl || actEl.matches("input, select, textarea, form")) return;
    const act = actEl.getAttribute("data-act");
    if (!actions[act]) return;
    event.preventDefault();
    Promise.resolve(actions[act](actEl, event)).catch(function (err) { toast(err && err.message ? err.message : "Something went wrong."); });
  });

  document.body.addEventListener("submit", function (event) {
    const form = event.target;
    if (!form || !form.getAttribute) return;
    const act = form.getAttribute("data-act");
    if (!act) return;
    event.preventDefault();
    if (act === "noop") return;
    Promise.resolve(onSubmit(act, form)).catch(function (err) { toast(err && err.message ? err.message : "Something went wrong."); });
  });

  document.body.addEventListener("change", function (event) {
    const el = event.target;
    if (el.id === "who") {
      App.userId = el.value;
      globalThis.Store.saveUser(App.userId);
      render();
      return;
    }
    if (el.id === "monthPick") { App.month = el.value; render(); return; }
    if (el.id === "taxYear") { App.taxYear = el.value; return; }
    const act = el.getAttribute("data-act");
    if (act === "toggle-item") {
      const row = L().byId(App.state.listItems, el.dataset.id);
      if (!row) return;
      change(function (api) { api.upsert("listItems", { id: row.id, checked: el.checked ? "yes" : "no" }); }).then(function () { render(); });
    } else if (act === "toggle-chore") {
      const row = L().byId(App.state.chores, el.dataset.id);
      if (!row) return;
      change(function (api) {
        if (el.checked) {
          api.upsert("chores", { id: row.id, status: "done", doneAt: new Date().toISOString(), doneBy: App.userId });
          if (row.cadence && row.cadence !== "once") {
            api.upsert("chores", { id: L().uid("ch"), title: row.title, assignee: row.assignee, dueDate: L().nextChoreDate(row.dueDate, row.cadence, L().today()), cadence: row.cadence, status: "open", area: row.area, notes: row.notes || "", doneAt: "", doneBy: "" });
          }
        } else api.upsert("chores", { id: row.id, status: "open", doneAt: "", doneBy: "" });
      }).then(function () { render(); });
    } else if (act === "toggle-milestone") {
      toggleChecked("milestones", el.dataset.id, "done", "yes", "no").then(function () { render(); });
    } else if (act === "toggle-trip-item") {
      const row = L().byId(App.state.tripItems, el.dataset.id);
      if (!row) return;
      change(function (api) { api.upsert("tripItems", { id: row.id, done: el.checked ? "yes" : "no" }); }).then(function () { render(); });
    } else if (act === "toggle-task") {
      const row = L().byId(App.state.tasks, el.dataset.id);
      if (!row) return;
      change(function (api) { api.upsert("tasks", { id: row.id, status: row.status === "done" ? "open" : "done" }); }).then(function () { render(); });
    }
  });

  document.body.addEventListener("input", function (event) {
    if (event.target.id === "q") { App.query = event.target.value; render(); }
    if (event.target.id === "txQuery") { App.txQuery = event.target.value; render(); }
  });

  document.getElementById("themeBtn").addEventListener("click", function () {
    const dark = document.documentElement.dataset.theme === "dark";
    App.theme = dark ? "light" : "dark";
    try { localStorage.setItem("hub-theme", App.theme); } catch (e) {}
    render();
  });
  document.getElementById("searchBtn").addEventListener("click", function () { go("search"); });
  document.getElementById("refreshBtn").addEventListener("click", async function () {
    if (App.mode !== "live") { toast("Sample data is already on this phone."); return; }
    const res = await globalThis.Store.refresh();
    if (res.ok && res.state) { App.state = res.state; App.offline = false; App.needsCode = false; toast("Up to date."); }
    else if (res.unauthorized) { App.needsCode = true; toast("The access code was not accepted."); }
    else { App.offline = true; toast("The sheet did not answer. Showing the saved copy."); }
    render();
  });
  document.getElementById("fab").addEventListener("click", function () { actions.quick(); });
  window.addEventListener("hashchange", function () {
    const next = (location.hash || "#home").slice(1) || "home";
    if (next !== App.route) { App.route = next; App.modal = null; render(); }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && App.modal) closeModal();
  });

  async function boot() {
    try { App.theme = localStorage.getItem("hub-theme") || "system"; } catch (e) { App.theme = "system"; }
    const loaded = globalThis.Store.load();
    App.state = loaded.state;
    App.mode = loaded.mode;
    App.userId = loaded.userId || "user_randy";
    App.needsCode = !!loaded.needsCode;
    App.month = L().monthKey(L().today());
    App.calMonth = App.month;
    App.calDay = L().today();
    App.calMode = window.innerWidth < 800 ? "agenda" : "month";
    App.route = (location.hash || "#home").slice(1) || "home";
    try { App.calHide = JSON.parse(localStorage.getItem("hub-cal-hide") || "{}"); } catch (e) { App.calHide = {}; }
    if (!location.hash) history.replaceState(null, "", "#home");
    if (App.mode === "sample") {
      App.devices = globalThis.HubSample.demoDevices();
      App.deviceNote = "demo";
    } else {
      try { App.devices = JSON.parse(localStorage.getItem("hub-devices-v1") || "[]"); } catch (e) { App.devices = []; }
    }
    render();
    loadWeather(false);
    pingNotifications();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(function () {});
    if (App.mode === "live" && !App.needsCode) {
      const res = await globalThis.Store.refresh();
      if (res.ok && res.state) { App.state = res.state; App.offline = false; }
      else if (res.unauthorized) App.needsCode = true;
      else App.offline = true;
      render();
      refreshDevices(true);
      loadWeather(false);
      pingNotifications();
    }
    setInterval(function () {
      if (document.hidden || App.modal || App.mode !== "live" || App.needsCode) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      globalThis.Store.refresh().then(function (res) {
        if (res.ok && res.state) { App.state = res.state; App.offline = false; render(); }
        else if (res.offline) { App.offline = true; render(); }
      });
    }, 30000);
  }

  boot();
})();
