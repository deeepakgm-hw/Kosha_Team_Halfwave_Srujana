import React, { createContext, useContext, useState } from "react";

export type Language = "EN" | "HI" | "KN";

export interface Translations {
  // Brand & General
  brandName: string;
  tagline: string;
  overview: string;
  signOut: string;
  signIn: string;
  demoMode: string;
  workspace: string;
  supportingTools: string;
  workflowTitle: string;

  // Stepper & Nav
  step1: string;
  step2: string;
  step3: string;
  step4: string;
  step5: string;
  receivables: string;
  cashCalendar: string;
  forecastReliability: string;

  // Page Headings
  loadHeading: string;
  loadSubtitle: string;
  forecastHeading: string;
  scenariosHeading: string;
  scenariosSubtitle: string;
  actionsHeading: string;
  actionsSubtitle: string;
  planHeading: string;
  receivablesHeading: string;
  calendarHeading: string;
  calendarSubtitle: string;
  trustHeading: string;
  trustSubtitle: string;

  // Common Metrics & Badges
  cashBalanceToday: string;
  expectedNotReceived: string;
  runway: string;
  days: string;
  safetyBuffer: string;
  shortfallRisk: string;
  reconciledCash: string;
  unsettledInvoices: string;
  untilBufferBreach: string;

  // Button Labels
  buildMyForecast: string;
  backLoadData: string;
  nextTestScenarios: string;
  backUnderstandCashFlow: string;
  nextCompareActions: string;
  backTestScenarios: string;
  nextActionPlan: string;
  backCompareActions: string;
  startOverLoadData: string;
  resetScenario: string;
  exportCsv: string;
  shareSummary: string;
  trySampleBusiness: string;
  uploadBusinessData: string;
  backToForecast: string;
  cashFlowImpact: string;
  riskShift: string;
  estimatedCost: string;
  practicalSteps: string;
}

const translations: Record<Language, Translations> = {
  EN: {
    brandName: "KOSHA",
    tagline: "Know your treasury before it runs dry.",
    overview: "Overview",
    signOut: "Sign out",
    signIn: "Sign in",
    demoMode: "Demo Mode",
    workspace: "Workspace",
    supportingTools: "Supporting Capabilities",
    workflowTitle: "5-Step Treasury Workflow",

    step1: "Load data",
    step2: "Understand cash flow",
    step3: "Test scenarios",
    step4: "Compare actions",
    step5: "Action plan",
    receivables: "Receivables",
    cashCalendar: "Cash calendar",
    forecastReliability: "Forecast reliability",

    loadHeading: "Load your business data",
    loadSubtitle: "Start immediately with a sample business persona, or upload your own CSV records.",
    forecastHeading: "Your 90-day cash-flow forecast",
    scenariosHeading: "Stress-test your cash flow",
    scenariosSubtitle: "Simulate commercial shocks using live sensitivity levers and compare outcomes directly against your baseline forecast.",
    actionsHeading: "Compare corrective actions",
    actionsSubtitle: "Actions are evaluated through our simulation engine and ranked using a multi-factor score balancing cash shortfall risk reduction, monetary cost, timing feasibility, and relationship impact.",
    planHeading: "Your action plan is ready",
    receivablesHeading: "Late payment has a legal price",
    calendarHeading: "Upcoming cash outflows",
    calendarSubtitle: "Every committed disbursement across the upcoming 42-day (6-week) window is scheduled into your cash forecast without duplicate debit counting.",
    trustHeading: "Can you trust this forecast?",
    trustSubtitle: "We backtested 12 historical evaluation periods against actual settlement outcomes to calibrate warning lead times, error margins, and prediction bands.",

    cashBalanceToday: "Cash balance today",
    expectedNotReceived: "Expected but not yet received",
    runway: "Runway",
    days: "days",
    safetyBuffer: "Safety buffer",
    shortfallRisk: "Cash shortfall risk",
    reconciledCash: "Reconciled starting liquid bank balance",
    unsettledInvoices: "Unsettled customer invoice remittances",
    untilBufferBreach: "Until projected buffer breach",

    buildMyForecast: "Build my forecast",
    backLoadData: "Back: Load data",
    nextTestScenarios: "Next: Test scenarios",
    backUnderstandCashFlow: "Back: Understand cash flow",
    nextCompareActions: "Next: Compare actions",
    backTestScenarios: "Back: Test scenarios",
    nextActionPlan: "Next: Action plan",
    backCompareActions: "Back: Compare actions",
    startOverLoadData: "Start over: Load data",
    resetScenario: "Reset scenario",
    exportCsv: "Export Action Plan CSV",
    shareSummary: "Share Summary",
    trySampleBusiness: "Try a sample business",
    uploadBusinessData: "Upload your business data",
    backToForecast: "Back to Forecast",
    cashFlowImpact: "Cash-flow impact",
    riskShift: "Risk shift",
    estimatedCost: "Estimated cost",
    practicalSteps: "Practical implementation steps",
  },
  HI: {
    brandName: "कोश",
    tagline: "तिजोरी खाली होने से पहले अपने कोष को जानें।",
    overview: "अवलोकन",
    signOut: "साइन आउट",
    signIn: "साइन इन",
    demoMode: "डेमो मोड",
    workspace: "कार्यक्षेत्र",
    supportingTools: "सहायक उपकरण",
    workflowTitle: "5-चरणीय ट्रेजरी वर्कफ़्लो",

    step1: "डेटा लोड करें",
    step2: "कैश फ्लो समझें",
    step3: "परिदृश्य परखें",
    step4: "कार्रवाई तुलना करें",
    step5: "कार्य योजना",
    receivables: "प्राप्य राशियां",
    cashCalendar: "कैश कैलेंडर",
    forecastReliability: "पूर्वानुमान विश्वसनीयता",

    loadHeading: "अपना व्यावसायिक डेटा लोड करें",
    loadSubtitle: "सैंपल बिजनेस प्रोफाइल के साथ तुरंत शुरू करें या अपनी CSV फाइलें अपलोड करें।",
    forecastHeading: "आपका 90-दिवसीय कैश-फ्लो पूर्वानुमान",
    scenariosHeading: "अपने कैश फ्लो का स्ट्रेस-टेस्ट करें",
    scenariosSubtitle: "विभिन्न व्यापारिक रुकावटों का लाइव सिमुलेशन करें और बेसलाइन से तुलना करें।",
    actionsHeading: "सुधारात्मक कार्रवाइयों की तुलना करें",
    actionsSubtitle: "कार्रवाइयों को सिमुलेशन इंजन द्वारा जोखिम कमी, वित्तीय लागत और संबंधों के प्रभाव के आधार पर रैंक किया गया है।",
    planHeading: "आपकी कार्य योजना तैयार है",
    receivablesHeading: "देर से भुगतान की कानूनी कीमत है",
    calendarHeading: "आगामी नकदी बहिर्वाह",
    calendarSubtitle: "अगले 42 दिनों (6 हफ्तों) के सभी वैधानिक और निश्चित भुगतानों का सटीक समय-सारणी।",
    trustHeading: "क्या आप इस पूर्वानुमान पर भरोसा कर सकते हैं?",
    trustSubtitle: "हमने चेतावनी समय और सटीकता जांचने के लिए 12 ऐतिहासिक अवधियों पर बैकटेस्ट किया है।",

    cashBalanceToday: "आज उपलब्ध नकदी",
    expectedNotReceived: "अपेक्षित लेकिन अप्राप्त राशि",
    runway: "रनवे",
    days: "दिन",
    safetyBuffer: "सुरक्षा बफर",
    shortfallRisk: "नकदी कमी का जोखिम",
    reconciledCash: "शुरुआती बैंक शेष",
    unsettledInvoices: "बकाया ग्राहक चालान",
    untilBufferBreach: "सुरक्षा बफर समाप्त होने तक",

    buildMyForecast: "पूर्वानुमान बनाएं",
    backLoadData: "पीछे: डेटा लोड करें",
    nextTestScenarios: "आगे: परिदृश्य परखें",
    backUnderstandCashFlow: "पीछे: कैश फ्लो समझें",
    nextCompareActions: "आगे: कार्रवाई तुलना करें",
    backTestScenarios: "पीछे: परिदृश्य परखें",
    nextActionPlan: "आगे: कार्य योजना",
    backCompareActions: "पीछे: कार्रवाई तुलना करें",
    startOverLoadData: "पुनः आरंभ करें: डेटा लोड करें",
    resetScenario: "परिदृश्य रीसेट करें",
    exportCsv: "कार्य योजना CSV डाउनलोड करें",
    shareSummary: "सारांश कॉपी करें",
    trySampleBusiness: "सैंपल व्यवसाय आज़माएं",
    uploadBusinessData: "अपना व्यवसाय डेटा अपलोड करें",
    backToForecast: "पूर्वानुमान पर वापस जाएं",
    cashFlowImpact: "कैश-फ्लो प्रभाव",
    riskShift: "जोखिम बदलाव",
    estimatedCost: "अनुमानित लागत",
    practicalSteps: "व्यावहारिक कार्यान्वयन चरण",
  },
  KN: {
    brandName: "ಕೋಶ",
    tagline: "ನಿಮ್ಮ ಖಜಾನೆ ಬರಿದಾಗುವ ಮುನ್ನ ತಿಳಿಯಿರಿ.",
    overview: "ಅವಲೋಕನ",
    signOut: "ಸೈನ್ ಔಟ್",
    signIn: "ಸೈನ್ ಇನ್",
    demoMode: "ಡೆಮೊ ಮೋಡ್",
    workspace: "ಕಾರ್ಯಕ್ಷೇತ್ರ",
    supportingTools: "ಬೆಂಬಲಿತ ಪರಿಕರಗಳು",
    workflowTitle: "5-ಹಂತದ ಖಜಾನೆ ಪ್ರಕ್ರಿಯೆ",

    step1: "ಡೇಟಾ ಲೋಡ್ ಮಾಡಿ",
    step2: "ನಗದು ಹರಿವು ತಿಳಿಯಿರಿ",
    step3: "ಸನ್ನಿವೇಶ ಪರೀಕ್ಷಿಸಿ",
    step4: "ಕ್ರಮಗಳನ್ನು ಹೋಲಿಸಿ",
    step5: "ಕಾರ್ಯ ಯೋಜನೆ",
    receivables: "ಸ್ವೀಕೃತಿಗಳು",
    cashCalendar: "ನಗದು ಕ್ಯಾಲೆಂಡರ್",
    forecastReliability: "ಮುನ್ನೋಟ ವಿಶ್ವಾಸಾರ್ಹತೆ",

    loadHeading: "ನಿಮ್ಮ ವ್ಯಾಪಾರ ಡೇಟಾವನ್ನು ಲೋಡ್ ಮಾಡಿ",
    loadSubtitle: "ಮಾದರಿ ಉದ್ಯಮದೊಂದಿಗೆ ತಕ್ಷಣ ಪ್ರಾರಂಭಿಸಿ ಅಥವಾ ನಿಮ್ಮ CSV ದಾಖಲೆಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.",
    forecastHeading: "ನಿಮ್ಮ 90 ದಿನಗಳ ನಗದು ಹರಿವಿನ ಮುನ್ನೋಟ",
    scenariosHeading: "ನಿಮ್ಮ ನಗದು ಹರಿವನ್ನು ಪರೀಕ್ಷಿಸಿ",
    scenariosSubtitle: "ವ್ಯಾಪಾರದ ಏರಿಳಿತಗಳನ್ನು ಸಿಮ್ಯುಲೇಶನ್ ಮಾಡಿ ಮೂಲ ಮುನ್ನೋಟದೊಂದಿಗೆ ಹೋಲಿಕೆ ಮಾಡಿ.",
    actionsHeading: "ತಿದ್ದುಪಡಿ ಕ್ರಮಗಳನ್ನು ಹೋಲಿಸಿ",
    actionsSubtitle: "ನಗದು ಕೊರತೆ ತಡೆಗಟ್ಟುವಿಕೆ, ಆರ್ಥಿಕ ವೆಚ್ಚ ಮತ್ತು ಗ್ರಾಹಕ ಸಂಬಂಧಗಳ ಆಧಾರದ ಮೇಲೆ ಶಿಫಾರಸುಗಳನ್ನು ಶ್ರೇಣೀಕರಿಸಲಾಗಿದೆ.",
    planHeading: "ನಿಮ್ಮ ಕಾರ್ಯ ಯೋಜನೆ ಸಿದ್ಧವಾಗಿದೆ",
    receivablesHeading: "ವಿಳಂಬ ಪಾವತಿಗೆ ಕಾನೂನುಬದ್ಧ ವೆಚ್ಚವಿದೆ",
    calendarHeading: "ಮುಂಬರುವ ನಗದು ಹೊರಹರಿವು",
    calendarSubtitle: "ಮುಂಬರುವ 42 ದಿನಗಳ (6 ವಾರಗಳು) ಎಲ್ಲಾ ನಿಗದಿತ ಪಾವತಿಗಳ ವೇಳಾಪಟ್ಟಿ.",
    trustHeading: "ನೀವು ಈ ಮುನ್ನೋಟವನ್ನು ನಂಬಬಹುದೇ?",
    trustSubtitle: "ಮುನ್ನೋಟದ ನಿಖರತೆಯನ್ನು ಅಳೆಯಲು 12 ಹಿಂದಿನ ಅವಧಿಗಳಲ್ಲಿ ಮರುಪರಿಶೀಲನೆ ನಡೆಸಲಾಗಿದೆ.",

    cashBalanceToday: "ಇಂದಿನ ನಗದು ಶಿಲ್ಕು",
    expectedNotReceived: "ನಿರೀಕ್ಷಿತ ಆದರೆ ಇನ್ನೂ ಸ್ವೀಕರಿಸದ ಮೊತ್ತ",
    runway: "ರನ್‌ವೇ",
    days: "ದಿನಗಳು",
    safetyBuffer: "ಸುರಕ್ಷತಾ ಬಫರ್",
    shortfallRisk: "ನಗದು ಕೊರತೆಯ ಅಪಾಯ",
    reconciledCash: "ಪ್ರಾರಂಭಿಕ ಬ್ಯಾಂಕ್ ಬ್ಯಾಲೆನ್ಸ್",
    unsettledInvoices: "ಬಾಕಿ ಉಳಿದಿರುವ ಇನ್‌ವಾಯ್ಸ್‌ಗಳು",
    untilBufferBreach: "ಬಫರ್ ಮುಗಿಯುವವರೆಗೆ",

    buildMyForecast: "ಮುನ್ನೋಟ ರಚಿಸಿ",
    backLoadData: "ಹಿಂದಕ್ಕೆ: ಡೇಟಾ ಲೋಡ್ ಮಾಡಿ",
    nextTestScenarios: "ಮುಂದೆ: ಸನ್ನಿವೇಶ ಪರೀಕ್ಷಿಸಿ",
    backUnderstandCashFlow: "ಹಿಂದಕ್ಕೆ: ನಗದು ಹರಿವು ತಿಳಿಯಿರಿ",
    nextCompareActions: "ಮುಂದೆ: ಕ್ರಮಗಳನ್ನು ಹೋಲಿಸಿ",
    backTestScenarios: "ಹಿಂದಕ್ಕೆ: ಸನ್ನಿವೇಶ ಪರೀಕ್ಷಿಸಿ",
    nextActionPlan: "ಮುಂದೆ: ಕಾರ್ಯ ಯೋಜನೆ",
    backCompareActions: "ಹಿಂದಕ್ಕೆ: ಕ್ರಮಗಳನ್ನು ಹೋಲಿಸಿ",
    startOverLoadData: "ಮತ್ತೆ ಪ್ರಾರಂಭಿಸಿ: ಡೇಟಾ ಲೋಡ್ ಮಾಡಿ",
    resetScenario: "ಸನ್ನಿವೇಶ ಮರುಹೊಂದಿಸಿ",
    exportCsv: "ಕಾರ್ಯ ಯೋಜನೆ CSV ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ",
    shareSummary: "ಸಾರಾಂಶವನ್ನು ನಕಲಿಸಿ",
    trySampleBusiness: "ಮಾದರಿ ವ್ಯಾಪಾರವನ್ನು ಪ್ರಯತ್ನಿಸಿ",
    uploadBusinessData: "ನಿಮ್ಮ ವ್ಯಾಪಾರ ಡೇಟಾವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
    backToForecast: "ಮುನ್ನೋಟಕ್ಕೆ ಹಿಂತಿರುಗಿ",
    cashFlowImpact: "ನಗದು ಹರಿವಿನ ಪರಿಣಾಮ",
    riskShift: "ಅಪಾಯ ಬದಲಾವಣೆ",
    estimatedCost: "ಅಂದಾಜು ವೆಚ್ಚ",
    practicalSteps: "ಪ್ರಾಯೋಗಿಕ ಅನುಷ್ಠಾನ ಹಂತಗಳು",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof Translations) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("kosha_lang") as Language;
    return saved === "HI" || saved === "KN" || saved === "EN" ? saved : "EN";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("kosha_lang", lang);
  };

  const t = (key: keyof Translations): string => {
    return translations[language][key] || translations["EN"][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

const defaultContextValue: LanguageContextType = {
  language: "EN",
  setLanguage: () => {},
  t: (key: keyof Translations) => translations["EN"][key] || key,
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  return context || defaultContextValue;
};
