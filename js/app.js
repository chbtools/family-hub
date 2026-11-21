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
    new FormData(form).forEach(function (value, key) { data[key] = String(value); });
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
          App.importRows = rows;
          openModal("Import " + rows.length + " rows", '<form class="stack" data-act="save-import"><p>Choose the account these rows belong to. Personal or Farm comes from the file when that column is present.</p>' + U().select("Account", "accountId", farmAccount(), U().accountOptions(App.state)) + cancelRow() + "</form>");
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
      await change(function (api) {
        api.upsert("goals", { id: data.id || L().uid("goal"), name: data.name, kind: data.kind, scope: data.scope, owner: data.owner, targetAmount: L().round2(data.targetAmount), currentAmount: L().round2(data.currentAmount), targetDate: data.targetDate || "", status: "active", notes: data.notes || "" });
      });
      closeModal();
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
    if (act === "save-settings") {
      await change(function (api) {
        api.upsert("settings", {
          id: "hub", randyName: data.randyName, partnerName: data.partnerName, farmName: data.farmName,
          location: data.location, digestEmails: data.digestEmails || "", digestHour: parseInt(data.digestHour, 10) || 6,
          calendarId: data.calendarId || "", calendarSync: data.calendarSync || "off", mileageRate: data.mileageRate || ""
        });
        api.upsert("users", { id: "user_randy", name: data.randyName || "Randy Johnson" });
        api.upsert("users", { id: "user_partner", name: data.partnerName || "Partner" });
      });
      toast("Settings saved.");
      render();
      return;
    }
    if (act === "save-import") {
      const rows = App.importRows || [];
      await change(function (api) {
        rows.forEach(function (row) {
          const cat = (App.state.categories || []).find(function (item) { return String(item.name).toLowerCase() === String(row.category || "").toLowerCase(); });
          api.upsert("transactions", {
            id: L().uid("tx"), date: row.date, accountId: data.accountId, amount: row.amount, type: row.type,
            categoryId: cat ? cat.id : "", book: row.book, payee: row.payee, memo: row.memo, refType: "csv", refId: "",
            createdBy: App.userId, createdAt: new Date().toISOString()
          });
          shiftAccount(api, data.accountId, row.amount);
        });
      });
      App.importRows = [];
      closeModal();
      toast("Imported " + rows.length + " transactions.");
      return;
    }
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
    if (!location.hash) history.replaceState(null, "", "#home");
    if (App.mode === "sample") {
      App.devices = globalThis.HubSample.demoDevices();
      App.deviceNote = "demo";
    } else {
      try { App.devices = JSON.parse(localStorage.getItem("hub-devices-v1") || "[]"); } catch (e) { App.devices = []; }
    }
    render();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(function () {});
    if (App.mode === "live" && !App.needsCode) {
      const res = await globalThis.Store.refresh();
      if (res.ok && res.state) { App.state = res.state; App.offline = false; }
      else if (res.unauthorized) App.needsCode = true;
      else App.offline = true;
      render();
      refreshDevices(true);
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
