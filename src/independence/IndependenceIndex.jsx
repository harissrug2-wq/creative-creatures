import React, { useState, useEffect } from 'react';
import {
  ChevronLeft, CheckCircle2, Award, TrendingUp,
  Send, RotateCcw, Calculator, Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CATEGORIES, QUESTIONS } from './questionsData.js';

// ─── Default answer state ────────────────────────────────────────────────────
const DEFAULT_ANSWERS = {
  24: { strategic: 50, operational: 50 },
  25: {
    Sales: 50,
    'Client Delivery': 50,
    Leadership: 50,
    Marketing: 50,
    Hiring: 50,
    Finance: 50,
  },
};

// ─── Score calculation ────────────────────────────────────────────────────────
function calculateScores(answers) {
  const categoryDetails = {};

  CATEGORIES.forEach(cat => {
    const catQs = QUESTIONS.filter(q => q.category === cat.id);

    if (cat.id === 'strategic') {
      // Part A: strategic % is the direct score (0–100)
      const stratPct = answers[24]?.strategic ?? 50;

      // Part B: average of the 6 activity matrix scores (0 / 50 / 100)
      const matrixObj = answers[25] || {};
      const matrixVals = Object.values(matrixObj);
      const matrixAvg =
        matrixVals.length > 0
          ? matrixVals.reduce((a, b) => a + b, 0) / matrixVals.length
          : 50;

      const rawScore = (stratPct + matrixAvg) / 2;
      const categoryScore = Math.round(rawScore);

      categoryDetails[cat.id] = {
        name: cat.name,
        subtitle: cat.subtitle,
        questionCount: catQs.length,
        maxPoints: null,             // not applicable for strategic
        scoredPoints: null,
        convertedPercentage: Math.round(rawScore * 10) / 10,
        categoryScore,
        stratPct,
        matrixAvg: Math.round(matrixAvg * 10) / 10,
      };
    } else {
      // Standard categories: each question scored 0–4
      const maxPoints = catQs.length * 4;
      const scoredPoints = catQs.reduce((sum, q) => {
        return sum + (answers[q.id] !== undefined ? answers[q.id] : 0);
      }, 0);

      const convertedPercentage = maxPoints > 0
        ? Math.round((scoredPoints / maxPoints) * 1000) / 10   // one decimal
        : 0;
      const categoryScore = Math.round(convertedPercentage);

      categoryDetails[cat.id] = {
        name: cat.name,
        subtitle: cat.subtitle,
        questionCount: catQs.length,
        maxPoints,
        scoredPoints,
        convertedPercentage,
        categoryScore,
      };
    }
  });

  const totalCategoryScoresSum = CATEGORIES.reduce(
    (sum, cat) => sum + categoryDetails[cat.id].categoryScore, 0,
  );
  const exactAverage = Math.round((totalCategoryScoresSum / CATEGORIES.length) * 10) / 10;
  const overallIndexScore = Math.round(exactAverage);
  const validationAnswer = answers[26];
  const validationScore = validationAnswer === undefined ? null : validationAnswer * 25;
  const mismatch = validationScore === null ? null : Math.abs(validationScore - overallIndexScore);
  let validationStatus = 'Needs Validation';
  let confidenceScore = 60;
  if (mismatch !== null && mismatch > 30) {
    validationStatus = 'Significant Contradiction';
    confidenceScore = Math.max(35, Math.round(60 - (mismatch - 30)));
  } else if (mismatch !== null && mismatch > 15) {
    confidenceScore = Math.max(45, Math.round(60 - (mismatch - 15) * 0.6));
  }

  return { categoryDetails, totalCategoryScoresSum, exactAverage, overallIndexScore, validationAnswer, validationScore, mismatch, validationStatus, confidenceScore };
}

// ─── App component ────────────────────────────────────────────────────────────
export default function App() {
  const [currentIdx, setCurrentIdx] = useState(() => {
    const saved = Number(localStorage.getItem('ccIndependenceCurrentQuestion'));
    return Number.isFinite(saved) && saved >= 0 && saved < QUESTIONS.length ? saved : 0;
  });
  const [answers, setAnswers] = useState(() => {
    try { return { ...DEFAULT_ANSWERS, ...JSON.parse(localStorage.getItem('ccIndependenceAnswers') || '{}') }; }
    catch { return { ...DEFAULT_ANSWERS }; }
  });
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isFinished, setIsFinished] = useState(false);

  const currentQuestion = QUESTIONS[currentIdx];
  const totalQuestions = QUESTIONS.length;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentIdx]);

  useEffect(() => {
    localStorage.setItem('ccIndependenceAnswers', JSON.stringify(answers));
    localStorage.setItem('ccIndependenceCurrentQuestion', String(currentIdx));
    const answered = QUESTIONS.filter(q => {
      if (q.type === 'strategic-sliders' || q.type === 'activity-matrix') return true;
      return answers[q.id] !== undefined;
    }).length;
    const progress = Math.min(99, Math.round((answered / QUESTIONS.length) * 100));
    localStorage.setItem('ccIndexIndependenceProgress', String(progress));
    window.CCDiagnostic?.setProgress?.('independence', progress);
  }, [answers, currentIdx]);

  // ── Answer handlers ──────────────────────────────────────────────────────
  const handleSelectOption = score =>
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: score }));

  const handleStrategicSlider = val => {
    const num = Math.min(100, Math.max(0, parseInt(val) || 0));
    setAnswers(prev => ({
      ...prev,
      24: { strategic: num, operational: 100 - num },
    }));
  };

  const handleMatrixSelect = (activity, score) =>
    setAnswers(prev => ({
      ...prev,
      25: { ...(prev[25] || {}), [activity]: score },
    }));

  // ── Navigation ───────────────────────────────────────────────────────────
  const handleNext = () => {
    if (currentIdx < totalQuestions - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentIdx > 0) setCurrentIdx(prev => prev - 1);
  };

  const handleFinish = e => {
    e?.preventDefault?.();
    const { overallIndexScore } = calculateScores(answers);
    window.CCDiagnostic?.mark?.('independence', overallIndexScore, { answers, scores: calculateScores(answers) });
    if (!window.CCDiagnostic) {
      localStorage.setItem('ownerIndependenceScore', overallIndexScore);
      localStorage.setItem('ccIndexIndependenceComplete', 'true');
      localStorage.setItem('ccIndexIndependenceProgress', '100');
    }
    setShowEmailModal(false);
    window.location.href = '/diagnostic/';
  };

  const handleRestart = () => {
    setCurrentIdx(0);
    setAnswers({ ...DEFAULT_ANSWERS });
    setIsFinished(false);
    setUserEmail('');
    ['ccIndependenceAnswers','ccIndependenceCurrentQuestion','ownerIndependenceScore','ccIndexIndependenceComplete','ccIndexIndependenceProgress'].forEach(key => localStorage.removeItem(key));
    window.CCDiagnostic?.invalidateReport?.();
  };

  // ── Answered count helpers ────────────────────────────────────────────────
  const isQuestionAnswered = q => {
    if (q.type === 'strategic-sliders') return true;     // always has default
    if (q.type === 'activity-matrix') return true;        // always has defaults
    return answers[q.id] !== undefined;
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">

      {/* ── Header ── */}
      <header className="bg-[#f8fafc] px-6 py-5 max-w-7xl w-full mx-auto flex items-center justify-between border-b border-slate-200/60">
        <button
          onClick={() => { window.location.href = '/diagnostic/'; }}
          className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to diagnostic hub
        </button>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
          {QUESTIONS.filter(isQuestionAnswered).length} / {totalQuestions} Answered
        </span>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">

        {/* ═══════════════ QUIZ SCREEN ═══════════════ */}
        {!isFinished ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Sidebar */}
            <aside className="lg:col-span-3 space-y-6">
              <div>
                <span className="text-xs font-semibold text-blue-600 tracking-wide uppercase">Independence Index</span>
                <h1 className="text-2xl font-bold text-slate-900 leading-tight mt-1">
                  Owner Independence Diagnostic
                </h1>
              </div>

              <nav className="space-y-1.5">
                {CATEGORIES.map(cat => {
                  const isActive = currentQuestion.category === cat.id;
                  const catQs = QUESTIONS.filter(q => q.category === cat.id);
                  const isCatDone = catQs.every(isQuestionAnswered);
                  const answeredCount = catQs.filter(isQuestionAnswered).length;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        const idx = QUESTIONS.findIndex(q => q.category === cat.id);
                        if (idx !== -1) setCurrentIdx(idx);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-medium flex items-center justify-between transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold'
                          : 'bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{cat.name}</span>
                        <span className={`text-[11px] ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                          {answeredCount}/{catQs.length} Questions
                        </span>
                      </div>
                      <CheckCircle2 className={`w-4 h-4 ${
                        isActive ? 'text-white' : isCatDone ? 'text-emerald-500' : 'text-slate-300'
                      }`} />
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Question workspace */}
            <div className="lg:col-span-9 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                <span className="text-blue-700 font-semibold uppercase tracking-wider">
                  {currentQuestion.categoryName} Category
                </span>
                <span>Question {currentIdx + 1} of {totalQuestions}</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-6">
                <div
                  className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${((currentIdx + 1) / totalQuestions) * 100}%` }}
                />
              </div>

              {/* Question card */}
              <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-200/80 flex flex-col gap-6">

                {/* Question text */}
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-snug tracking-tight">
                    {currentQuestion.text}
                  </h2>
                  {currentQuestion.subtitle && (
                    <p className="text-slate-500 text-sm mt-2">{currentQuestion.subtitle}</p>
                  )}
                </div>

                {/* ── MCQ (choice) ── */}
                {currentQuestion.type === 'choice' && (
                  <div className="grid grid-cols-1 gap-3">
                    {currentQuestion.options.map(opt => {
                      const isSelected = answers[currentQuestion.id] === opt.score;
                      return (
                        <button
                          key={opt.label}
                          onClick={() => handleSelectOption(opt.score)}
                          className={`w-full text-left p-4 md:p-5 rounded-2xl border-2 transition-all flex items-center gap-3 cursor-pointer group ${
                            isSelected
                              ? 'bg-blue-50/90 border-blue-600 text-blue-950 shadow-sm'
                              : 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:border-slate-300 hover:bg-slate-100/60'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 group-hover:border-slate-400 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                          <span className="text-base font-semibold">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ── Part A: Strategic / Operational slider ── */}
                {currentQuestion.type === 'strategic-sliders' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Strategic */}
                      <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-bold text-slate-900 text-sm">Strategic Work</span>
                          <span className="text-2xl font-extrabold font-mono text-blue-600">
                            {answers[24]?.strategic ?? 50}%
                          </span>
                        </div>
                        <ul className="text-xs text-slate-500 space-y-1 pl-4 list-disc">
                          {currentQuestion.strategicItems.map(item => <li key={item}>{item}</li>)}
                        </ul>
                      </div>

                      {/* Operational */}
                      <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-bold text-slate-900 text-sm">Operational Work</span>
                          <span className="text-2xl font-extrabold font-mono text-amber-600">
                            {answers[24]?.operational ?? 50}%
                          </span>
                        </div>
                        <ul className="text-xs text-slate-500 space-y-1 pl-4 list-disc">
                          {currentQuestion.operationalItems.map(item => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    </div>

                    {/* Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-slate-400 font-medium">
                        <span>100% Operational</span>
                        <span>100% Strategic</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={answers[24]?.strategic ?? 50}
                        onChange={e => handleStrategicSlider(e.target.value)}
                        className="w-full"
                      />
                      <p className="text-xs text-slate-400 text-center">
                        Creature automatically groups these into Strategic % and Operational %
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Part B: Activity matrix ── */}
                {currentQuestion.type === 'activity-matrix' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[480px]">
                      <thead>
                        <tr className="border-b-2 border-slate-200">
                          <th className="py-3 px-4 text-sm font-bold text-slate-700">Activity</th>
                          {currentQuestion.matrixOptions.map(opt => (
                            <th key={opt.label} className="py-3 px-4 text-sm font-bold text-slate-700 text-center">
                              {opt.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentQuestion.activities.map(act => {
                          const currentScore = answers[25]?.[act] ?? 50;
                          return (
                            <tr key={act} className="hover:bg-slate-50 transition-colors">
                              <td className="py-4 px-4 font-semibold text-slate-800 text-sm">{act}</td>
                              {currentQuestion.matrixOptions.map(opt => {
                                const isSelected = currentScore === opt.score;
                                return (
                                  <td key={opt.label} className="py-4 px-4 text-center">
                                    <button
                                      onClick={() => handleMatrixSelect(act, opt.score)}
                                      className={`w-6 h-6 rounded-full border-2 mx-auto flex items-center justify-center transition-all cursor-pointer ${
                                        isSelected
                                          ? 'border-blue-600 bg-blue-600'
                                          : 'border-slate-300 hover:border-slate-400 bg-white'
                                      }`}
                                    >
                                      {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Nav buttons ── */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    onClick={handleBack}
                    disabled={currentIdx === 0}
                    className={`px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-1.5 transition-all ${
                      currentIdx === 0
                        ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>

                  <button
                    onClick={handleNext}
                    className="px-6 py-2.5 rounded-full font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer transition-all"
                  >
                    {currentIdx === totalQuestions - 1 ? 'Save & Finish' : 'Next Question →'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        ) : (

          /* ═══════════════ RESULTS SCREEN ═══════════════ */
          (() => {
            const { categoryDetails, totalCategoryScoresSum, exactAverage, overallIndexScore } = calculateScores(answers);

            return (
              <div className="max-w-4xl mx-auto space-y-8">

                {/* ── Hero score card ── */}
                <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-sm">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="space-y-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                        <Award className="w-3.5 h-3.5" /> Assessment Completed
                      </span>
                      <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                        Owner Independence Index
                      </h2>
                      <p className="text-slate-500 text-sm max-w-lg">
                        Measures overall business autonomy across Decisions, Revenue, Delivery, Leadership & Strategy.
                      </p>
                    </div>

                    {/* Circular gauge */}
                    <div className="relative w-40 h-40 flex-shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" stroke="#e2e8f0" strokeWidth="8" fill="transparent" />
                        <circle
                          cx="50" cy="50" r="42"
                          stroke="#2563eb" strokeWidth="8"
                          strokeDasharray={264}
                          strokeDashoffset={264 - (264 * overallIndexScore) / 100}
                          strokeLinecap="round" fill="transparent"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl font-extrabold text-slate-900 font-mono">{overallIndexScore}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Index Score</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Scoring breakdown (dark card) ── */}
                <div className="bg-slate-900 text-white rounded-3xl p-8 border border-slate-800 shadow-lg space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-blue-400" /> Scoring Breakdown
                    </h3>
                  </div>

                  {/* Per-category cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CATEGORIES.map(cat => {
                      const d = categoryDetails[cat.id];
                      const isStrategic = cat.id === 'strategic';
                      return (
                        <div key={cat.id} className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 space-y-1">
                          <div className="text-xs font-semibold text-slate-400">{d.name} ({d.questionCount} questions)</div>
                          {isStrategic ? (
                            <>
                              <div className="text-xs text-slate-300">
                                Part A (Strategic %): <span className="font-mono text-white">{d.stratPct}%</span>
                              </div>
                              <div className="text-xs text-slate-300">
                                Part B (Activity avg): <span className="font-mono text-white">{d.matrixAvg}</span>
                              </div>
                              <div className="text-emerald-400 font-mono font-bold text-sm">
                                ({d.stratPct} + {d.matrixAvg}) ÷ 2 = {d.convertedPercentage}%
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-xs text-slate-300">
                                Maximum: <span className="font-mono text-white">{d.maxPoints} pts</span>
                              </div>
                              <div className="text-emerald-400 font-mono font-bold text-sm">
                                {d.scoredPoints}/{d.maxPoints} = {d.convertedPercentage}%
                              </div>
                            </>
                          )}
                          <div className="text-xs text-slate-400 pt-1">
                            Category Score: <span className="font-bold text-white text-sm">{d.categoryScore}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Overall formula */}
                  <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 space-y-2">
                    <p className="text-slate-300 font-semibold text-sm">Overall Owner Independence Score:</p>
                    <div className="p-4 rounded-xl bg-slate-950 font-mono text-emerald-400 text-sm overflow-x-auto">
                      {CATEGORIES.map(cat => categoryDetails[cat.id].categoryScore).join(' + ')} = {totalCategoryScoresSum} ÷ 5 = {exactAverage}
                    </div>
                    <div className="text-base font-bold text-white pt-1">
                      Owner Independence Index Score:{' '}
                      <span className="text-blue-400 text-xl font-mono">{overallIndexScore}</span>
                    </div>
                  </div>
                </div>

                {/* ── Visual bars ── */}
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" /> Category Breakdown
                  </h3>
                  <div className="space-y-5">
                    {CATEGORIES.map(cat => {
                      const d = categoryDetails[cat.id];
                      return (
                        <div key={cat.id} className="space-y-2">
                          <div className="flex justify-between items-center text-sm font-medium">
                            <span className="text-slate-800 font-semibold">{cat.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400 font-mono">
                                {d.convertedPercentage}%
                              </span>
                              <span className="font-mono text-slate-900 font-bold bg-slate-100 px-2.5 py-0.5 rounded-lg">
                                {d.categoryScore}
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${d.categoryScore}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Actions ── */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setShowEmailModal(true)}
                    className="px-6 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center gap-2 cursor-pointer shadow-md shadow-blue-500/20"
                  >
                    <Send className="w-4 h-4" /> Email Results
                  </button>
                  <button
                    onClick={handleRestart}
                    className="px-6 py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> Retake Diagnostic
                  </button>
                </div>
              </div>
            );
          })()
        )}
      </main>

      {/* ── Email Modal ── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Save & View Results</h3>
            <p className="text-slate-500 text-sm mb-6">
              Enter your email to receive your complete Owner Independence Index breakdown.
            </p>
            <form onSubmit={handleFinish} className="space-y-4">
              <input
                type="email"
                required
                placeholder="founder@company.com"
                value={userEmail}
                onChange={e => setUserEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 text-sm"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="w-1/2 py-2.5 rounded-full bg-slate-100 text-slate-600 text-sm font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-full bg-blue-600 text-white text-sm font-semibold cursor-pointer shadow-md shadow-blue-500/20"
                >
                  View Results
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}