import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Lang = "en" | "hi" | "pa";
export const LANGUAGES: { id: Lang; short: string; label: string }[] = [
  { id: "en", short: "EN", label: "English" },
  { id: "hi", short: "हिं", label: "हिन्दी" },
  { id: "pa", short: "ਪੰ", label: "ਪੰਜਾਬੀ" },
];

// Core user-facing strings. English is the source; missing keys fall back to it.
// Keys are namespaced so the dictionary can grow screen-by-screen.
const dict: Record<Lang, Record<string, string>> = {
  en: {
    "login.title": "Thapar Staff Portal",
    "login.subtitle": "Faculty & Residence Gate Management",
    "login.email": "Official University Email",
    "login.password": "Password",
    "login.forgot": "Forgot password?",
    "login.signIn": "Sign In to Portal",
    "login.or": "or continue with",
    "login.google": "Sign in with Google",
    "login.demo": "Quick Demo Access",
    "login.errFill": "Please fill in email and password",
    "login.errEmailFirst": "Enter your campus email above first",
    "login.resetSent": "If an account exists for {email}, a password reset link has been sent to your campus inbox.",
    "login.invalid": "Invalid credentials",
    "tab.parking": "Parking & Access",
    "tab.guests": "Guest Passes",
    "tab.staff": "Domestic Staff",
    "tab.notices": "Security Notices",
    "hdr.signOut": "Sign Out",
    "hdr.faculty": "Faculty",
  },
  hi: {
    "login.title": "थापर स्टाफ़ पोर्टल",
    "login.subtitle": "फ़ैकल्टी और आवास गेट प्रबंधन",
    "login.email": "आधिकारिक विश्वविद्यालय ईमेल",
    "login.password": "पासवर्ड",
    "login.forgot": "पासवर्ड भूल गए?",
    "login.signIn": "पोर्टल में साइन इन करें",
    "login.or": "या इसके साथ जारी रखें",
    "login.google": "Google से साइन इन करें",
    "login.demo": "त्वरित डेमो एक्सेस",
    "login.errFill": "कृपया ईमेल और पासवर्ड भरें",
    "login.errEmailFirst": "पहले ऊपर अपना कैंपस ईमेल दर्ज करें",
    "login.resetSent": "यदि {email} के लिए खाता मौजूद है, तो पासवर्ड रीसेट लिंक आपके कैंपस इनबॉक्स में भेज दिया गया है।",
    "login.invalid": "अमान्य क्रेडेंशियल",
    "tab.parking": "पार्किंग और एक्सेस",
    "tab.guests": "अतिथि पास",
    "tab.staff": "घरेलू स्टाफ़",
    "tab.notices": "सुरक्षा सूचनाएं",
    "hdr.signOut": "साइन आउट",
    "hdr.faculty": "फ़ैकल्टी",
  },
  pa: {
    "login.title": "ਥਾਪਰ ਸਟਾਫ਼ ਪੋਰਟਲ",
    "login.subtitle": "ਫੈਕਲਟੀ ਅਤੇ ਰਿਹਾਇਸ਼ ਗੇਟ ਪ੍ਰਬੰਧਨ",
    "login.email": "ਅਧਿਕਾਰਤ ਯੂਨੀਵਰਸਿਟੀ ਈਮੇਲ",
    "login.password": "ਪਾਸਵਰਡ",
    "login.forgot": "ਪਾਸਵਰਡ ਭੁੱਲ ਗਏ?",
    "login.signIn": "ਪੋਰਟਲ ਵਿੱਚ ਸਾਈਨ ਇਨ ਕਰੋ",
    "login.or": "ਜਾਂ ਇਸ ਨਾਲ ਜਾਰੀ ਰੱਖੋ",
    "login.google": "Google ਨਾਲ ਸਾਈਨ ਇਨ ਕਰੋ",
    "login.demo": "ਤੁਰੰਤ ਡੈਮੋ ਪਹੁੰਚ",
    "login.errFill": "ਕਿਰਪਾ ਕਰਕੇ ਈਮੇਲ ਅਤੇ ਪਾਸਵਰਡ ਭਰੋ",
    "login.errEmailFirst": "ਪਹਿਲਾਂ ਉੱਪਰ ਆਪਣੀ ਕੈਂਪਸ ਈਮੇਲ ਦਰਜ ਕਰੋ",
    "login.resetSent": "ਜੇ {email} ਲਈ ਖਾਤਾ ਮੌਜੂਦ ਹੈ, ਤਾਂ ਪਾਸਵਰਡ ਰੀਸੈੱਟ ਲਿੰਕ ਤੁਹਾਡੇ ਕੈਂਪਸ ਇਨਬਾਕਸ ਵਿੱਚ ਭੇਜ ਦਿੱਤਾ ਗਿਆ ਹੈ।",
    "login.invalid": "ਗਲਤ ਕ੍ਰੈਡੈਂਸ਼ਲ",
    "tab.parking": "ਪਾਰਕਿੰਗ ਅਤੇ ਪਹੁੰਚ",
    "tab.guests": "ਮਹਿਮਾਨ ਪਾਸ",
    "tab.staff": "ਘਰੇਲੂ ਸਟਾਫ਼",
    "tab.notices": "ਸੁਰੱਖਿਆ ਸੂਚਨਾਵਾਂ",
    "hdr.signOut": "ਸਾਈਨ ਆਊਟ",
    "hdr.faculty": "ਫੈਕਲਟੀ",
  },
};

const STORAGE_KEY = "@campus_staff_lang";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string>) => string;
};

const LanguageContext = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => k });

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === "en" || v === "hi" || v === "pa") setLangState(v);
      })
      .catch(() => {});
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => {
      let s = dict[lang][key] ?? dict.en[key] ?? key;
      if (vars) for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, vars[k]);
      return s;
    },
    [lang]
  );

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => useContext(LanguageContext);
