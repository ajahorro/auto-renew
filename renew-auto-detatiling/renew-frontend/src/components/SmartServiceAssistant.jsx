import { useState } from "react";
import { Sparkles, ArrowRight, X, CheckCircle2 } from "lucide-react";

const SmartServiceAssistant = ({ onRecommend, services }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0); // 0: Start, 1: Vehicle Size, 2: Primary Goal, 3: Specific Issues, 4: Result
  const [answers, setAnswers] = useState({
    size: "",
    goal: "",
    issues: []
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
    }
  ];

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
        const name = s.name.toLowerCase();
        const matchesKeyword = keywords.some(k => name.includes(k));
        const matchesCategory = !category || s.category === category;
        return matchesKeyword && matchesCategory;
      });
    };

    if (lowerGoal === "full") {
      // Suggest a package that sounds like a full detail
      const fullDetail = findByKeyword(["premium", "full", "ultimate", "deluxe", "platinum"]);
      if (fullDetail) recommendations.push(fullDetail);
      
      const interior = findByKeyword(["deep", "premium", "shampoo", "steam"], "INTERIOR");
      if (interior && !recommendations.find(r => r.id === interior.id)) recommendations.push(interior);
      
      const exterior = findByKeyword(["wax", "sealant", "wash"], "EXTERIOR");
      if (exterior && !recommendations.find(r => r.id === exterior.id)) recommendations.push(exterior);
    } else if (lowerGoal === "shine") {
      const shine = findByKeyword(["wax", "polish", "buff", "glaze", "sealant"]);
      if (shine) recommendations.push(shine);
      
      const protection = findByKeyword(["ceramic", "coating", "graphene", "protection"], "SPECIALIZED");
      if (protection && !recommendations.find(r => r.id === protection.id)) recommendations.push(protection);

      const wash = findByKeyword(["wash", "exterior"], "EXTERIOR");
      if (wash && !recommendations.find(r => r.id === wash.id)) recommendations.push(wash);
    } else if (lowerGoal === "interior") {
      const deepClean = findByKeyword(["deep", "shampoo", "steam", "vacuum"], "INTERIOR");
      if (deepClean) recommendations.push(deepClean);
      
      const refresh = findByKeyword(["refresh", "express", "basic"], "INTERIOR");
      if (refresh && !recommendations.find(r => r.id === refresh.id)) recommendations.push(refresh);
    }

    // Fallback if nothing found
    if (recommendations.length === 0) {
      // Just pick top 3 most expensive or popular ones if we have categories
      if (lowerGoal === "full") {
        recommendations = allServices.slice(0, 2);
      } else if (lowerGoal === "interior") {
        recommendations = (services.interior || []).slice(0, 2);
      } else {
        recommendations = (services.exterior || []).slice(0, 2);
      }
    }

    return recommendations.slice(0, 3); // Max 3 suggestions
  };

  const handleNext = (value) => {
    const currentQuestion = QUESTIONS[step - 1];
    setAnswers(prev => ({ ...prev, [currentQuestion.field]: value }));
    if (step < QUESTIONS.length) {
      setStep(step + 1);
    } else {
      setStep(QUESTIONS.length + 1); // Go to Result
    }
  };

  const reset = () => {
    setStep(0);
    setAnswers({ size: "", goal: "", issues: [] });
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
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>₱{Number(s.price).toLocaleString()}</div>
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
