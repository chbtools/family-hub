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
