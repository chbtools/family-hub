# Family Hub

Household and farm book for Randy Johnson and his wife in Lillington, North Carolina. It covers the house (bills, budgets, lists, meals, chores, goals) and **CW Johnson Farms LLC** (duck, chicken, and quail eggs, plus tractor work: driveway maintenance, bush hogging, grading, brush cleanup, and stump grinding).

It runs in the browser on a phone, a tablet, or a Windows laptop. Until a Google Sheet is connected, it opens with **sample data** saved only on that device, so every screen can be tried right away. The banner says **Sample data** so it is not mistaken for the live household.

After GitHub Pages is turned on, the address is:

**https://chbtools.github.io/family-hub/**

## Add it to the phone

The Fold and the tablet both use Chrome.

1. Open the address above.
2. Tap the menu (three dots) and choose **Add to Home screen** or **Install app**.
3. Name it Family Hub. It then opens full screen, like any other app, and works from the last saved copy if the signal is poor.

On a Windows laptop, open the same address in Chrome or Edge. The sections sit across the top. On a phone they sit along the bottom: Home, Money, Farm, Today, More.

Each person picks their name in the top corner. Randy is already there. The second name starts as **Partner**. Change it under **More → Settings → Second person**. Bills, chores, and jobs can be assigned to either of you.

## What you can do

**Home** is a set of cards: the next trip, bills, money, the farm, chores, shopping, the calendar, budgets, goals, and the house. Tap a title to open that section. On a card you can mark a bill paid, check off a chore or a shopping item, or log eggs. **Edit layout** lets you drag cards (press and hold on a phone or tablet), hide them, and switch each one between small, medium, and full width. Hidden cards come back from the list under the buttons. **Reset to default** restores the original arrangement. The layout is saved for whoever is selected at the top, on this phone and, once the sheet is connected, on the sheet so it follows that person to the other phone. Charts need a network the first time; the numbers still show if it is offline.

**Money** keeps accounts, transactions, categories, and a Personal or Farm tag on every row. There is a monthly budget bar for each expense category (it turns gold near the limit and red when it is over), recurring bills with a due day and an autopay flag, a subscription list, debts with a payoff estimate, savings goals, and a net worth chart. **Add** records a transaction. **Import CSV** reads a file with columns like Date, Amount, Payee, Category, Book, and Memo. **Mark paid** on a bill writes the payment and the expense. Transfers move money between two accounts and stay out of the budget.

**Farm** is the business. Log eggs by species, record sales, keep customers, and write quotes, scheduled jobs, and invoices for tractor work. **Print invoice** uses the browser print dialog (pick Save as PDF if you want a file) and shows the CW Johnson Farms name. Marking a job or an egg sale paid records farm income so it is not counted twice. Equipment has a service log. The flock list tracks birds. Mileage and tractor hours are separate: miles use the 2026 IRS business rate (72.5¢ through June 30, 76¢ after that) unless you type a rate in Settings. **P&L** is cash-basis profit by month and by category. **Download tax CSV** is the year-end file of farm income and expenses, plus a mileage line.

**Today** is the shared agenda, chores, the weekly meal plan, and shopping. A meal can push its ingredients onto the grocery list. Shopping has Grocery, Farm supply, and Hardware, with aisles, a quick add box, and staples. **Restock staples** unchecks the regulars. With the sheet connected, the list refreshes about every 30 seconds, and **Refresh** does it immediately.

**Vacations** starts on Home as the next trip: days and hours until you leave, or until you are home if the trip has started. Tap it for **Vacations** (also under **More**). A trip has dates, destination, who is going, a budget against what you have spent, a day-by-day plan (drive or flight, lodging with a confirmation number, reservations, activities, addresses, notes), and checklists. Packing can be per person. The before-we-leave list covers the house and the farm: feeding, egg collection, the coop, the thermostat, and documents. Checklist templates can be applied to any trip. Turn on **Spent comes from Money** and use **Add expense** when a cost should also be a transaction. Each day of the trip shows on the calendar.

**More** holds the calendar (month, week, and agenda), vacations, goals with milestones, home and farm projects, the house controls, settings, and search. Bill due dates, scheduled farm jobs, and trip days appear on the calendar by themselves. The **+** button is quick add from any screen. **Dark** / **Light** is in the header. Search looks across bills, jobs, lists, and goals. **Download JSON** is a full backup. Transactions and the farm year also export as CSV.

## Bank import

Roo, or any helper you trust, can push SECU transactions once a day. The request is a POST to the same web app URL (`/exec`). It uses `IMPORT_KEY`, not the household access code. Amounts are signed: negative is money spent, positive is money in. Send `Content-Type: text/plain`.

```json
{
  "action": "importTransactions",
  "key": "the IMPORT_KEY you saved in Script properties",
  "transactions": [
    {
      "date": "2026-11-21",
      "amount": -42.18,
      "merchant": "FOOD LION #123",
      "account": "Joint checking",
      "externalId": "secu-txn-99812"
    }
  ]
}
```

`externalId` is required. A repeat of the same id is skipped. The account name is matched to an account in the sheet. The merchant is matched to **More → Bank rules** (the longest matching phrase wins). If nothing matches, the transaction is Personal and uncategorized. A rule can mark a merchant as Farm.

The reply looks like `{ "ok": true, "added": 1, "skipped": 0 }`.

Each imported row stores the bank account name in `accountName`. A bank-synced account (see balances below) does not have its balance changed by these rows.

Balances are a separate POST, also with `IMPORT_KEY`. The balance is stored as a positive number. `source` is set to `bank`, so later transaction imports do not add onto that balance. An account is matched by `externalId`, then by the exact name. If it is new, the book is Personal. Transactions with an empty account and the same stored account name are linked to it.

```json
{
  "action": "importBalances",
  "key": "the IMPORT_KEY you saved in Script properties",
  "accounts": [
    {
      "externalId": "secu-acct-00000000-0000-0000-0000-000000000000",
      "name": "SECU Checking 7135",
      "type": "checking",
      "institution": "SECU",
      "balance": 1234.56
    }
  ]
}
```

The reply is `{ "ok": true, "created": 1, "updated": 0, "relinked": 0 }`. `type` is `checking` or `savings`.

A CSV from the phone can also be Rocket Money. That export lists spending as a positive amount and income as a negative amount, so the importer flips the sign. If most rows line up with transactions already saved only when the sign is the other way, the confirm box says the amounts were reversed. Custom Name is the payee when it is filled in; otherwise Name, then Description. Category is kept, and Note becomes the memo. Rows with Ignored From filled in are skipped. Account Name is used when it matches an account you already have. A row is skipped when the amount matches to the cent and the date is within one day, or within two days when the payee is the same store (Walmart matches WAL-MART #1234). Two different purchases of the same amount on the same day in one file are both kept. **Find duplicates** on Transactions lists imported rows that match a bank row. Nothing is checked. Only the imported rows you tick are deleted, after you confirm the count. The bank row stays.

Optional: put a SimpleFIN Bridge access URL in the script property `SIMPLEFIN_ACCESS_URL`. The daily trigger reads the last 10 days from that URL and imports them the same way. Leave the property blank if Roo is pushing SECU instead.

## The other tools

**Snap receipt** is on Money → Transactions. Take a photo. The script stores it in a private Drive folder named Family Hub Receipts and reads the amount, date, and store when Drive OCR is available. You confirm the category and Personal or Farm before it is saved. In Apps Script, open **Services** (the plus by Services), add **Drive API**, and save. If OCR is not turned on, the photo still saves and you type the amount.

**Bill reminders** email both digest addresses a set number of days before a bill or a document expires. The count is **Bill reminder, days ahead** in Settings (3 if you leave it). **Sunday at 6pm** sends a weekly money summary. While the app is open you can tap **Allow phone notifications** in Settings. Those are browser notifications, not text messages.

**Egg prices** (Farm → Egg prices, or add the card) divides recent feed spending by the dozens collected, by species, and suggests a price using **Egg price margin %**.

**Quote calculator** is on Farm → Jobs. Hours times rate, plus fuel, miles times the mileage rate, plus wear per hour. Save it as a quote or an invoice.

**Quarterly tax** estimates farm profit times **Farm tax estimate %**. It is a planning number, not a return. The calendar shows April 15, June 15, September 15, and January 15. **Schedule F CSV** totals income and expenses by the line number stored on each farm category.

**Routines** are Away, Home, Bedtime, and Vacation. Each is a list of SmartThings commands, plus arm or disarm Blink when you include that. The app asks before it runs them.

**Laundry** is checked about once an hour. When a washer or dryer goes from running to finished, both digest addresses get an email. This needs `SMARTTHINGS_TOKEN`.

**Weather** is a Home card for Lillington from the National Weather Service. Frost, freeze, heat, and storm notes are written for the birds, and the same notes are in the morning digest.

**Upkeep** is the house, the truck, and the tractor, by days, hours, or miles. Marking one done logs the service and moves the next date. Due dates are on the calendar.

**Documents** stores a name, category, owner, expiration, and a link. Upload puts the file in Drive and keeps the link. Do not type policy numbers or account numbers.

**Wins** is the shared view of goals. Hitting a goal amount, or finishing its milestones, records a win and plays a short celebration.

## Script properties and triggers

| Property | Required | What it is |
| --- | --- | --- |
| `ACCESS_CODE` | Yes | The code both phones type |
| `IMPORT_KEY` | For bank import | A different secret for Roo or SimpleFIN. Not the access code |
| `SIMPLEFIN_ACCESS_URL` | No | SimpleFIN access URL, only if you are not pushing transactions yourself |
| `SMARTTHINGS_TOKEN` | For house controls and laundry | Personal access token |
| `BLINK_EMAIL`, `BLINK_PASSWORD` | No | Experimental cameras |
| `DIGEST_EMAILS` | No | Used if Settings has no addresses yet |
| `GOOGLE_CALENDAR_ID` | No | One calendar id. Still used if you only have one |
| `GOOGLE_CALENDAR_IDS` | No | Several calendar ids, separated by commas. `primary` is allowed |

After you add a property, deploy a **new version** of the web app (Deploy → Manage deployments → pencil → Version: New version). The `/exec` address stays the same.

Then in the script editor choose **installTriggers** and click **Run** once. That replaces these timers:

- `familyDigest` every morning at the digest hour
- `billReminders` the same hour, for bills and expiring documents
- `weeklyMoney` Sunday at 6pm
- `simplefinDaily` at 5am (it does nothing if the SimpleFIN URL is empty)
- `laundryWatch` about once an hour
- `importGoogleCalendars` about every 30 minutes

`installDigestTrigger` still works. It runs `installTriggers`.

## Turn on GitHub Pages

A computer is easier for this part. Do it after this project is merged onto `main`.

1. On GitHub, open **chbtools/family-hub**.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Under **Branch**, choose **main** and **/ (root)**, then **Save**.
5. Wait a minute or two. Open **https://chbtools.github.io/family-hub/**.

You can use the app with sample data as soon as that page loads. The sheet is a separate step.

## Connect the Google Sheet

Do this when both of you should see the same bills, lists, and jobs. The sample data on the phone is not copied into the sheet. The sheet starts with the two names, starter categories, and three shopping lists. You add the real accounts yourself.

1. Go to [sheets.google.com](https://sheets.google.com) and create a blank sheet. Name it **Family Hub**.
2. Click **Extensions → Apps Script**.
3. Select everything in the editor and delete it. Paste in the whole `Code.gs` file from this repo. Do not type a password or a token into that file.
4. Click the gear (**Project settings**). Set **Time zone** to `America/New_York`. The morning email uses that clock.
5. On the same settings page, open **Script properties** and add a row:

   | Property | Value |
   | --- | --- |
   | `ACCESS_CODE` | a code you both will remember, for example a short phrase you pick |

   Add the other properties only when you are ready for them. They are listed below. Click **Save script properties**.
6. Back in the editor, click **Save** (the disk icon).
7. In the function dropdown, choose **setup** and click **Run**. Google asks for permission: pick your account, then **Advanced → Go to (project name) → Allow**. Tabs appear for accounts, bills, jobs, and the rest.
8. Click **Deploy → New deployment**. Click the gear and choose **Web app**.
9. Set **Execute as: Me** and **Who has access: Anyone**.
10. Click **Deploy**. Copy the **Web app URL**. It ends in `/exec`. "Anyone" only lets the page reach the script. The access code is what keeps other people out.
11. On the phone, open Family Hub, go to **More → Settings**, paste that URL into **Web app URL**, and tap **Save sheet address**. The page reloads and asks for the access code. Enter it once on each phone, and pick who is holding it.

That Settings box is stored on that phone only. To bake the address into the site so a new phone does not have to paste it:

1. On GitHub, open `index.html` in this repo and click the pencil.
2. Find `window.HUB_SCRIPT_URL = "";` and paste the `/exec` URL between the quotes.
3. Click **Commit changes** onto `main`. Pages picks it up in a minute or two.

Each phone keeps a copy so the lists come up on a weak signal. New saves go to the sheet. If the sheet cannot be reached, the page says so and the change stays on that phone until the sheet answers. A wrong access code works the same way. Pull to the point of the **Refresh** button, or wait; shopping and the rest reload about every half minute while the app is open.

On the sheet, you can sort and filter. Do not rename the tabs or the header row. New columns are added at the end when a newer script runs. Change balances and lists from the app.

### Script properties

| Property | Required | What it is |
| --- | --- | --- |
| `ACCESS_CODE` | Yes | The shared code. Never put this in the repo or in an email. |
| `PARTNER_NAME` | No | Second person's name, used only the first time the sheet is empty. You can also rename them in Settings. |
| `SMARTTHINGS_TOKEN` | No | Personal access token from [account.smartthings.com/tokens](https://account.smartthings.com/tokens). Include device read and device control. The token stays in the script. The page never sees it. |
| `BLINK_EMAIL` | No | Blink account email. Experimental. See below. |
| `BLINK_PASSWORD` | No | Blink password. Experimental. Stays in the script. |
| `DIGEST_EMAILS` | No | Extra digest addresses. The list in Settings is the one the app uses first. |
| `GOOGLE_CALENDAR_ID` | No | One calendar id. Still works |
| `GOOGLE_CALENDAR_IDS` | No | Comma-separated calendar ids to import together. `primary` means Randy's main calendar |

After you add or change a property, deploy a **new version** of the existing web app (Deploy → Manage deployments → pencil → Version: New version → Deploy). The `/exec` address stays the same. You do not need a new URL.

### What's in the sheet

| Tab | What it is |
| --- | --- |
| users | Randy and the second person |
| settings | Names, digest email, calendar, mileage rate |
| accounts | Checking, savings, loans |
| transactions | Every deposit and expense, tagged Personal or Farm |
| categories | Groceries, feed, egg sales, and the rest, with a monthly budget |
| budgets | A one-month override, when you set "only this month" |
| bills, billPayments | Recurring bills and the dates you marked them paid |
| subscriptions | Streaming and the other renewals |
| debts | Loans used for the payoff estimate |
| snapshots | Net worth on the days you saved one |
| goals, milestones | Shared and personal goals |
| projects, tasks | Home and farm projects |
| events | Calendar entries you typed, plus events pulled from Google |
| calendars | Google calendars to import: id, name, color, whose, on or off |
| lists, listItems | Grocery, farm supply, hardware, and anything else |
| chores | To-dos, including ones that repeat |
| meals, mealItems | The week of meals and their ingredients |
| eggs, eggSales | Production and sales |
| customers, jobs | Tractor customers, quotes, and invoices |
| equipment, serviceLogs | Tractor, implements, and service |
| flock | Birds on hand |
| mileage | Miles and tractor hours |
| trips | Vacation dates, destination, travelers, budget |
| itinerary | Flights, drives, lodging, reservations, by day |
| tripItems | Packing and before-we-leave checklists |
| templates, templateItems | Reusable checklists, including the farm close-up |
| layouts | Each person's Home card order, size, and hidden cards |

## Morning digest

1. In the app, open **More → Settings**.
2. Put one or both email addresses in **Digest emails**, separated by a comma. Set the hour (6 is 6:00 in the script time zone). Save.
3. In Apps Script, choose the function **installDigestTrigger** and click **Run** once. Allow the extra permissions it asks for (sending email, and the calendar if you turned sync on).
4. **More → Settings → Send digest now** sends one immediately so you can see it.

The trigger does not change the web app URL. The email lists bills due in the next 7 days, today's events, and upcoming farm jobs. It does not include the access code. Run **installDigestTrigger** again if you change the hour. That replaces the old trigger.

## Google calendars

Family Hub can show several Google calendars on the same page as bills, jobs, and trips. The script runs as you, so a calendar has to be yours or shared with you.

### Find a calendar id

1. Open [calendar.google.com](https://calendar.google.com) on a computer, signed in as the Google account that owns the script.
2. Hover the calendar in the left list, click the three dots, then **Settings and sharing**.
3. Scroll to **Integrate calendar** and copy **Calendar ID**. It often looks like an email address. Your main calendar can also be entered as `primary`.

### Have your wife share her calendar

1. She opens Google Calendar, then **Settings and sharing** on her calendar.
2. Under **Share with specific people**, she adds your Google account.
3. She sets permission to **See all event details**. Make changes is not required for import.
4. You accept the share if Google asks. The calendar should appear in your left list. Copy its calendar id the same way as above.

Work calendars work the same way when they are shared with you.

### Add the ids

Either place is enough. You can use both.

- In the app: **More → Settings → Google calendars**. Type the calendar id and a name, pick whose calendar it is, and tap **Add calendar**. Tap **On** to stop importing one without deleting it. Tap **Sync now**.
- Or in Apps Script: **Project settings → Script properties**. Add `GOOGLE_CALENDAR_IDS` with the ids separated by commas, for example `primary, wife@gmail.com`. `GOOGLE_CALENDAR_ID` still works for a single id.

The first sync adds a row on the **calendars** tab for each id it finds.

### Turn on the timer and the permission

1. Paste the latest `Code.gs` if this is a new version. **Deploy → Manage deployments → pencil → Version: New version → Deploy**. The `/exec` address stays the same.
2. In the script editor, choose **installTriggers** and click **Run**. Allow calendar permission when Google asks.
3. That adds a timer, `importGoogleCalendars`, about every 30 minutes. It pulls 30 days back and 180 days ahead.
4. Open **More → Calendar**. Each calendar has a color. Tap a name in the legend to hide or show it. A Google event opens in Google Calendar. It is not edited in Family Hub.

Push is unchanged. **Google Calendar id** plus **Push Family Hub to Google** or **Both ways** still writes Family Hub events onto that one calendar. Those events are marked so the import does not copy them back. If you delete an event in Google, the next import removes that imported copy from Family Hub. Events you typed in Family Hub stay.

## SmartThings

The app talks to SmartThings only through the script, using the token in `SMARTTHINGS_TOKEN`.

On **More → House** you can see device health and status, and control:

- a Samsung TV: power, volume, mute, and HDMI or TV input
- a Resideo or Honeywell thermostat: mode, heat and cool setpoints, and fan
- a washer or dryer: what it is doing and the time left (starting a cycle stays on the machine, where Smart Control has to be turned on)
- switches, dimmers, and locks
- contact, motion, and temperature sensors

Every command asks you to confirm first. If the token is missing, the page says so and the rest of the app keeps working. In sample mode the device cards are examples. Nothing is sent to the house, and the page says that.

Some TVs use a Samsung-specific input name. Power, volume, and mute use the standard SmartThings capabilities. If a command is rejected, the page shows the error and does not change anything else.

## Blink (experimental)

Blink does not publish an official API. The integration follows the community-documented login, PIN, camera list, arm, disarm, and thumbnail calls. Amazon can change those calls without notice. The card is labeled experimental and is separate from the rest of the app: if Blink fails, bills and the farm pages still work.

1. Add `BLINK_EMAIL` and `BLINK_PASSWORD` in Script properties. Redeploy a new version.
2. Open **More → House** and go to the Blink card.
3. Tap **Sign in to Blink**. If Blink texts or emails a PIN, type it in. The PIN is checked by the script and is not written into the sheet.
4. Arm, disarm, and thumbnails each stay inside that card.

**Open the Blink app** is always there. On the phone it opens the Play Store page for Blink (`com.immediasemi.android.blink`) so you can use the official app when this experiment is being difficult.

## Updating the script

Do this when `Code.gs` in this repo changes. The page on GitHub Pages updates by itself. The sheet does not.

1. Open the Family Hub sheet. Click **Extensions → Apps Script**.
2. Select everything and delete it. Paste in the new `Code.gs`. Do not add the access code to the file. It stays in Script properties.
3. Click **Save**.
4. Click **Deploy → Manage deployments**.
5. On the web app that is already there, click the pencil. Do not make a new deployment.
6. Set **Version** to **New version**. Leave **Execute as: Me** and **Who has access: Anyone**.
7. Click **Deploy**. The address should stay the same.

The first time you send mail, sync a calendar, or call SmartThings, Google asks for that permission. Allow it. Run **setup** again only if you want to confirm the tabs exist. Opening the app also creates any missing tabs.

## Later changes

- **New access code:** change the `ACCESS_CODE` script property, then deploy a new version as above. Everyone enters the new code once.
- **Second person's name:** **More → Settings → Second person**.
- **Back to sample data on a phone:** clear the web app URL in Settings and save. That does not delete the sheet.
- **Sample data looks wrong:** **More → Settings → Reset sample data** puts the practice household back. This only appears when the sheet is not connected.

## Known limits

- There is no bank connection. Transactions are typed in or imported from a CSV.
- Charts load from the internet. Totals still show when that file is unavailable.
- Blink is unofficial and can break. The official app link is the fallback.
- Washer and dryer controls are status and time remaining. Remote start depends on the machine and is not sent.
- Calendar sync does not delete an event that was removed on the other side.
- Two people editing the same row at the same moment: the later save wins for that row.
- The live sheet does not import the sample transactions. Those stay on the phone that was practicing.
