import React, { useState, useEffect } from 'react';
import { ChevronLeft, CheckCircle2, Award, ShieldAlert, TrendingUp, Sparkles, Send, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CATEGORIES, QUESTIONS } from './questionsData';

export default function App() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({
    // default slider value 4 for slider questions
    1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 12: 4, 13: 4, 14: 4, 15: 4, 18: 4, 19: 4, 20: 4, 21: 4, 23: 4,
    // default Q24: strategic 50, operational 50
    24: { strategic: 50, operational: 50 },
    // default Q25 matrix selections
    25: {
      Sales: 50,
      'Client Delivery': 50,
      Leadership: 50,
      Marketing: 50,
      Hiring: 50,
      Finance: 50
    }
  });

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isFinished, setIsFinished] = useState(false);

  const currentQuestion = QUESTIONS[currentIdx];
  const totalQuestions = QUESTIONS.length;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentIdx]);

  const handleSelectOption = (score) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: score
    }));
  };

  const handleSliderChange = (val) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: parseInt(val)
    }));
  };

  const handleStrategicSlider = (val) => {
    const num = Math.min(100, Math.max(0, parseInt(val) || 0));
    setAnswers(prev => ({
      ...prev,
      24: {
        strategic: num,
        operational: 100 - num
      }
    }));
  };

  const handleMatrixSelect = (activity, score) => {
    setAnswers(prev => ({
      ...prev,
      25: {
        ...(prev[25] || {}),
        [activity]: score
      }
    }));
  };

  const handleNext = () => {
    if (currentIdx < totalQuestions - 1) {
      setCurrentIdx(prev => prev + 1);
    } else {
      setShowEmailModal(true);
    }
  };

  const handleBack = () => {
    if (currentIdx > 0) {
      setCurrentIdx(prev => prev - 1);
    }
  };

  const handleFinish = (e) => {
    e.preventDefault();
    console.log("=== OWNER INDEPENDENCE INDEX SUBMISSION ===");
    console.log("User Email:", userEmail);
    console.log("Answers:", answers);
    
    try {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch (err) {}

    setShowEmailModal(false);
    setIsFinished(true);
  };

  const handleRestart = () => {
    setCurrentIdx(0);
    setAnswers({
      1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 12: 4, 13: 4, 14: 4, 15: 4, 18: 4, 19: 4, 20: 4, 21: 4, 23: 4,
      24: { strategic: 50, operational: 50 },
      25: {
        Sales: 50,
        'Client Delivery': 50,
        Leadership: 50,
        Marketing: 50,
        Hiring: 50,
        Finance: 50
      }
    });
    setIsFinished(false);
    setUserEmail('');
  };

  const calculateScores = () => {
    const categoryScores = {
      decision: [],
      revenue: [],
      delivery: [],
      leadership: [],
      strategic: []
    };

    QUESTIONS.forEach(q => {
      if (q.category === 'validation') return;

      if (q.type === 'slider') {
        const val = answers[q.id] !== undefined ? answers[q.id] : 0;
        const normalized = (val / 10) * 100;
        categoryScores[q.category].push(normalized);
      } else if (q.type === 'choice') {
        const scoreVal = answers[q.id] !== undefined ? answers[q.id] : 0;
        const normalized = (scoreVal / 4) * 100;
        categoryScores[q.category].push(normalized);
      } else if (q.id === 24) {
        const stratPct = answers[24]?.strategic || 50;
        categoryScores.strategic.push(stratPct);
      } else if (q.id === 25) {
        const actObj = answers[25] || {};
        const vals = Object.values(actObj);
        const avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
        categoryScores.strategic.push(avg);
      }
    });

    const categoryAverages = {
      decision: Math.round(categoryScores.decision.reduce((a, b) => a + b, 0) / (categoryScores.decision.length || 1)),
      revenue: Math.round(categoryScores.revenue.reduce((a, b) => a + b, 0) / (categoryScores.revenue.length || 1)),
      delivery: Math.round(categoryScores.delivery.reduce((a, b) => a + b, 0) / (categoryScores.delivery.length || 1)),
      leadership: Math.round(categoryScores.leadership.reduce((a, b) => a + b, 0) / (categoryScores.leadership.length || 1)),
      strategic: Math.round(categoryScores.strategic.reduce((a, b) => a + b, 0) / (categoryScores.strategic.length || 1))
    };

    const overallScore = Math.round(
      (categoryAverages.decision * 0.20) +
      (categoryAverages.revenue * 0.20) +
      (categoryAverages.delivery * 0.20) +
      (categoryAverages.leadership * 0.20) +
      (categoryAverages.strategic * 0.20)
    );

    const q26Val = answers[26] !== undefined ? answers[26] : 0;
    const q26Normalized = (q26Val / 4) * 100;
    const scoreDiff = Math.abs(overallScore - q26Normalized);
    const hasInconsistency = scoreDiff > 30;
    const confidenceScore = hasInconsistency ? Math.max(40, 100 - Math.round(scoreDiff)) : 95;

    return {
      categoryAverages,
      overallScore,
      q26Normalized,
      hasInconsistency,
      confidenceScore
    };
  };

  const getInsights = (categoryAverages) => {
    const sorted = Object.entries(categoryAverages).sort((a, b) => a[1] - b[1]);
    const insightsMap = {
      decision: "Delegation Gap: Decision-making is bottlenecked at the founder level.",
      revenue: "Sales Dependency: New business relies heavily on founder involvement.",
      delivery: "Fulfillment Risk: Clients look directly to you for assurance or delivery.",
      leadership: "Leadership Coaching Needed: The team requires more autonomy to lead.",
      strategic: "Time & Activity Trapped: Too much bandwidth is spent firefighting operational work."
    };

    return sorted.slice(0, 3).map(([cat, score]) => ({
      category: cat.charAt(0).toUpperCase() + cat.slice(1),
      score,
      text: insightsMap[cat]
    }));
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-[#f8fafc] px-6 py-5 max-w-7xl w-full mx-auto flex items-center justify-between">
        <button 
          onClick={() => alert("Navigating to diagnostic hub...")} 
          className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to diagnostic hub</span>
        </button>
      </header>

      {/* Main Container with Sidebar + Main Card matching screenshot */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 pb-12">
        {!isFinished ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Navigation Sidebar */}
            <aside className="lg:col-span-3 space-y-6">
              <div>
                <span className="text-xs font-medium text-blue-600 tracking-wide uppercase">Independence</span>
                <h1 className="text-2xl font-bold text-slate-900 leading-tight mt-1">
                  Owner Independence Index
                </h1>
              </div>

              <nav className="space-y-1">
                {CATEGORIES.map((cat) => {
                  const isActive = currentQuestion.category === cat.id;
                  const catQuestions = QUESTIONS.filter(q => q.category === cat.id);
                  const isCatDone = catQuestions.every(q => answers[q.id] !== undefined || q.id === 24 || q.id === 25);

                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        const firstQ = QUESTIONS.findIndex(q => q.category === cat.id);
                        if (firstQ !== -1) setCurrentIdx(firstQ);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-medium flex items-center justify-between transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-100/70 text-blue-950 font-semibold'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
                      }`}
                    >
                      <span>{cat.name}</span>
                      <CheckCircle2 className={`w-4 h-4 ${isCatDone ? 'text-emerald-500' : 'text-slate-300'}`} />
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Right Question Card Area */}
            <div className="lg:col-span-9 space-y-3">
              
              {/* Category Subhead & Progress bar */}
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1">
                <span className="text-slate-600 font-medium">{currentQuestion.categoryName}</span>
                <span>Question {currentIdx + 1} of {totalQuestions}</span>
              </div>
              
              {/* Top blue bar progress indicator */}
              <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden mb-6">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${((currentIdx + 1) / totalQuestions) * 100}%` }}
                />
              </div>

              {/* Main White Card matching reference screenshot */}
              <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-200/80 min-h-[400px] flex flex-col justify-between">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-snug tracking-tight mb-2">
                    {currentQuestion.text}
                  </h2>
                  
                  {currentQuestion.subtitle && (
                    <p className="text-slate-500 text-sm mb-6">{currentQuestion.subtitle}</p>
                  )}

                  {/* SLIDER TYPE QUESTION (matching screenshot layout) */}
                  {currentQuestion.type === 'slider' && (
                    <div className="mt-8 space-y-6">
                      <p className="text-sm text-slate-500 font-medium">
                        0 = none &nbsp;•&nbsp; 10 = essentially all
                      </p>

                      <div className="text-center my-6">
                        <span className="text-4xl font-extrabold text-slate-900 font-mono">
                          {answers[currentQuestion.id] ?? 4}
                        </span>
                      </div>

                      <div className="relative pt-2 pb-2">
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="1"
                          value={answers[currentQuestion.id] ?? 4}
                          onChange={(e) => handleSliderChange(e.target.value)}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-slate-400 font-medium mt-2">
                          <span>0</span>
                          <span>10</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CHOICE TYPE QUESTION */}
                  {currentQuestion.type === 'choice' && (
                    <div className="grid grid-cols-1 gap-3 mt-6">
                      {currentQuestion.options.map((opt) => {
                        const isSelected = answers[currentQuestion.id] === opt.score;
                        return (
                          <button
                            key={opt.label}
                            onClick={() => handleSelectOption(opt.score)}
                            className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                              isSelected
                                ? 'bg-blue-50/80 border-blue-600 text-blue-950 shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100/50'
                            }`}
                          >
                            <span className="text-base font-medium">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* STRATEGIC SLIDERS (Q24) */}
                  {currentQuestion.id === 24 && (
                    <div className="mt-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-slate-900 text-sm">Strategic Work</span>
                            <span className="text-xl font-bold font-mono text-blue-600">
                              {answers[24]?.strategic || 50}%
                            </span>
                          </div>
                          <ul className="text-xs text-slate-500 space-y-1 pl-4 list-disc">
                            {currentQuestion.strategicItems.map(item => <li key={item}>{item}</li>)}
                          </ul>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-slate-900 text-sm">Operational Work</span>
                            <span className="text-xl font-bold font-mono text-amber-600">
                              {answers[24]?.operational || 50}%
                            </span>
                          </div>
                          <ul className="text-xs text-slate-500 space-y-1 pl-4 list-disc">
                            {currentQuestion.operationalItems.map(item => <li key={item}>{item}</li>)}
                          </ul>
                        </div>
                      </div>

                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={answers[24]?.strategic || 50}
                        onChange={(e) => handleStrategicSlider(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* ACTIVITY MATRIX (Q25) */}
                  {currentQuestion.id === 25 && (
                    <div className="mt-6 overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[500px]">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase">
                            <th className="py-3 px-3">Activity</th>
                            {currentQuestion.matrixOptions.map(opt => (
                              <th key={opt.label} className="py-3 px-3 text-center">{opt.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {currentQuestion.activities.map(act => {
                            const currentScore = answers[25]?.[act] ?? 50;
                            return (
                              <tr key={act}>
                                <td className="py-3.5 px-3 font-medium text-slate-900 text-sm">{act}</td>
                                {currentQuestion.matrixOptions.map(opt => {
                                  const isSelected = currentScore === opt.score;
                                  return (
                                    <td key={opt.label} className="py-3.5 px-3 text-center">
                                      <button
                                        onClick={() => handleMatrixSelect(act, opt.score)}
                                        className={`w-5 h-5 rounded-full border mx-auto flex items-center justify-center transition-all cursor-pointer ${
                                          isSelected
                                            ? 'border-blue-600 bg-blue-600'
                                            : 'border-slate-300 hover:border-slate-400 bg-white'
                                        }`}
                                      />
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

                </div>

                {/* Bottom Card Navigation Buttons matching screenshot */}
                <div className="flex items-center justify-between mt-10 pt-6">
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
                    Back
                  </button>

                  <button
                    onClick={handleNext}
                    className="px-6 py-2.5 rounded-full font-medium text-sm bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer transition-all"
                  >
                    <span>{currentIdx === totalQuestions - 1 ? 'Save & finish' : 'Next →'}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* RESULTS DASHBOARD */
          <div className="max-w-4xl mx-auto space-y-8">
            {(() => {
              const { categoryAverages, overallScore, confidenceScore, hasInconsistency } = calculateScores();
              const insights = getInsights(categoryAverages);

              return (
                <>
                  <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-sm text-center md:text-left">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                      <div className="space-y-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                          <Award className="w-3.5 h-3.5" /> Diagnostic Completed
                        </span>
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                          Owner Independence Score
                        </h2>
                        <p className="text-slate-500 text-sm max-w-lg">
                          Measures your business's ability to generate revenue, make decisions, and deliver service without owner involvement.
                        </p>
                      </div>

                      <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" stroke="#e2e8f0" strokeWidth="8" fill="transparent" />
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            stroke="#2563eb"
                            strokeWidth="8"
                            strokeDasharray={264}
                            strokeDashoffset={264 - (264 * overallScore) / 100}
                            strokeLinecap="round"
                            fill="transparent"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-3xl font-bold text-slate-900 font-mono">{overallScore}%</span>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Overall Index</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" /> Category Scores
                    </h3>
                    <div className="space-y-4">
                      {CATEGORIES.map(cat => (
                        <div key={cat.id} className="space-y-1.5">
                          <div className="flex justify-between text-sm font-medium">
                            <span className="text-slate-700">{cat.name}</span>
                            <span className="font-mono text-slate-900">{categoryAverages[cat.id]}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full" style={{ width: `${categoryAverages[cat.id]}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4">
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
                      <RotateCcw className="w-4 h-4" /> Start Over
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </main>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Save & Receive Results</h3>
            <p className="text-slate-500 text-sm mb-6">Enter your email address to complete the diagnostic.</p>
            <form onSubmit={handleFinish} className="space-y-4">
              <input
                type="email"
                required
                placeholder="founder@agency.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
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
                  className="w-1/2 py-2.5 rounded-full bg-blue-600 text-white text-sm font-medium cursor-pointer"
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
