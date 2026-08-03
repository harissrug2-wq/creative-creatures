import React, { useEffect, useState } from 'react';
import { CATEGORY_ORDER, CATEGORY_COLORS, CATEGORY_NAMES, CATEGORY_SHORT } from '../data/questions.js';

/* ── Circular Gauge (SVG) ───────────────────────────────────────── */
function CircularGauge({ score }) {
  const r = 72;
  const circ = 2 * Math.PI * r;
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setCurrent(score), 100);
    return () => clearTimeout(t);
  }, [score]);

  const offset = circ - (current / 100) * circ;

  const color =
    score >= 75 ? '#10b981' :
    score >= 50 ? '#4f46e5' :
    score >= 25 ? '#f59e0b' : '#ef4444';

  const label =
    score >= 80 ? 'High Strength' :
    score >= 60 ? 'Developing' :
    score >= 40 ? 'Emerging' :
    score >= 20 ? 'Foundational' : 'Critical Gaps';

  return (
    <div className="flex flex-col items-center justify-center py-2 w-full">
      <div className="relative w-44 h-44 flex items-center justify-center">
        <svg width="180" height="180" viewBox="0 0 180 180" className="transform -rotate-90">
          {/* Track */}
          <circle
            cx="90"
            cy="90"
            r={r}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="12"
          />
          {/* Progress Arc */}
          <circle
            cx="90"
            cy="90"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(.34,1.56,.64,1)',
              filter: `drop-shadow(0 2px 8px ${color}35)`,
            }}
          />
        </svg>

        {/* Centered Score Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-4xl font-extrabold text-slate-900 leading-none mb-1">
            {score}
          </span>
          <span className="text-xs font-semibold text-slate-400">
            out of 100
          </span>
        </div>
      </div>

      <div
        className="mt-4 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider inline-block"
        style={{ background: `${color}18`, color }}
      >
        {label}
      </div>
    </div>
  );
}

/* ── Category Bar ───────────────────────────────────────────────── */
function CategoryBar({ label, score, color, delay = 0 }) {
  const [w, setW] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setW(score), 120 + delay);
    return () => clearTimeout(t);
  }, [score, delay]);

  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F';

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded"
            style={{ background: `${color}18`, color }}
          >
            {grade}
          </span>
          <span className="text-sm font-bold text-slate-900 w-10 text-right">{score}%</span>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${w}%`,
            background: color,
            transition: `width 0.9s cubic-bezier(.34,1.56,.64,1) ${delay}ms`,
          }}
        />
      </div>
    </div>
  );
}

/* ── Validation Badge ───────────────────────────────────────────── */
function ValidationBadge({ status, confidenceScore, mismatch }) {
  const cfg = {
    'Verified': {
      color: '#10b981',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      desc: 'Your self-assessment is internally consistent with your scale test response.',
    },
    'Needs Validation': {
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fde68a',
      desc: `A ${mismatch}-point gap between your Scale Test and diagnostic score suggests blind spots worth reviewing.`,
    },
    'Significant Contradiction': {
      color: '#dc2626',
      bg: '#fef2f2',
      border: '#fecaca',
      desc: `Your Scale Test is ${mismatch} points away from your diagnostic score — indicating scaling confidence may exceed current infrastructure.`,
    },
  };
  const c = cfg[status] || cfg['Verified'];

  return (
    <div className="p-5 rounded-xl" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className="flex items-start gap-3">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: c.color }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            {status === 'Verified' ? (
              <path d="M20 6L9 17l-5-5" />
            ) : (
              <>
                <line x1="12" y1="8" x2="12" y2="13" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </>
            )}
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold mb-1" style={{ color: c.color }}>
            {status}
          </div>
          <p className="text-sm text-slate-600 leading-normal mb-2">
            {c.desc}
          </p>
          <div className="text-xs text-slate-500 font-medium">
            Confidence Score: <strong style={{ color: c.color }}>{Math.round(confidenceScore)}%</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Creature Observation ───────────────────────────────────────── */
function CreatureObservation({ mismatch, overallScore, scaleScore }) {
  const overconfident = scaleScore > overallScore;

  return (
    <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
      <div className="flex gap-3">
        <span className="text-lg">🔍</span>
        <div>
          <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">
            Creature Observation
          </div>
          <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
            {overconfident
              ? `You rated scalability at ${scaleScore}% on the Scale Test, but your diagnostic is ${overallScore}%. This ${mismatch}-point gap suggests you may be more confident about scaling than your systems can currently support.`
              : `You rated scalability at ${scaleScore}% on the Scale Test, but your diagnostic is ${overallScore}%. You may be underestimating the strength of your systems, or past challenges have tempered your confidence.`}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Email Modal ────────────────────────────────────────────────── */
function EmailModal({ email, setEmail, onClose, onSubmit, emailSent }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(6px)' }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl p-6 sm:p-8 relative shadow-2xl border border-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {emailSent ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Results Sent!</h3>
            <p className="text-sm text-slate-500">
              Report successfully delivered to <strong className="text-slate-800">{email}</strong>
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-1.5">Email My Results</h3>
              <p className="text-sm text-slate-500">Get your complete Agency Strength Index report delivered to your inbox.</p>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@youragency.com"
                className="w-full px-4 py-3 rounded-xl text-sm border border-slate-200 text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && email && onSubmit()}
              />
            </div>

            <button
              onClick={onSubmit}
              disabled={!email}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all shadow-sm"
              style={{
                background: email ? '#4f46e5' : '#e2e8f0',
                color: email ? '#ffffff' : '#94a3b8',
                cursor: email ? 'pointer' : 'not-allowed',
              }}
            >
              Send My Results
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main Results Dashboard ─────────────────────────────────────── */
export default function ResultsDashboard({
  results,
  insights,
  onStartOver,
  emailModal,
  setEmailModal,
  email,
  setEmail,
  emailSent,
  setEmailSent,
}) {
  const { categoryScores, overallScore, scaleScore, mismatch, validationStatus, confidenceScore } = results;
  const showObs = mismatch !== null && mismatch > 30;

  return (
    <div className="app-wrapper">
      {emailModal && (
        <EmailModal
          email={email}
          setEmail={setEmail}
          onClose={() => setEmailModal(false)}
          onSubmit={() => email && setEmailSent(true)}
          emailSent={emailSent}
        />
      )}

      {/* Top Header */}
      <header className="top-header">
        <div className="main-container flex items-center justify-between">
          <button onClick={() => { window.location.href = '/diagnostic/'; }} className="btn-back">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Back to diagnostic hub
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setEmailModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Email Results
            </button>

            <button
              onClick={onStartOver}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
              </svg>
              Retake
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-container" style={{ paddingTop: 28, paddingBottom: 60 }}>
        {/* Title Header */}
        <div className="mb-8 fade-in">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest mb-1">
            RESULTS
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-1.5">
            Agency Strength Index
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Based on 30 diagnostic questions across 5 infrastructure categories
          </p>
        </div>

        {/* Row 1: Overall Strength & Category Breakdown */}
        <div className="results-top-grid fade-in">
          {/* Overall Strength */}
          <div className="q-card p-6 sm:p-8 flex flex-col justify-between items-center text-center">
            <div className="w-full text-xs font-bold text-slate-400 uppercase tracking-wider text-left mb-2">
              OVERALL STRENGTH
            </div>
            <CircularGauge score={overallScore} />
            <div className="w-full pt-4 mt-2 border-t border-slate-100 text-xs text-slate-500 font-medium">
              Average across all 5 infrastructure pillars
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="q-card p-6 sm:p-8 flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">
              CATEGORY BREAKDOWN
            </div>
            <div className="space-y-4">
              {CATEGORY_ORDER.map((cat, i) => (
                <CategoryBar
                  key={cat}
                  label={CATEGORY_NAMES[cat]}
                  score={categoryScores[cat]}
                  color={CATEGORY_COLORS[cat]}
                  delay={i * 100}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Confidence Assessment & Strategic Insights */}
        <div className="results-middle-grid fade-in">
          {/* Confidence Assessment */}
          <div className="q-card p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">
                CONFIDENCE ASSESSMENT
              </div>

              {scaleScore !== null && (
                <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-center">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-slate-400 mb-1">Scale Test</div>
                    <div className="text-2xl font-extrabold text-slate-900">{scaleScore}</div>
                  </div>
                  <div className="h-8 w-px bg-slate-200 mx-2" />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-slate-400 mb-1">Diagnostic</div>
                    <div className="text-2xl font-extrabold text-slate-900">{overallScore}</div>
                  </div>
                  {mismatch !== null && (
                    <div
                      className="ml-3 pl-3 border-l border-slate-200 text-xs font-bold"
                      style={{ color: mismatch > 30 ? '#ef4444' : mismatch > 15 ? '#f59e0b' : '#10b981' }}
                    >
                      {mismatch} pt gap
                    </div>
                  )}
                </div>
              )}

              <ValidationBadge status={validationStatus} confidenceScore={confidenceScore} mismatch={mismatch} />
              {showObs && <CreatureObservation mismatch={mismatch} overallScore={overallScore} scaleScore={scaleScore} />}
            </div>
          </div>

          {/* Strategic Insights */}
          <div className="q-card p-6 sm:p-8">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">
              STRATEGIC INSIGHTS
            </div>
            <div className="space-y-4">
              {insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                    style={{ background: '#eef2ff', color: '#4f46e5' }}
                  >
                    {i + 1}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                    {ins}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Mini Category Grid */}
        <div className="results-mini-grid fade-in">
          {CATEGORY_ORDER.map((cat) => {
            const s = categoryScores[cat];
            const c = CATEGORY_COLORS[cat];
            const status = s >= 75 ? 'Strong' : s >= 50 ? 'Good' : s >= 25 ? 'Developing' : 'Critical';

            return (
              <div
                key={cat}
                className="q-card p-4 flex flex-col justify-between text-center"
                style={{ border: `1px solid ${c}30` }}
              >
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: c }}>
                    {CATEGORY_SHORT[cat]}
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 leading-tight">
                    {s}<span className="text-xs font-semibold text-slate-400">%</span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 mt-0.5">{status}</div>
                </div>

                <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s}%`, background: c }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Row 4: Call to Action Banner */}
        <div className="q-card p-8 sm:p-10 text-center fade-in">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
            Ready to Build a Stronger Agency?
          </h2>
          <p className="text-sm text-slate-500 max-w-xl mx-auto mb-6 leading-relaxed">
            Your results reveal exactly where to focus. Book a strategy call to get a custom roadmap for closing your infrastructure gaps.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => setEmailModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-md"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              Email My Results
            </button>
            <button
              onClick={onStartOver}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
              </svg>
              Retake Diagnostic
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
