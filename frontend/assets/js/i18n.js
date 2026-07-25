// assets/js/i18n.js
//
// SCOPE NOTE: this covers core navigation and a handful of common UI
// strings — not full page-by-page translation. Translating every page's
// body content (product descriptions, form labels, help text across 30+
// pages) is a much larger undertaking and hasn't been attempted here.
// This is real, working infrastructure that the rest of the translation
// work can be built on incrementally, page by page, as needed.
window.SPOTGH_TRANSLATIONS = {
  en: {
    'nav.categories': 'Categories', 'nav.directory': 'Directory', 'nav.pricing': 'Pricing',
    'nav.deals': '🎉 Deals', 'nav.home': 'Home', 'nav.map': 'Map',
    'search.placeholder': 'Search businesses…', 'search.city_placeholder': 'City: Accra, Kumasi…',
    'btn.search': 'Search', 'btn.sign_in': 'Sign In', 'btn.register': 'Register free',
    'btn.add_business': 'Add Business', 'btn.view_all': 'View All',
    'hero.title_1': 'Find Any Business', 'hero.title_2': 'Across Ghana',
    'hero.tagline': 'Spot it. Find it. Visit it.',
  },
  tw: { // Twi
    'nav.categories': 'Nnwuma Ahodoɔ', 'nav.directory': 'Nsɛm Nyinaa', 'nav.pricing': 'Sika a Wɔbɔ',
    'nav.deals': '🎉 Nneɛma a Wɔtɔn Fofor', 'nav.home': 'Fie', 'nav.map': 'Map',
    'search.placeholder': 'Hwehwɛ adwuma…', 'search.city_placeholder': 'Kuro: Accra, Kumasi…',
    'btn.search': 'Hwehwɛ', 'btn.sign_in': 'Kɔ Mu', 'btn.register': 'Kyerɛw wo din kwa',
    'btn.add_business': 'Fa Adwuma Ka Ho', 'btn.view_all': 'Hwɛ Nyinaa',
    'hero.title_1': 'Hwehwɛ Adwuma Biara', 'hero.title_2': 'Wɔ Ghana Nyinaa',
    'hero.tagline': 'Hwɛ. Hunu. Kɔsra.',
  },
  ga: { // Ga
    'nav.categories': 'Nitsumɔi', 'nav.directory': 'Gbɛtsɔɔmɔ Fɛɛ', 'nav.pricing': 'Shika',
    'nav.deals': '🎉 Nii ni Aŋɔ Waa', 'nav.home': 'Shia', 'nav.map': 'Map',
    'search.placeholder': 'Taomɔ nitsumɔi…', 'search.city_placeholder': 'Maŋ: Accra, Kumasi…',
    'btn.search': 'Taomɔ', 'btn.sign_in': 'Bɔi Mli', 'btn.register': 'Ŋma ogbɛi yɛ yaka',
    'btn.add_business': 'Kɛ Nitsumɔ Fata He', 'btn.view_all': 'Na Fɛɛ',
    'hero.title_1': 'Taomɔ Nitsumɔ Fɛɛ', 'hero.title_2': 'Yɛ Ghana Fɛɛ',
    'hero.tagline': 'Na. Yoo. Yaa.',
  },
};

window.SPOTGH_LANGUAGES = { en: 'English', tw: 'Twi', ga: 'Ga' };

window.getLanguage = () => localStorage.getItem('sgh_lang') || 'en';

window.t = (key) => {
  const lang = getLanguage();
  return SPOTGH_TRANSLATIONS[lang]?.[key] || SPOTGH_TRANSLATIONS.en[key] || key;
};

// Finds every element with a data-i18n attribute and sets its text (or
// placeholder, for inputs) from the dictionary. Call again after
// switching languages, or after injecting new HTML that contains
// data-i18n attributes.
window.applyTranslations = () => {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.setAttribute('placeholder', val);
    else el.textContent = val;
  });
};

window.setLanguage = (lang) => {
  if (!SPOTGH_TRANSLATIONS[lang]) return;
  localStorage.setItem('sgh_lang', lang);
  applyTranslations();
};

document.addEventListener('DOMContentLoaded', () => {
  applyTranslations();
  const sel = document.getElementById('langSwitcher');
  if (sel) sel.value = getLanguage();
});
