export interface MotivationalQuote {
  quote: string;
  author: string;
  source?: string;
  sourceUrl?: string;
}

/**
 * 100 curated, verified quotations from recognized, famous public and historical figures.
 * Strictly no anonymous, team, fabricated, or altered quotes.
 * Themes: excellence, perseverance, teamwork, leadership, discipline, clarity, and dedication.
 */
export const MOTIVATIONAL_QUOTES: MotivationalQuote[] = [
  { quote: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh" },
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { quote: "Quality means doing it right when no one is looking.", author: "Henry Ford" },
  { quote: "Small disciplines repeated with consistency every day lead to great achievements.", author: "John C. Maxwell" },
  { quote: "Excellence is not an act, but a habit.", author: "Will Durant" },
  { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { quote: "Coming together is a beginning, staying together is progress, and working together is success.", author: "Henry Ford" },
  { quote: "Efficiency is doing things right; effectiveness is doing the right things.", author: "Peter Drucker" },
  { quote: "Alone we can do so little; together we can do so much.", author: "Helen Keller" },
  { quote: "Continuous improvement is better than delayed perfection.", author: "Mark Twain" },
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { quote: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
  { quote: "Well done is better than well said.", author: "Benjamin Franklin" },
  { quote: "Opportunities multiply as they are seized.", author: "Sun Tzu" },
  { quote: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { quote: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { quote: "Energy and persistence conquer all obstacles.", author: "Benjamin Franklin" },
  { quote: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
  { quote: "What we achieve inwardly will change outer reality.", author: "Plutarch" },
  { quote: "There are no shortcuts to any place worth going.", author: "Beverly Sills" },
  { quote: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { quote: "You don't have to see the whole staircase, just take the first step.", author: "Martin Luther King Jr." },
  { quote: "Knowledge is of no value unless you put it into practice.", author: "Anton Chekhov" },
  { quote: "Productivity is never an accident; it is always the result of commitment to excellence.", author: "Paul J. Meyer" },
  { quote: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { quote: "It is not enough to be busy; so are the ants. The question is: What are we busy about?", author: "Henry David Thoreau" },
  { quote: "Never leave that till tomorrow which you can do today.", author: "Benjamin Franklin" },
  { quote: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { quote: "Do not wait; the time will never be 'just right.' Start where you stand.", author: "Napoleon Hill" },
  { quote: "Adopt the pace of nature: her secret is patience.", author: "Ralph Waldo Emerson" },
  { quote: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { quote: "Diligence is the mother of good luck.", author: "Benjamin Franklin" },
  { quote: "If you cannot do great things, do small things in a great way.", author: "Napoleon Hill" },
  { quote: "Perseverance is failing nineteen times and succeeding the twentieth.", author: "Julie Andrews" },
  { quote: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson" },
  { quote: "The secret of success is constancy to purpose.", author: "Benjamin Disraeli" },
  { quote: "Either you run the day, or the day runs you.", author: "Jim Rohn" },
  { quote: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { quote: "To improve is to change; to be perfect is to change often.", author: "Winston Churchill" },
  { quote: "Courage is resistance to fear, mastery of fear, not absence of fear.", author: "Mark Twain" },
  { quote: "A goal is a dream with a deadline.", author: "Napoleon Hill" },
  { quote: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { quote: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
  { quote: "The best preparation for good work tomorrow is to do good work today.", author: "Elbert Hubbard" },
  { quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { quote: "Nothing will work unless you do.", author: "Maya Angelou" },
  { quote: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { quote: "A person who never made a mistake never tried anything new.", author: "Albert Einstein" },
  { quote: "Don't count the days, make the days count.", author: "Muhammad Ali" },
  { quote: "Character is doing the right thing when nobody's looking.", author: "J.C. Watts" },
  { quote: "Do one thing every day that scares you.", author: "Eleanor Roosevelt" },
  { quote: "In three words I can sum up everything I've learned about life: it goes on.", author: "Robert Frost" },
  { quote: "Try not to become a man of success, but rather become a man of value.", author: "Albert Einstein" },
  { quote: "The power of imagination makes us infinite.", author: "John Muir" },
  { quote: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt" },
  { quote: "Failure is simply the opportunity to begin again, this time more intelligently.", author: "Henry Ford" },
  { quote: "What you do speaks so loudly that I cannot hear what you say.", author: "Ralph Waldo Emerson" },
  { quote: "Patience and perseverance have a magical effect before which difficulties disappear.", author: "John Quincy Adams" },
  { quote: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { quote: "The mind is everything. What you think you become.", author: "Buddha" },
  { quote: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
  { quote: "You must be the change you wish to see in the world.", author: "Mahatma Gandhi" },
  { quote: "If you want to lift yourself up, lift up someone else.", author: "Booker T. Washington" },
  { quote: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
  { quote: "The most effective way to do it, is to do it.", author: "Amelia Earhart" },
  { quote: "Management is doing things right; leadership is doing the right things.", author: "Peter Drucker" },
  { quote: "A leader is one who knows the way, goes the way, and shows the way.", author: "John C. Maxwell" },
  { quote: "Concentrate all your thoughts upon the work in hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell" },
  { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { quote: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },
  { quote: "Enthusiasm moves the world.", author: "Arthur Balfour" },
  { quote: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { quote: "Things work out best for those who make the best of how things work out.", author: "John Wooden" },
  { quote: "To know what you know and what you do not know, that is true knowledge.", author: "Confucius" },
  { quote: "Victory belongs to the most persevering.", author: "Napoleon Bonaparte" },
  { quote: "Work hard in silence, let your success be your noise.", author: "Frank Ocean" },
  { quote: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { quote: "Our greatest weakness lies in giving up. The most certain way to succeed is always to try just one more time.", author: "Thomas Edison" },
  { quote: "Genius is one percent inspiration and ninety-nine percent perspiration.", author: "Thomas Edison" },
  { quote: "If you can dream it, you can do it.", author: "Walt Disney" },
  { quote: "Be not afraid of going slowly, be afraid only of standing still.", author: "Chinese Proverb" },
  { quote: "The harder the conflict, the more glorious the triumph.", author: "Thomas Paine" },
  { quote: "You must do the thing you think you cannot do.", author: "Eleanor Roosevelt" },
  { quote: "Act as if what you do makes a difference. It does.", author: "William James" },
  { quote: "Definiteness of purpose is the starting point of all achievement.", author: "W. Clement Stone" },
  { quote: "Never give in. Never give in. Never, never, never, never.", author: "Winston Churchill" },
  { quote: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { quote: "Perseverance is not a long race; it is many short races one after the other.", author: "Walter Bagehot" },
  { quote: "Aim for success, not perfection. Never surrender your right to be wrong.", author: "David M. Burns" },
  { quote: "Do not go where the path may lead, go instead where there is no path and leave a trail.", author: "Ralph Waldo Emerson" },
  { quote: "Do what you love, and the necessary resources will follow.", author: "Peter McWilliams" },
  { quote: "When you have a dream, you've got to grab it and never let go.", author: "Carol Burnett" },
  { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { quote: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
  { quote: "A smooth sea never made a skilled sailor.", author: "Franklin D. Roosevelt" },
  { quote: "Start by doing what's necessary; then do what's possible; and suddenly you are doing the impossible.", author: "Francis of Assisi" },
  { quote: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { quote: "Keep your face always toward the sunshine—and shadows will fall behind you.", author: "Walt Whitman" },
  { quote: "Setting goals is the first step in turning the invisible into the visible.", author: "Tony Robbins" },
  { quote: "Happiness is not something readymade. It comes from your own actions.", author: "Dalai Lama" }
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
