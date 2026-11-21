/* Screens. App is the live page state; HubLogic does the math. */
(function () {
  const U = function () { return globalThis.HubUI; };
  const Logic = function () { return globalThis.HubLogic; };

  function subnav(items) {
    return '<div class="subnav">' + items.map(function (item) {
      const on = App.route === item[0] ? " on" : "";
      return '<a href="#' + item[0] + '" data-go="' + item[0] + '" class="' + on + '">' + U().esc(item[1]) + "</a>";
    }).join("") + "</div>";
  }

  function head(title, lede, extra) {
    return '<div class="page-head"><div><h2>' + U().esc(title) + "</h2>" + (lede ? '<p class="lede">' + lede + "</p>" : "") + "</div>" + (extra || "") + "</div>";
  }

  function linkBtn(label, route, primary) {
    return '<a class="' + (primary ? "primary" : "btn") + '" href="#' + route + '" data-go="' + route + '" style="display:inline-flex;align-items:center;text-decoration:none">' + U().esc(label) + "</a>";
  }

  function moneyNav() {
    return subnav([["money", "Overview"], ["money/transactions", "Transactions"], ["money/bills", "Bills"], ["money/budgets", "Budgets"], ["money/debts", "Debts"], ["money/subs", "Subscriptions"]]);
  }
  function farmNav() {
    return subnav([["farm", "Overview"], ["farm/eggs", "Eggs"], ["farm/sales", "Sales"], ["farm/jobs", "Jobs"], ["farm/expenses", "Expenses"], ["farm/equipment", "Equipment"], ["farm/flock", "Flock"], ["farm/mileage", "Mileage"], ["farm/pl", "P&L"]]);
  }
  function todayNav() {
    return subnav([["today", "Agenda"], ["today/chores", "Chores"], ["today/meals", "Meals"], ["today/shop", "Shopping"]]);
  }

  function widgetTitle(id) {
    const row = Logic().WIDGETS.filter(function (item) { return item[0] === id; })[0];
    return row ? row[1] : id;
  }

  function sizeWord(size) {
    if (size === "sm") return "S";
    if (size === "lg") return "Full";
    return "M";
  }

  function widgetShell(id, size, route, body) {
    const edit = App.editing ? '<div class="edit-tools"><button class="btn grip" type="button" aria-label="Drag to move">Move</button><button class="btn" type="button" data-act="size-widget" data-id="' + id + '" aria-label="Change size">' + sizeWord(size) + '</button><button class="btn" type="button" data-act="hide-widget" data-id="' + id + '">Hide</button></div>' : "";
    const title = route
      ? '<a href="#' + route + '" data-go="' + route + '">' + U().esc(widgetTitle(id)) + "</a>"
      : U().esc(widgetTitle(id));
    return '<article class="card widget size-' + size + '" data-widget="' + id + '"><div class="widget-top"><h3>' + title + "</h3>" + edit + "</div>" + body + "</article>";
  }

  function home() {
    const L = Logic();
    const day = L.today();
    const dash = L.dashboard(App.state, day, App.userId);
    const hour = new Date().getHours();
    const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const name = L.userName(App.state, App.userId);
    const layout = App.layout || L.defaultLayout();
    const shown = layout.filter(function (item) { return item.show; });
    const hidden = layout.filter(function (item) { return !item.show; });
    App._charts = [];
    const cards = shown.map(function (item) { return widgetBody(item, dash, day); }).join("");
    const gallery = hidden.length ? '<div class="gallery"><p class="meta">Add a card</p>' + hidden.map(function (item) {
      return '<button class="btn" type="button" data-act="show-widget" data-id="' + item.id + '">' + U().esc(widgetTitle(item.id)) + "</button>";
    }).join("") + "</div>" : "";
    const tools = App.editing
      ? '<div class="row wrap edit-bar"><button class="primary" type="button" data-act="done-layout">Done</button><button class="btn" type="button" data-act="reset-layout">Reset to default</button></div>' + gallery
      : '<div class="row wrap"><button class="btn" type="button" data-act="edit-layout">Edit layout</button></div>';
    return head(hello + ", " + name, U().esc(U().longDate(day)) + (App.editing ? " · Drag Move. On a phone, press and hold Move." : "")) +
      tools + '<div id="widgets">' + cards + "</div>";
  }

  function widgetBody(item, dash, day) {
    const id = item.id;
    const L = Logic();
    if (id === "vacation") return widgetShell(id, item.size, "vacation", vacationCardInner());
    if (id === "bills") {
      const rows = dash.bills.slice(0, 4).map(function (bill) {
        return '<div class="item"><a class="grow" href="#money/bills" data-go="money/bills"><strong>' + U().esc(bill.bill.name) + "</strong><p class=\"meta\">" + U().esc(L.money(bill.bill.amount)) + " · " + U().esc(U().rel(bill.days)) + "</p></a><button class=\"btn\" type=\"button\" data-act=\"pay-bill\" data-id=\"" + U().esc(bill.bill.id) + "\">Paid</button></div>";
      }).join("") || '<p class="empty">Nothing due this week.</p>';
      return widgetShell(id, item.size, "money/bills", '<div class="list">' + rows + "</div>");
    }
    if (id === "budgets") {
      const rows = (dash.budgets.length ? dash.budgets : L.budgetRows(App.state, dash.month).slice(0, 4)).slice(0, 4).map(function (row) {
        return "<p><strong>" + U().esc(row.name) + "</strong> " + U().chip(row.status === "none" ? "" : row.status, row.status) + "<span class=\"meta\">" + U().esc(L.money(row.spent)) + " of " + U().esc(L.money(row.limit || 0)) + "</span>" + U().bar(row.limit ? row.pct : 0, row.status) + "</p>";
      }).join("") || '<p class="empty">No budgets yet.</p>';
      return widgetShell(id, item.size, "money/budgets", rows);
    }
    if (id === "events") {
      const rows = shownCal(dash.events).slice(0, 5).map(function (ev) {
        return '<a class="item" href="#plan/calendar" data-go="plan/calendar"><div class="grow"><strong>' + U().esc(ev.title) + "</strong><p class=\"meta\">" + U().esc(U().shortDate(ev.date)) + (ev.time ? " · " + U().esc(ev.time) : "") + "</p></div></a>";
      }).join("") || '<p class="empty">Nothing in the next week.</p>';
      return widgetShell(id, item.size, "plan/calendar", '<div class="list">' + rows + "</div>");
    }
    if (id === "chores") {
      const mine = (App.state.chores || []).filter(function (chore) { return chore.status !== "done" && (!chore.assignee || chore.assignee === App.userId); }).slice(0, 5);
      const rows = mine.map(function (chore) {
        return '<label class="checkline item"><input type="checkbox" data-act="toggle-chore" data-id="' + U().esc(chore.id) + '"><span><strong>' + U().esc(chore.title) + "</strong></span></label>";
      }).join("") || '<p class="empty">You are caught up.</p>';
      return widgetShell(id, item.size, "today/chores", '<div class="list">' + rows + "</div>");
    }
    if (id === "goals") {
      const rows = dash.goals.slice(0, 3).map(function (goal) {
        return "<p><strong>" + U().esc(goal.goal.name) + "</strong><span class=\"meta\">" + Math.round(goal.pct * 100) + "%</span>" + U().bar(goal.pct, "") + "</p>";
      }).join("") || '<p class="empty">No open goals.</p>';
      return widgetShell(id, item.size, "plan/goals", rows);
    }
    if (id === "shopping") {
      const rows = (App.state.listItems || []).filter(function (item) { return item.checked !== "yes"; }).slice(0, 5).map(function (item) {
        return '<label class="checkline item"><input type="checkbox" data-act="toggle-item" data-id="' + U().esc(item.id) + '"><span><strong>' + U().esc(item.name) + "</strong></span></label>";
      }).join("") || '<p class="empty">Lists are clear.</p>';
      return widgetShell(id, item.size, "today/shop", '<p class="meta">' + dash.shopping + " still to buy</p><div class=\"list\">" + rows + "</div>");
    }
    if (id === "farm") {
      App._charts.push({ id: "chartEggs", type: "bar", labels: ["Duck", "Chicken", "Quail"], data: [dash.eggs.duck, dash.eggs.chicken, dash.eggs.quail] });
      return widgetShell(id, item.size, "farm", '<div class="stats"><div class="stat"><span>Eggs, 7 days</span><strong>' + dash.eggs.total + '</strong></div><div class="stat"><span>Open jobs</span><strong>' + dash.openJobs.length + "</strong></div></div><div class=\"row wrap\"><button class=\"btn\" type=\"button\" data-act=\"bump-egg\" data-species=\"duck\">+ Duck</button><button class=\"btn\" type=\"button\" data-act=\"bump-egg\" data-species=\"chicken\">+ Chicken</button><button class=\"btn\" type=\"button\" data-act=\"bump-egg\" data-species=\"quail\">+ Quail</button></div><div class=\"chart-box\"><canvas id=\"chartEggs\"></canvas></div>");
    }
    if (id === "money") {
      App._charts.push({ id: "chartFlow", type: "bar", labels: ["Home in", "Home out", "Farm in", "Farm out"], data: [dash.flow.personalIn, dash.flow.personalOut, dash.flow.farmIn, dash.flow.farmOut] });
      return widgetShell(id, item.size, "money", '<div class="stats"><div class="stat"><span>Net worth</span><strong>' + U().esc(L.money(dash.net.net)) + '</strong></div><div class="stat"><span>Farm in</span><strong>' + U().esc(L.money(dash.flow.farmIn)) + "</strong></div></div><div class=\"chart-box\"><canvas id=\"chartFlow\"></canvas></div>");
    }
    if (id === "devices") {
      const devices = (App.devices || []).slice(0, 6).map(function (device) {
        return '<button class="btn" type="button" data-go="devices">' + U().esc(device.name) + " · " + U().esc(deviceLine(device)) + "</button>";
      }).join(" ") || '<p class="empty">No devices yet.</p>';
      return widgetShell(id, item.size, "devices", '<div class="row wrap">' + devices + "</div>" + (App.deviceNote === "demo" ? '<p class="meta">Sample devices. Nothing is sent to the house.</p>' : ""));
    }
    if (id === "weather") return widgetShell(id, item.size, "weather", weatherBody());
    if (id === "upkeep") return widgetShell(id, item.size, "upkeep", upkeepBody(true));
    if (id === "routines") return widgetShell(id, item.size, "routines", routinesBody(true));
    if (id === "wins") return widgetShell(id, item.size, "wins", winsBody(true));
    if (id === "prices") return widgetShell(id, item.size, "farm/prices", pricesBody(true));
    if (id === "tax") return widgetShell(id, item.size, "tax", taxBody(true));
    if (id === "docs") return widgetShell(id, item.size, "docs", docsBody(true));
    return "";
  }

  function vacationCardInner() {
    const L = Logic();
    const trip = L.upcomingTrip(App.state, L.today());
    const count = trip ? L.countdown(trip, new Date()) : null;
    const title = trip ? trip.name : "Plan a trip";
    const where = trip ? (trip.destination || "Destination not set") : "Dates, packing, and who covers the farm";
    return '<a class="countdown-in" href="#vacation" data-go="vacation"><div><strong>' + U().esc(title) + '</strong><p class="meta">' + U().esc(where) + '</p></div><div class="when">' + U().esc(countdownText(count)) + "</div></a>";
  }

  function deviceLine(device) {
    const s = device.status || {};
    if (device.kind === "thermostat") return (s.thermostatMode || "thermostat") + " " + (s.temperature != null && s.temperature !== "" ? s.temperature + "°" : "");
    if (device.kind === "tv") return (s.switch || "off") + (s.volume != null && s.volume !== "" ? " · vol " + s.volume : "");
    if (device.kind === "washer" || device.kind === "dryer") return s.washerState || s.dryerState || "idle";
    if (device.kind === "lock") return s.lock || "lock";
    if (device.kind === "switch") return s.switch || "off";
    if (s.contact) return s.contact;
    return device.health || "";
  }

  function money() {
    const L = Logic();
    const month = App.month || L.monthKey(L.today());
    const net = L.accountSides(App.state.accounts);
    const flow = L.monthFlow(App.state, month);
    const snaps = (App.state.snapshots || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    App._charts = [{
      id: "chartNet", type: "line",
      labels: snaps.map(function (s) { return s.date.slice(0, 7); }).concat(["Now"]),
      data: snaps.map(function (s) { return L.num(s.net); }).concat([net.net])
    }];
    const accounts = (App.state.accounts || []).map(function (acct) {
      const owed = acct.type === "loan" || acct.type === "credit";
      return '<div class="item"><div class="grow"><strong>' + U().esc(acct.name) + "</strong><p class=\"meta\">" + U().esc(acct.institution || acct.type) + " · " + U().chip(acct.book || "Personal", acct.book === "Farm" ? "farm" : "personal") + "</p></div>" + U().amt(owed ? -L.num(acct.balance) : acct.balance) + "</div>";
    }).join("") || '<p class="empty">No accounts yet.</p>';
    return moneyNav() + head("Money", "Personal and farm stay tagged on every transaction.") +
      '<div class="stats"><div class="stat"><span>Net worth</span><strong>' + U().esc(L.money(net.net)) + '</strong></div><div class="stat"><span>Assets</span><strong>' + U().esc(L.money(net.assets)) + '</strong></div><div class="stat"><span>Owed</span><strong>' + U().esc(L.money(net.liabilities)) + '</strong></div><div class="stat"><span>' + U().esc(month) + ' left</span><strong>' + U().esc(L.money(flow.personalIn + flow.farmIn - flow.personalOut - flow.farmOut)) + "</strong></div></div>" +
      '<div class="grid-2"><article class="card"><h3>Accounts</h3><div class="list">' + accounts + '</div><p><button class="btn" type="button" data-act="add-account">Add account</button> <button class="btn" type="button" data-act="save-snapshot">Save net worth snapshot</button></p></article><article class="card"><h3>Net worth</h3><div class="chart-box"><canvas id="chartNet"></canvas></div><p class="meta">Home in ' + U().esc(L.money(flow.personalIn)) + " · out " + U().esc(L.money(flow.personalOut)) + "<br>Farm in " + U().esc(L.money(flow.farmIn)) + " · out " + U().esc(L.money(flow.farmOut)) + "</p></article></div>";
  }

  function transactions(forceBook) {
    const L = Logic();
    const month = App.month || L.monthKey(L.today());
    const book = forceBook || App.bookFilter || "All";
    const rows = (App.state.transactions || []).filter(function (tx) {
      if (!L.inPeriod(tx.date, month)) return false;
      if (book !== "All" && tx.book !== book) return false;
      if (App.txQuery && (tx.payee + " " + tx.memo).toLowerCase().indexOf(App.txQuery.toLowerCase()) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    const list = rows.map(function (tx) {
      const cat = L.byId(App.state.categories, tx.categoryId);
      return '<div class="item"><div class="grow"><strong>' + U().esc(tx.payee || tx.memo || "Transaction") + "</strong><p class=\"meta\">" + U().esc(U().shortDate(tx.date)) + " · " + U().esc((cat && cat.name) || "Uncategorized") + " · " + U().chip(tx.book, tx.book === "Farm" ? "farm" : "personal") + "</p></div><div>" + U().amt(tx.amount) + '<div><button class="btn" type="button" data-act="delete-tx" data-id="' + U().esc(tx.id) + '">Delete</button></div></div></div>';
    }).join("") || '<p class="empty">Nothing in this month for that filter.</p>';
    const books = forceBook ? "" : ["All", "Personal", "Farm"].map(function (name) {
      return '<button class="btn' + (book === name ? " primary" : "") + '" type="button" data-act="book" data-book="' + name + '">' + name + "</button>";
    }).join(" ");
    return (forceBook ? farmNav() : moneyNav()) + head(forceBook ? "Farm expenses and income" : "Transactions", "Tag each one Personal or Farm.") +
      '<div class="row wrap"><label class="field"><span>Month</span><input id="monthPick" type="month" value="' + U().esc(month) + '"></label>' + books + '<button class="primary" type="button" data-act="add-tx" data-book="' + U().esc(forceBook || "Personal") + '">Add</button><button class="btn" type="button" data-act="pick-csv">Import CSV</button><button class="btn" type="button" data-act="snap-receipt">Snap receipt</button></div>' +
      '<form class="search-box" data-act="noop"><input id="txQuery" placeholder="Search payee or memo" value="' + U().esc(App.txQuery || "") + '"></form>' +
      '<div class="list">' + list + "</div>";
  }

  function bills() {
    const L = Logic();
    const day = L.today();
    const rows = (App.state.bills || []).map(function (bill) {
      const view = L.billView(bill, App.state.billPayments, day);
      const who = L.userName(App.state, bill.assignedTo);
      return '<article class="item"><div class="grow"><strong>' + U().esc(bill.name) + "</strong><p class=\"meta\">" + U().esc(L.money(bill.amount)) + " · " + U().esc(view.due ? U().shortDate(view.due) + " · " + U().rel(view.days) : "no open due date") + " · " + U().esc(who) + "</p><p>" + U().chip(view.status, view.status) + (bill.autopay === "yes" ? U().chip("Autopay", "ok") : "") + U().chip(bill.book, bill.book === "Farm" ? "farm" : "personal") + "</p></div><button class=\"primary\" type=\"button\" data-act=\"pay-bill\" data-id=\"" + U().esc(bill.id) + "\">Mark paid</button></article>";
    }).join("") || '<p class="empty">No bills yet.</p>';
    return moneyNav() + head("Bills", "Due dates also show on the calendar.") + '<p><button class="primary" type="button" data-act="add-bill">Add bill</button></p><div class="list">' + rows + "</div>";
  }

  function budgets() {
    const L = Logic();
    const month = L.monthKey(L.today());
    const rows = L.budgetRows(App.state, month);
    const html = rows.map(function (row) {
      return '<article class="card"><div class="row" style="justify-content:space-between"><strong>' + U().esc(row.name) + "</strong>" + U().chip(row.book, row.book === "Farm" ? "farm" : "personal") + "</div><p class=\"meta\">" + U().esc(L.money(row.spent)) + " of " + U().esc(L.money(row.limit || 0)) + "</p>" + U().bar(row.limit ? row.pct : 0, row.status) + '<p><button class="btn" type="button" data-act="edit-budget" data-id="' + U().esc(row.id) + '">Change budget</button></p></article>';
    }).join("") || '<p class="empty">Add an expense category with a monthly amount.</p>';
    return moneyNav() + head("Budgets", U().esc(month) + " · alerts start at 80%.") + '<p><button class="primary" type="button" data-act="add-category">Add category</button></p><div class="grid-2">' + html + "</div>";
  }

  function debts() {
    const L = Logic();
    const day = L.today();
    const cards = (App.state.debts || []).map(function (debt) {
      const plan = L.payoff(debt.principal, debt.apr, debt.payment);
      const when = plan.never ? "This payment does not cover the interest." : "Paid off about " + U().shortDate(L.payoffDate(day, plan.months)) + " · interest " + L.money(plan.interest);
      return '<article class="card"><h3>' + U().esc(debt.name) + "</h3><p>" + U().esc(L.money(debt.principal)) + " at " + U().esc(debt.apr) + "% · " + U().esc(L.money(debt.payment)) + "/month</p><p>" + U().chip(debt.book, debt.book === "Farm" ? "farm" : "personal") + "</p><p>" + U().esc(when) + '</p><button class="btn" type="button" data-act="edit-debt" data-id="' + U().esc(debt.id) + '">Update</button></article>';
    }).join("") || '<p class="empty">No debts recorded.</p>';
    return moneyNav() + head("Debts and loans", "The payoff uses the balance, rate, and payment on the card. Net worth uses accounts.") + '<p><button class="primary" type="button" data-act="add-debt">Add debt</button></p><div class="grid-2">' + cards + "</div>";
  }

  function subs() {
    const L = Logic();
    let monthly = 0;
    const rows = (App.state.subscriptions || []).map(function (sub) {
      const each = L.subscriptionMonthly(sub);
      if (String(sub.active) !== "no") monthly += each;
      return '<div class="item"><div class="grow"><strong>' + U().esc(sub.name) + "</strong><p class=\"meta\">" + U().esc(L.money(sub.amount)) + " " + U().esc(sub.cadence) + " · next " + U().esc(U().shortDate(sub.nextDate)) + "</p></div>" + U().amt(-each) + "</div>";
    }).join("") || '<p class="empty">No subscriptions yet.</p>';
    return moneyNav() + head("Subscriptions", "About " + L.money(monthly) + " a month.") + '<p><button class="primary" type="button" data-act="add-sub">Add subscription</button></p><div class="list">' + rows + "</div>";
  }

  function farm() {
    const L = Logic();
    const day = L.today();
    const month = L.monthKey(day);
    const eggs = L.eggTotals(App.state.eggs, month + "-01", day);
    const pl = L.farmPL(App.state, month);
    const open = (App.state.jobs || []).filter(function (job) { return job.status !== "paid" && job.status !== "cancelled"; });
    const flock = (App.state.flock || []).filter(function (bird) { return bird.status !== "sold" && bird.status !== "lost"; });
    return farmNav() + head("CW Johnson Farms", "Lillington, NC · eggs and tractor work") +
      '<div class="stats"><div class="stat"><span>Duck eggs</span><strong>' + eggs.duck + '</strong></div><div class="stat"><span>Chicken</span><strong>' + eggs.chicken + '</strong></div><div class="stat"><span>Quail</span><strong>' + eggs.quail + '</strong></div><div class="stat"><span>Month profit</span><strong>' + U().esc(L.money(pl.profit)) + "</strong></div></div>" +
      '<div class="tiles"><a class="tile" href="#farm/jobs" data-go="farm/jobs"><strong>Jobs</strong><span>' + open.length + ' open</span></a><a class="tile" href="#farm/eggs" data-go="farm/eggs"><strong>Egg log</strong><span>Duck, chicken, quail</span></a><a class="tile" href="#farm/pl" data-go="farm/pl"><strong>Profit and loss</strong><span>' + U().esc(L.money(pl.income)) + " in</span></a></div>" +
      '<article class="card"><h3>Flock</h3><p>' + flock.map(function (bird) { return U().esc(bird.count + " " + bird.breed + " " + bird.species); }).join(" · ") + "</p></article>";
  }

  function eggs() {
    const L = Logic();
    const day = L.today();
    const from = L.addDays(day, -13);
    const rows = (App.state.eggs || []).filter(function (row) { return row.date >= from; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    const byDay = {};
    rows.forEach(function (row) {
      if (!byDay[row.date]) byDay[row.date] = { duck: 0, chicken: 0, quail: 0 };
      if (byDay[row.date][row.species] != null) byDay[row.date][row.species] += L.num(row.count);
    });
    const dates = [];
    for (let i = 13; i >= 0; i--) dates.push(L.addDays(day, -i));
    App._charts = [{
      id: "chartEggDays", type: "bar", stacked: true, labels: dates.map(function (d) { return d.slice(5); }),
      sets: ["duck", "chicken", "quail"].map(function (species) {
        return { label: species, data: dates.map(function (d) { return (byDay[d] && byDay[d][species]) || 0; }) };
      })
    }];
    const list = rows.slice(0, 21).map(function (row) {
      return '<div class="item"><div class="grow"><strong>' + U().esc(row.species) + "</strong><p class=\"meta\">" + U().esc(U().shortDate(row.date)) + "</p></div><strong>" + U().esc(row.count) + "</strong></div>";
    }).join("");
    return farmNav() + head("Egg log", "A tap adds one egg for today.") +
      '<div class="row wrap"><button class="primary" type="button" data-act="bump-egg" data-species="duck">+ Duck</button><button class="primary" type="button" data-act="bump-egg" data-species="chicken">+ Chicken</button><button class="primary" type="button" data-act="bump-egg" data-species="quail">+ Quail</button><button class="btn" type="button" data-act="add-eggs">Enter a count</button></div>' +
      '<article class="card"><div class="chart-box"><canvas id="chartEggDays"></canvas></div></article><div class="list">' + (list || '<p class="empty">No eggs logged in the last two weeks.</p>') + "</div>";
  }

  function sales() {
    const L = Logic();
    const rows = (App.state.eggSales || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (sale) {
      const customer = L.byId(App.state.customers, sale.customerId);
      return '<div class="item"><div class="grow"><strong>' + U().esc((customer && customer.name) || sale.notes || sale.species) + "</strong><p class=\"meta\">" + U().esc(U().shortDate(sale.date)) + " · " + U().esc(sale.dozens) + " dozen " + U().esc(sale.species) + "</p></div>" + U().amt(sale.total) + "</div>";
    }).join("") || '<p class="empty">No egg sales yet.</p>';
    return farmNav() + head("Egg sales") + '<p><button class="primary" type="button" data-act="add-sale">Record a sale</button> <button class="btn" type="button" data-act="add-customer">Add customer</button></p><div class="list">' + rows + "</div>" + customers(true);
  }

  function customers(embedded) {
    const rows = (App.state.customers || []).map(function (customer) {
      return '<div class="item"><div class="grow"><strong>' + U().esc(customer.name) + "</strong><p class=\"meta\">" + U().esc(customer.phone || customer.email || customer.kind || "") + "</p></div>" + U().chip(customer.kind || "both", "farm") + "</div>";
    }).join("") || '<p class="empty">No customers yet.</p>';
    if (embedded) return '<h3 style="margin-top:16px">Customers</h3><div class="list">' + rows + "</div>";
    return farmNav() + head("Customers") + '<p><button class="primary" type="button" data-act="add-customer">Add customer</button></p><div class="list">' + rows + "</div>";
  }

  function jobs() {
    const L = Logic();
    const rows = (App.state.jobs || []).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).map(function (job) {
      return '<a class="item" href="#farm/job/' + U().esc(job.id) + '" data-go="farm/job/' + U().esc(job.id) + '"><div class="grow"><strong>' + U().esc(job.number || "Job") + " · " + U().esc(job.customerName || "Customer") + "</strong><p class=\"meta\">" + U().esc(L.serviceName(job.service)) + " · " + U().esc(U().shortDate(job.date)) + "</p></div><div>" + U().chip(job.status, job.status === "paid" ? "ok" : job.status === "invoiced" ? "soon" : "farm") + "<div class=\"right\">" + U().esc(L.money(job.amount)) + "</div></div></a>";
    }).join("") || '<p class="empty">No jobs yet.</p>';
    return farmNav() + head("Tractor jobs", "Driveways, bush hogging, grading, brush, and stumps.") + '<p><button class="primary" type="button" data-act="add-job">New job or quote</button> <button class="btn" type="button" data-act="open-quote">Quote calculator</button></p><div class="list">' + rows + "</div>";
  }

  function jobDetail(id) {
    const L = Logic();
    const job = L.byId(App.state.jobs, id);
    if (!job) return head("Job") + '<p class="empty">That job is not on this phone.</p>';
    const customer = L.byId(App.state.customers, job.customerId);
    return farmNav() + head(job.number + " · " + (job.customerName || "Job"), L.serviceName(job.service)) +
      '<article class="card"><p>' + U().chip(job.status, job.status === "paid" ? "ok" : "soon") + "</p><p>" + U().esc(U().longDate(job.date)) + "</p><p>" + U().esc(job.address || "") + "</p><p>" + U().esc(job.description || "") + "</p><p>" + U().esc(job.hours || 0) + " h · " + U().esc(L.money(job.rate)) + "/h · <strong>" + U().esc(L.money(job.amount)) + "</strong></p><p class=\"meta\">" + U().esc((customer && customer.phone) || "") + "</p><div class=\"row wrap\"><button class=\"primary\" type=\"button\" data-act=\"print-job\" data-id=\"" + U().esc(job.id) + "\">Print invoice</button>" + (job.status !== "paid" ? '<button class="btn" type="button" data-act="pay-job" data-id="' + U().esc(job.id) + '">Mark paid</button>' : "") + '<button class="btn" type="button" data-act="edit-job" data-id="' + U().esc(job.id) + '">Edit</button></div></article>';
  }

  function equipment() {
    const L = Logic();
    const cards = (App.state.equipment || []).map(function (item) {
      const logs = (App.state.serviceLogs || []).filter(function (row) { return row.equipmentId === item.id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      const last = logs[0];
      return '<article class="card"><h3>' + U().esc(item.name) + "</h3><p>" + U().chip(item.status, item.status === "ready" ? "ok" : "warn") + " " + U().esc(item.hours || 0) + ' h</p><p class="meta">' + U().esc(last ? "Last: " + last.what + " · " + U().shortDate(last.date) : "No service logged") + '</p><button class="btn" type="button" data-act="add-service" data-id="' + U().esc(item.id) + '">Log service</button></article>';
    }).join("");
    return farmNav() + head("Equipment") + '<p><button class="primary" type="button" data-act="add-equip">Add equipment</button></p><div class="grid-2">' + (cards || '<p class="empty">Add the tractor and implements.</p>') + "</div>";
  }

  function flock() {
    const rows = (App.state.flock || []).map(function (bird) {
      return '<div class="item"><div class="grow"><strong>' + U().esc(bird.count + " " + bird.breed) + "</strong><p class=\"meta\">" + U().esc(bird.species) + " · " + U().esc(bird.status) + "</p></div></div>";
    }).join("") || '<p class="empty">No birds recorded.</p>';
    return farmNav() + head("Flock") + '<p><button class="primary" type="button" data-act="add-flock">Add birds</button></p><div class="list">' + rows + "</div>";
  }

  function mileage() {
    const L = Logic();
    const year = String(L.today()).slice(0, 4);
    const rows = (App.state.mileage || []).filter(function (row) { return L.inPeriod(row.date, year); });
    const settings = (App.state.settings || [])[0] || {};
    const value = L.mileageValue(rows, settings.mileageRate);
    const list = rows.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (row) {
      return '<div class="item"><div class="grow"><strong>' + U().esc(row.purpose || row.vehicle) + "</strong><p class=\"meta\">" + U().esc(U().shortDate(row.date)) + " · " + U().esc(row.vehicle) + "</p></div><div class=\"right\">" + U().esc(row.miles) + " mi<br>" + U().esc(row.hours || 0) + " h</div></div>";
    }).join("") || '<p class="empty">No trips this year.</p>';
    return farmNav() + head("Mileage and hours", value.miles + " miles · about " + L.money(value.deduction) + " at the IRS business rate. Hours are tractor time, not mileage.") + '<p><button class="primary" type="button" data-act="add-miles">Add a trip</button></p><div class="list">' + list + "</div>";
  }

  function profit() {
    const L = Logic();
    const year = App.taxYear || String(L.today()).slice(0, 4);
    const pl = L.farmPL(App.state, year);
    const months = [];
    for (let m = 1; m <= 12; m++) months.push(year + "-" + (m < 10 ? "0" : "") + m);
    App._charts = [{
      id: "chartPl", type: "bar", labels: months.map(function (month) { return month.slice(5); }),
      sets: [
        { label: "Income", data: months.map(function (month) { return L.farmPL(App.state, month).income; }) },
        { label: "Expense", data: months.map(function (month) { return L.farmPL(App.state, month).expense; }) }
      ]
    }];
    const lines = pl.lines.map(function (line) {
      return "<tr><td>" + U().esc(line.kind) + "</td><td>" + U().esc(line.category) + "</td><td class=\"right\">" + U().esc(L.money(line.amount)) + "</td></tr>";
    }).join("") || "<tr><td colspan=\"3\">No farm money in " + U().esc(year) + ".</td></tr>";
    return farmNav() + head("Farm profit and loss", "Cash basis. A sale that already has a transaction is counted once.") +
      '<div class="stats"><div class="stat"><span>Income</span><strong>' + U().esc(L.money(pl.income)) + '</strong></div><div class="stat"><span>Expenses</span><strong>' + U().esc(L.money(pl.expense)) + '</strong></div><div class="stat"><span>Profit</span><strong>' + U().esc(L.money(pl.profit)) + "</strong></div></div>" +
      '<article class="card"><div class="chart-box"><canvas id="chartPl"></canvas></div></article>' +
      '<table><thead><tr><th>Type</th><th>Category</th><th class="right">Amount</th></tr></thead><tbody>' + lines + '</tbody></table>' +
      '<p><label class="field"><span>Tax year</span><input id="taxYear" type="number" min="2000" max="2100" value="' + U().esc(year) + '"></label></p>' +
      '<p><button class="primary" type="button" data-act="export-tax">Download tax CSV</button></p>';
  }

  function agenda() {
    const L = Logic();
    const day = L.today();
    const items = shownCal(L.calendarEntries(App.state, day, L.addDays(day, 14)));
    const list = items.map(function (item) {
      return '<div class="item"><div class="grow"><strong>' + U().esc(item.title) + "</strong><p class=\"meta\">" + U().esc(U().shortDate(item.date)) + (item.time ? " · " + U().esc(item.time) : "") + "</p></div>" + U().chip(item.source, item.source === "job" ? "farm" : item.source === "bill" ? "soon" : "") + "</div>";
    }).join("") || '<p class="empty">Clear for the next two weeks.</p>';
    return todayNav() + head("Next two weeks") + '<div class="list">' + list + "</div>";
  }

  function chores() {
    const L = Logic();
    const open = (App.state.chores || []).filter(function (chore) { return chore.status !== "done"; });
    const done = (App.state.chores || []).filter(function (chore) { return chore.status === "done"; }).slice(-5).reverse();
    function row(chore, finished) {
      const who = L.userName(App.state, chore.assignee);
      return '<div class="item"><label class="checkline grow"><input type="checkbox" data-act="toggle-chore" data-id="' + U().esc(chore.id) + '"' + (finished ? " checked" : "") + '><span class="' + (finished ? "done" : "") + '"><strong>' + U().esc(chore.title) + "</strong><span class=\"meta\">" + U().esc(who) + (chore.dueDate ? " · " + U().esc(U().shortDate(chore.dueDate)) : "") + " · " + U().esc(chore.cadence || "once") + "</span></span></label></div>";
    }
    return todayNav() + head("Chores") + '<p><button class="primary" type="button" data-act="add-chore">Add chore</button></p><div class="list">' + (open.map(function (chore) { return row(chore, false); }).join("") || '<p class="empty">All caught up.</p>') + "</div><h3>Recently done</h3><div class=\"list\">" + done.map(function (chore) { return row(chore, true); }).join("") + "</div>";
  }

  function meals() {
    const L = Logic();
    const day = L.today();
    const days = [];
    for (let i = 0; i < 7; i++) days.push(L.addDays(day, i));
    const html = days.map(function (date) {
      const slots = ["breakfast", "lunch", "dinner"].map(function (slot) {
        const meal = (App.state.meals || []).find(function (item) { return item.date === date && item.slot === slot; });
        if (!meal) return '<p class="meta">' + slot + ' · <button class="btn" type="button" data-act="add-meal" data-date="' + date + '" data-slot="' + slot + '">Add</button></p>';
        const ingredients = (App.state.mealItems || []).filter(function (item) { return item.mealId === meal.id; });
        return '<p><strong>' + U().esc(slot) + "</strong> · " + U().esc(meal.title) + "</p>" + (ingredients.length ? '<p class="meta">' + U().esc(ingredients.map(function (item) { return item.name; }).join(", ")) + '</p><button class="btn" type="button" data-act="push-grocery" data-id="' + U().esc(meal.id) + '">Add ingredients to grocery</button>' : '<p><button class="btn" type="button" data-act="add-ingredient" data-id="' + U().esc(meal.id) + '">Add ingredients</button></p>');
      }).join("");
      return '<article class="card"><h3>' + U().esc(U().shortDate(date)) + "</h3>" + slots + "</article>";
    }).join("");
    return todayNav() + head("Meals", "Push a dinner's ingredients onto the grocery list.") + '<div class="grid-2">' + html + "</div>";
  }

  function shop() {
    const lists = App.state.lists || [];
    const current = lists.find(function (list) { return list.id === App.listId; }) || lists[0];
    App.listId = current ? current.id : "";
    const tabs = lists.map(function (list) {
      return '<button class="btn' + (current && list.id === current.id ? " primary" : "") + '" type="button" data-act="pick-list" data-id="' + U().esc(list.id) + '">' + U().esc(list.name) + "</button>";
    }).join(" ");
    const items = (App.state.listItems || []).filter(function (item) { return current && item.listId === current.id; });
    const groups = {};
    items.forEach(function (item) {
      const key = item.aisle || "Other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    const html = Object.keys(groups).sort().map(function (aisle) {
      const rows = groups[aisle].map(function (item) {
        return '<label class="checkline item"><input type="checkbox" data-act="toggle-item" data-id="' + U().esc(item.id) + '"' + (item.checked === "yes" ? " checked" : "") + '><span class="grow ' + (item.checked === "yes" ? "done" : "") + '"><strong>' + U().esc(item.name) + "</strong><span class=\"meta\">" + U().esc(item.qty || "") + (item.staple === "yes" ? " · staple" : "") + "</span></span></label>";
      }).join("");
      return "<h3>" + U().esc(aisle) + '</h3><div class="list">' + rows + "</div>";
    }).join("") || '<p class="empty">This list is empty.</p>';
    return todayNav() + head(current ? current.name : "Shopping", "Both phones share this list once the sheet is connected. Pull to refresh, or it checks every half minute.") +
      '<div class="row wrap">' + tabs + '<button class="btn" type="button" data-act="add-list">New list</button></div>' +
      (current ? '<form class="add-row" data-act="add-item"><input id="itemName" name="name" placeholder="Add an item" required><input name="aisle" placeholder="Aisle"><input name="qty" placeholder="Qty"><button class="primary" type="submit">Add</button></form><div class="row wrap"><button class="btn" type="button" data-act="restock">Restock staples</button><button class="btn" type="button" data-act="clear-checked">Clear checked</button></div>' : "") +
      html;
  }

  function safeColor(value) {
    return /^#[0-9A-Fa-f]{6}$/.test(String(value || "")) ? value : "";
  }

  function shownCal(items) {
    const hide = App.calHide || {};
    return items.filter(function (item) {
      if (item.source === "google" || item.source === "gcal") return !hide[item.calId || ""];
      return !hide.hub;
    });
  }

  function calLegend() {
    const hide = App.calHide || {};
    const chips = ['<button type="button" class="btn cal-key' + (hide.hub ? " off" : "") + '" data-act="toggle-cal-view" data-id="hub"><i style="background:#1f6b3a"></i>Family Hub</button>'];
    (App.state.calendars || []).forEach(function (cal) {
      if (String(cal.enabled) === "no") return;
      const color = safeColor(cal.color) || "#3c7ea6";
      chips.push('<button type="button" class="btn cal-key' + (hide[cal.calendarId] ? " off" : "") + '" data-act="toggle-cal-view" data-id="' + U().esc(cal.calendarId) + '"><i style="background:' + color + '"></i>' + U().esc(cal.name || cal.calendarId) + "</button>");
    });
    return '<div class="row wrap cal-legend">' + chips.join("") + "</div>";
  }

  function eventLine(item) {
    const color = safeColor(item.color);
    const swatch = color ? '<i class="swatch" style="background:' + color + '"></i>' : "";
    const title = item.readOnly && item.link
      ? '<a href="' + U().esc(item.link) + '" target="_blank" rel="noopener">' + U().esc(item.title) + "</a>"
      : "<strong>" + U().esc(item.title) + "</strong>";
    const meta = U().esc(item.time || "") + (item.category ? " · " + U().esc(item.category) : "") + (item.readOnly ? " · Google" : "");
    return '<div class="item">' + swatch + '<div class="grow">' + title + '<p class="meta">' + meta + "</p></div></div>";
  }

  function calendar() {
    const L = Logic();
    const month = App.calMonth || L.monthKey(L.today());
    const mode = App.calMode || "agenda";
    const modes = ["month", "week", "agenda"].map(function (name) {
      return '<button class="btn' + (mode === name ? " primary" : "") + '" type="button" data-act="cal-mode" data-mode="' + name + '">' + name + "</button>";
    }).join(" ");
    let body = "";
    if (mode === "month") {
      const cells = L.monthGrid(month);
      const from = cells[0].date;
      const to = cells[cells.length - 1].date;
      const items = shownCal(L.calendarEntries(App.state, from, to));
      body = '<div class="cal"><span class="dow">Sun</span><span class="dow">Mon</span><span class="dow">Tue</span><span class="dow">Wed</span><span class="dow">Thu</span><span class="dow">Fri</span><span class="dow">Sat</span>' + cells.map(function (cell) {
        const mine = items.filter(function (item) { return item.date === cell.date; }).slice(0, 3);
        const on = cell.date === (App.calDay || L.today()) ? " on" : "";
        return '<button type="button" class="' + (cell.inMonth ? "" : "off") + on + '" data-act="cal-day" data-date="' + cell.date + '"><strong>' + Number(cell.date.slice(8)) + '</strong><span class="dots">' + mine.map(function (item) { const color = safeColor(item.color); return '<i class="' + (item.source === "bill" ? "bill" : item.source === "job" ? "job" : item.source === "trip" ? "trip" : "") + '"' + (color ? ' style="background:' + color + '"' : "") + "></i>"; }).join("") + "</span></button>";
      }).join("") + "</div>";
      const picked = items.filter(function (item) { return item.date === (App.calDay || L.today()); });
      body += '<h3>' + U().esc(U().longDate(App.calDay || L.today())) + "</h3><div class=\"list\">" + (picked.map(eventLine).join("") || '<p class="empty">Nothing that day.</p>') + "</div>";
    } else if (mode === "week") {
      const anchor = App.calDay || L.today();
      const days = L.weekDays(anchor);
      const items = shownCal(L.calendarEntries(App.state, days[0], days[6]));
      body = days.map(function (date) {
        const mine = items.filter(function (item) { return item.date === date; });
        return '<article class="card"><h3>' + U().esc(U().shortDate(date)) + "</h3>" + (mine.map(function (item) { return "<p>" + U().esc(item.title) + "</p>"; }).join("") || '<p class="muted">Clear</p>') + "</article>";
      }).join("");
      body = '<div class="grid-2">' + body + "</div>";
    } else {
      const anchor = App.calDay || L.today();
      const items = shownCal(L.calendarEntries(App.state, anchor, L.addDays(anchor, 21)));
      body = '<div class="list">' + (items.map(eventLine).join("") || '<p class="empty">Nothing scheduled.</p>') + "</div>";
    }
    return head("Calendar", "Family Hub items and Google calendars on one page. Google events open in Google and are not edited here.") +
      calLegend() +
      '<div class="row wrap"><button class="btn" type="button" data-act="cal-shift" data-dir="-1">Prev</button><strong>' + U().esc(month) + '</strong><button class="btn" type="button" data-act="cal-shift" data-dir="1">Next</button>' + modes + '<button class="primary" type="button" data-act="add-event">Add event</button><button class="btn" type="button" data-act="cal-sync">Sync Google Calendar</button></div>' + body;
  }

  function goals() {
    const L = Logic();
    const cards = (App.state.goals || []).map(function (goal) {
      const stones = (App.state.milestones || []).filter(function (item) { return item.goalId === goal.id; }).sort(function (a, b) { return L.num(a.sort) - L.num(b.sort); });
      const pct = L.goalProgress(goal, stones);
      const checks = stones.map(function (stone) {
        return '<label class="checkline"><input type="checkbox" data-act="toggle-milestone" data-id="' + U().esc(stone.id) + '"' + (stone.done === "yes" ? " checked" : "") + "><span>" + U().esc(stone.name) + "</span></label>";
      }).join("");
      return '<article class="card"><h3>' + U().esc(goal.name) + "</h3><p>" + U().chip(goal.scope || goal.kind, goal.scope === "shared" ? "ok" : "personal") + " " + U().esc(L.userName(App.state, goal.owner)) + "</p><p>" + U().esc(L.money(goal.currentAmount)) + " of " + U().esc(L.money(goal.targetAmount)) + (goal.targetDate ? " · " + U().esc(U().shortDate(goal.targetDate)) : "") + "</p>" + U().bar(pct, pct >= 1 ? "ok" : "") + checks + '<p><button class="btn" type="button" data-act="add-milestone" data-id="' + U().esc(goal.id) + '">Add milestone</button> <button class="btn" type="button" data-act="edit-goal" data-id="' + U().esc(goal.id) + '">Update</button></p></article>';
    }).join("");
    return head("Goals", "Shared and personal.") + '<p><button class="primary" type="button" data-act="add-goal">Add goal</button></p><div class="grid-2">' + (cards || '<p class="empty">No goals yet.</p>') + "</div>";
  }

  function projects() {
    const rows = (App.state.projects || []).map(function (project) {
      return '<a class="tile" href="#plan/project/' + U().esc(project.id) + '" data-go="plan/project/' + U().esc(project.id) + '"><strong>' + U().esc(project.name) + "</strong><span>" + U().esc(project.area) + " · " + U().esc(project.status) + "</span></a>";
    }).join("");
    return head("Projects") + '<p><button class="primary" type="button" data-act="add-project">Add project</button></p><div class="tiles">' + (rows || '<p class="empty">No projects yet.</p>') + "</div>";
  }

  function project(id) {
    const L = Logic();
    const item = L.byId(App.state.projects, id);
    if (!item) return head("Project") + '<p class="empty">That project is not here.</p>';
    const tasks = (App.state.tasks || []).filter(function (task) { return task.projectId === id; });
    const list = tasks.map(function (task) {
      return '<label class="checkline item"><input type="checkbox" data-act="toggle-task" data-id="' + U().esc(task.id) + '"' + (task.status === "done" ? " checked" : "") + '><span class="' + (task.status === "done" ? "done" : "") + '"><strong>' + U().esc(task.title) + "</strong><span class=\"meta\">" + U().esc(L.userName(App.state, task.assignee)) + (task.dueDate ? " · " + U().esc(U().shortDate(task.dueDate)) : "") + "</span></span></label>";
    }).join("") || '<p class="empty">No tasks yet.</p>';
    return head(item.name, (item.area || "") + " · budget " + L.money(item.budget || 0) + " · spent " + L.money(item.spent || 0)) + '<p>' + U().esc(item.notes || "") + '</p><p><button class="primary" type="button" data-act="add-task" data-id="' + U().esc(item.id) + '">Add task</button></p><div class="list">' + list + "</div>";
  }

  function devices() {
    const list = App.devices || [];
    const cards = list.map(function (device) { return deviceCard(device); }).join("") || '<p class="empty">No devices loaded.</p>';
    const note = App.deviceNote === "demo"
      ? "These are sample devices so you can see the controls. Commands stay on this phone."
      : (App.deviceError || "Live devices come through the Google script. The token stays in Script properties.");
    return head("House", note) +
      '<p><button class="btn" type="button" data-act="device-refresh">Refresh devices</button></p>' +
      '<div class="grid-2">' + cards + "</div>" + blinkPanel();
  }

  function deviceCard(device) {
    const s = device.status || {};
    let controls = "";
    if (device.kind === "thermostat") {
      controls = modeButtons(device, "thermostatMode", "setThermostatMode", ["off", "heat", "cool", "auto"]) +
        stepper(device, "Heat", s.heatingSetpoint, "thermostatHeatingSetpoint", "setHeatingSetpoint") +
        stepper(device, "Cool", s.coolingSetpoint, "thermostatCoolingSetpoint", "setCoolingSetpoint") +
        modeButtons(device, "thermostatFanMode", "setThermostatFanMode", ["auto", "on", "circulate"]);
    } else if (device.kind === "tv") {
      controls = cmd(device, s.switch === "on" ? "Turn off" : "Turn on", "switch", s.switch === "on" ? "off" : "on") +
        cmd(device, "Volume down", "audioVolume", "volumeDown") +
        cmd(device, "Volume up", "audioVolume", "volumeUp") +
        cmd(device, s.mute === "muted" ? "Unmute" : "Mute", "audioMute", s.mute === "muted" ? "unmute" : "mute") +
        ["HDMI1", "HDMI2", "TV"].map(function (input) { return cmd(device, input, "mediaInputSource", "setInputSource", input); }).join("");
    } else if (device.kind === "washer" || device.kind === "dryer") {
      controls = '<p class="meta">Status only. Starting a cycle stays on the washer, where Smart Control has to be on.</p>';
    } else if (device.kind === "switch") {
      controls = cmd(device, s.switch === "on" ? "Turn off" : "Turn on", "switch", s.switch === "on" ? "off" : "on");
    } else if (device.kind === "lock") {
      controls = cmd(device, s.lock === "locked" ? "Unlock" : "Lock", "lock", s.lock === "locked" ? "unlock" : "lock");
    }
    const remain = remaining(s.completionTime);
    return '<article class="card device"><h3>' + U().esc(device.name) + "</h3><p>" + U().chip(device.health || "DEMO", device.health === "OFFLINE" ? "over" : "ok") + " " + U().esc(deviceLine(device)) + (remain ? " · " + U().esc(remain) : "") + '</p><div class="controls">' + controls + "</div></article>";
  }

  function cmd(device, label, capability, command, argument) {
    return '<button class="btn" type="button" data-act="device-cmd" data-id="' + U().esc(device.id) + '" data-capability="' + U().esc(capability) + '" data-command="' + U().esc(command) + '" data-argument="' + U().esc(argument || "") + '" data-label="' + U().esc(label + " · " + device.name) + '">' + U().esc(label) + "</button>";
  }

  function modeButtons(device, capability, command, values) {
    return values.map(function (value) { return cmd(device, value, capability, command, value); }).join("");
  }

  function stepper(device, label, current, capability, command) {
    const n = Number(current || 0);
    return '<span class="meta">' + U().esc(label) + " " + U().esc(current || "—") + "</span>" +
      cmd(device, label + " -", capability, command, String(n - 1)) +
      cmd(device, label + " +", capability, command, String(n + 1));
  }

  function remaining(iso) {
    if (!iso) return "";
    const ms = Date.parse(iso) - Date.now();
    if (!isFinite(ms)) return "";
    if (ms <= 0) return "done";
    const minutes = Math.round(ms / 60000);
    const h = Math.floor(minutes / 60);
    return h ? h + "h " + (minutes % 60) + "m left" : minutes + "m left";
  }

  function blinkPanel() {
    const blink = App.blink || { configured: false };
    let body = '<p>Blink has no official public API. This block is optional and experimental. A failure here does not affect the rest of Family Hub. The email, password, and token stay in the script, not in this page.</p>';
    body += '<p><a class="primary" style="display:inline-flex;align-items:center;text-decoration:none" href="https://play.google.com/store/apps/details?id=com.immediasemi.android.blink">Open the Blink app</a></p>';
    if (App.mode !== "live") {
      body += '<p class="meta">Connect the Google Sheet before signing in. Sample mode does not call Blink.</p>';
    } else if (!blink.configured) {
      body += '<p>Add BLINK_EMAIL and BLINK_PASSWORD in Script properties, then redeploy a new version.</p>';
    } else if (blink.needsPin) {
      body += '<form class="stack" data-act="blink-verify"><p>' + U().esc(blink.message || "Enter the PIN Blink sent.") + "</p>" + U().field("PIN", "pin", "", "text") + '<button class="primary" type="submit">Verify PIN</button></form>';
    } else if (!blink.signedIn) {
      body += '<p>' + U().esc(blink.error || "") + '</p><button class="btn" type="button" data-act="blink-login">Sign in to Blink</button>';
    } else {
      body += (blink.networks || []).map(function (network) {
        return '<p><strong>' + U().esc(network.name) + "</strong> · " + (network.armed ? "armed" : "disarmed") + '</p><div class="row wrap"><button class="btn" type="button" data-act="blink-arm" data-op="arm" data-network="' + U().esc(network.id) + '">Arm</button><button class="btn" type="button" data-act="blink-arm" data-op="disarm" data-network="' + U().esc(network.id) + '">Disarm</button></div>';
      }).join("");
      body += (blink.cameras || []).map(function (cam) {
        return '<div class="item"><div class="grow"><strong>' + U().esc(cam.name) + '</strong></div><button class="btn" type="button" data-act="blink-thumb" data-network="' + U().esc(cam.networkId) + '" data-camera="' + U().esc(cam.id) + '">Thumbnail</button></div>';
      }).join("");
      if (blink.preview) body += '<img class="thumb" alt="Latest Blink thumbnail" src="' + blink.preview + '">';
      if (blink.error) body += '<p>' + U().esc(blink.error) + "</p>";
    }
    return '<section class="experimental"><h3>Blink cameras · experimental</h3>' + body + "</section>";
  }

  function countdownText(count) {
    if (!count) return "No trip on the books";
    const bits = [];
    if (count.days) bits.push(count.days + (count.days === 1 ? " day" : " days"));
    if (count.hours || !bits.length) bits.push(count.hours + (count.hours === 1 ? " hour" : " hours"));
    const label = bits.join(", ");
    return count.phase === "there" ? label + " until you're home" : label;
  }

  function vacationCard() {
    const L = Logic();
    const day = L.today();
    const trip = L.upcomingTrip(App.state, day);
    const count = trip ? L.countdown(trip, new Date()) : null;
    const title = trip ? trip.name : "Plan a trip";
    const where = trip ? (trip.destination || "") : "Dates, packing, and who covers the farm";
    return '<a class="card countdown" href="#vacation" data-go="vacation"><div><p class="eyebrow">' + (count && count.phase === "there" ? "On the trip" : "Next trip") + "</p><h3>" + U().esc(title) + "</h3><p class=\"meta\">" + U().esc(where) + "</p></div><div class=\"when\">" + U().esc(countdownText(count)) + "</div></a>";
  }

  function vacations() {
    const L = Logic();
    const day = L.today();
    const rows = (App.state.trips || []).slice().sort(function (a, b) { return String(b.startDate).localeCompare(String(a.startDate)); });
    const upcoming = rows.filter(function (trip) { return trip.endDate >= day; });
    const past = rows.filter(function (trip) { return trip.endDate < day; });
    function card(trip) {
      const spent = L.tripSpent(App.state, trip);
      return '<a class="item" href="#vacation/trip/' + U().esc(trip.id) + '" data-go="vacation/trip/' + U().esc(trip.id) + '"><div class="grow"><strong>' + U().esc(trip.name) + "</strong><p class=\"meta\">" + U().esc(trip.destination || "") + " · " + U().esc(U().shortDate(trip.startDate)) + " – " + U().esc(U().shortDate(trip.endDate)) + "</p></div><div class=\"right\">" + U().esc(L.money(spent)) + "<br><span class=\"meta\">of " + U().esc(L.money(trip.budget || 0)) + "</span></div></a>";
    }
    const templates = (App.state.templates || []).map(function (tpl) {
      const n = (App.state.templateItems || []).filter(function (item) { return item.templateId === tpl.id; }).length;
      return '<div class="item"><div class="grow"><strong>' + U().esc(tpl.name) + "</strong><p class=\"meta\">" + U().esc(tpl.kind) + " · " + n + " items</p></div></div>";
    }).join("") || '<p class="empty">No templates yet.</p>';
    return head("Vacations", "Upcoming and past trips. Dates also show on the calendar.") +
      '<p><button class="primary" type="button" data-act="add-trip">Add trip</button> <button class="btn" type="button" data-act="add-template">Add checklist template</button></p>' +
      "<h3>Upcoming</h3><div class=\"list\">" + (upcoming.map(card).join("") || '<p class="empty">Nothing planned.</p>') + "</div>" +
      "<h3>Past</h3><div class=\"list\">" + (past.map(card).join("") || '<p class="empty">No past trips yet.</p>') + "</div>" +
      "<h3>Checklist templates</h3><div class=\"list\">" + templates + "</div>";
  }

  function tripDetail(id) {
    const L = Logic();
    const trip = L.byId(App.state.trips, id);
    if (!trip) return head("Trip") + '<p class="empty">That trip is not on this phone.</p>';
    const spent = L.tripSpent(App.state, trip);
    const budget = L.num(trip.budget);
    const who = String(trip.travelers || "").split(",").filter(Boolean).map(function (person) { return L.userName(App.state, person.trim()); }).join(", ");
    const stops = (App.state.itinerary || []).filter(function (row) { return row.tripId === id; }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return String(a.time).localeCompare(String(b.time));
    });
    const days = {};
    stops.forEach(function (stop) {
      const key = stop.date || "Unscheduled";
      if (!days[key]) days[key] = [];
      days[key].push(stop);
    });
    const plan = Object.keys(days).map(function (date) {
      const lines = days[date].map(function (stop) {
        return "<p><strong>" + U().esc(stop.kind) + "</strong> · " + U().esc(stop.time || "") + " " + U().esc(stop.title) + (stop.confirmation ? " · #" + U().esc(stop.confirmation) : "") + (stop.address ? "<br><span class=\"meta\">" + U().esc(stop.address) + "</span>" : "") + (stop.notes ? "<br><span class=\"meta\">" + U().esc(stop.notes) + "</span>" : "") + "</p>";
      }).join("");
      return "<h3>" + U().esc(date === "Unscheduled" ? date : U().longDate(date)) + "</h3>" + lines;
    }).join("") || '<p class="empty">No plans for the days yet.</p>';
    const groups = {};
    (App.state.tripItems || []).filter(function (item) { return item.tripId === id; }).forEach(function (item) {
      const key = item.listName || item.kind || "List";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    const lists = Object.keys(groups).map(function (name) {
      const rows = groups[name].map(function (item) {
        const person = item.assignee ? " · " + L.userName(App.state, item.assignee) : "";
        return '<label class="checkline item"><input type="checkbox" data-act="toggle-trip-item" data-id="' + U().esc(item.id) + '"' + (item.done === "yes" ? " checked" : "") + '><span class="' + (item.done === "yes" ? "done" : "") + '">' + U().esc(item.text) + '<span class="meta">' + U().esc(item.kind || "") + person + "</span></span></label>";
      }).join("");
      return "<h3>" + U().esc(name) + "</h3><div class=\"list\">" + rows + "</div>";
    }).join("") || '<p class="empty">No checklist yet. Apply a template or add an item.</p>';
    const templateOptions = (App.state.templates || []).map(function (tpl) { return [tpl.id, tpl.name]; });
    return '<p><a href="#vacation" data-go="vacation">All trips</a></p>' +
      head(trip.name, U().esc(trip.destination || "") + " · " + U().esc(U().shortDate(trip.startDate)) + " – " + U().esc(U().shortDate(trip.endDate)) + (trip.departTime ? " · leave " + U().esc(trip.departTime) : "")) +
      '<article class="card"><p>' + U().esc(who || "No travelers yet") + "</p><p>" + U().esc(L.money(spent)) + " spent of " + U().esc(L.money(budget)) + (String(trip.trackMoney) === "yes" ? " · from Money" : "") + "</p>" + U().bar(budget ? spent / budget : 0, budget && spent > budget ? "over" : "") + "<p>" + U().esc(trip.notes || "") + '</p><div class="row wrap"><button class="btn" type="button" data-act="edit-trip" data-id="' + U().esc(trip.id) + '">Edit</button><button class="btn" type="button" data-act="add-trip-expense" data-id="' + U().esc(trip.id) + '">Add expense</button></div></article>' +
      '<p><button class="primary" type="button" data-act="add-stop" data-id="' + U().esc(trip.id) + '">Add to the itinerary</button></p>' + plan +
      '<p><button class="primary" type="button" data-act="add-trip-item" data-id="' + U().esc(trip.id) + '">Add checklist item</button></p>' +
      (templateOptions.length ? '<form class="add-row" data-act="apply-template"><input type="hidden" name="tripId" value="' + U().esc(trip.id) + '">' + U().select("Template", "templateId", templateOptions[0][0], templateOptions) + '<button class="btn" type="submit">Apply</button></form>' : "") +
      lists;
  }

  function weatherNow() {
    if (App.weather && App.weather.periods) return App.weather;
    const periods = [{ name: "Today", temp: 58, unit: "F", forecast: "Sunny" }, { name: "Tonight", temp: 34, unit: "F", forecast: "Clear and cold" }];
    const report = { place: "Lillington, NC", periods: periods, alerts: [], sample: true };
    report.care = Logic().weatherCare(report);
    return report;
  }

  function weatherBody() {
    const report = weatherNow();
    const rows = (report.periods || []).slice(0, 3).map(function (period) {
      return "<p><strong>" + U().esc(period.name) + "</strong> " + U().esc(period.temp) + "°" + U().esc(period.unit || "F") + " · " + U().esc(period.forecast || "") + "</p>";
    }).join("");
    const alerts = (report.alerts || []).map(function (alert) { return "<p>" + U().chip(alert.event || "Alert", "over") + " " + U().esc(alert.headline || "") + "</p>"; }).join("");
    const care = (report.care || []).map(function (note) { return "<p>" + U().esc(note) + "</p>"; }).join("");
    return (report.sample ? '<p class="meta">Sample forecast for Lillington. The live card uses the National Weather Service.</p>' : "") + rows + alerts + care;
  }

  function weatherPage() {
    return head("Weather", "Lillington, NC") + '<article class="card">' + weatherBody() + '</article><p><button class="btn" type="button" data-act="refresh-weather">Refresh forecast</button></p>';
  }

  function upkeepBody(compact) {
    const L = Logic();
    const day = L.today();
    const rows = (App.state.upkeep || []).map(function (item) {
      const view = L.upkeepView(item, day);
      return '<div class="item"><div class="grow"><strong>' + U().esc(item.name) + "</strong><p class=\"meta\">" + U().esc(item.kind) + (view.due ? " · " + U().esc(U().shortDate(view.due)) : "") + (view.next !== "" ? " · next " + U().esc(view.next) : "") + "</p></div>" + U().chip(view.status, view.status === "overdue" ? "over" : view.status === "soon" ? "soon" : "ok") + (compact ? "" : '<button class="btn" type="button" data-act="log-upkeep" data-id="' + U().esc(item.id) + '">Done</button>') + "</div>";
    }).join("");
    return '<div class="list">' + (rows || '<p class="empty">Nothing on the maintenance list.</p>') + "</div>";
  }

  function upkeepPage() {
    return head("Upkeep", "House, truck, and tractor. Due dates show on the calendar.") + '<p><button class="primary" type="button" data-act="add-upkeep">Add reminder</button></p>' + upkeepBody(false);
  }

  function routinesBody(compact) {
    const rows = (App.state.routines || []).filter(function (scene) { return scene.active !== "no"; }).map(function (scene) {
      return '<button class="btn" type="button" data-act="run-routine" data-id="' + U().esc(scene.id) + '">' + U().esc(scene.name) + "</button>";
    }).join(" ");
    return '<div class="row wrap">' + (rows || '<p class="empty">No scenes yet.</p>') + "</div>" + (compact ? '<p class="meta">Asks before it changes the house.</p>' : "");
  }

  function routinesPage() {
    return head("Routines", "One tap runs the saved SmartThings steps, and Blink if that scene includes it. You confirm first.") + '<p><button class="primary" type="button" data-act="add-routine">Add scene</button></p>' + routinesBody(false);
  }

  function winsBody(compact) {
    const L = Logic();
    const goals = (App.state.goals || []).filter(function (goal) { return goal.status !== "done" || true; }).slice(0, compact ? 3 : 12);
    const bars = goals.map(function (goal) {
      const stones = (App.state.milestones || []).filter(function (item) { return item.goalId === goal.id; });
      const pct = L.goalProgress(goal, stones);
      return "<p><strong>" + U().esc(goal.name) + "</strong> · " + U().esc(L.userName(App.state, goal.owner)) + " " + Math.round(pct * 100) + "%" + U().bar(pct, pct >= 1 ? "ok" : "") + "</p>";
    }).join("");
    const history = (App.state.wins || []).slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, compact ? 2 : 20).map(function (win) {
      return '<div class="item"><div class="grow"><strong>' + U().esc(win.title) + '</strong><p class="meta">' + U().esc(U().shortDate(win.date)) + "</p></div></div>";
    }).join("");
    return bars + '<div class="list">' + history + "</div>";
  }

  function winsPage() {
    return head("Wins", "Shared progress for both of you.") + winsBody(false);
  }

  function pricesBody() {
    const L = Logic();
    const day = L.today();
    const settings = (App.state.settings || [])[0] || {};
    const prices = L.eggPrices(App.state, L.addDays(day, -30), day, settings.eggMargin);
    return ["duck", "chicken", "quail"].map(function (species) {
      const row = prices[species];
      return "<p><strong>" + species + "</strong> · " + U().esc(L.money(row.perDozen)) + "/doz cost · suggest " + U().esc(L.money(row.suggested)) + "</p>";
    }).join("") + '<p class="meta">Feed over 30 days ' + U().esc(L.money(prices.feedCost)) + ", margin " + U().esc(prices.margin) + "%.</p>";
  }

  function pricesPage() {
    return farmNav() + head("Egg prices", "Cost per dozen from feed spending and the eggs you logged. The suggestion adds your margin.") + '<article class="card">' + pricesBody() + "</article>";
  }

  function taxBody() {
    const L = Logic();
    const year = String(L.today()).slice(0, 4);
    const settings = (App.state.settings || [])[0] || {};
    const rate = settings.taxRate === "" || settings.taxRate == null ? 15 : settings.taxRate;
    const pl = L.farmPL(App.state, year);
    const tax = L.farmTax(pl.profit, rate);
    const lines = L.scheduleF(App.state, year).map(function (line) {
      return "<p>Line " + U().esc(line.line) + " · " + U().esc(line.kind) + " · " + U().esc(L.money(line.amount)) + "</p>";
    }).join("") || "<p>No farm lines yet.</p>";
    return '<p><strong>' + U().esc(L.money(tax)) + "</strong> estimated on " + U().esc(L.money(pl.profit)) + " farm profit at " + U().esc(rate) + "%.</p>" + lines;
  }

  function taxPage() {
    return head("Quarterly tax", "A planning estimate, not a filing. Due dates are on the calendar: April 15, June 15, September 15, and January 15.") +
      '<article class="card">' + taxBody() + '</article><p><button class="btn" type="button" data-act="export-schedule-f">Schedule F CSV</button></p>';
  }

  function docsBody(compact) {
    const L = Logic();
    const day = L.today();
    const rows = (App.state.docs || []).slice(0, compact ? 4 : 40).map(function (doc) {
      const soon = doc.expires && doc.expires <= L.addDays(day, 30);
      return '<div class="item"><div class="grow"><strong>' + U().esc(doc.name) + "</strong><p class=\"meta\">" + U().esc(doc.category) + (doc.expires ? " · " + U().esc(U().shortDate(doc.expires)) : "") + "</p></div>" + (soon ? U().chip("Soon", "soon") : "") + (doc.link ? '<a class="btn" href="' + U().esc(doc.link) + '" target="_blank" rel="noopener">Open</a>' : "") + "</div>";
    }).join("");
    return '<div class="list">' + (rows || '<p class="empty">No documents yet.</p>') + "</div>";
  }

  function docsPage() {
    return head("Documents", "Links and expiration dates only. Do not put account numbers or policy numbers in the notes.") + '<p><button class="primary" type="button" data-act="add-doc">Add document</button> <button class="btn" type="button" data-act="upload-doc">Upload a file</button></p>' + docsBody(false);
  }

  function rulesPage() {
    const L = Logic();
    const rows = (App.state.merchantRules || []).map(function (rule) {
      const cat = L.byId(App.state.categories, rule.categoryId);
      return '<div class="item"><div class="grow"><strong>' + U().esc(rule.pattern) + "</strong><p class=\"meta\">" + U().esc((cat && cat.name) || "Uncategorized") + " · " + U().esc(rule.book) + "</p></div></div>";
    }).join("") || '<p class="empty">No merchant rules yet. Imports stay Personal until you add one.</p>';
    return moneyNav() + head("Bank rules", "When a transaction is imported, the longest matching merchant name sets the category and Personal or Farm.") +
      '<p><button class="primary" type="button" data-act="add-rule">Add rule</button></p><div class="list">' + rows + "</div>";
  }

  function more() {
    const tiles = [
      ["plan/calendar", "Calendar", "Month, week, and agenda"],
      ["vacation", "Vacations", "Trips, packing, and the farm"],
      ["plan/goals", "Goals", "Shared and personal"],
      ["plan/projects", "Projects", "Home and farm tasks"],
      ["devices", "House", "Thermostats, TV, laundry"],
      ["routines", "Routines", "Away, home, bedtime"],
      ["upkeep", "Upkeep", "House, truck, tractor"],
      ["docs", "Documents", "Links and expiration dates"],
      ["wins", "Wins", "Goals you have hit"],
      ["farm/prices", "Egg prices", "Cost per dozen"],
      ["tax", "Quarterly tax", "Farm estimate"],
      ["money/rules", "Bank rules", "Merchant categories"],
      ["settings", "Settings", "Names, backup, digest"],
      ["search", "Search", "Find a bill, job, or list"]
    ];
    return head("More") + '<div class="tiles">' + tiles.map(function (tile) {
      return '<a class="tile" href="#' + tile[0] + '" data-go="' + tile[0] + '"><strong>' + tile[1] + "</strong><span>" + tile[2] + "</span></a>";
    }).join("") + "</div>";
  }

  function settings() {
    const row = (App.state.settings || [])[0] || {};
    const L = Logic();
    return head("Settings", "The access code and device tokens are not stored in this page.") +
      '<form class="card stack" data-act="save-settings">' +
      U().field("Randy's name", "randyName", row.randyName || "Randy Johnson") +
      U().field("Second person", "partnerName", row.partnerName || "Partner") +
      '<p class="meta">The second name is yours to set. Sample data says Partner until you change it.</p>' +
      U().field("Farm name", "farmName", row.farmName || "CW Johnson Farms LLC") +
      U().field("Location", "location", row.location || "Lillington, NC") +
      U().field("Digest emails", "digestEmails", row.digestEmails || "") +
      U().field("Digest hour (0-23)", "digestHour", row.digestHour == null ? 6 : row.digestHour, "number") +
      U().field("Google Calendar id", "calendarId", row.calendarId || "") +
      U().select("Calendar sync", "calendarSync", row.calendarSync || "off", [["off", "Off"], ["push", "Push Family Hub to Google"], ["both", "Both ways"]]) +
      '<p class="meta">Push still uses the one calendar id above. Import reads every calendar listed below, plus GOOGLE_CALENDAR_IDS.</p>' +
      U().field("Mileage rate override", "mileageRate", row.mileageRate || "") +
      '<p class="meta">Leave the rate blank to use the 2026 IRS business rates: 72.5¢ per mile through June 30 and 76¢ after that. A number here replaces both.</p>' +
      U().field("Bill reminder, days ahead", "billLeadDays", row.billLeadDays === "" || row.billLeadDays == null ? 3 : row.billLeadDays, "number") +
      U().field("Farm tax estimate %", "taxRate", row.taxRate === "" || row.taxRate == null ? 15 : row.taxRate, "number") +
      U().field("Egg price margin %", "eggMargin", row.eggMargin === "" || row.eggMargin == null ? 50 : row.eggMargin, "number") +
      U().field("Equipment wear $ per hour", "wearRate", row.wearRate === "" || row.wearRate == null ? 8 : row.wearRate, "number") +
      '<p><button class="btn" type="button" data-act="enable-notifications">Allow phone notifications</button></p>' +
      '<button class="primary" type="submit">Save settings</button></form>' +
      calendarSettings() +
      '<form class="card stack" data-act="save-url"><h3>Google Sheet</h3>' +
      U().field("Web app URL", "url", (function () { try { return localStorage.getItem("hub-script-url") || ""; } catch (e) { return ""; } })()) +
      '<p class="meta">Paste the /exec address from Apps Script. It is saved on this phone only. Leave it blank and save to go back to sample data. To use the same address on every phone, also paste it into index.html where it says HUB_SCRIPT_URL.</p>' +
      '<button class="primary" type="submit">Save sheet address</button></form>' +
      '<article class="card stack"><h3>Backup</h3><div class="row wrap"><button class="btn" type="button" data-act="export-json">Download JSON</button><button class="btn" type="button" data-act="export-tx">Transactions CSV</button><button class="btn" type="button" data-act="export-tax">Farm tax CSV</button></div>' +
      (App.mode === "live" ? '<button class="btn" type="button" data-act="test-digest">Send digest now</button>' : '<button class="btn" type="button" data-act="reset-sample">Reset sample data</button>') +
      '<p class="meta">' + (App.mode === "live" ? "This phone is sharing the Google Sheet." : "Sample data is stored only on this phone.") + "</p></article>";
  }

  function calendarSettings() {
    const rows = (App.state.calendars || []).map(function (cal) {
      const on = String(cal.enabled) !== "no";
      const color = safeColor(cal.color) || "#3c7ea6";
      return '<div class="item"><i class="swatch" style="background:' + color + '"></i><div class="grow"><strong>' + U().esc(cal.name || cal.calendarId) + '</strong><p class="meta">' + U().esc(cal.calendarId) + " · " + U().esc(cal.owner || "shared") + '</p></div><button class="btn" type="button" data-act="toggle-gcal" data-id="' + U().esc(cal.id) + '">' + (on ? "On" : "Off") + "</button></div>";
    }).join("") || '<p class="empty">None yet. Add a calendar id, or set GOOGLE_CALENDAR_IDS on the script.</p>';
    return '<article class="card stack"><h3>Google calendars</h3><p class="meta">Events from these calendars show with Family Hub. Turn one off to stop importing it. Google events stay read-only here.</p><div class="list">' + rows + '</div><form class="stack" data-act="add-gcal">' +
      U().field("Calendar id", "calendarId", "") +
      U().field("Name", "name", "") +
      U().select("Whose", "owner", "shared", [["shared", "Shared"]].concat(U().userOptions(App.state))) +
      U().field("Color", "color", "#3c7ea6") +
      '<button class="primary" type="submit">Add calendar</button></form><p><button class="btn" type="button" data-act="cal-sync">Sync now</button></p></article>';
  }

  function search() {
    const hits = Logic().searchAll(App.state, App.query || "");
    const list = hits.map(function (hit) {
      return '<a class="item" href="#' + hit.route + '" data-go="' + hit.route + '"><div class="grow"><strong>' + U().esc(hit.title) + '</strong><p class="meta">' + U().esc(hit.kind) + " · " + U().esc(hit.sub) + "</p></div></a>";
    }).join("") || '<p class="empty">Type at least two letters.</p>';
    return head("Search") + '<form class="search-box" data-act="noop"><input id="q" placeholder="Bills, jobs, lists, goals" value="' + U().esc(App.query || "") + '"></form><div id="searchResults" class="list">' + list + "</div>";
  }

  function login() {
    return head("Sign in", "Enter the household access code, then pick who is holding the phone.") +
      '<form class="card stack" data-act="login">' + U().field("Access code", "code", "", "password") +
      '<button class="primary" type="submit">Continue</button><p class="meta">The code is checked by the Google script. It is not saved in this project.</p></form>';
  }

  function page() {
    if (App.needsCode) return login();
    const route = App.route || "home";
    if (route === "home") return home();
    if (route === "money") return money();
    if (route === "money/transactions") return transactions();
    if (route === "money/bills") return bills();
    if (route === "money/budgets") return budgets();
    if (route === "money/debts") return debts();
    if (route === "money/subs") return subs();
    if (route === "money/rules") return rulesPage();
    if (route === "farm") return farm();
    if (route === "farm/eggs") return eggs();
    if (route === "farm/sales" || route === "farm/customers") return route === "farm/customers" ? customers(false) : sales();
    if (route === "farm/jobs") return jobs();
    if (route.indexOf("farm/job/") === 0) return jobDetail(route.slice("farm/job/".length));
    if (route === "farm/expenses") return transactions("Farm");
    if (route === "farm/equipment") return equipment();
    if (route === "farm/flock") return flock();
    if (route === "farm/mileage") return mileage();
    if (route === "farm/pl") return profit();
    if (route === "farm/prices") return pricesPage();
    if (route === "today") return agenda();
    if (route === "today/chores") return chores();
    if (route === "today/meals") return meals();
    if (route === "today/shop") return shop();
    if (route === "plan/calendar") return calendar();
    if (route === "vacation") return vacations();
    if (route.indexOf("vacation/trip/") === 0) return tripDetail(route.slice("vacation/trip/".length));
    if (route === "plan/goals") return goals();
    if (route === "plan/projects") return projects();
    if (route.indexOf("plan/project/") === 0) return project(route.slice("plan/project/".length));
    if (route === "devices") return devices();
    if (route === "routines") return routinesPage();
    if (route === "upkeep") return upkeepPage();
    if (route === "docs") return docsPage();
    if (route === "wins") return winsPage();
    if (route === "tax") return taxPage();
    if (route === "weather") return weatherPage();
    if (route === "settings") return settings();
    if (route === "search") return search();
    if (route === "more") return more();
    return head("Family Hub") + more();
  }

  function modal() {
    if (!App.modal) return "";
    return '<div class="modal-back" id="modalBack"><div class="modal' + (App.modal.wide ? " wide" : "") + '" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><h3 id="modalTitle">' + U().esc(App.modal.title) + "</h3>" + App.modal.html + "</div></div>";
  }

  globalThis.HubView = { page: page, modal: modal, deviceLine: deviceLine };
})();
