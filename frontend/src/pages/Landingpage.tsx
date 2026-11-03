import React from "react";

const steps = [
  {
    title: "Add your transactions",
    text: "Paste M-Pesa SMS, say them out loud, or snap a photo of your paper ledger.",
  },
  {
    title: "Check and confirm",
    text: "Review what was read, fix any amount, remove mistakes. Nothing is saved until you say so.",
  },
  {
    title: "Get your float plan",
    text: "See how much cash and float to hold for the coming days, and why.",
  },
];

const features = [
  {
    title: "Forecasts that know your calendar",
    text: "Market days and paydays are part of the forecast, so busy periods don't catch you short.",
  },
  {
    title: "What-if planning",
    text: "Expecting a funeral, a festival or a quiet week? Add the event and see how the plan changes.",
  },
  {
    title: "Ask in your own words",
    text: "Type or speak a question and get an answer built from your own records, checked against the numbers.",
  },
  {
    title: "Voice and ledger photos",
    text: "Record sales by voice or photograph your notebook. FloatWise turns them into entries for you to confirm.",
  },
];

export default function LandingPage() {
  return (
    <div className="fw">
      <style>{css}</style>

      <header className="fw-dark">
        <div className="fw-wrap fw-nav">
          <a href="#top" className="fw-logo">FloatWise</a>
          <nav className="fw-links" aria-label="Main">
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="/login">Log in / Ingia</a>
            <a href="/signup" className="fw-btn fw-btn-amber">Sign up / Sajili</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="fw-dark">
          <div className="fw-wrap fw-hero">
            <div className="fw-hero-text">
              <p className="fw-kicker">For M-Pesa agents and duka owners</p>
              <h1>Never run out of float on your busiest day.</h1>
              <p className="fw-lead">
                FloatWise reads your M-Pesa messages, learns your shop's rhythm of market
                days and paydays, and tells you how much cash and float to hold. In English
                or Kiswahili.
              </p>
              <div className="fw-row">
                <a href="/signup" className="fw-btn fw-btn-amber">Create account / Sajili</a>
                <a href="/login" className="fw-btn fw-btn-outline">Log in / Ingia</a>
              </div>
            </div>

            <div className="fw-card-sample" aria-label="Sample outlook">
              <div className="fw-card-head">
                <strong>Saturday outlook</strong>
                <span className="fw-tag">Sample data</span>
              </div>
              <div className="fw-row">
                <div className="fw-stat">
                  <span>Cash</span>
                  <b>KSh 18,500</b>
                </div>
                <div className="fw-stat">
                  <span>M-Pesa float</span>
                  <b>KSh 42,000</b>
                </div>
              </div>
              <div className="fw-reco">
                <span>Recommendation</span>
                <p>Top up your float before market day, then rebalance cash on Sunday.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="fw-section">
          <div className="fw-wrap">
            <h2>Three steps, no spreadsheets</h2>
            <ol className="fw-grid fw-steps">
              {steps.map((s, i) => (
                <li key={s.title} className="fw-step">
                  <span className="fw-num" aria-hidden="true">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="features" className="fw-section fw-section-tight">
          <div className="fw-wrap">
            <h2>Built around how your shop really runs</h2>
            <div className="fw-grid fw-features">
              {features.map((f) => (
                <article key={f.title} className="fw-feature">
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="fw-amber">
          <div className="fw-wrap fw-lang">
            <div>
              <h2>Kiswahili au English. Chagua lugha yako.</h2>
              <p>Switch language any time, in the app and in the answers you get back.</p>
            </div>
            <a href="/signup" className="fw-btn fw-btn-dark">Sajili sasa</a>
          </div>
        </section>

        <section className="fw-section fw-final">
          <div className="fw-wrap fw-final-inner">
            <h2>Ready to stop guessing your float?</h2>
            <p>Set up your shop in a few minutes. All you need is your phone number.</p>
            <div className="fw-row fw-center">
              <a href="/signup" className="fw-btn fw-btn-dark">Create account / Sajili</a>
              <a href="/login" className="fw-btn fw-btn-outline-dark">Log in / Ingia</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="fw-dark fw-footer">
        <div className="fw-wrap fw-footer-inner">
          <span className="fw-logo">FloatWise</span>
          <span>Float and cash planning for Kenyan agents and shops.</span>
        </div>
      </footer>
    </div>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=DM+Sans:wght@400;500;700&display=swap');

.fw { --ink:#10231B; --paper:#F7F5EF; --amber:#F2B33D; --muted:#4A5750;
  font-family:'DM Sans',system-ui,sans-serif; background:var(--paper); color:var(--ink); line-height:1.55; }
.fw *, .fw *::before, .fw *::after { box-sizing:border-box; }
.fw a { color:inherit; text-decoration:none; }
.fw h1, .fw h2, .fw h3, .fw .fw-logo, .fw .fw-stat b { font-family:'Bricolage Grotesque',sans-serif; }
.fw h1, .fw h2, .fw h3, .fw p { margin:0; }
.fw a:focus-visible { outline:3px solid var(--amber); outline-offset:3px; }

.fw-wrap { max-width:1120px; margin:0 auto; padding:0 24px; }
.fw-dark { background:var(--ink); color:var(--paper); }
.fw-amber { background:var(--amber); color:var(--ink); }

.fw-nav { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; padding-top:18px; padding-bottom:18px; }
.fw-logo { font-weight:700; font-size:24px; }
.fw-links { display:flex; align-items:center; gap:24px; flex-wrap:wrap; }
.fw-links a:not(.fw-btn) { padding:12px 0; }

.fw-btn { display:inline-flex; align-items:center; justify-content:center; min-height:48px; padding:12px 24px;
  border-radius:999px; font-weight:700; font-size:17px; }
.fw-btn:hover { opacity:.88; }
.fw-btn-amber { background:var(--amber); color:var(--ink); }
.fw-btn-outline { border:2px solid var(--paper); }
.fw-btn-dark { background:var(--ink); color:var(--paper); }
.fw-btn-outline-dark { border:2px solid var(--ink); }

.fw-hero { display:flex; flex-wrap:wrap; gap:48px; align-items:center; padding-top:56px; padding-bottom:88px; }
.fw-hero-text { flex:1 1 440px; display:flex; flex-direction:column; gap:24px; }
.fw-kicker { color:var(--amber); font-weight:700; }
.fw-hero h1 { font-size:clamp(38px,6vw,56px); line-height:1.05; font-weight:700; }
.fw-lead { font-size:20px; color:#D5DDD7; max-width:520px; }
.fw-row { display:flex; flex-wrap:wrap; gap:16px; }
.fw-center { justify-content:center; }

.fw-card-sample { flex:1 1 360px; background:var(--paper); color:var(--ink); border-radius:24px; padding:28px; display:flex; flex-direction:column; gap:20px; }
.fw-card-head { display:flex; justify-content:space-between; align-items:center; gap:12px; font-size:18px; }
.fw-tag { font-size:14px; color:var(--muted); border:1px solid #B9C2BB; border-radius:999px; padding:4px 12px; }
.fw-stat { flex:1 1 140px; background:#fff; border-radius:16px; padding:16px; display:flex; flex-direction:column; }
.fw-stat span { font-size:14px; color:var(--muted); }
.fw-stat b { font-size:28px; }
.fw-reco { background:var(--ink); color:var(--paper); border-radius:16px; padding:20px; }
.fw-reco span { font-size:14px; color:var(--amber); font-weight:700; }
.fw-reco p { font-size:18px; margin-top:4px; }

.fw-section { padding:88px 0 40px; }
.fw-section-tight { padding:48px 0 88px; }
.fw-section h2 { font-size:clamp(30px,4vw,40px); line-height:1.1; margin-bottom:40px; }
.fw-grid { display:grid; gap:24px; margin:0; padding:0; list-style:none; }
.fw-steps { grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); }
.fw-features { grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); }

.fw-step { background:#fff; border-radius:20px; padding:28px; display:flex; flex-direction:column; gap:12px; }
.fw-num { font-family:'Bricolage Grotesque',sans-serif; font-size:40px; font-weight:700; color:#8A5F00; line-height:1; }
.fw-step h3, .fw-feature h3 { font-size:22px; }
.fw-step p, .fw-feature p { color:var(--muted); }
.fw-feature { border:2px solid var(--ink); border-radius:20px; padding:28px; display:flex; flex-direction:column; gap:8px; }

.fw-lang { display:flex; flex-wrap:wrap; gap:24px; align-items:center; justify-content:space-between; padding-top:56px; padding-bottom:56px; }
.fw-lang > div { flex:1 1 400px; }
.fw-lang h2 { font-size:clamp(26px,3.5vw,36px); line-height:1.1; margin-bottom:8px; }
.fw-lang p { font-size:18px; }

.fw-final { padding:88px 0; }
.fw-final-inner { max-width:720px; text-align:center; display:flex; flex-direction:column; gap:20px; align-items:center; }
.fw-final h2 { font-size:clamp(30px,4.5vw,44px); margin-bottom:0; }
.fw-final p { font-size:20px; color:var(--muted); }

.fw-footer { color:#D5DDD7; font-size:14px; }
.fw-footer-inner { display:flex; flex-wrap:wrap; gap:16px; justify-content:space-between; padding-top:32px; padding-bottom:32px; }
.fw-footer .fw-logo { font-size:18px; color:var(--paper); }
`;