# FloatWise

**An assistant that helps mobile money agents in Kenya avoid running out of cash or e-float.**

Built for the Meta Global AI Developer Hackathon (Oct 26 to Nov 4, 2026), indie developer track.

Mobile money agents are the small shops where people turn phone balances into cash and back. To serve everyone, an agent has to hold both physical cash and e-float. When either runs out, customers are turned away and the agent loses income. Most agents decide when to restock by feel.

FloatWise lets an agent talk to it in Swahili or English, paste raw M-Pesa SMS messages (voice notes and ledger photos are planned), and get plain-language restocking advice such as:

> "Restock KSh 22,000 cash by Saturday. Until then there is about a 46% chance that at least one customer is turned away."

That sentence is illustrative. The numbers in real answers come from the solver, not from the language model.

---

## Contents

- [FloatWise](#floatwise)
  - [Contents](#contents)
  - [The key design choice](#the-key-design-choice)
  - [Status](#status)
  - [Architecture](#architecture)
  - [How the maths works](#how-the-maths-works)
    - [State](#state)
    - [Demand (`demand.py`, `fit.py`)](#demand-demandpy-fitpy)
    - [Exact one-day kernel (`kernel.py`)](#exact-one-day-kernel-kernelpy)
    - [Solver (`solver.py`)](#solver-solverpy)
    - [Risk (`risk.py`)](#risk-riskpy)
    - [Monte Carlo simulator (`simulate.py`)](#monte-carlo-simulator-simulatepy)
    - [Recommendation (`tools.py`)](#recommendation-toolspy)
  - [The language-model layer](#the-language-model-layer)
  - [Ingestion and the confirm step](#ingestion-and-the-confirm-step)
    - [SMS parsing](#sms-parsing)
    - [Pending batches](#pending-batches)
  - [Getting started](#getting-started)
  - [Configuration](#configuration)
  - [Running the demos](#running-the-demos)
  - [Testing and validation](#testing-and-validation)
  - [Project layout](#project-layout)
  - [API contract](#api-contract)
  - [Assumptions and known limitations](#assumptions-and-known-limitations)
  - [Privacy](#privacy)
  - [Roadmap](#roadmap)

---

## The key design choice

**The language model never does the numbers.**

A chatbot asked "when should I restock?" will produce a confident answer with figures it made up. FloatWise splits the work:

| Job | Done by |
|---|---|
| Understand the question (Swahili or English) | Meta Muse Spark model |
| Decide which tool to call | Meta Muse Spark model |
| Simulate thousands of possible days for the shop | Our code |
| Find the restocking policy with the lowest expected cost | Our exact solver |
| Turn the result into plain advice | Meta Muse Spark model |
| Check every number in the advice against the solver output | Our code (a verifier) |

The model calls our functions as tools. After it drafts an answer, a plain-code verifier extracts every number and date and rejects the draft if any is not supported by the tool results. The model gets two chances to correct itself. If it still fails, the agent falls back to a template sentence built directly from the solver output. A wrong figure therefore cannot reach the agent.

This makes the advice auditable, and it is the answer to "why not just ask a chatbot?"

---

## Status

This is a hackathon project. The table says plainly what exists today.

| Component | Status |
|---|---|
| Domain model (cash and e-float, coupled) | Done |
| Exact one-day kernel, Monte Carlo simulator, validated against each other | Done |
| Exact restocking solver (backward induction) | Done |
| Exact stockout-risk calculation | Done |
| Demand fitting from a shop's transaction history | Done |
| Tools for the agent: recommendation, forecast, what-if | Done |
| Agent loop with tool calling, number verifier and fallback | Done |
| M-Pesa SMS parsing (two confirmed message formats) with a model fallback | Done |
| Shop store with the pending-batch and confirm flow (in memory) | Done |
| Synthetic shop data generator | Done |
| FastAPI endpoints | In progress |
| Voice notes (Swahili transcription) | Planned |
| Ledger photo reading (vision) | Planned |
| Replay of last month (cost of stockouts in KSh) | Planned |
| Peer matching between shops | Mock screen only |
| React frontend | In progress (separate `web/` folder) |

---

## Architecture

```
 Swahili/English question       Pasted M-Pesa SMS      (planned) voice note, ledger photo
            |                          |                              |
            v                          v                              v
   +------------------+      +--------------------+          +------------------+
   |   Advisor agent  |      |   Ingestion        |          |  Model-based     |
   |   (Muse Spark,   |      |   regex first,     |          |  extraction      |
   |   tool calling)  |      |   model fallback   |          |                  |
   +--------+---------+      +---------+----------+          +--------+---------+
            |                          |                              |
            |  calls                   v                              |
            |                 Pending batch --> Agent confirms/edits  |
            |                          |                              |
            v                          v                              |
   +--------------------------------------------------------+         |
   |                    Tool layer                          |<--------+
   |   get_recommendation | get_forecast | run_whatif       |
   +-------------------------+------------------------------+
                             |
        +--------------------+---------------------+
        v                    v                     v
  Exact solver         Exact risk            Monte Carlo
  (backward            (probability a        simulator
  induction)           customer is           (cross-checks
                       turned away)          the exact maths)
                             ^
                             |
                  Demand model fitted from the shop's transactions
                             |
             Verifier checks every number in the draft answer
```

---

## How the maths works

All the code lives in `backend/src/floatwise/model/`.

### State

A shop is described by two balances, **cash** (physical notes in the till) and **float** (the digital M-Pesa balance). They are coupled:

- A **customer withdrawal** takes cash out of the till and adds float. Cash goes down, float goes up.
- A **customer deposit** adds cash and removes float. Cash goes up, float goes down.
- Both conserve `cash + float`. Only a restock (bringing cash from a bank, or buying float) changes the total.

Balances live on a grid of **KSh 1,000 per unit**. The total is capped at 150 units (KSh 150,000), and a single transaction is modelled up to KSh 40,000. See [limitations](#assumptions-and-known-limitations).

### Demand (`demand.py`, `fit.py`)

Each day, the number of customers is **Poisson**. Its mean depends on:

- day of the week
- market days (a configurable multiplier)
- paydays (a multiplier, plus a shift toward more withdrawals)
- one-off events such as school fees (used by what-if questions)
- an overall demand multiplier (also a what-if lever)

Each customer is a withdrawal with some probability, and their transaction size follows a **log-normal** distribution. It is discretised onto the grid so that the mean in shillings is preserved. Rounding small transactions up to a whole unit would inflate demand, and this avoids it.

`fit.py` estimates these parameters from a shop's transaction history. Demand is only counted when a customer was served, so the fit is biased low on days the shop ran out. The output says so.

### Exact one-day kernel (`kernel.py`)

For a single customer event, we build sparse matrices over all `(cash, float)` states: one for a withdrawal, one for a deposit. A request larger than the balance is **rejected**. The state stays the same and the shop loses the commission (plus an optional customer-loss cost).

The exact one-day transition is a mixture over the number of customers: `sum over n of P(N = n) * M^n`. From this we get, with no sampling, the exact expected cost of a day and the exact end-of-day distribution of balances.

### Solver (`solver.py`)

Each morning the shop chooses a restock option from a small menu: add 0, 20, 50 or 100 units of cash, and 0, 20, 50 or 100 units of float (16 combinations; option 0 is "wait"). Restocking has a fixed cost per trip and a cost per unit. **Backward induction** over the planning horizon finds the cheapest choice for every state on every day. Ties resolve to waiting.

Cost means restock cost, plus lost commission on turned-away customers, plus a configurable customer-loss cost per turned-away customer.

### Risk (`risk.py`)

The probability that **at least one customer has been turned away** by the end of each day, if the shop does not restock, is computed exactly using sub-stochastic versions of the event matrices (a rejected path leaves the system). This is the "chance you run out before then" figure.

### Monte Carlo simulator (`simulate.py`)

A vectorised simulator runs thousands of paths in parallel, with any restocking policy plugged in. It exists mainly as an independent check on the exact maths, and it will power the month replay.

### Recommendation (`tools.py`)

`get_recommendation` combines the above. If the plan says to restock this morning for the shop's real balances, it says so. Otherwise it reports the first morning by which the plan has probably already restocked (cumulative probability of at least 50%), with the amount clamped to the free room. That probability is approximate, because a path could restock more than once, so it is labelled "likely by".

---

## The language-model layer

Code in `backend/src/floatwise/llm/`.

- **`client.py`** is the only file that talks to a model provider. It uses the OpenAI-compatible chat-completions API, so one setting switches between providers.
- **`toolkit.py`** holds the tool definitions the model sees, and wraps the real functions so the model's arguments are clamped to sensible ranges.
- **`agent.py`** runs the loop: send the question, execute any tool calls, feed results back, receive a draft, verify it. Up to 6 iterations and 2 correction retries.
- **`verify.py`** extracts numbers, percentages, dates and `22k`-style amounts from a draft and checks each against the tool results, the shop's balances and the numbers in the user's own question.

Providers supported by configuration:

- **Baseten**, serving Meta's **Muse Spark Open** (open weights), which is what the project has been developed on.
- **Meta Model API**, serving Muse Spark.

The verifier is a safety net, not a proof. It catches invented and miscalculated figures, but a real number used in the wrong sentence could pass. The accurate claim is that numbers are checked against the solver's output.

---

## Ingestion and the confirm step

Code in `backend/src/floatwise/ingest/` and `backend/src/floatwise/store.py`.

### SMS parsing

M-Pesa confirmations follow templates, so **regex runs first**. It is exact, free and fast. Currently two formats are confirmed against real wording:

- `... sent to <name> <phone> ...` is a **customer deposit** (the agent sent float).
- `... You have received ... from <name> <phone> ...` is a **customer withdrawal**.

The M-PESA balance printed in each message is the float balance. The parser chains the balances and warns if a message appears to be missing.

Anything that matches no pattern is **reported as unparsed, never guessed**. Optionally those messages go to a model fallback, which only ever sees redacted text and marks everything it returns for review.

Incoming amounts of KSh 30,000 or more are flagged for review, because a float top-up from a super agent is worded like a customer withdrawal.

### Pending batches

Ingestion produces a **pending batch**. Nothing is committed until the agent confirms, optionally with edits or removals. This is also how mistakes in extraction are caught.

On confirmation:

- Without edits, float is set to the balance printed on the latest SMS, because the phone is the source of truth.
- With edits or removals, float follows the transaction amounts, with a warning that it may no longer match the phone.
- Cash moves by the transaction amounts only (SMS cannot show physical cash). A negative result is clamped to zero with a warning.
- A message that was already committed is skipped.

The shop store is currently **in memory**.

---

## Getting started

Requirements: **Python 3.11 or newer** (developed on 3.13), and Git.

```powershell
git clone <your-repo-url>
cd Floatwise\backend

python -m venv .venv
.venv\Scripts\Activate.ps1          # in every new terminal
pip install -e ".[dev]"
```

On macOS or Linux, activate with `source .venv/bin/activate`.

If PowerShell refuses to run the activation script, run this once and try again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Then create `backend/.env` (see [Configuration](#configuration)) and check everything works:

```powershell
python -m pytest -q
```

---

## Configuration

Copy `backend/.env.example` to `backend/.env`. **Never commit `.env`.** It is already listed in `.gitignore`.

```
# Which provider the agent uses: "baseten" or "meta"
LLM_PROVIDER=baseten

BASETEN_API_KEY=
BASETEN_BASE_URL=https://inference.baseten.co/v1
BASETEN_MODEL=meta-models/muse-spark-open-1026

META_API_KEY=
META_API_BASE_URL=https://api.meta.ai/v1
META_MODEL_TEXT=muse-spark-1.3
```

Environment variables override `.env`, so you can switch provider for one command:

```powershell
$env:LLM_PROVIDER="baseten"; python scripts/smoke_llm.py
```

Check your provider dashboard for the exact model names available to your account.

Both providers have free hackathon credits. While free credits are in use, content sent to the provider may be used for product improvement, so **send only synthetic or anonymised data**.

---

## Running the demos

All commands run from `backend/` with the virtual environment active.

| Command | What it shows |
|---|---|
| `python scripts/gen_synthetic_data.py` | Generates a synthetic shop history in `data/synthetic/` |
| `python scripts/demo_sim.py` | Monte Carlo comparison of "never restock" with a threshold rule |
| `python scripts/demo_plan.py` | The exact solver's restock plan and risk by day |
| `python scripts/demo_tools.py` | Demand fitting, then recommendation, forecast and what-if |
| `python scripts/smoke_llm.py` | Checks the model connection, Swahili output and tool calling |
| `python scripts/demo_agent.py` | The full agent answering Swahili and English questions, with verification |
| `python scripts/demo_sms.py` | SMS parsing (add `--llm` to try the model fallback) |
| `python scripts/demo_store.py` | Ingest, confirm, then recommend |

---

## Testing and validation

```powershell
python -m pytest -q
```

The tests are designed to support the claims in this README, not just to cover lines of code.

| What is checked | Where |
|---|---|
| Every transaction conserves `cash + float` | `test_model.py` |
| Balances never go negative or above capacity, even with restocking | `test_model.py` |
| Discretised transaction sizes keep the mean in shillings | `test_model.py` |
| **Monte Carlo agrees with the exact kernel** (expected loss and end-of-day cash, within sampling error) | `test_model.py` |
| **Exact stockout probability agrees with simulation** | `test_solver.py` |
| **The optimal plan is never worse than waiting, or than a hand-written threshold rule, in any state** | `test_solver.py` |
| **The plan's predicted cost matches a Monte Carlo run of the same policy** | `test_solver.py` |
| Demand fitting recovers the patterns in synthetic data | `test_tools.py` |
| Restock amounts never exceed free capacity | `test_tools.py` |
| The verifier accepts supported numbers and rejects invented ones | `test_agent.py` |
| The agent retries a bad draft, then falls back to a verified template | `test_agent.py` |
| No names or phone numbers survive parsing | `test_ingest.py` |
| A missing SMS is detected from the balance chain | `test_ingest.py` |
| Unknown message formats are reported, not guessed | `test_ingest.py` |
| Pending batches change nothing until confirmed | `test_store.py` |

The agent tests use a fake model, so they run offline and cost nothing.

---

## Project layout

```
Floatwise/
├── README.md
├── backend/
│   ├── pyproject.toml
│   ├── .env.example
│   ├── scripts/                 demos and smoke tests (see above)
│   ├── tests/
│   └── src/floatwise/
│       ├── config.py            settings and provider selection
│       ├── schema.py            Transaction, Advice, TxnType, balance rules
│       ├── economics.py         commission tiers (illustrative)
│       ├── synthetic.py         synthetic shop history generator
│       ├── store.py             shops, batches, confirm flow (in memory)
│       ├── model/
│       │   ├── grid.py          state space, restock clamping
│       │   ├── demand.py        demand model and size distribution
│       │   ├── fit.py           fit demand from transactions
│       │   ├── kernel.py        exact one-day kernel
│       │   ├── simulate.py      vectorised Monte Carlo
│       │   ├── costs.py         restock costs
│       │   ├── risk.py          exact stockout probability
│       │   ├── solver.py        backward induction
│       │   └── tools.py         get_recommendation, get_forecast, run_whatif
│       ├── llm/
│       │   ├── client.py        the only file that calls a model provider
│       │   ├── toolkit.py       tool schemas and argument clamping
│       │   ├── agent.py         the agent loop and fallback
│       │   └── verify.py        number and date verifier
│       └── ingest/
│           ├── anonymize.py     phone hashing and redaction
│           ├── sms_parser.py    regex parser for M-Pesa messages
│           └── llm_extract.py   model fallback for unparsed messages
└── web/                         React frontend (separate workspace)
```

---

## API contract

The frontend is built against a fixed contract. Money is always an integer in KSh, times are ISO 8601 with an offset, and errors always have the shape `{"error": {"code", "message", "details"}}`.

| Endpoint | Purpose |
|---|---|
| `GET /health` | Health check |
| `POST /shops` and `GET /shops/{id}` | Create and read a shop |
| `PUT /shops/{id}/balances` | Manual balance correction |
| `POST /shops/{id}/ingest/sms` | Parse pasted SMS into a pending batch |
| `POST /shops/{id}/ingest/voice` | Planned |
| `POST /shops/{id}/ingest/ledger` | Planned |
| `POST /shops/{id}/ingest/{batch}/confirm` | Confirm a batch, with optional edits and removals |
| `POST /shops/{id}/chat` | Ask the agent a question |
| `GET /shops/{id}/forecast` | Balance ranges and risk by day |
| `POST /shops/{id}/whatif` | Compare a scenario with the baseline |
| `GET /shops/{id}/replay` | Planned: stockout cost over the last month |
| `GET /shops/{id}/matches` | Mock data for the peer-matching screen |

The FastAPI app generates interactive documentation at `/docs`. Export the spec to `docs/openapi.json` so the frontend can generate its types.

---

## Assumptions and known limitations

Please read this section before trusting any number from the app.

**Assumptions that are placeholders, not facts**

- **Commission tiers** in `economics.py` are illustrative, not Safaricom's tariff.
- **Restock costs** (trip fee, per-unit fees) are illustrative and should be editable by the agent.
- **Customer-loss cost** (KSh 150 per turned-away customer) is an assumption. It is the setting that makes restocking worthwhile, because commission on one customer is small compared with the cost of a trip.
- **Default demand parameters** apply until a shop has enough history (30 or more customers over at least a week).
- The **Swahili fallback template** in `agent.py` was not written by a Swahili speaker and needs review.

**Modelling limits**

- **Stockout definition** is "at least one customer turned away". It is strict, and risk climbs towards 100% within days for busy shops. A softer definition may be more useful in practice.
- **Capacity** is KSh 150,000 for cash plus float, and one unit is KSh 1,000. Larger shops need a larger grid, which slows the solver.
- **Demand fitting is biased low.** Customers turned away leave no record, so demand on stockout days is undercounted.
- **A few weeks of data gives uncertain estimates.** Multipliers for market days and paydays are noisy, so the app should show ranges.
- **Physical cash cannot be seen from SMS.** Cash is only as accurate as the agent's own count.
- The recommended restock day is a summary of a state-dependent plan, not a law.

**Parsing limits**

- Only two SMS formats are confirmed against real wording. Float top-ups, bank deposits, reversals and Swahili-language messages need examples before patterns can be added.
- The review rule for amounts of KSh 30,000 and above is a stand-in. The confirm step is what decides.

**Process limits**

- The store is in memory, so a restart loses data.
- No real agent data has been used. All demos run on synthetic shops, and no real agent has validated the advice yet.

---

## Privacy

M-Pesa messages contain customers' names and phone numbers.

- **Names and phone numbers are never stored.** The parser keeps only a salted hash of the phone number.
- Text is **redacted before any model call**.
- The default hash salt is a demo value. Use a secret salt before handling real data.
- During the hackathon, **only synthetic or anonymised data** is sent to model providers, because free credits may allow content to be used for product improvement.
- A real deployment would need a data-protection review under Kenyan law, an explicit retention policy, and consent from agents.

FloatWise gives operational advice only. It does not move money.

---

## Roadmap

1. FastAPI endpoints matching the contract above.
2. Voice notes: Swahili transcription, then structured transactions.
3. Ledger photos: vision-based extraction into the same pending-batch flow.
4. Month replay: re-run the last month under the optimal plan and report lost commission and customer-loss cost in shillings, labelled as an estimate.
5. Replace the fixed restock menu with a trigger rule the agent can follow ("restock cash when it falls below about KSh X").
6. A softer stockout definition, and risk shown as a range.
7. Persistent storage.
8. Peer matching: suggest nearby shops with opposite surpluses to swap cash and float. This is a mock screen today, and a real version needs trust and security design before any automatic swap.
9. Validate with real agents.

---


Built with Meta's Muse Spark models, served through Baseten (Muse Spark Open) and the Meta Model API, for the Meta Global AI Developer Hackathon.