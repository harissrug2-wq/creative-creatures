import React, { useState, useEffect } from 'react';
import { ChevronLeft, CheckCircle2, Award, TrendingUp, Send, RotateCcw, Calculator, Info, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { CATEGORIES, QUESTIONS } from './questionsData';

export default function App() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});

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
    try {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch (err) {}

    setShowEmailModal(false);
    setIsFinished(true);
  };

  const handleRestart = () => {
    setCurrentIdx(0);
    setAnswers({});
    setIsFinished(false);
    setUserEmail('');
  };

  // Calculation Logic exactly as specified in screenshot 2:
  // Each category points max = (num_questions * 4)
  // Category converted percentage = (scored / max) * 100
  // Category score = Math.round(converted percentage)
  // Overall score = Math.round((sum of 5 category scores) / 5)
  const calculateScores = () => {
    const categoryDetails = {};
    let totalCategoryScoresSum = 0;

    CATEGORIES.forEach(cat => {
      const catQuestions = QUESTIONS.filter(q => q.category === cat.id);
      const maxPoints = catQuestions.length * 4;
      let scoredPoints = 0;

      catQuestions.forEach(q => {
        const answerVal = answers[q.id] !== undefined ? answers[q.id] : 0;
        scoredPoints += answerVal;
      });

      const rawPercentage = maxPoints > 0 ? (scoredPoints / maxPoints) * 100 : 0;
      const convertedPercentage = Math.round(rawPercentage * 10) / 10; // 91.7%
      const categoryScore = Math.round(rawPercentage); // 92

      categoryDetails[cat.id] = {
        name: cat.name,
        subtitle: cat.subtitle,
        questionCount: catQuestions.length,
        maxPoints,
        scoredPoints,
        convertedPercentage,
        categoryScore
      };

      totalCategoryScoresSum += categoryScore;
    });

    const exactAverage = totalCategoryScoresSum / CATEGORIES.length;
    const overallIndexScore = Math.round(exactAverage);

    return {
      categoryDetails,
      totalCategoryScoresSum,
      exactAverage: Math.round(exactAverage * 10) / 10,
      overallIndexScore
    };
  };

  const isCurrentQuestionAnswered = answers[currentQuestion.id] !== undefined;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      <header className="bg-[#f8fafc] px-6 py-5 max-w-7xl w-full mx-auto flex items-center justify-between border-b border-slate-200/60">
        <button 
          onClick={() => alert("Navigating to diagnostic hub...")} 
          className="text-slate-600 hover:text-slate-900 transition-colors text-sm font-medium flex items-center gap-1.5 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to diagnostic hub</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
            {Object.keys(answers).length} / {totalQuestions} Answered
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {!isFinished ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Sidebar Navigation */}
            <aside className="lg:col-span-3 space-y-6">
              <div>
                <span className="text-xs font-semibold text-blue-600 tracking-wide uppercase">Independence Index</span>
                <h1 className="text-2xl font-bold text-slate-900 leading-tight mt-1">
                  Owner Independence Diagnostic
                </h1>
              </div>

              <nav className="space-y-1.5">
                {CATEGORIES.map((cat) => {
                  const isActive = currentQuestion.category === cat.id;
                  const catQuestions = QUESTIONS.filter(q => q.category === cat.id);
                  const isCatDone = catQuestions.every(q => answers[q.id] !== undefined);
                  const answeredCount = catQuestions.filter(q => answers[q.id] !== undefined).length;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        const firstQ = QUESTIONS.findIndex(q => q.category === cat.id);
                        if (firstQ !== -1) setCurrentIdx(firstQ);
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
                          {answeredCount}/{catQuestions.length} Questions
                        </span>
                      </div>
                      <CheckCircle2 className={`w-4 h-4 ${
                        isActive 
                          ? 'text-white' 
                          : isCatDone 
                            ? 'text-emerald-500' 
                            : 'text-slate-300'
                      }`} />
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Question Workspace */}
            <div className="lg:col-span-9 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
                <span className="text-blue-700 font-semibold uppercase tracking-wider">{currentQuestion.categoryName} Category</span>
                <span>Question {currentIdx + 1} of {totalQuestions}</span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-6">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${((currentIdx + 1) / totalQuestions) * 100}%` }}
                />
              </div>

              {/* Question Card */}
              <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-200/80 min-h-[420px] flex flex-col justify-between">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-snug tracking-tight mb-6">
                    {currentQuestion.text}
                  </h2>

                  <div className="grid grid-cols-1 gap-3.5 mt-6">
                    {currentQuestion.options.map((opt) => {
                      const isSelected = answers[currentQuestion.id] === opt.score;
                      return (
                        <button
                          key={opt.label}
                          onClick={() => handleSelectOption(opt.score)}
                          className={`w-full text-left p-4 md:p-5 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer group ${
                            isSelected
                              ? 'bg-blue-50/90 border-blue-600 text-blue-950 shadow-sm'
                              : 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:border-slate-300 hover:bg-slate-100/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 group-hover:border-slate-400 bg-white'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <span className="text-base font-semibold">{opt.label}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-100">
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
                    <span>{currentIdx === totalQuestions - 1 ? 'Save & Finish' : 'Next Question →'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Results Dashboard */
          <div className="max-w-4xl mx-auto space-y-8">
            {(() => {
              const { categoryDetails, totalCategoryScoresSum, exactAverage, overallIndexScore } = calculateScores();

              return (
                <>
                  {/* Score Card Header */}
                  <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-sm text-center md:text-left">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                      <div className="space-y-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                          <Award className="w-3.5 h-3.5" /> Assessment Completed
                        </span>
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                          Owner Independence Index
                        </h2>
                        <p className="text-slate-500 text-sm max-w-lg">
                          Measures overall business autonomy across Decisions, Revenue, Delivery, Leadership, and Strategy.
                        </p>
                      </div>

                      <div className="relative w-40 h-40 flex items-center justify-center flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" stroke="#e2e8f0" strokeWidth="8" fill="transparent" />
                          <circle
                            cx="50"
                            cy="50"
                            r="42"
                            stroke="#2563eb"
                            strokeWidth="8"
                            strokeDasharray={264}
                            strokeDashoffset={264 - (264 * overallIndexScore) / 100}
                            strokeLinecap="round"
                            fill="transparent"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-4xl font-extrabold text-slate-900 font-mono">{overallIndexScore}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Index Score</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Scoring Audit Box matching attached screenshot 2 */}
                  <div className="bg-slate-900 text-white rounded-3xl p-8 border border-slate-800 shadow-lg space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                        <Calculator className="w-5 h-5 text-blue-400" /> The Scoring Logic Breakdown
                      </h3>
                      <span className="text-xs bg-blue-500/20 text-blue-300 font-semibold px-3 py-1 rounded-full border border-blue-500/30">
                        Each category has 20 points
                      </span>
                    </div>

                    {/* Example Audit Display matching user's screenshot format */}
                    <div className="space-y-4 text-sm font-sans">
                      <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 space-y-3">
                        <p className="text-slate-300 font-semibold">Category Conversions & Max Points:</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {CATEGORIES.map(cat => {
                            const details = categoryDetails[cat.id];
                            return (
                              <div key={cat.id} className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
                                <div className="text-xs font-semibold text-slate-400 mb-1">{details.name} ({details.questionCount} questions)</div>
                                <div className="text-xs text-slate-300">
                                  Maximum: <span className="font-mono text-white">{details.maxPoints} points</span>
                                </div>
                                <div className="text-emerald-400 font-mono font-bold mt-1 text-sm">
                                  {details.scoredPoints}/{details.maxPoints} = {details.convertedPercentage}%
                                </div>
                                <div className="text-xs text-slate-400 mt-1">
                                  Category Score: <span className="font-bold text-white">{details.categoryScore}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Overall Index Math Calculation */}
                      <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 space-y-2">
                        <p className="text-slate-300 font-semibold">Overall Owner Independence Score Calculation:</p>
                        <div className="p-4 rounded-xl bg-slate-950 font-mono text-emerald-400 text-sm overflow-x-auto">
                          {CATEGORIES.map(cat => categoryDetails[cat.id].categoryScore).join(' + ')} = {totalCategoryScoresSum} ÷ 5 = {exactAverage}
                        </div>
                        <div className="text-base font-bold text-white pt-1">
                          Owner Independence Index Score: <span className="text-blue-400 text-xl font-mono">{overallIndexScore}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Visual Category Cards */}
                  <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" /> Category Breakdown
                    </h3>
                    <div className="space-y-5">
                      {CATEGORIES.map(cat => {
                        const details = categoryDetails[cat.id];
                        return (
                          <div key={cat.id} className="space-y-2">
                            <div className="flex justify-between items-center text-sm font-medium">
                              <span className="text-slate-800 font-semibold">{cat.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-400 font-mono">({details.scoredPoints}/{details.maxPoints} pts = {details.convertedPercentage}%)</span>
                                <span className="font-mono text-slate-900 font-bold bg-slate-100 px-2.5 py-0.5 rounded-lg text-sm">
                                  {details.categoryScore}
                                </span>
                              </div>
                            </div>
                            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                              <div 
                                className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${details.categoryScore}%` }} 
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
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
                      <RotateCcw className="w-4 h-4" /> Retake Diagnostic
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
            <h3 className="text-xl font-bold text-slate-900 mb-2">Save & View Diagnostic Results</h3>
            <p className="text-slate-500 text-sm mb-6">Enter your email address to generate your complete Owner Independence Index breakdown.</p>
            <form onSubmit={handleFinish} className="space-y-4">
              <input
                type="email"
                required
                placeholder="founder@company.com"
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
                  className="w-1/2 py-2.5 rounded-full bg-blue-600 text-white text-sm font-medium cursor-pointer font-semibold shadow-md shadow-blue-500/20"
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
