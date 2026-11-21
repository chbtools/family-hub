const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const L = require("../js/logic.js");
const Sample = require("../js/sample.js");

const DAY = "2026-11-21";

function sample() {
  return Sample.build(DAY);
}

test("sample household is a full state with relative dates", () => {
  const state = sample();
  Object.keys(L.FIELDS).forEach((name) => {
    assert.ok(Array.isArray(state[name]), name);
  });
  assert.equal(state.users[0].name, "Randy Johnson");
  assert.equal(state.settings[0].farmName, "CW Johnson Farms LLC");
  assert.equal(state.settings[0].location, "Lillington, NC");
  const overdue = state.bills.find((b) => b.id === "bill_ins");
  const view = L.billView(overdue, state.billPayments, DAY);
  assert.equal(view.status, "overdue");
  assert.equal(view.due, "2026-11-19");
  const soon = L.billView(state.bills.find((b) => b.id === "bill_elec"), state.billPayments, DAY);
  assert.equal(soon.status, "soon");
  assert.equal(soon.due, "2026-11-24");
  const phone = L.billView(state.bills.find((b) => b.id === "bill_phone"), state.billPayments, DAY);
  assert.equal(phone.due, "2026-12-03");
  assert.equal(phone.status, "later");
});

test("budgets flag groceries under the limit and can go over", () => {
  const state = sample();
  const rows = L.budgetRows(state, "2026-11");
  const groc = rows.find((r) => r.id === "cat_groceries");
  assert.ok(groc.spent > 0);
  assert.equal(groc.limit, 600);
  assert.equal(groc.status, "ok");
  state.transactions.push({
    id: "tx_big", date: "2026-11-02", accountId: "acct_joint", amount: -700, type: "expense",
    categoryId: "cat_groceries", book: "Personal", payee: "Stock up", memo: "", refType: "", refId: "", createdBy: "user_randy", createdAt: DAY
  });
  const over = L.budgetRows(state, "2026-11").find((r) => r.id === "cat_groceries");
  assert.equal(over.status, "over");
});

test("a month budget overrides the category default", () => {
  const state = sample();
  state.budgets.push({ id: "bud1", categoryId: "cat_feed", month: "2026-11", amount: 50 });
  assert.equal(L.budgetAmount(state, "cat_feed", "2026-11"), 50);
  assert.equal(L.budgetAmount(state, "cat_feed", "2026-12"), 180);
});

test("tractor payoff is finite and a tiny payment never catches up", () => {
  const ok = L.payoff(18400, 6.5, 412);
  assert.equal(ok.never, false);
  assert.ok(ok.months > 40 && ok.months < 80);
  assert.ok(ok.interest > 0);
  const stuck = L.payoff(18400, 6.5, 50);
  assert.equal(stuck.never, true);
  assert.equal(L.payoff(0, 6.5, 412).months, 0);
});

test("personal and farm money stay split", () => {
  const flow = L.monthFlow(sample(), "2026-11");
  assert.ok(flow.farmIn > 0);
  assert.ok(flow.farmOut > 0);
  assert.ok(flow.personalIn > 0);
  assert.ok(flow.personalOut > 0);
  assert.ok(flow.farmIn !== flow.personalIn);
});

test("farm P&L does not count a sale twice when a transaction already exists", () => {
  const state = sample();
  const pl = L.farmPL(state, "2026-11");
  const eggLines = pl.lines.filter((line) => line.category === "Egg sales");
  const eggIncome = eggLines.reduce((s, line) => s + line.amount, 0);
  const txEggs = state.transactions.filter((t) => t.categoryId === "cat_eggs").reduce((s, t) => s + t.amount, 0);
  assert.equal(eggIncome, L.round2(txEggs));
  assert.ok(pl.income > pl.expense);
});

test("net worth treats the tractor loan as a liability", () => {
  const net = L.accountSides(sample().accounts);
  assert.equal(net.liabilities, 18400);
  assert.ok(net.assets > net.liabilities);
  assert.equal(net.net, L.round2(net.assets - net.liabilities));
});

test("calendar shows the bush hog job and the overdue bill, and hides quotes", () => {
  const state = sample();
  state.jobs.push({
    id: "job_quote", number: "JOB-1009", customerId: "", customerName: "Somebody", service: "grading",
    status: "quote", date: "2026-11-22", address: "", description: "", hours: 1, rate: 80, amount: 80,
    mileage: 0, paidDate: "", notes: "", assignedTo: "", transactionId: ""
  });
  const items = L.calendarEntries(state, "2026-11-01", "2026-11-30");
  assert.ok(items.some((item) => item.source === "job" && item.sourceId === "job_bennett"));
  assert.ok(items.some((item) => item.source === "bill" && item.title.indexOf("Farm insurance") === 0));
  assert.equal(items.some((item) => item.sourceId === "job_quote"), false);
});

test("egg counts by species stay inside the week window", () => {
  const totals = L.eggTotals(sample().eggs, "2026-11-15", "2026-11-21");
  assert.ok(totals.duck > 0 && totals.chicken > 0 && totals.quail > 0);
  assert.equal(totals.total, totals.duck + totals.chicken + totals.quail);
});

test("2026 mileage uses the mid-year IRS rates unless a rate is saved", () => {
  assert.equal(L.irsBusinessRate("2026-03-01"), 0.725);
  assert.equal(L.irsBusinessRate("2026-11-21"), 0.76);
  const rows = [
    { date: "2026-03-01", miles: 10, hours: 0 },
    { date: "2026-11-21", miles: 10, hours: 1 }
  ];
  const value = L.mileageValue(rows, "");
  assert.equal(value.deduction, L.round2(10 * 0.725 + 10 * 0.76));
  assert.equal(L.mileageValue(rows, 0.5).deduction, 10);
});

test("Rocket Money payee falls back and merchant names match across punctuation", () => {
  const text = [
    "Date,Original Date,Account Name,Institution Name,Name,Custom Name,Amount,Description,Category,Note,Ignored From",
    "11/21/2026,11/21/2026,SECU Checking,SECU,WAL-MART #1234,,12.34,POS PURCHASE,Groceries,,,",
    "11/21/2026,11/21/2026,SECU Checking,SECU,,Food Lion,8.00,ignored name,Groceries,,,",
    "11/22/2026,11/22/2026,SECU Checking,SECU,,,4.00,SHELL OIL,Gas,,,"
  ].join("\n");
  const rows = L.importTransactions(text);
  assert.equal(rows[0].payee, "WAL-MART #1234");
  assert.equal(rows[0].amount, -12.34);
  assert.equal(rows[1].payee, "Food Lion");
  assert.equal(rows[2].payee, "SHELL OIL");
  assert.equal(L.payeesSimilar("Walmart", "WAL-MART #1234"), true);
  assert.equal(L.payeesSimilar("Walmart", "POS PURCHASE WAL-MART #1234"), true);
  assert.equal(L.payeesSimilar("Walmart", "SHELL OIL"), false);
});

test("duplicate detection matches a blank payee by amount and date, and keeps same-file repeats", () => {
  const sheet = [{ date: "2026-11-21", amount: -12.34, payee: "WM SUPERCENTER", externalId: "secu-wm" }];
  const blank = L.planCsvImport(sheet, [{ date: "2026-11-21", amount: -12.34, payee: "" }], []);
  assert.equal(blank.skipped.length, 1);
  const named = L.planCsvImport(sheet, [{ date: "2026-11-20", amount: -12.34, payee: "WAL-MART #1234" }], []);
  assert.equal(named.skipped.length, 1);
  const repeats = L.planCsvImport([], [
    { date: "2026-11-21", amount: -4, payee: "Coffee Shop" },
    { date: "2026-11-21", amount: -4, payee: "Hardware" }
  ], []);
  assert.equal(repeats.accepted.length, 2);
  assert.equal(repeats.skipped.length, 0);
  const sameStore = L.planCsvImport([], [
    { date: "2026-11-21", amount: -4, payee: "WAL-MART #1" },
    { date: "2026-11-22", amount: -4, payee: "Walmart" }
  ], []);
  assert.equal(sameStore.accepted.length, 1);
  assert.equal(sameStore.skipped.length, 1);
});

test("a Rocket Money file that only matches with the opposite sign is flipped", () => {
  const existing = [
    { date: "2026-11-01", amount: -10, payee: "A", externalId: "secu-a" },
    { date: "2026-11-02", amount: -20, payee: "B", externalId: "secu-b" },
    { date: "2026-11-03", amount: -30, payee: "C", externalId: "secu-c" }
  ];
  const already = L.planCsvImport(existing, existing.map((row) => ({ date: row.date, amount: row.amount, payee: row.payee, rocket: true })), []);
  assert.equal(already.signNote, "");
  assert.equal(already.skipped.length, 3);
  const backwards = L.planCsvImport(existing, existing.map((row) => ({ date: row.date, amount: -row.amount, payee: row.payee, rocket: true })), []);
  assert.ok(backwards.signNote);
  assert.equal(backwards.skipped.length, 3);
  assert.equal(backwards.accepted.length, 0);
  const plain = L.planCsvImport(existing, existing.map((row) => ({ date: row.date, amount: -row.amount, payee: row.payee })), []);
  assert.equal(plain.signNote, "");
  assert.equal(plain.accepted.length, 3);
});

test("cleanup selection never includes the bank row and starts with nothing checked", () => {
  const txs = [
    { id: "bank1", date: "2026-11-21", amount: -12.34, payee: "WAL-MART #1234", externalId: "secu-x", refType: "import" },
    { id: "csv1", date: "2026-11-21", amount: -12.34, payee: "Walmart", refType: "csv" },
    { id: "csv2", date: "2026-11-21", amount: -9, payee: "Other", refType: "csv", accountId: "acct" }
  ];
  const accounts = [{ id: "acct", source: "bank", name: "SECU" }];
  const pairs = L.duplicatePairs(txs, accounts);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].csvId, "csv1");
  assert.equal(pairs[0].bankId, "bank1");
  assert.deepEqual(L.cleanupIds(pairs, []), []);
  assert.deepEqual(L.cleanupIds(pairs, ["csv1"]), ["csv1"]);
  assert.deepEqual(L.cleanupIds(pairs, ["bank1"]), []);
  assert.deepEqual(L.cleanupIds(pairs, ["csv1", "bank1", "nope"]), ["csv1"]);
  assert.equal(L.duplicatePairs([
    { id: "csvA", refType: "csv", accountId: "acct", date: "2026-11-01", amount: -1, payee: "X" },
    { id: "csvB", refType: "csv", accountId: "acct", date: "2026-11-01", amount: -1, payee: "X" }
  ], accounts).length, 0);
});

test("recurring charges group a merchant, skip ones already tracked, and add only ticked rows", () => {
  const txs = [
    { date: "2026-08-18", amount: -180, type: "expense", payee: "Electric co-op" },
    { date: "2026-09-18", amount: -170, type: "expense", payee: "ELECTRIC CO-OP" },
    { date: "2026-10-18", amount: -190, type: "expense", payee: "Electric co-op" },
    { date: "2026-06-01", amount: -40, type: "expense", payee: "WAL-MART #1234" },
    { date: "2026-07-01", amount: -42, type: "expense", payee: "Walmart" },
    { date: "2026-08-02", amount: -39, type: "expense", payee: "Walmart" },
    { date: "2026-09-01", amount: -400, type: "expense", payee: "Walmart" },
    { date: "2026-01-06", amount: -9, type: "expense", payee: "Gym" },
    { date: "2026-01-13", amount: -9, type: "expense", payee: "Gym" },
    { date: "2026-01-20", amount: -9, type: "expense", payee: "Gym" },
    { date: "2025-11-01", amount: -80, type: "expense", payee: "Domain" },
    { date: "2026-11-02", amount: -80, type: "expense", payee: "Domain" },
    { date: "2026-03-01", amount: -20, type: "expense", payee: "Once" },
    { date: "2026-04-01", amount: -20, type: "expense", payee: "Once" }
  ];
  const found = L.recurringCharges(txs, [], []);
  const electric = found.find((row) => row.merchant === "Electric co-op");
  assert.ok(electric);
  assert.equal(electric.cadence, "monthly");
  assert.equal(electric.suggested, "bill");
  assert.equal(electric.lastDate, "2026-10-18");
  assert.equal(electric.nextDate, "2026-11-18");
  assert.equal(electric.amount, 180);
  const walmart = found.filter((row) => row.cadence === "monthly" && row.amount < 50);
  assert.equal(walmart.length, 1);
  assert.equal(found.some((row) => row.amount === 400), false);
  const gym = found.find((row) => row.merchant === "Gym");
  assert.equal(gym.cadence, "weekly");
  assert.equal(gym.suggested, "subscription");
  assert.equal(gym.nextDate, "2026-01-27");
  const domain = found.find((row) => row.merchant === "Domain");
  assert.equal(domain.cadence, "yearly");
  assert.equal(domain.count, 2);
  assert.equal(found.some((row) => row.merchant === "Once"), false);
  const skipped = L.recurringCharges(txs, [{ name: "Electric co-op", payee: "Lumbee" }], [{ name: "Gym" }]);
  assert.equal(skipped.some((row) => row.merchant === "Electric co-op" || row.merchant === "Gym"), false);
  assert.deepEqual(L.chosenRecurring(found, []), []);
  const picked = L.chosenRecurring(found, [electric.id, gym.id], {});
  assert.deepEqual(picked.map((row) => row.kind), ["bill", "subscription"]);
  const flipped = L.chosenRecurring(found, [electric.id], { [electric.id]: "subscription" });
  assert.equal(flipped.length, 1);
  assert.equal(flipped[0].kind, "subscription");
  assert.equal(L.chosenRecurring(found, ["nope"]).length, 0);
});

test("Rocket Money spending is flipped and duplicates are skipped", () => {
  const text = [
    "Date,Original Date,Account Type,Account Name,Account Number,Institution Name,Name,Custom Name,Amount,Description,Category,Note,Ignored From,Tax Deductible,Extra",
    "11/21/2026,11/19/2026,Checking,SECU Checking 7135,7135,SECU,FOOD LION #12,Food Lion,42.18,GROCERY,Groceries,weekly shop,,,",
    "11/20/2026,11/20/2026,Checking,SECU Checking 7135,7135,SECU,PAYROLL,Payroll,-2400,PAY,Paycheck,payday,,,",
    "11/18/2026,11/18/2026,Checking,SECU Checking 7135,7135,SECU,SKIP ME,Skip Me,9.00,X,Other,hidden,manual,,"
  ].join("\n");
  const rows = L.importTransactions(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].amount, -42.18);
  assert.equal(rows[0].payee, "Food Lion");
  assert.equal(rows[0].memo, "weekly shop");
  assert.equal(rows[0].category, "Groceries");
  assert.equal(rows[0].accountName, "SECU Checking 7135");
  assert.equal(rows[0].institution, "SECU");
  assert.equal(rows[1].amount, 2400);
  assert.equal(rows[1].type, "income");
  const existing = [{ date: "2026-11-20", amount: -42.18, payee: "FOOD LION #12", accountId: "acct_secu", externalId: "secu-abc" }];
  const accounts = [{ id: "acct_secu", name: "SECU Checking 7135" }];
  const planned = L.planCsvImport(existing, rows, accounts);
  assert.equal(planned.accepted.length, 1);
  assert.equal(planned.accepted[0].payee, "Payroll");
  assert.equal(planned.skipped.length, 1);
  const blank = L.planCsvImport(
    [{ date: "2026-11-01", amount: -5, payee: "", accountId: "acct_secu" }],
    [{ date: "2026-11-02", amount: -5, payee: "", accountName: "SECU Checking 7135" }],
    accounts
  );
  assert.equal(blank.skipped.length, 1);
});

test("csv import reads a header row and keeps the farm book", () => {
  const text = "Date,Amount,Payee,Category,Book,Memo\n11/02/2026,-42.50,Southern States,Feed,Farm,scratch\n2026-11-03,18,Market,Egg sales,Personal,\n";
  const rows = L.importTransactions(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].date, "2026-11-02");
  assert.equal(rows[0].amount, -42.5);
  assert.equal(rows[0].book, "Farm");
  assert.equal(rows[1].book, "Personal");
  assert.equal(rows[1].type, "income");
  const round = L.parseCsv(L.toCsv([{ date: "2026-11-01", note: 'say "hi", friend' }], ["date", "note"]));
  assert.equal(round[1][1], 'say "hi", friend');
});

test("search finds the stump job and ignores a one-letter query", () => {
  const hits = L.searchAll(sample(), "stump");
  assert.ok(hits.some((hit) => hit.kind === "Farm job"));
  assert.equal(L.searchAll(sample(), "a").length, 0);
});

test("tax export is farm-only and skips linked sales", () => {
  const rows = L.taxRows(sample(), "2026");
  assert.ok(rows.length > 0);
  assert.equal(rows.some((row) => row.description === "Food Lion"), false);
  const sources = rows.map((row) => row.source);
  assert.ok(sources.includes("job") || sources.includes("eggSale") || sources.includes("transaction"));
  assert.equal(rows.some((row) => row.source === "egg sale"), false);
});

test("dashboard names both people and counts open shopping items", () => {
  const state = sample();
  const dash = L.dashboard(state, DAY, "user_randy");
  assert.equal(dash.people.length, 2);
  assert.ok(dash.shopping >= 1);
  assert.ok(dash.bills.some((b) => b.status === "overdue"));
  assert.ok(dash.openJobs.some((job) => job.status === "invoiced"));
});

test("vacation countdown, spending, and calendar days", () => {
  const state = sample();
  const trip = state.trips.find((row) => row.id === "trip_beach");
  const count = L.countdown(trip, new Date(2026, 10, 21, 8, 0, 0));
  assert.equal(count.phase, "until");
  assert.equal(count.days, 20);
  assert.equal(count.hours, 0);
  assert.equal(L.tripSpent(state, trip), 40);
  const depart = L.calendarEntries(state, trip.startDate, trip.endDate).filter((item) => item.source === "trip");
  assert.equal(depart[0].notes, "depart");
  assert.equal(depart[depart.length - 1].notes, "return");
  assert.ok(depart.length >= 4);
  assert.equal(L.countdown(trip, new Date(2026, 11, 12, 12, 0, 0)).phase, "there");
  assert.equal(L.countdown(trip, new Date(2026, 11, 20, 12, 0, 0)), null);
  assert.ok(L.searchAll(state, "emerald").some((hit) => hit.kind === "Trip"));
});

test("dashboard layout keeps hides and fills in new cards", () => {
  const layout = L.normalizeLayout([
    { id: "bills", size: "lg", show: false },
    { id: "nope", size: "sm", show: true },
    { id: "money", size: "tiny", show: true }
  ]);
  assert.equal(layout.find((row) => row.id === "bills").show, false);
  assert.equal(layout.find((row) => row.id === "bills").size, "lg");
  assert.equal(layout.some((row) => row.id === "nope"), false);
  assert.equal(layout.find((row) => row.id === "money").size, "md");
  assert.equal(layout.length, L.WIDGETS.length);
  const chosen = L.chooseLayout({
    layouts: [{ id: "lay_user_randy", userId: "user_randy", body: JSON.stringify([{ id: "devices", size: "sm", show: true }]), updatedAt: "2026-11-21T00:00:00.000Z" }]
  }, "user_randy", { items: [{ id: "vacation", size: "lg", show: false }], savedAt: "2026-11-22T00:00:00.000Z" });
  assert.equal(chosen[0].id, "vacation");
  assert.equal(chosen[0].show, false);
});

test("bank rules, egg price, quote, and tax dates", () => {
  const state = sample();
  const farm = L.matchRule(state.merchantRules, "SOUTHERN STATES #12");
  assert.equal(farm.book, "Farm");
  assert.equal(farm.categoryId, "cat_feed");
  assert.equal(L.matchRule(state.merchantRules, "Unknown Cafe").book, "Personal");
  const planned = L.planImport(["abc"], [
    { externalId: "abc", date: "2026-11-01", amount: -5, merchant: "Food Lion" },
    { externalId: "new1", date: "2026-11-02", amount: -10, merchant: "Southern States" }
  ], state.merchantRules);
  assert.equal(planned.accepted.length, 1);
  assert.equal(planned.accepted[0].book, "Farm");
  assert.equal(planned.skipped.length, 1);
  const prices = L.eggPrices(state, "2026-10-01", "2026-11-30", 50);
  assert.ok(prices.feedCost > 0);
  assert.ok(prices.chicken.perDozen > 0);
  assert.ok(prices.chicken.suggested > prices.chicken.perDozen);
  const quote = L.jobQuote({ hours: 2, rate: 80, fuel: 15, miles: 10, mileageRate: 0.76, wearRate: 8 });
  assert.equal(quote.total, L.round2(160 + 15 + 7.6 + 16));
  assert.equal(L.farmTax(1000, 15), 150);
  assert.equal(L.farmTax(-20, 15), 0);
  assert.deepEqual(L.quarterDates(2026), ["2026-04-15", "2026-06-15", "2026-09-15", "2027-01-15"]);
  const hvac = state.upkeep.find((row) => row.id === "up_hvac");
  assert.equal(L.upkeepView(hvac, "2026-11-21").status, "soon");
  assert.ok(L.weatherCare({ periods: [{ temp: 30 }], alerts: [] }).length);
  const lines = L.scheduleF(state, "2026");
  assert.ok(lines.some((line) => line.line === "16" && line.kind === "expense"));
});

test("a Google event keeps its calendar color and stays read-only", () => {
  const state = sample();
  const choir = state.events.find((row) => row.id === "ev_choir");
  const items = L.calendarEntries(state, choir.date, choir.date);
  const hit = items.find((item) => item.title === "Choir practice");
  assert.equal(hit.source, "google");
  assert.equal(hit.readOnly, true);
  assert.equal(hit.color, "#3c7ea6");
  assert.equal(hit.calId, "partner@example.com");
});

test("Code.gs collections match the client schema", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
  const block = src.slice(src.indexOf("const COLUMNS"), src.indexOf("const NUMERIC"));
  Object.keys(L.FIELDS).forEach((name) => {
    assert.ok(block.includes(name + ":"), "missing collection " + name);
    L.FIELDS[name].forEach((field) => {
      const re = new RegExp(name + ":\\s*\\[[^\\]]*'" + field + "'");
      assert.ok(re.test(block), name + "." + field);
    });
  });
  assert.equal(src.includes("CHANGE-ME"), false);
  assert.equal(/SMARTTHINGS_TOKEN\s*=\s*['"][^'"]+['"]/.test(src), false);
  assert.equal(src.includes("PropertiesService.getScriptProperties()"), true);
});
