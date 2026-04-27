import { useState } from "react";
import { Sparkles, ArrowRight, X, CheckCircle2 } from "lucide-react";

const SmartServiceAssistant = ({ onRecommend, services }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0); // 0: Start, 1: Vehicle Size, 2: Primary Goal, 3: Specific Issues, 4: Result
  const [answers, setAnswers] = useState({
    size: "",
    goal: "",
    condition: "",
    issue: ""
  });

  const QUESTIONS = [
    {
      title: "What is your vehicle size?",
      field: "size",
      options: [
        { label: "Sedan / Hatchback", value: "small" },
        { label: "SUV / Crossover", value: "medium" },
        { label: "Pickup / Van / Large SUV", value: "large" }
      ]
    },
    {
      title: "What is your primary goal?",
      field: "goal",
      options: [
        { label: "Deep Clean (Interior + Exterior)", value: "full" },
        { label: "Exterior Shine & Protection", value: "shine" },
        { label: "Interior Refresh", value: "interior" }
      ]
    },
    {
      title: "Vehicle Condition?",
      field: "condition",
      options: [
        { label: "Well Maintained (New/Regularly Cleaned)", value: "good" },
        { label: "Needs Attention (Daily Driver)", value: "average" },
        { label: "Heavily Soiled / Neglected", value: "poor" }
      ]
    },
    {
      title: "Any specific issues?",
      field: "issue",
      options: [
        { label: "Scratches / Swirl Marks", value: "scratches" },
        { label: "Foul Odor / Pet Hair", value: "odor" },
        { label: "Hard Water Spots", value: "water_spots" },
        { label: "None, just maintenance", value: "none" }
      ]
    }
  ];


  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const getRecommendation = () => {
    // Flatten services
    const allServices = [
      ...(services.exterior || []),
      ...(services.interior || []),
      ...(services.specialized || [])
    ];

    if (allServices.length === 0) return [];

    let recommendations = [];
    const lowerGoal = answers.goal.toLowerCase();

    // Helper to find service by keyword
    const findByKeyword = (keywords, category = null) => {
      return allServices.find(s => {
        const name = (s.name || "").toLowerCase();
        const description = (s.description || "").toLowerCase();
        const matchesKeyword = keywords.some(k => name.includes(k) || description.includes(k));
        const matchesCategory = !category || (s.category || "").toUpperCase() === category.toUpperCase();
        return matchesKeyword && matchesCategory;
      });
    };

    if (lowerGoal === "full") {
      // Look for full detailing packages first
      const fullDetail = findByKeyword(["premium", "full", "ultimate", "deluxe", "platinum", "all-in", "complete"]);
      if (fullDetail) {
        recommendations.push({ ...fullDetail, reason: `Our most comprehensive protection for your ${answers.size} vehicle.` });
      } else {
        // Fallback: pick the highest priced exterior and interior service
        const bestExt = [...(services.exterior || [])].sort((a, b) => b.price - a.price)[0];
        const bestInt = [...(services.interior || [])].sort((a, b) => b.price - a.price)[0];
        if (bestExt) recommendations.push({ ...bestExt, reason: "Top-tier exterior care for maximum protection." });
        if (bestInt) recommendations.push({ ...bestInt, reason: "Deep interior sanitization and refresh." });
      }
    } else if (lowerGoal === "shine") {
      const shine = findByKeyword(["wax", "polish", "buff", "glaze", "sealant", "paint correction"]);
      if (shine) recommendations.push({ ...shine, reason: "Restores deep gloss and adds a hydrophobic layer." });
      
      const protection = findByKeyword(["ceramic", "coating", "graphene", "paint protection"], "SPECIALIZED");
      if (protection) recommendations.push({ ...protection, reason: "Professional-grade shield against UV and water spots." });
    } else if (lowerGoal === "interior") {
      const deepClean = findByKeyword(["deep", "shampoo", "steam", "vacuum", "leather", "upholstery", "disinfect"], "INTERIOR");
      if (deepClean) {
        recommendations.push({ ...deepClean, reason: "Total interior restoration and fresh scent." });
      } else {
        const anyInt = (services.interior || [])[0];
        if (anyInt) recommendations.push({ ...anyInt, reason: "Essential interior maintenance for a cleaner cabin." });
      }
    }

    // Specialized Add-ons based on issues
    if (answers.issue === "scratches") {
      const correction = findByKeyword(["correction", "buff", "polish"], "SPECIALIZED");
      if (correction) recommendations.push({ ...correction, reason: "Removes swirl marks and light scratches." });
    } else if (answers.issue === "odor") {
      const odor = findByKeyword(["odor", "steam", "antibac", "disinfect"], "SPECIALIZED") || findByKeyword(["odor", "steam"], "INTERIOR");
      if (odor) recommendations.push({ ...odor, reason: "Eliminates bacteria and tough odors at the source." });
    } else if (answers.issue === "water_spots") {
      const spots = findByKeyword(["water spot", "glass", "acid"], "SPECIALIZED");
      if (spots) recommendations.push({ ...spots, reason: "Safely removes etched mineral deposits from paint/glass." });
    }

    // Heavy Soiling Bonus
    if (answers.condition === "poor") {
      const heavy = findByKeyword(["heavy", "deep", "restoration"]);
      if (heavy && !recommendations.some(r => r.id === heavy.id)) {
        recommendations.push({ ...heavy, reason: "Powerful cleaning agents for heavily soiled surfaces." });
      }
    }

    // Final fallback if nothing found
    if (recommendations.length === 0) {
      recommendations = allServices.slice(0, 2).map(s => ({ 
        ...s, 
        reason: "Our most popular professional choice for standard maintenance." 
      }));
    }

    // Ensure unique recommendations
    const seen = new Set();
    const uniqueRecs = recommendations.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    return uniqueRecs.slice(0, 3);
  };

  const handleNext = (value) => {
    const currentQuestion = QUESTIONS[step - 1];
    setAnswers(prev => ({ ...prev, [currentQuestion.field]: value }));
    if (step < QUESTIONS.length) {
      setStep(step + 1);
    } else {
      setIsAnalyzing(true);
      setStep(QUESTIONS.length + 1);
      setTimeout(() => setIsAnalyzing(false), 1500);
    }
  };

  const reset = () => {
    setStep(0);
    setAnswers({ size: "", goal: "", condition: "", issue: "" });
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "12px 20px",
          borderRadius: "12px",
          background: "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)",
          color: "white",
          border: "none",
          fontWeight: "600",
          cursor: "pointer",
          boxShadow: "0 4px 15px rgba(59, 130, 246, 0.3)",
          transition: "0.2s transform",
          marginBottom: "20px"
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.02)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        <Sparkles size={18} />
        AI Service Assistant
      </button>
    );
  }

  const recommendedServices = step > QUESTIONS.length ? getRecommendation() : [];

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.8)",
      backdropFilter: "blur(4px)",
      zIndex: 2000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px"
    }}>
      <div style={{
        background: "var(--card-bg)",
        width: "100%",
        maxWidth: "500px",
        borderRadius: "24px",
        border: "1px solid var(--border-color)",
        overflow: "hidden",
        position: "relative"
      }}>
        <button onClick={reset} style={{ position: "absolute", top: "20px", right: "20px", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
          <X size={24} />
        </button>

        <div style={{ padding: "40px" }}>
          {step === 0 && (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "rgba(99, 102, 241, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <Sparkles size={40} color="#6366f1" />
              </div>
              <h2 style={{ marginBottom: "12px" }}>AI Service Assistant</h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: "32px", lineHeight: "1.6" }}>
                Not sure which service is right for your vehicle? Answer a few questions and I'll recommend the perfect package.
              </p>
              <button 
                onClick={() => setStep(1)}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "12px",
                  background: "var(--accent-blue)",
                  color: "white",
                  border: "none",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px"
                }}
              >
                Get Started
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step > 0 && step <= QUESTIONS.length && (
            <div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "32px" }}>
                {QUESTIONS.map((_, i) => (
                  <div key={i} style={{ 
                    flex: 1, 
                    height: "4px", 
                    borderRadius: "2px", 
                    background: i + 1 <= step ? "var(--accent-blue)" : "var(--border-color)" 
                  }} />
                ))}
              </div>
              <h3 style={{ fontSize: "20px", marginBottom: "24px" }}>{QUESTIONS[step - 1].title}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {QUESTIONS[step - 1].options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleNext(opt.value)}
                    style={{
                      padding: "16px 20px",
                      borderRadius: "12px",
                      background: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                      textAlign: "left",
                      fontSize: "15px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "0.2s"
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = "var(--accent-blue)";
                      e.currentTarget.style.background = "rgba(59, 130, 246, 0.05)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = "var(--border-color)";
                      e.currentTarget.style.background = "var(--bg-tertiary)";
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step > QUESTIONS.length && (
            <div>
              <div style={{ textAlign: "center", marginBottom: "32px" }}>
                <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "rgba(34, 197, 94, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <CheckCircle2 size={32} color="#22c55e" />
                </div>
                <h3>Recommended for You</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "8px" }}>Based on your vehicle type and cleaning goals.</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
                {recommendedServices.length > 0 ? recommendedServices.map((s) => (
                  <div 
                    key={s.id}
                    style={{
                      padding: "16px",
                      borderRadius: "12px",
                      background: "rgba(59, 130, 246, 0.05)",
                      border: "1px solid var(--accent-blue)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "14px" }}>{s.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--accent-blue)", fontWeight: "500", marginTop: "2px" }}>{s.reason}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>₱{Number(s.price).toLocaleString()}</div>
                    </div>
                    <Sparkles size={16} color="var(--accent-blue)" />
                  </div>
                )) : (
                  <p style={{ textAlign: "center", opacity: 0.6 }}>No specific matching services found. Please browse our menu.</p>
                )}
              </div>

              <button 
                onClick={() => {
                  onRecommend(recommendedServices);
                  reset();
                }}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "12px",
                  background: "var(--accent-blue)",
                  color: "white",
                  border: "none",
                  fontWeight: "700",
                  cursor: "pointer",
                  marginBottom: "12px"
                }}
              >
                Apply Recommendations
              </button>
              <button 
                onClick={reset}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "12px",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "none",
                  fontWeight: "500",
                  cursor: "pointer"
                }}
              >
                Browse Manually
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartServiceAssistant;
