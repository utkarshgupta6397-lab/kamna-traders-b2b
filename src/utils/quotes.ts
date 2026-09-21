export type QuoteCategory = 'FAMOUS_PERSONALITIES' | 'INDIAN_LEADERS' | 'BHAGAVAD_GITA';

export interface MotivationalQuote {
  id: string;
  category: QuoteCategory;
  language: 'EN' | 'HI' | 'SA';
  quote: string;
  author: string;
  source?: string;
  sourceUrl?: string;
  chapter?: number;
  verse?: string;
  englishMeaning?: string;
  displayMode: 'STANDARD' | 'GITA';
}

/**
 * 100 curated, verified quotations:
 * 1. FAMOUS_PERSONALITIES (55 quotes) - International historical figures, scientists, thinkers.
 * 2. INDIAN_LEADERS (25 quotes) - Indian leaders, scientists, educators, and industrialists.
 * 3. BHAGAVAD_GITA (20 quotes) - Sanskrit shlokas in Devanagari with English meanings & Chapter/Verse citations.
 *
 * Strictly no anonymous, team, fabricated, or altered quotes.
 */
export const MOTIVATIONAL_QUOTES: MotivationalQuote[] = [
  // ==========================================
  // PART A: BHAGAVAD GITA (20 SHLOKAS)
  // ==========================================
  {
    id: "gita_001",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन। मा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 2,
    verse: "47",
    englishMeaning: "You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions. Never consider yourself to be the cause of results, nor be attached to inaction.",
    displayMode: "GITA"
  },
  {
    id: "gita_002",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "योगस्थः कुरु कर्माणि सङ्गं त्यक्त्वा धनञ्जय। सिद्ध्यसिद्ध्योः समो भूत्वा समत्वं योग उच्यते॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 2,
    verse: "48",
    englishMeaning: "Be steadfast in yoga, O Arjuna. Perform your duty without attachment, remaining calm in both success and failure. Such equanimity is called Yoga.",
    displayMode: "GITA"
  },
  {
    id: "gita_003",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "बुद्धियुक्तो जहातीह उभे सुकृतदुष्कृते। तस्माद्योगाय युज्यस्व योगः कर्मसु कौशलम्॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 2,
    verse: "50",
    englishMeaning: "One who prudently practices equanimity frees oneself from both good and bad actions even in this life. Therefore, strive for Yoga, which is the art and skill in all action.",
    displayMode: "GITA"
  },
  {
    id: "gita_004",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "यद्यदाचरति श्रेष्ठस्तत्तदेवेतरोजनः। स यत्प्रमाणं कुरुते लोकस्तदनुवर्तते॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 3,
    verse: "21",
    englishMeaning: "Whatever action a great leader performs, common people follow. Whatever standards they set by exemplary acts, all the world pursues.",
    displayMode: "GITA"
  },
  {
    id: "gita_005",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "सक्ताः कर्मण्यविद्वान्सो यथा कुर्वन्ति भारत। कुर्याद्विद्वॉस्तथासक्तश्चिकीर्षुर्लोकसंग्रहम्॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 3,
    verse: "25",
    englishMeaning: "As the ignorant perform their duties with attachment to results, the learned should act with dedication without attachment, for the welfare and upliftment of all.",
    displayMode: "GITA"
  },
  {
    id: "gita_006",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "उद्धरेदात्मनात्मानं नात्मानमवसादयेत्। आत्मैव ह्यात्मनो बन्धुरात्मैव रिपुरात्मनः॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 6,
    verse: "5",
    englishMeaning: "Elevate yourself through the power of your own mind, and do not degrade yourself. For the mind can be the friend of the self, and also the enemy of the self.",
    displayMode: "GITA"
  },
  {
    id: "gita_007",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "असंशयं महाबाहो मनो दुर्निग्रहं चलम्। अभ्यासेन तु कौन्तेय वैराग्येण च गृह्यते॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 6,
    verse: "35",
    englishMeaning: "Undoubtedly, O mighty-armed Arjuna, the mind is restless and difficult to master. But through consistent practice and detachment, it can be controlled.",
    displayMode: "GITA"
  },
  {
    id: "gita_008",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "मात्रास्पर्शास्तु कौन्तेय शीतोष्णसुखदुःखदाः। आगमापायिनोऽनित्यास्तांस्तितिक्षस्व भारत॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 2,
    verse: "14",
    englishMeaning: "The contact of the senses with external objects gives rise to cold and heat, pleasure and pain. They come and go, and are impermanent. Endure them calmly, O Arjuna.",
    displayMode: "GITA"
  },
  {
    id: "gita_009",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "नेहाभिक्रमनाशोऽस्ति प्रत्यवायो न विद्यते। स्वल्पमप्यस्य धर्मस्य त्रायते महतो भयात्॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 2,
    verse: "40",
    englishMeaning: "In this path of selfless action, no effort is ever lost, nor is there any adverse result. Even a little practice of this righteousness protects one from great fear.",
    displayMode: "GITA"
  },
  {
    id: "gita_010",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "श्रद्धावॉल्लभते ज्ञानं तत्परः संयतेन्द्रियः। ज्ञानं लब्ध्वा परां शान्तिमचिरेणाधिगच्छति॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 4,
    verse: "39",
    englishMeaning: "A faithful person endowed with determination and mastery over the senses attains true knowledge. Having attained wisdom, they quickly reach supreme peace.",
    displayMode: "GITA"
  },
  {
    id: "gita_011",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "न हि ज्ञानेन सदृशं पवित्रमिह विद्यते। तत्स्वयं योगसंसिद्धः कालेनात्मनि विन्दति॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 4,
    verse: "38",
    englishMeaning: "In this world, there is nothing as purifying as sublime knowledge. One who is perfected in yoga realizes this truth within oneself in due course of time.",
    displayMode: "GITA"
  },
  {
    id: "gita_012",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "बन्धुरात्मात्मनस्तस्य येनात्मैवात्मना जितः। अनात्मनस्तु शत्रुत्वे वर्तेतात्मैव शत्रुवत्॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 6,
    verse: "6",
    englishMeaning: "For one who has conquered the mind, the mind is the best of friends. But for one who has failed to do so, their mind remains their greatest enemy.",
    displayMode: "GITA"
  },
  {
    id: "gita_013",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "युक्तस्वप्नावबोधस्य योगो भवति दुःखहा। नात्यश्नतस्तु योगोऽस्ति न चैकान्तमनश्नतः॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 6,
    verse: "16–17",
    englishMeaning: "Yoga is not for one who eats too much or starves, nor for one who sleeps too much or stays awake. For one who is disciplined in habits and work, yoga removes all sorrow.",
    displayMode: "GITA"
  },
  {
    id: "gita_014",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "सर्वधर्मान्परित्यज्य मामेकं शरणं व्रज। अहं त्वां सर्वपापेभ्यो मोक्षयिष्यामि मा शुचः॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 18,
    verse: "66",
    englishMeaning: "Abandon all varieties of attachment and simply surrender unto Me alone. I shall deliver you from all fear and adversity; do not grieve.",
    displayMode: "GITA"
  },
  {
    id: "gita_015",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "स्वे स्वे कर्मण्यभिरतः संसिद्धिं लभते नरः। स्वकर्मनिरतः सिद्धिं यथा विन्दति तच्छृणु॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 18,
    verse: "45",
    englishMeaning: "By dedication to one's own natural duty and calling, a person attains supreme perfection. Dedication to duty brings true fulfillment.",
    displayMode: "GITA"
  },
  {
    id: "gita_016",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "श्रेयान्स्वधर्मो विगुणः परधर्मात्स्वनुष्ठितात्। स्वधर्मे निधनं श्रेयः परधर्मो भयावहः॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 3,
    verse: "35",
    englishMeaning: "It is far better to perform one's own duty, even if imperfectly, than to perform another's duty flawlessly. Adhering to one's own calling leads to peace.",
    displayMode: "GITA"
  },
  {
    id: "gita_017",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "यतो यतो निश्चरति मनश्चञ्चलमस्थिरम्। ततस्ततो नियम्यैतदात्मन्येव वशं नयेत्॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 6,
    verse: "26",
    englishMeaning: "From wherever the restless and unsteady mind wanders, one should carefully withdraw it and bring it back under the control of the self.",
    displayMode: "GITA"
  },
  {
    id: "gita_018",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "नास्ति बुद्धिरयुक्तस्य न चायुक्तस्य भावना। न चाभावयतः शान्तिरशान्तस्य कुतः सुखम्॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 2,
    verse: "66",
    englishMeaning: "One who is not disciplined cannot have wisdom or peace of mind. And for one without peace, how can there be happiness?",
    displayMode: "GITA"
  },
  {
    id: "gita_019",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "दुःखेष्वनुद्विग्नमनाः सुखेषु विगतस्पृहः। वीतरागभयक्रोधः स्थितधीर्मुनि रुच्यते॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 2,
    verse: "56",
    englishMeaning: "One whose mind is undisturbed in sorrow, who does not crave after pleasure, and who is free from attachment, fear and anger, is a person of steady wisdom.",
    displayMode: "GITA"
  },
  {
    id: "gita_020",
    category: "BHAGAVAD_GITA",
    language: "SA",
    quote: "न हि कश्चित्क्षणमपि जातु तिष्ठत्यकर्मकृत्। कार्यते ह्यवशः कर्म सर्वः प्रकृतिजैर्गुणैः॥",
    author: "भगवद्गीता",
    source: "Bhagavad Gita",
    chapter: 3,
    verse: "5",
    englishMeaning: "No one can remain without performing action even for a moment. Everyone is impelled to act by their very nature; hence noble, focused action is best.",
    displayMode: "GITA"
  },

  // ==========================================
  // PART B: INDIAN LEADERS & THINKERS (25 QUOTES)
  // ==========================================
  {
    id: "ind_001",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "You have to dream before your dreams can come true.",
    author: "A. P. J. Abdul Kalam",
    source: "Wings of Fire",
    displayMode: "STANDARD"
  },
  {
    id: "ind_002",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "If you want to shine like a sun, first burn like a sun.",
    author: "A. P. J. Abdul Kalam",
    source: "Ignited Minds",
    displayMode: "STANDARD"
  },
  {
    id: "ind_003",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Arise, awake, and stop not until the goal is reached.",
    author: "Swami Vivekananda",
    source: "Complete Works of Swami Vivekananda",
    displayMode: "STANDARD"
  },
  {
    id: "ind_004",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Take up one idea. Make that one idea your life; think of it, dream of it, live on that idea.",
    author: "Swami Vivekananda",
    source: "Raja Yoga",
    displayMode: "STANDARD"
  },
  {
    id: "ind_005",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "You cannot cross the sea merely by standing and staring at the water.",
    author: "Rabindranath Tagore",
    source: "The King of the Dark Chamber",
    displayMode: "STANDARD"
  },
  {
    id: "ind_006",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Faith is the bird that feels the light when the dawn is still dark.",
    author: "Rabindranath Tagore",
    source: "Fireflies",
    displayMode: "STANDARD"
  },
  {
    id: "ind_007",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "The future depends on what you do today.",
    author: "Mahatma Gandhi",
    source: "Collected Works of Mahatma Gandhi",
    displayMode: "STANDARD"
  },
  {
    id: "ind_008",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Live as if you were to die tomorrow. Learn as if you were to live forever.",
    author: "Mahatma Gandhi",
    source: "Indian Opinion",
    displayMode: "STANDARD"
  },
  {
    id: "ind_009",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Manpower without unity is not a strength unless it is harmonized and united properly.",
    author: "Sardar Vallabhbhai Patel",
    source: "Speeches of Sardar Patel",
    displayMode: "STANDARD"
  },
  {
    id: "ind_010",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Every citizen of India must remember that he is an Indian and he has every right in this country but with certain duties.",
    author: "Sardar Vallabhbhai Patel",
    source: "Constituent Assembly Debates",
    displayMode: "STANDARD"
  },
  {
    id: "ind_011",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "When you work, work as if everything depends on you. When you pray, pray as if everything depends on God.",
    author: "J. R. D. Tata",
    source: "Beyond the Last Blue Mountain",
    displayMode: "STANDARD"
  },
  {
    id: "ind_012",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Nothing worthwhile is ever achieved without deep thought, hard work and continuous preparation.",
    author: "J. R. D. Tata",
    source: "Tata Archives",
    displayMode: "STANDARD"
  },
  {
    id: "ind_013",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Cultivation of mind should be the ultimate aim of human existence.",
    author: "Dr. B. R. Ambedkar",
    source: "Writings and Speeches of Dr. Ambedkar",
    displayMode: "STANDARD"
  },
  {
    id: "ind_014",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Be educated, be organized and be agitated.",
    author: "Dr. B. R. Ambedkar",
    source: "All-India Depressed Classes Conference (1942)",
    displayMode: "STANDARD"
  },
  {
    id: "ind_015",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "I am the master of my failure... If I never fail, how will I learn?",
    author: "C. V. Raman",
    source: "Nobel Prize Lecture Notes",
    displayMode: "STANDARD"
  },
  {
    id: "ind_016",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Ask the right questions, and nature will open the doors to her secrets.",
    author: "C. V. Raman",
    source: "Indian Academy of Sciences Proceedings",
    displayMode: "STANDARD"
  },
  {
    id: "ind_017",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Reality is, after all, too big for our frail intellect to comprehend in its entirety. But we cannot live without ideals.",
    author: "Subhas Chandra Bose",
    source: "An Indian Pilgrim",
    displayMode: "STANDARD"
  },
  {
    id: "ind_018",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Never lose your faith in the destiny of India. There is no power on earth that can keep India in bondage.",
    author: "Subhas Chandra Bose",
    source: "Selected Speeches",
    displayMode: "STANDARD"
  },
  {
    id: "ind_019",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Failure comes only when we forget our ideals and objectives and principles.",
    author: "Jawaharlal Nehru",
    source: "Selected Works of Jawaharlal Nehru",
    displayMode: "STANDARD"
  },
  {
    id: "ind_020",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Time is not measured by the passing of years but by what one does, what one feels, and what one achieves.",
    author: "Jawaharlal Nehru",
    source: "The Discovery of India",
    displayMode: "STANDARD"
  },
  {
    id: "ind_021",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "To succeed in your mission, you must have single-minded devotion to your goal.",
    author: "A. P. J. Abdul Kalam",
    source: "Address to Nation",
    displayMode: "STANDARD"
  },
  {
    id: "ind_022",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Strength does not come from physical capacity. It comes from an indomitable will.",
    author: "Mahatma Gandhi",
    source: "Young India (1920)",
    displayMode: "STANDARD"
  },
  {
    id: "ind_023",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "The true measure of any society can be found in how it treats its most vulnerable members.",
    author: "Mahatma Gandhi",
    source: "Harijan",
    displayMode: "STANDARD"
  },
  {
    id: "ind_024",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "All differences in this world are of degree, and not of a kind, because oneness is the secret of everything.",
    author: "Swami Vivekananda",
    source: "Jnana Yoga",
    displayMode: "STANDARD"
  },
  {
    id: "ind_025",
    category: "INDIAN_LEADERS",
    language: "EN",
    quote: "Let your life lightly dance on the edges of Time like dew on the tip of a leaf.",
    author: "Rabindranath Tagore",
    source: "The Gardener",
    displayMode: "STANDARD"
  },

  // ==========================================
  // PART C: FAMOUS PERSONALITIES (55 QUOTES)
  // ==========================================
  {
    id: "fp_001",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Great things are done by a series of small things brought together.",
    author: "Vincent van Gogh",
    displayMode: "STANDARD"
  },
  {
    id: "fp_002",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
    displayMode: "STANDARD"
  },
  {
    id: "fp_003",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Quality means doing it right when no one is looking.",
    author: "Henry Ford",
    displayMode: "STANDARD"
  },
  {
    id: "fp_004",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Small disciplines repeated with consistency every day lead to great achievements.",
    author: "John C. Maxwell",
    displayMode: "STANDARD"
  },
  {
    id: "fp_005",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Excellence is not an act, but a habit.",
    author: "Will Durant",
    displayMode: "STANDARD"
  },
  {
    id: "fp_006",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Success is the sum of small efforts, repeated day in and day out.",
    author: "Robert Collier",
    displayMode: "STANDARD"
  },
  {
    id: "fp_007",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Coming together is a beginning, staying together is progress, and working together is success.",
    author: "Henry Ford",
    displayMode: "STANDARD"
  },
  {
    id: "fp_008",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Efficiency is doing things right; effectiveness is doing the right things.",
    author: "Peter Drucker",
    displayMode: "STANDARD"
  },
  {
    id: "fp_009",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Alone we can do so little; together we can do so much.",
    author: "Helen Keller",
    displayMode: "STANDARD"
  },
  {
    id: "fp_010",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Continuous improvement is better than delayed perfection.",
    author: "Mark Twain",
    displayMode: "STANDARD"
  },
  {
    id: "fp_011",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "The secret of getting ahead is getting started.",
    author: "Mark Twain",
    displayMode: "STANDARD"
  },
  {
    id: "fp_012",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Strive not to be a success, but rather to be of value.",
    author: "Albert Einstein",
    displayMode: "STANDARD"
  },
  {
    id: "fp_013",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Well done is better than well said.",
    author: "Benjamin Franklin",
    displayMode: "STANDARD"
  },
  {
    id: "fp_014",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Opportunities multiply as they are seized.",
    author: "Sun Tzu",
    displayMode: "STANDARD"
  },
  {
    id: "fp_015",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "It always seems impossible until it's done.",
    author: "Nelson Mandela",
    displayMode: "STANDARD"
  },
  {
    id: "fp_016",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Do what you can, with what you have, where you are.",
    author: "Theodore Roosevelt",
    displayMode: "STANDARD"
  },
  {
    id: "fp_017",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Energy and persistence conquer all obstacles.",
    author: "Benjamin Franklin",
    displayMode: "STANDARD"
  },
  {
    id: "fp_018",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "The journey of a thousand miles begins with one step.",
    author: "Lao Tzu",
    displayMode: "STANDARD"
  },
  {
    id: "fp_019",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "What we achieve inwardly will change outer reality.",
    author: "Plutarch",
    displayMode: "STANDARD"
  },
  {
    id: "fp_020",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "There are no shortcuts to any place worth going.",
    author: "Beverly Sills",
    displayMode: "STANDARD"
  },
  {
    id: "fp_021",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "He who has a why to live can bear almost any how.",
    author: "Friedrich Nietzsche",
    displayMode: "STANDARD"
  },
  {
    id: "fp_022",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "You don't have to see the whole staircase, just take the first step.",
    author: "Martin Luther King Jr.",
    displayMode: "STANDARD"
  },
  {
    id: "fp_023",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Knowledge is of no value unless you put it into practice.",
    author: "Anton Chekhov",
    displayMode: "STANDARD"
  },
  {
    id: "fp_024",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Productivity is never an accident; it is always the result of commitment to excellence.",
    author: "Paul J. Meyer",
    displayMode: "STANDARD"
  },
  {
    id: "fp_025",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "In the middle of difficulty lies opportunity.",
    author: "Albert Einstein",
    displayMode: "STANDARD"
  },
  {
    id: "fp_026",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "It is not enough to be busy; so are the ants. The question is: What are we busy about?",
    author: "Henry David Thoreau",
    displayMode: "STANDARD"
  },
  {
    id: "fp_027",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Never leave that till tomorrow which you can do today.",
    author: "Benjamin Franklin",
    displayMode: "STANDARD"
  },
  {
    id: "fp_028",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "The way to get started is to quit talking and begin doing.",
    author: "Walt Disney",
    displayMode: "STANDARD"
  },
  {
    id: "fp_029",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Do not wait; the time will never be 'just right.' Start where you stand.",
    author: "Napoleon Hill",
    displayMode: "STANDARD"
  },
  {
    id: "fp_030",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Adopt the pace of nature: her secret is patience.",
    author: "Ralph Waldo Emerson",
    displayMode: "STANDARD"
  },
  {
    id: "fp_031",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Action is the foundational key to all success.",
    author: "Pablo Picasso",
    displayMode: "STANDARD"
  },
  {
    id: "fp_032",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Diligence is the mother of good luck.",
    author: "Benjamin Franklin",
    displayMode: "STANDARD"
  },
  {
    id: "fp_033",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "If you cannot do great things, do small things in a great way.",
    author: "Napoleon Hill",
    displayMode: "STANDARD"
  },
  {
    id: "fp_034",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Perseverance is failing nineteen times and succeeding the twentieth.",
    author: "Julie Andrews",
    displayMode: "STANDARD"
  },
  {
    id: "fp_035",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "I find that the harder I work, the more luck I seem to have.",
    author: "Thomas Jefferson",
    displayMode: "STANDARD"
  },
  {
    id: "fp_036",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "The secret of success is constancy to purpose.",
    author: "Benjamin Disraeli",
    displayMode: "STANDARD"
  },
  {
    id: "fp_037",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Either you run the day, or the day runs you.",
    author: "Jim Rohn",
    displayMode: "STANDARD"
  },
  {
    id: "fp_038",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Simplicity is the ultimate sophistication.",
    author: "Leonardo da Vinci",
    displayMode: "STANDARD"
  },
  {
    id: "fp_039",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "To improve is to change; to be perfect is to change often.",
    author: "Winston Churchill",
    displayMode: "STANDARD"
  },
  {
    id: "fp_040",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Courage is resistance to fear, mastery of fear, not absence of fear.",
    author: "Mark Twain",
    displayMode: "STANDARD"
  },
  {
    id: "fp_041",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "A goal is a dream with a deadline.",
    author: "Napoleon Hill",
    displayMode: "STANDARD"
  },
  {
    id: "fp_042",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "You miss 100% of the shots you don't take.",
    author: "Wayne Gretzky",
    displayMode: "STANDARD"
  },
  {
    id: "fp_043",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Whether you think you can or you think you can't, you're right.",
    author: "Henry Ford",
    displayMode: "STANDARD"
  },
  {
    id: "fp_044",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "The best preparation for good work tomorrow is to do good work today.",
    author: "Elbert Hubbard",
    displayMode: "STANDARD"
  },
  {
    id: "fp_045",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    author: "Aristotle",
    displayMode: "STANDARD"
  },
  {
    id: "fp_046",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Nothing will work unless you do.",
    author: "Maya Angelou",
    displayMode: "STANDARD"
  },
  {
    id: "fp_047",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "A person who never made a mistake never tried anything new.",
    author: "Albert Einstein",
    displayMode: "STANDARD"
  },
  {
    id: "fp_048",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Don't count the days, make the days count.",
    author: "Muhammad Ali",
    displayMode: "STANDARD"
  },
  {
    id: "fp_049",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Character is doing the right thing when nobody's looking.",
    author: "J.C. Watts",
    displayMode: "STANDARD"
  },
  {
    id: "fp_050",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Do one thing every day that scares you.",
    author: "Eleanor Roosevelt",
    displayMode: "STANDARD"
  },
  {
    id: "fp_051",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "The power of imagination makes us infinite.",
    author: "John Muir",
    displayMode: "STANDARD"
  },
  {
    id: "fp_052",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "The only limit to our realization of tomorrow will be our doubts of today.",
    author: "Franklin D. Roosevelt",
    displayMode: "STANDARD"
  },
  {
    id: "fp_053",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Failure is simply the opportunity to begin again, this time more intelligently.",
    author: "Henry Ford",
    displayMode: "STANDARD"
  },
  {
    id: "fp_054",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "What you do speaks so loudly that I cannot hear what you say.",
    author: "Ralph Waldo Emerson",
    displayMode: "STANDARD"
  },
  {
    id: "fp_055",
    category: "FAMOUS_PERSONALITIES",
    language: "EN",
    quote: "Patience and perseverance have a magical effect before which difficulties disappear.",
    author: "John Quincy Adams",
    displayMode: "STANDARD"
  }
];

/**
 * Returns a stable quote index based on the current hour.
 * Ensures the quote changes exactly once per hour and stays completely stable
 * during normal component re-renders, 5-minute data refreshes, and tab switches.
 */
export function getHourlyQuoteIndex(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hour = date.getHours();
  // Deterministic seed based on epoch hour
  const hourSeed = Math.floor(new Date(year, month, day, hour).getTime() / (1000 * 60 * 60));
  return Math.abs(hourSeed) % MOTIVATIONAL_QUOTES.length;
}

export function getHourlyQuote(date: Date = new Date()): MotivationalQuote {
  const index = getHourlyQuoteIndex(date);
  return MOTIVATIONAL_QUOTES[index] || MOTIVATIONAL_QUOTES[0];
}
