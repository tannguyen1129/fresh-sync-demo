# FreshSync — Demo Script (for the Thailand team)

> Audience: anyone running a live walkthrough of FreshSync — including teammates joining from Thailand who may not have day-to-day context. Time budget: **8–12 minutes** for the full demo, **3–4 minutes** for the short version.

## 0. One-line pitch

> FreshSync is a coordination layer between shipping lines, terminals, logistics companies and drivers. It only lets a truck depart when **commercial, yard, and gate** are simultaneously ready — and re-orchestrates everything automatically when conditions change.

Use this whenever you need a 10-second answer to "what is FreshSync?".

---

## 1. Before you present

### 1.1. Reset the demo

```bash
# Full reset (DB + seed)
pnpm --filter @freshsync/api db:push
pnpm --filter @freshsync/api db:seed

# Shortcut alias
pnpm demo:reset
```

### 1.2. Smoke check (optional, ~10 s)

```bash
pnpm demo:smoke
# or against the deployed instance
API_URL=https://freshsync.umtoj.edu.vn/api pnpm demo:smoke
```

### 1.3. Browser tabs to pre-open

Open these in order — left to right — so you don't fumble during the live demo:

1. `/login` — quick-login buttons for all 4 roles
2. `/operator/dashboard` — Control Tower
3. `/business/pickup` — pickup wizard
4. `/business/dashboard` — outcomes
5. `/driver/dashboard` — JIT driver view
6. `/authority/dashboard` — ESG + Cát Lái projection

### 1.4. Accounts (password is always `123456`)

| Role | Email | Lands on |
| --- | --- | --- |
| Port Operator | `ops@port.com` | `/operator/dashboard` |
| Logistics (Business) | `biz@logistics.com` | `/business/dashboard` |
| Truck Driver | `driver@fleet.com` | `/driver/dashboard` |
| Port Authority | `admin@authority.gov` | `/authority/dashboard` |
| Shipping Line System | `system@one-line.com` | API only |
| TOS System | `tos@terminal.local` | API only |

---

## 2. The story arc (always tell this first)

Before you click anything, take 30 seconds to set up the framing:

> "In both Vietnam (Cát Lái) and Thailand (Laem Chabang, Khlong Toei), the bottleneck is **not** more physical infrastructure. It's the lack of real-time coordination between shipping lines, terminals, customs, logistics companies and drivers.
> Today we'll show how FreshSync acts as that coordination layer through one mechanism: **Triple Validation**. A truck is allowed to leave only when commercial readiness, yard readiness, and gate capacity all agree — at the same time."

That sentence is what every screen in the demo proves.

---

## 3. Full demo flow (8–12 minutes)

### Step 1 — Control Tower overview · `/operator/dashboard`

Login: `ops@port.com`.

What to point at, in order:

1. **KPI strip**: Gate Utilization, Yard Occupancy, Active Disruptions, Risk Level.
2. **Live Port Operations Map**: terminals, gates (colored by utilization), depots, trucks (blue = pickup, sky = return-empty), disruption circles.
3. **Gate Load chart** (last 6 hours, area chart): real gate utilization vs peak window.
4. **Live Events feed** on the right — keep this visible later when disruptions trigger.
5. **Depot Network Load** bar chart — sets up the Smart Empty Return story.

Say: "This is the same situational picture every role gets — but each role only sees the actions they're allowed to take."

### Step 2 — Triple Validation: green path · `/business/pickup` with `CONT-001`

Login as `biz@logistics.com`. Navigate to **New Pickup Request**.

1. Click the `CONT-001` quick chip.
2. Optionally fill in the demo fleet shortcut (auto-fills truck plate + driver).
3. Hit **Analyze Availability**.

Now this is the *key* moment of the demo. The Triple Validation card is structured exactly like the SRS:

- **① Commercial Readiness** → three sub-rows
  - Delivery Order = `RELEASED`
  - Customs = `CLEARED`
  - Cargo Classification = `DRY` (with soft quota 65% and urgency × 1.0)
- **② Yard Readiness** → four sub-rows
  - Container Location, Availability, Equipment, Yard Access (all PASS)
- **③ Gate Capacity** → utilization %, available slots, cargo quota usage

Below the validation card you'll see the **Dynamic Priority Score** breakdown (cargo urgency + waiting pressure + deadline risk + resource constraint + backlog pressure + priority flag).

Say: "Notice the engine doesn't just say 'OK'. It tells the business user **why** it's OK. Every recommendation comes with an explanation, a risk score, and a priority score they can audit."

Click **Confirm Booking** → booking is created, a driver assignment is generated, you get a green confirmation with the booking code.

### Step 3 — Triple Validation: blocked paths

Stay on `/business/pickup`. Click **Create Another** and walk through the failure scenarios. **Pick 2 out of 4** depending on time:

| Container | What it proves | Layer that fails |
| --- | --- | --- |
| `CONT-013` | Shipping line has not released the D/O | Commercial — D/O HOLD |
| `CONT-010` | D/O has expired | Commercial — D/O EXPIRED |
| `CONT-016` | Customs put a stop on this container | Commercial — Customs HOLD |
| `CONT-014` | Container still on vessel, not ready in yard | Yard — Container not located / not ready |
| `CONT-007` | Customs paperwork still being processed | Commercial — Customs PENDING (WARN) |
| `CONT-008` | Physical inspection required | Commercial — INSPECTION_REQUIRED (WARN) |
| `CONT-011` | OOG cargo needs special equipment | Cargo + Yard equipment WARN |
| `CONT-005` | Reefer cargo, priority slot, special quota | Green path with reefer urgency × 3.0 |

Say: "Every block has a **reason code**, not just a red banner. That's what makes this a coordination layer, not a black box."

### Step 4 — Business overview · `/business/dashboard`

Switch to **My Requests** tab.

Show:

1. KPI cards (Pickup Requests, Confirmed, Blocked, Rescheduled, Upcoming).
2. **My Fleet on the Port Map** — the business user sees only *their own* trucks on the live map, but with the full port context.
3. **AI Risk Distribution** pie chart (Low / Medium / High slots).
4. **Booking Outcome Snapshot** bar chart.
5. **Recent AI Analyses** — each shows risk badge color (LOW / MED / HIGH).

Say: "The logistics company doesn't just get notifications. They see the same orchestration logic the operator sees — filtered for their own fleet."

### Step 5 — Driver: JIT route · `/driver/dashboard`

Login as `driver@fleet.com`.

1. Show the **Next Move Map** — real Leaflet map with driver position, gate, yard zone, exit gate, all connected.
2. Tap the current job card to open the assignment detail.
3. On the detail screen, show:
   - Full-width route map at the top
   - JIT Guidance card (green = on time, yellow = too early, red = late for slot)
   - QR check-in card with booking code and QR token (tap **Simulate Scan** to check in)
   - Slot window and ETA tiles
   - Route plan + status timeline

4. Walk the status through: `START TRIP → ARRIVED AT GATE → CONFIRM PICKUP → DEPART PORT → ARRIVED DESTINATION`.

Say: "On the driver side there is **no algorithm complexity**. They get one task, one route, one slot, one QR. The intelligence stays on the orchestration layer."

### Step 6 — Smart Empty Return · `/driver/return-empty?assignmentId=<latest>`

After `DELIVERED`, tap **RETURN EMPTY** on the assignment, or open the Return Empty link from the sidebar.

Show:

1. Map with **all candidate depots** displayed and connected to the driver position.
2. The **recommended depot** appears in green, full depots in red, healthy alternatives in sky-blue.
3. The recommendation card: depot name, distance (km), traffic level, estimated minutes, utilization, reason.
4. The **Other candidates** list with their scores.

Say: "The same scoring model is applied: `distance + load × 10 + traffic`. The system never picks a `FULL` depot, never picks one outside the allowed list — even if it's closer."

### Step 7 — Dynamic re-optimization · disruption simulation

Switch back to the Operator. Two paths, pick whichever is faster on the day:

- **Path A** — Live Map page: `/operator/map` → click **Terminal Overload** scenario button.
- **Path B** — Override page: `/operator/override` → block `ZONE_B` with reason "crane breakdown demo".

Then return to `/operator/dashboard`:

1. **Active Disruptions** count increments.
2. **Live Events feed** logs the disruption + impacted bookings.
3. **Impacted Bookings table** at the bottom shows `RESCHEDULED` / `BLOCKED` containers with reasons.
4. Switch to Business → notification toast appears + booking row goes amber.
5. Switch to Driver → if the affected job was theirs, the "Route Changed!" red alert appears at the top of the assignment detail.

Say: "When the port changes, FreshSync re-orchestrates affected bookings within seconds — and tells every stakeholder *why*."

### Step 8 — Green Economy · `/authority/dashboard`

Login as `admin@authority.gov` (or use a 4th browser tab).

This is the closing slide. Walk top-to-bottom:

1. **Cát Lái Green-Economy Projection** card (top): the doc's expected scenario in tiles —
   - Trucks impacted / day · **11,000**
   - Idle hours saved / day · **~6,875 h**
   - Diesel saved / day · **~20,820 L**
   - CO₂ avoided / day · **~56 t**
   - CO₂ avoided / year · **~20,500 t**
   - Fuel cost saved / day · **~₫458M**

2. **KPI cards** (CO₂, Idle, Peak Avoided, Diesel, Fuel cost) derived from *actual* bookings in the demo DB.

3. **Port Network ESG Map** — terminals, gates, depots, yard load.

4. **Carbon Footprint Reduction** area chart over date range.

5. **Depot Network Load** bar chart + **Yard Pressure** bars.

6. **Daily Breakdown** table + **Export CSV** button.

Say: "The same orchestration that helped one driver skip the queue is what produces these numbers at port scale. The business case and the ESG case are the same case."

### Step 9 — Business ROI close · `/business/roi`

Switch to Business. Show the **ROI & Sustainability** tab so the logistics buyer can map operational wins to their own P&L:

- Idle minutes saved, diesel saved, fuel cost saved (USD), CO₂ avoided, fleet utilization (trips/truck/week).
- Daily savings trend (area chart).
- Driver contribution breakdown (bar chart).
- Transparent assumptions panel.

End on this line:

> "FreshSync turns coordination into money for the logistics company, into capacity for the operator, and into CO₂ savings for the authority — from the same data."

---

## 4. Short demo (3–4 minutes)

When you only have a few minutes (e.g. pitch context), run this compressed path:

1. `/operator/dashboard` — 30 s, show map + KPI strip + live events.
2. `/business/pickup` with `CONT-001` — 60 s, hit the Triple Validation, confirm booking.
3. `/business/pickup` with `CONT-013` or `CONT-010` — 30 s, show the red block + reason code.
4. `/operator/map` — click **Terminal Overload** — 30 s, show impact in live events.
5. `/authority/dashboard` — 60 s, point at Cát Lái projection + the actual KPI strip.

---

## 5. Talk-track snippets (copy-paste during demo)

Drop these into chat or slides if the room is mixed-language.

- **Triple Validation, 1-liner**:
  > "A truck departs only if `Commercial = TRUE` AND `Yard = TRUE` AND `Gate = AVAILABLE`."

- **Why not just terminal appointment systems?**
  > "Terminal appointment is gate-centric — it only manages pressure at the gate after trucks are already queueing. FreshSync moves the decision upstream: we never dispatch the truck unless the whole chain agrees."

- **Why this works without full PCS integration?**
  > "FreshSync runs as an independent P2B coordination layer. It plugs into shipping line data and TOS feeds where available, but it produces value even before a national PCS is in place."

- **Why the Green Economy story is credible?**
  > "It's a scenario model, not a measurement. The assumptions are visible on the dashboard, derived from public Cát Lái traffic data (22,000 trucks/day) and EPA diesel emission factors. Anyone can re-run the math."

---

## 6. If something breaks during the demo

| Symptom | Fix in &lt; 10 seconds |
| --- | --- |
| Realtime feed feels quiet | Hit the **Refresh** button on the page — REST fallback always works |
| Disruption job seems delayed | Wait ~2 s, then refresh `/operator/dashboard` — the BullMQ worker is asynchronous |
| Authority dashboard is empty | Click **Sync Today** to generate today's ESG report |
| Confirm Booking returns "Slot full" | The seed already pre-fills peak slots — pick an earlier hour or run `pnpm demo:reset` |
| Driver dashboard shows no jobs | Make sure you ran step 2 (confirm booking) first; the demo driver belongs to `FastLogistics Co` |
| Map shows blank tiles | Internet to `tile.openstreetmap.org` is required — fall back to the textual KPIs |
| One-click login fails | Confirm the seed ran; default password is `123456` for every demo user |

### Hard reset (last resort)

```bash
pnpm demo:reset
# wait ~3 s, refresh the browser, log in again
```

---

## 7. After-demo Q&A cheatsheet

- **"Where do you get the data from?"** → Shipping line systems (D/O, vessel ETA, empty-return rules) + TOS (yard, gate capacity, disruptions). In demo we mock these through `/api/integrations/*` endpoints.
- **"Is the AI a real model?"** → It's a rule-based decision engine in P1, with explainable scoring (risk score + priority score + factor breakdown). The architecture is built so a learned model can replace the rules later without changing the API contract.
- **"What about multi-terminal?"** → The data model already supports multiple terminals (`TML-A`, `TML-B`, `TML-R`) and the orchestration is terminal-aware. Cross-terminal balancing is the natural P2 feature.
- **"How would this fit Laem Chabang?"** → Same model. Replace the Cát Lái baseline (22k trucks/day) with Laem Chabang's actual figures, plug in the local shipping line / TOS feeds, and the Triple Validation rules apply unchanged.

---

## 8. Useful URLs

- Local dev: `http://localhost:3000` (web), `http://localhost:4000/api` (API), `http://localhost:4000/api/docs` (Swagger)
- Deployed demo: `https://freshsync.umtoj.edu.vn`
- API health: `GET /api/health`
- Demo status: `GET /api/demo/status`
- Cát Lái projection: `GET /api/authority/esg/cat-lai-projection`
- Port map snapshot: `GET /api/meta/port-map-snapshot`
