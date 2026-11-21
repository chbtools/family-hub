/* Practice household for CW Johnson Farms. Dates are built from today so the
   dashboard always shows bills, eggs, and jobs around the day you open it.
   This stays on the phone until a Google Sheet is connected. */
(function (root, factory) {
  const api = factory(root.HubLogic);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HubSample = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (L) {
  function cat(id, name, book, kind, monthly, sort, scheduleF) {
    return { id: id, name: name, book: book, kind: kind, monthly: monthly || "", scheduleF: scheduleF || "", sort: sort, active: "yes" };
  }

  function build(day) {
    const Lref = L || globalThis.HubLogic;
    const month = Lref.monthKey(day);
    const prev = Lref.addMonths(month + "-01", -1);
    function on(offset) { return Lref.addDays(day, offset); }
    function monthOf(offset) { return Lref.monthKey(on(offset)); }
    function dayNum(offset) { return +on(offset).slice(8, 10); }

    const state = Lref.emptyState();
    state.users = [
      { id: "user_randy", name: "Randy Johnson", role: "owner", active: "yes", createdAt: day },
      { id: "user_partner", name: "Partner", role: "owner", active: "yes", createdAt: day }
    ];
    state.settings = [{
      id: "hub",
      randyName: "Randy Johnson",
      partnerName: "Partner",
      farmName: "CW Johnson Farms LLC",
      location: "Lillington, NC",
      digestEmails: "",
      digestHour: 6,
      billLeadDays: 3,
      taxRate: 15,
      eggMargin: 50,
      wearRate: 8,
      calendarId: "",
      calendarSync: "off",
      mileageRate: "",
      createdAt: day
    }];
    state.accounts = [
      { id: "acct_joint", name: "Joint checking", type: "checking", book: "Personal", balance: 4280.55, institution: "First Bank", notes: "", updatedAt: day },
      { id: "acct_farm", name: "Farm checking", type: "checking", book: "Farm", balance: 6120.4, institution: "First Bank", notes: "CW Johnson Farms", updatedAt: day },
      { id: "acct_save", name: "Savings", type: "savings", book: "Personal", balance: 8500, institution: "First Bank", notes: "Emergency fund", updatedAt: day },
      { id: "acct_loan", name: "Tractor loan", type: "loan", book: "Farm", balance: 18400, institution: "Farm Credit", notes: "", updatedAt: day }
    ];
    state.categories = [
      cat("cat_groceries", "Groceries", "Personal", "expense", 600, 1),
      cat("cat_electric", "Electric", "Personal", "expense", 200, 2),
      cat("cat_phone", "Phone", "Personal", "expense", 120, 3),
      cat("cat_house", "Household", "Personal", "expense", 200, 4),
      cat("cat_subs", "Subscriptions", "Personal", "expense", 40, 5),
      cat("cat_pins", "Insurance", "Personal", "expense", 0, 6),
      cat("cat_pay", "Paycheck", "Personal", "income", "", 7),
      cat("cat_feed", "Feed", "Farm", "expense", 180, 10, "16"),
      cat("cat_fuel", "Fuel", "Farm", "expense", 250, 11, "19"),
      cat("cat_equip", "Equipment", "Farm", "expense", 100, 12, "26"),
      cat("cat_fsup", "Farm supplies", "Farm", "expense", 80, 13, "29"),
      cat("cat_fins", "Farm insurance", "Farm", "expense", 0, 14, "20"),
      cat("cat_eggs", "Egg sales", "Farm", "income", "", 20, "4"),
      cat("cat_tractor", "Tractor services", "Farm", "income", "", 21, "9")
    ];
    state.transactions = [
      tx("tx_pay", on(-10), "acct_joint", 2400, "income", "cat_pay", "Personal", "Employer", "Payday", "user_randy"),
      tx("tx_egg1", on(-6), "acct_farm", 54, "income", "cat_eggs", "Farm", "Saturday market", "Duck and chicken", "user_partner"),
      tx("tx_egg2", on(-1), "acct_farm", 36, "income", "cat_eggs", "Farm", "Neighbor", "2 dozen chicken", "user_randy"),
      tx("tx_job1", on(-8), "acct_farm", 280, "income", "cat_tractor", "Farm", "M. Alvarez", "Driveway maintenance", "user_randy"),
      tx("tx_groc", on(-3), "acct_joint", -86.42, "expense", "cat_groceries", "Personal", "Food Lion", "", "user_partner"),
      tx("tx_groc2", on(-12), "acct_joint", -124.18, "expense", "cat_groceries", "Personal", "Walmart", "", "user_randy"),
      tx("tx_feed", on(-4), "acct_farm", -72.5, "expense", "cat_feed", "Farm", "Southern States", "Layer feed", "user_randy"),
      tx("tx_fuel", on(-2), "acct_farm", -68, "expense", "cat_fuel", "Farm", "Circle K", "Off-road diesel", "user_randy"),
      tx("tx_house", on(-9), "acct_joint", -46.2, "expense", "cat_house", "Personal", "Hardware", "Door latch", "user_partner"),
      tx("tx_trip", on(20), "acct_joint", -40, "expense", "cat_house", "Personal", "Cottage deposit", "Emerald Isle", "user_randy"),
      tx("tx_sub", on(-15), "acct_joint", -15.49, "expense", "cat_subs", "Personal", "Streaming", "", "user_partner"),
      tx("tx_elec", prev + "-18", "acct_joint", -178.33, "expense", "cat_electric", "Personal", "Electric co-op", "Last month", "user_randy")
    ];
    state.bills = [
      bill("bill_elec", "Electric co-op", "Lumbee River EMC", 186, 3, "Personal", "cat_electric", "acct_joint", "no", "user_randy"),
      bill("bill_phone", "Phones", "Verizon", 95, 12, "Personal", "cat_phone", "acct_joint", "yes", "user_partner"),
      bill("bill_ins", "Farm insurance", "Farm Bureau", 140, -2, "Farm", "cat_fins", "acct_farm", "no", "user_randy"),
      bill("bill_trac", "Tractor payment", "Farm Credit", 412, 5, "Farm", "cat_equip", "acct_farm", "no", "user_randy")
    ];
    state.billPayments = [
      { id: "pay_elec_prev", billId: "bill_elec", dueDate: "", paidDate: prev + "-18", amount: 178.33, paidBy: "user_randy", accountId: "acct_joint", transactionId: "tx_elec" }
    ];
    /* The electric sample payment covers last cycle only when that cycle's due date matches.
       openCycle uses startMonth, so last month is not an open cycle. Leave dueDate blank-safe:
       bill payments must match a real due date to count. The previous payment is history only. */
    state.billPayments = [];
    state.subscriptions = [
      { id: "sub_stream", name: "Streaming", amount: 15.49, cadence: "monthly", nextDate: on(9), book: "Personal", categoryId: "cat_subs", assignedTo: "user_partner", active: "yes", notes: "" },
      { id: "sub_cloud", name: "Photo backup", amount: 2.99, cadence: "monthly", nextDate: on(4), book: "Personal", categoryId: "cat_subs", assignedTo: "user_randy", active: "yes", notes: "" }
    ];
    state.debts = [
      { id: "debt_tractor", name: "Tractor loan", principal: 18400, apr: 6.5, payment: 412, book: "Farm", kind: "equipment", notes: "Matches the Farm Credit account" }
    ];
    state.snapshots = [];
    for (let i = 5; i >= 0; i--) {
      const m = Lref.addMonths(month + "-01", -i);
      const assets = 17000 + (5 - i) * 280;
      const liabilities = 19600 - (5 - i) * 200;
      state.snapshots.push({
        id: "snap_" + m.replace("-", ""),
        date: m + "-01",
        assets: Lref.round2(assets),
        liabilities: Lref.round2(liabilities),
        net: Lref.round2(assets - liabilities),
        note: ""
      });
    }
    state.goals = [
      { id: "goal_fund", name: "Emergency fund", kind: "savings", scope: "shared", owner: "shared", targetAmount: 10000, currentAmount: 8500, targetDate: Lref.addMonths(month + "-01", 4) + "-01", status: "active", notes: "Tied to the savings account." },
      { id: "goal_coop", name: "Coop expansion", kind: "farm", scope: "shared", owner: "user_randy", targetAmount: 1500, currentAmount: 400, targetDate: Lref.addMonths(month + "-01", 3) + "-15", status: "active", notes: "Shade and another nest run." },
      { id: "goal_trip", name: "Weekend away", kind: "personal", scope: "personal", owner: "user_partner", targetAmount: 600, currentAmount: 150, targetDate: Lref.addMonths(month + "-01", 2) + "-01", status: "active", notes: "" }
    ];
    state.milestones = [
      { id: "ms_coop1", goalId: "goal_coop", name: "Pick the footprint", done: "yes", dueDate: on(-20), sort: 1 },
      { id: "ms_coop2", goalId: "goal_coop", name: "Price lumber and wire", done: "no", dueDate: on(10), sort: 2 },
      { id: "ms_coop3", goalId: "goal_coop", name: "Build the run", done: "no", dueDate: on(40), sort: 3 }
    ];
    state.projects = [
      { id: "proj_drive", name: "Our driveway", area: "home", status: "active", budget: 0, spent: 0, owner: "user_randy", startDate: on(-14), targetDate: on(21), notes: "Grade the low spot before the next rain." },
      { id: "proj_coop", name: "Coop expansion", area: "farm", status: "active", budget: 1500, spent: 400, owner: "user_randy", startDate: on(-20), targetDate: on(50), notes: "See the goal for the lumber list." }
    ];
    state.tasks = [
      { id: "task_drive1", projectId: "proj_drive", title: "Walk the low spot and mark it", assignee: "user_randy", status: "done", dueDate: on(-7), notes: "" },
      { id: "task_drive2", projectId: "proj_drive", title: "Grade after the next dry day", assignee: "user_randy", status: "open", dueDate: on(2), notes: "" },
      { id: "task_coop1", projectId: "proj_coop", title: "Order welded wire", assignee: "user_partner", status: "open", dueDate: on(8), notes: "" }
    ];
    state.events = [
      { id: "ev_market", title: "Egg stand at the market", date: on(1), time: "08:00", endTime: "12:00", owner: "user_partner", category: "farm", source: "manual", sourceId: "", notes: "Duck, chicken, and quail.", gcalId: "" },
      { id: "ev_dinner", title: "Dinner with the neighbors", date: on(3), time: "18:00", endTime: "20:00", owner: "shared", category: "family", source: "manual", sourceId: "", notes: "", gcalId: "" },
      { id: "ev_feed", title: "Pick up layer feed", date: on(0), time: "16:00", endTime: "", owner: "user_randy", category: "farm", source: "manual", sourceId: "", notes: "", gcalId: "" }
    ];
    state.lists = [
      { id: "list_groc", name: "Grocery", kind: "grocery", sort: 1 },
      { id: "list_farm", name: "Farm supply", kind: "farm", sort: 2 },
      { id: "list_hard", name: "Hardware", kind: "hardware", sort: 3 }
    ];
    state.listItems = [
      item("li_milk", "list_groc", "Milk", "Dairy", "1 gal", "no", "yes"),
      item("li_eggs", "list_groc", "Butter", "Dairy", "1", "no", "yes"),
      item("li_bread", "list_groc", "Bread", "Bakery", "1", "yes", "yes"),
      item("li_coffee", "list_groc", "Coffee", "Drinks", "1", "no", "yes"),
      item("li_feed", "list_farm", "Layer pellets", "Feed", "2 bags", "no", "yes"),
      item("li_grit", "list_farm", "Grit", "Feed", "1", "no", "no"),
      item("li_wire", "list_hard", "Welded wire", "Fencing", "1 roll", "no", "no"),
      item("li_latch", "list_hard", "Gate latch", "Hardware", "2", "no", "no")
    ];
    state.chores = [
      { id: "ch_eggs", title: "Collect eggs", assignee: "user_randy", dueDate: day, cadence: "daily", status: "open", area: "farm", notes: "", doneAt: "", doneBy: "" },
      { id: "ch_water", title: "Water and feed", assignee: "user_partner", dueDate: day, cadence: "daily", status: "open", area: "farm", notes: "", doneAt: "", doneBy: "" },
      { id: "ch_trash", title: "Take the trash out", assignee: "user_randy", dueDate: on(1), cadence: "weekly", status: "open", area: "home", notes: "", doneAt: "", doneBy: "" },
      { id: "ch_beds", title: "Change the bed linens", assignee: "user_partner", dueDate: on(2), cadence: "weekly", status: "open", area: "home", notes: "", doneAt: "", doneBy: "" }
    ];
    state.meals = [
      { id: "meal_d0", date: day, slot: "dinner", title: "Chicken and rice", notes: "" },
      { id: "meal_d1", date: on(1), slot: "dinner", title: "Beans and cornbread", notes: "" },
      { id: "meal_d2", date: on(2), slot: "dinner", title: "Breakfast for dinner", notes: "Use the extra eggs." }
    ];
    state.mealItems = [
      { id: "mi1", mealId: "meal_d0", name: "Rice", qty: "1 bag", aisle: "Dry goods" },
      { id: "mi2", mealId: "meal_d0", name: "Onion", qty: "2", aisle: "Produce" },
      { id: "mi3", mealId: "meal_d1", name: "Cornmeal", qty: "1", aisle: "Baking" },
      { id: "mi4", mealId: "meal_d1", name: "Dried beans", qty: "1 lb", aisle: "Dry goods" }
    ];
    state.eggs = [];
    for (let i = 6; i >= 0; i--) {
      const date = on(-i);
      state.eggs.push({ id: "egg_d_" + i, date: date, species: "duck", count: 4 + (i % 3), notes: "", loggedBy: "user_randy" });
      state.eggs.push({ id: "egg_c_" + i, date: date, species: "chicken", count: 8 + (i % 4), notes: "", loggedBy: "user_partner" });
      if (i % 2 === 0) state.eggs.push({ id: "egg_q_" + i, date: date, species: "quail", count: 10 + i, notes: "", loggedBy: "user_randy" });
    }
    state.customers = [
      { id: "cust_alvarez", name: "M. Alvarez", phone: "910-555-0142", email: "", kind: "both", notes: "Driveway on the west side of town." },
      { id: "cust_bennett", name: "Bennett place", phone: "910-555-0177", email: "", kind: "tractor", notes: "Pasture bush hog, call the day before." },
      { id: "cust_market", name: "Saturday market", phone: "", email: "", kind: "eggs", notes: "Regular dozen price." }
    ];
    state.jobs = [
      { id: "job_alvarez", number: "JOB-1001", customerId: "cust_alvarez", customerName: "M. Alvarez", service: "driveway", status: "paid", date: on(-8), address: "Lillington", description: "Grade and pull the washout.", hours: 3.5, rate: 80, amount: 280, mileage: 12, paidDate: on(-8), notes: "", assignedTo: "user_randy", transactionId: "tx_job1" },
      { id: "job_bennett", number: "JOB-1002", customerId: "cust_bennett", customerName: "Bennett place", service: "bushhog", status: "scheduled", date: on(2), address: "NC-27", description: "Back pasture, watch the fence line.", hours: 4, rate: 85, amount: 340, mileage: 18, paidDate: "", notes: "Quote accepted.", assignedTo: "user_randy", transactionId: "" },
      { id: "job_stump", number: "JOB-1003", customerId: "cust_alvarez", customerName: "M. Alvarez", service: "stump", status: "invoiced", date: on(-1), address: "Lillington", description: "Two oak stumps by the shed.", hours: 2, rate: 95, amount: 190, mileage: 12, paidDate: "", notes: "Invoice sent, not paid yet.", assignedTo: "user_randy", transactionId: "" }
    ];
    state.eggSales = [
      { id: "sale1", date: on(-6), customerId: "cust_market", species: "mixed", dozens: 6, price: 9, total: 54, paid: "yes", notes: "Market morning", transactionId: "tx_egg1" },
      { id: "sale2", date: on(-1), customerId: "", species: "chicken", dozens: 2, price: 6, total: 12, paid: "yes", notes: "Neighbor, plus a duck dozen in the same deposit", transactionId: "tx_egg2" }
    ];
    state.equipment = [
      { id: "eq_tractor", name: "Tractor", type: "tractor", hours: 842, status: "ready", notes: "Primary machine for hire work." },
      { id: "eq_hog", name: "Bush hog", type: "implement", hours: 310, status: "ready", notes: "" },
      { id: "eq_blade", name: "Box blade", type: "implement", hours: 190, status: "ready", notes: "Driveways and grading." },
      { id: "eq_stump", name: "Stump grinder", type: "implement", hours: 76, status: "service", notes: "Teeth due for a look." }
    ];
    state.serviceLogs = [
      { id: "svc1", equipmentId: "eq_tractor", date: on(-30), hours: 820, what: "Engine oil and filter", cost: 68, notes: "", by: "user_randy" },
      { id: "svc2", equipmentId: "eq_stump", date: on(-3), hours: 76, what: "Checked teeth", cost: 0, notes: "Order a set before the next job.", by: "user_randy" }
    ];
    state.flock = [
      { id: "fl_duck", species: "duck", breed: "Pekin", count: 8, acquired: "2024-04-01", status: "active", notes: "" },
      { id: "fl_hen", species: "chicken", breed: "Rhode Island Red", count: 22, acquired: "2024-03-15", status: "active", notes: "" },
      { id: "fl_quail", species: "quail", breed: "Coturnix", count: 30, acquired: "2025-05-01", status: "active", notes: "" }
    ];
    state.trips = [
      { id: "trip_beach", name: "Weekend at the coast", destination: "Emerald Isle, NC", startDate: on(20), endDate: on(23), departTime: "08:00", travelers: "user_randy,user_partner", budget: 600, spent: "", trackMoney: "yes", notes: "Leave after chores. Neighbor has the gate code." },
      { id: "trip_mtn", name: "Asheville weekend", destination: "Asheville, NC", startDate: on(-40), endDate: on(-37), departTime: "09:00", travelers: "user_randy,user_partner", budget: 400, spent: 365, trackMoney: "no", notes: "Already home." }
    ];
    state.itinerary = [
      { id: "it_drive", tripId: "trip_beach", date: on(20), time: "08:00", kind: "drive", title: "Drive to Emerald Isle", address: "From Lillington", confirmation: "", notes: "About 2.5 hours. Stop for fuel in Dunn.", sort: 1 },
      { id: "it_stay", tripId: "trip_beach", date: on(20), time: "15:00", kind: "lodging", title: "Cottage check-in", address: "214 Ocean Drive, Emerald Isle", confirmation: "EI-4481", notes: "Keypad code is in the booking email.", sort: 2 },
      { id: "it_eat", tripId: "trip_beach", date: on(21), time: "18:30", kind: "reservation", title: "Dinner", address: "Boardwalk, Emerald Isle", confirmation: "Smith 2", notes: "", sort: 3 },
      { id: "it_beach", tripId: "trip_beach", date: on(22), time: "10:00", kind: "activity", title: "Beach morning", address: "Public access near the cottage", confirmation: "", notes: "", sort: 4 }
    ];
    state.tripItems = [
      { id: "ti_pack1", tripId: "trip_beach", listName: "Packing", kind: "packing", assignee: "user_randy", text: "Clothes and charger", done: "no", sort: 1 },
      { id: "ti_pack2", tripId: "trip_beach", listName: "Packing", kind: "packing", assignee: "user_partner", text: "Medicine", done: "no", sort: 2 },
      { id: "ti_farm1", tripId: "trip_beach", listName: "Before we leave", kind: "farm", assignee: "user_randy", text: "Feed and water covered", done: "no", sort: 1 },
      { id: "ti_farm2", tripId: "trip_beach", listName: "Before we leave", kind: "farm", assignee: "user_partner", text: "Egg collection covered", done: "yes", sort: 2 },
      { id: "ti_farm3", tripId: "trip_beach", listName: "Before we leave", kind: "farm", assignee: "user_randy", text: "Coop secured", done: "no", sort: 3 },
      { id: "ti_house", tripId: "trip_beach", listName: "Before we leave", kind: "house", assignee: "shared", text: "Thermostat set and doors locked", done: "no", sort: 4 },
      { id: "ti_docs", tripId: "trip_beach", listName: "Documents", kind: "documents", assignee: "shared", text: "IDs and insurance cards", done: "no", sort: 1 }
    ];
    state.templates = [
      { id: "tpl_leave", name: "Before we leave", kind: "farm", notes: "House and farm close-up." },
      { id: "tpl_pack", name: "Packing", kind: "packing", notes: "One list, then assign people on the trip." }
    ];
    state.templateItems = [
      { id: "tpi1", templateId: "tpl_leave", text: "Feed and water covered", assignee: "user_randy", sort: 1 },
      { id: "tpi2", templateId: "tpl_leave", text: "Egg collection covered", assignee: "user_partner", sort: 2 },
      { id: "tpi3", templateId: "tpl_leave", text: "Coop secured", assignee: "user_randy", sort: 3 },
      { id: "tpi4", templateId: "tpl_leave", text: "Thermostat set and doors locked", assignee: "shared", sort: 4 },
      { id: "tpi5", templateId: "tpl_pack", text: "Clothes and charger", assignee: "", sort: 1 },
      { id: "tpi6", templateId: "tpl_pack", text: "Medicine", assignee: "", sort: 2 },
      { id: "tpi7", templateId: "tpl_pack", text: "IDs and insurance cards", assignee: "shared", sort: 3 }
    ];
    state.mileage = [
      { id: "mi_job1", date: on(-8), vehicle: "Farm truck", miles: 12, hours: 3.5, purpose: "Driveway job", book: "Farm", jobId: "job_alvarez", notes: "" },
      { id: "mi_feed", date: on(-4), vehicle: "Farm truck", miles: 16, hours: 0, purpose: "Feed run", book: "Farm", jobId: "", notes: "" },
      { id: "mi_stump", date: on(-1), vehicle: "Farm truck", miles: 12, hours: 2, purpose: "Stump grinding", book: "Farm", jobId: "job_stump", notes: "" }
    ];

    function tx(id, date, accountId, amount, type, categoryId, book, payee, memo, createdBy) {
      return { id: id, date: date, accountId: accountId, amount: amount, type: type, categoryId: categoryId, book: book, payee: payee, memo: memo, refType: "", refId: "", createdBy: createdBy, createdAt: date };
    }
    function bill(id, name, payee, amount, offset, book, categoryId, accountId, autopay, assignedTo) {
      return {
        id: id, name: name, payee: payee, amount: amount, dueDay: dayNum(offset), startMonth: monthOf(offset),
        book: book, categoryId: categoryId, accountId: accountId, autopay: autopay, assignedTo: assignedTo, active: "yes", notes: ""
      };
    }
    function item(id, listId, name, aisle, qty, checked, staple) {
      return { id: id, listId: listId, name: name, aisle: aisle, qty: qty, checked: checked, staple: staple, addedBy: "user_randy", createdAt: day };
    }
    /* tx/bill/item are used above before initialization if this were let in a block.
       Function declarations are hoisted inside build(), so the calls above are fine. */
    state.transactions.forEach(function (row) {
      if (row.id === "tx_job1") { row.refType = "job"; row.refId = "job_alvarez"; }
      if (row.id === "tx_egg1") { row.refType = "eggSale"; row.refId = "sale1"; }
      if (row.id === "tx_egg2") { row.refType = "eggSale"; row.refId = "sale2"; }
      if (row.id === "tx_trip") { row.refType = "trip"; row.refId = "trip_beach"; }
    });
    state.merchantRules = [
      { id: "rule_lion", pattern: "Food Lion", categoryId: "cat_groceries", book: "Personal" },
      { id: "rule_feed", pattern: "Southern States", categoryId: "cat_feed", book: "Farm" },
      { id: "rule_fuel", pattern: "Circle K", categoryId: "cat_fuel", book: "Farm" }
    ];
    state.routines = [
      { id: "scene_away", name: "Away", active: "yes", steps: JSON.stringify([{ type: "st", deviceId: "demo_therm", capability: "thermostatMode", command: "setThermostatMode", argument: "eco" }, { type: "st", deviceId: "demo_tv", capability: "switch", command: "off" }, { type: "st", deviceId: "demo_porch", capability: "switch", command: "on" }, { type: "blink", op: "arm" }]) },
      { id: "scene_home", name: "Home", active: "yes", steps: JSON.stringify([{ type: "st", deviceId: "demo_therm", capability: "thermostatMode", command: "setThermostatMode", argument: "heat" }, { type: "st", deviceId: "demo_therm", capability: "thermostatHeatingSetpoint", command: "setHeatingSetpoint", argument: "68" }, { type: "blink", op: "disarm" }]) },
      { id: "scene_bed", name: "Bedtime", active: "yes", steps: JSON.stringify([{ type: "st", deviceId: "demo_tv", capability: "switch", command: "off" }, { type: "st", deviceId: "demo_porch", capability: "switch", command: "off" }, { type: "st", deviceId: "demo_lock", capability: "lock", command: "lock" }]) },
      { id: "scene_vac", name: "Vacation", active: "yes", steps: JSON.stringify([{ type: "st", deviceId: "demo_therm", capability: "thermostatHeatingSetpoint", command: "setHeatingSetpoint", argument: "62" }, { type: "st", deviceId: "demo_tv", capability: "switch", command: "off" }, { type: "blink", op: "arm" }]) }
    ];
    state.upkeep = [
      { id: "up_hvac", name: "House HVAC filter", kind: "house", everyDays: 90, everyHours: "", everyMiles: "", lastDate: on(-80), lastReading: "", notes: "Return grille in the hall." },
      { id: "up_truck", name: "Farm truck oil", kind: "truck", everyDays: "", everyHours: "", everyMiles: 5000, lastDate: on(-60), lastReading: 84200, notes: "" },
      { id: "up_trac", name: "Tractor engine oil", kind: "tractor", everyDays: "", everyHours: 100, everyMiles: "", lastDate: on(-30), lastReading: 820, notes: "Same hour meter as the tractor." }
    ];
    state.docs = [
      { id: "doc_ins", name: "Farm policy", category: "insurance", owner: "shared", expires: on(20), link: "", notes: "Renewal packet. No policy number stored here." },
      { id: "doc_title", name: "Truck title", category: "title", owner: "user_randy", expires: "", link: "", notes: "Paper copy in the file box." }
    ];
    state.wins = [
      { id: "win_coop", goalId: "goal_coop", title: "Picked the coop footprint", date: on(-20), note: "First milestone." }
    ];
    state.demoDevices = demoDevices();
    return state;
  }

  function demoDevices() {
    return [
      { id: "demo_tv", name: "Living room TV", kind: "tv", health: "ONLINE", capabilities: ["switch", "audioVolume", "audioMute", "mediaInputSource"], status: { switch: "on", volume: 18, mute: "unmuted", inputSource: "HDMI1" } },
      { id: "demo_therm", name: "Hall thermostat", kind: "thermostat", health: "ONLINE", capabilities: ["thermostatMode", "thermostatHeatingSetpoint", "thermostatCoolingSetpoint", "thermostatFanMode", "temperatureMeasurement"], status: { thermostatMode: "heat", heatingSetpoint: 68, coolingSetpoint: 74, fanMode: "auto", temperature: 70, tempUnit: "F" } },
      { id: "demo_wash", name: "Washer", kind: "washer", health: "ONLINE", capabilities: ["washerOperatingState"], status: { washerState: "run", washerJob: "wash", completionTime: new Date(Date.now() + 22 * 60000).toISOString() } },
      { id: "demo_dry", name: "Dryer", kind: "dryer", health: "ONLINE", capabilities: ["dryerOperatingState"], status: { dryerState: "stop", completionTime: "" } },
      { id: "demo_porch", name: "Porch light", kind: "switch", health: "ONLINE", capabilities: ["switch"], status: { switch: "on" } },
      { id: "demo_lock", name: "Front door", kind: "lock", health: "ONLINE", capabilities: ["lock"], status: { lock: "locked" } },
      { id: "demo_coop", name: "Coop door", kind: "sensor", health: "ONLINE", capabilities: ["contactSensor"], status: { contact: "closed" } }
    ];
  }

  return { build: build, demoDevices: demoDevices };
});
