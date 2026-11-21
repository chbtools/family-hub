/* Small HTML helpers. Every value that came from the sheet is escaped. */
(function () {
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function field(label, name, value, type) {
    return '<label class="field"><span>' + esc(label) + '</span><input name="' + esc(name) + '" type="' + esc(type || "text") + '" value="' + esc(value == null ? "" : value) + '"' + (type === "number" ? ' step="0.01" inputmode="decimal"' : "") + "></label>";
  }

  function area(label, name, value) {
    return '<label class="field"><span>' + esc(label) + '</span><textarea name="' + esc(name) + '" rows="3">' + esc(value || "") + "</textarea></label>";
  }

  function select(label, name, value, options) {
    const html = (options || []).map(function (opt) {
      const selected = String(opt[0]) === String(value) ? " selected" : "";
      return '<option value="' + esc(opt[0]) + '"' + selected + ">" + esc(opt[1]) + "</option>";
    }).join("");
    return '<label class="field"><span>' + esc(label) + "</span><select name=\"" + esc(name) + '\">' + html + "</select></label>";
  }

  function chip(text, kind) {
    return '<span class="chip ' + esc(kind || "") + '">' + esc(text) + "</span>";
  }

  function bar(pct, status) {
    const width = Math.max(0, Math.min(100, Math.round((pct || 0) * 100)));
    return '<div class="bar ' + esc(status || "") + '"><span style="width:' + width + '%"></span></div>';
  }

  function amt(n) {
    const value = globalThis.HubLogic.num(n);
    const cls = value < 0 ? "out" : "in";
    return '<span class="amt ' + cls + '">' + esc(globalThis.HubLogic.money(value)) + "</span>";
  }

  function longDate(iso) {
    if (!iso) return "";
    const p = String(iso).split("-");
    const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    if (!isFinite(d.getTime())) return String(iso);
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  }

  function shortDate(iso) {
    if (!iso) return "";
    const p = String(iso).split("-");
    const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    if (!isFinite(d.getTime())) return String(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }

  function rel(days) {
    if (days == null) return "";
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days === -1) return "yesterday";
    if (days > 0) return "in " + days + " days";
    return Math.abs(days) + " days overdue";
  }

  function userOptions(state, extra) {
    const rows = (extra || []).slice();
    (state.users || []).forEach(function (user) {
      if (String(user.active) !== "no") rows.push([user.id, user.name]);
    });
    return rows;
  }

  function categoryOptions(state, kind) {
    return (state.categories || []).filter(function (cat) {
      return String(cat.active) !== "no" && (!kind || cat.kind === kind);
    }).map(function (cat) { return [cat.id, cat.name + " · " + cat.book]; });
  }

  function accountOptions(state) {
    return (state.accounts || []).map(function (acct) { return [acct.id, acct.name]; });
  }

  function buttons(html) {
    return '<div class="row end wrap">' + html + "</div>";
  }

  globalThis.HubUI = {
    esc: esc,
    field: field,
    area: area,
    select: select,
    chip: chip,
    bar: bar,
    amt: amt,
    longDate: longDate,
    shortDate: shortDate,
    rel: rel,
    userOptions: userOptions,
    categoryOptions: categoryOptions,
    accountOptions: accountOptions,
    buttons: buttons
  };
})();
