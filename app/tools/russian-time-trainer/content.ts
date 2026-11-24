export type Bilingual = Readonly<{ en: string; ru: string }>;
type StudyText = Bilingual & { vi: string };

export type TimeExample = Readonly<{
  id: string;
  clock?: string;
  phrase: StudyText;
  stressed: string;
}>;

export type TimeLesson = Readonly<{
  id: string;
  title: Bilingual;
  objective: StudyText;
  rule: StudyText;
  examples: readonly TimeExample[];
}>;

export const timeLessons: readonly TimeLesson[] = [
  {
    id: "asking",
    title: { en: "Ask the time", ru: "Спросить время" },
    objective: {
      en: "Distinguish the current time, the start time, and how much time is left.",
      ru: "Различайте текущее время, время начала и сколько времени осталось.",
      vi: "Phân biệt giờ hiện tại, giờ bắt đầu và thời gian còn lại.",
    },
    rule: {
      en: "Use “What time is it?” for the current time. Use “At what time?” to ask when an event starts.",
      ru: "Чтобы узнать время сейчас, спросите «Который час?». О начале события спросите «Во сколько?».",
      vi: "Hỏi «Который час?» để biết bây giờ là mấy giờ. Dùng «Во сколько?» để hỏi một sự kiện bắt đầu lúc mấy giờ.",
    },
    examples: [
      {
        id: "what-time",
        phrase: { en: "What time is it?", ru: "Который час?", vi: "Bây giờ là mấy giờ?" },
        stressed: "Кото́рый ча́с?",
      },
      {
        id: "lesson-start",
        phrase: { en: "What time does the lesson start?", ru: "Во сколько начинается урок?", vi: "Tiết học bắt đầu lúc mấy giờ?" },
        stressed: "Во ско́лько начина́ется уро́к?",
      },
      {
        id: "time-left",
        phrase: { en: "How much time is left?", ru: "Сколько времени осталось?", vi: "Còn bao nhiêu thời gian?" },
        stressed: "Ско́лько вре́мени оста́лось?",
      },
    ],
  },
  {
    id: "hours",
    title: { en: "Read the hour", ru: "Назвать час" },
    objective: {
      en: "Choose the right form of hour after a number.",
      ru: "Выберите нужную форму слова «час» после числительного.",
      vi: "Chọn đúng dạng của từ «час» sau số đếm.",
    },
    rule: {
      en: "Use the singular after one and the genitive singular after two through four. Five through twenty take the genitive plural.",
      ru: "После одного — «час», после двух, трёх и четырёх — «часа». От пяти до двадцати нужна форма «часов».",
      vi: "Sau một, dùng «час». Sau hai, ba và bốn, dùng «часа». Từ năm đến hai mươi, dùng «часов».",
    },
    examples: [
      {
        id: "one",
        clock: "01:00",
        phrase: { en: "It is one o’clock.", ru: "Сейчас час.", vi: "Bây giờ là một giờ." },
        stressed: "Сейча́с ча́с.",
      },
      {
        id: "two",
        clock: "02:00",
        phrase: { en: "It is two o’clock.", ru: "Сейчас два часа.", vi: "Bây giờ là hai giờ." },
        stressed: "Сейча́с два часа́.",
      },
      {
        id: "five",
        clock: "05:00",
        phrase: { en: "It is five o’clock.", ru: "Сейчас пять часов.", vi: "Bây giờ là năm giờ." },
        stressed: "Сейча́с пять часо́в.",
      },
    ],
  },
  {
    id: "minutes",
    title: { en: "Half and quarter hours", ru: "Половина и четверть часа" },
    objective: {
      en: "Say a quarter past, half past, and a quarter to the hour.",
      ru: "Научитесь называть время с помощью слов «половина» и «четверть».",
      vi: "Tập nói giờ hơn mười lăm phút, giờ rưỡi và giờ kém mười lăm phút.",
    },
    rule: {
      en: "For a quarter past or half past, Russian names the next hour. A quarter to nine means fifteen minutes are left until nine.",
      ru: "После «четверть» и «половина» назовите следующий час: «девятого». «Без четверти девять» значит, что до девяти осталось пятнадцать минут.",
      vi: "Sau «четверть» và «половина», tiếng Nga gọi theo giờ kế tiếp. «Без четверти девять» nghĩa là còn mười lăm phút nữa đến chín giờ.",
    },
    examples: [
      {
        id: "quarter-past",
        clock: "08:15",
        phrase: { en: "It is a quarter past eight.", ru: "Сейчас четверть девятого.", vi: "Bây giờ là tám giờ mười lăm." },
        stressed: "Сейча́с че́тверть девя́того.",
      },
      {
        id: "half-past",
        clock: "08:30",
        phrase: { en: "It is half past eight.", ru: "Сейчас половина девятого.", vi: "Bây giờ là tám giờ rưỡi." },
        stressed: "Сейча́с полови́на девя́того.",
      },
      {
        id: "quarter-to",
        clock: "08:45",
        phrase: { en: "It is a quarter to nine.", ru: "Сейчас без четверти девять.", vi: "Bây giờ là chín giờ kém mười lăm." },
        stressed: "Сейча́с без че́тверти де́вять.",
      },
    ],
  },
  {
    id: "plans",
    title: { en: "Make a plan", ru: "Договориться о времени" },
    objective: {
      en: "Tell someone when a lesson, meeting, or train is scheduled.",
      ru: "Скажите, во сколько начнётся урок, состоится встреча или отправится поезд.",
      vi: "Nói giờ bắt đầu tiết học, giờ hẹn gặp hoặc giờ tàu chạy.",
    },
    rule: {
      en: "Use the preposition в before an event time. For a meeting at half past eight, say в половине девятого.",
      ru: "Перед точным временем события ставьте «в». Для встречи в восемь тридцать скажите «в половине девятого».",
      vi: "Dùng «в» trước giờ diễn ra sự kiện. Khi hẹn lúc tám giờ rưỡi, nói «в половине девятого».",
    },
    examples: [
      {
        id: "start-nine",
        clock: "09:00",
        phrase: { en: "The lesson starts at nine o’clock.", ru: "Урок начинается в девять часов.", vi: "Tiết học bắt đầu lúc chín giờ." },
        stressed: "Уро́к начина́ется в де́вять часо́в.",
      },
      {
        id: "meet-half",
        clock: "08:30",
        phrase: { en: "Let’s meet at half past eight.", ru: "Давай встретимся в половине девятого.", vi: "Mình gặp nhau lúc tám giờ rưỡi nhé." },
        stressed: "Дава́й встре́тимся в полови́не девя́того.",
      },
      {
        id: "train",
        clock: "06:40",
        phrase: { en: "The train leaves at six forty.", ru: "Поезд отправляется в шесть сорок.", vi: "Tàu khởi hành lúc sáu giờ bốn mươi." },
        stressed: "По́езд отправля́ется в шесть со́рок.",
      },
    ],
  },,
{"id":"weekdays","title":{"en":"Days of the week","ru":"Дни недели"},"objective":{"en":"Learn the days of the week.","ru":"Учите дни недели.","vi":"Học các ngày trong tuần."},"rule":{"en":"Tuesday has devoicing.","ru":"Во вторнике оглушение.","vi":"Thứ Ba có hiện tượng vô thanh hóa."},"examples":[{"id":"weekdays-0","phrase":{"en":"Monday","ru":"понедельник","vi":"thứ Hai"},"stressed":"понеде́льник"},{"id":"weekdays-1","phrase":{"en":"Tuesday","ru":"вторник","vi":"thứ Ba"},"stressed":"вто́рник"},{"id":"weekdays-2","phrase":{"en":"Wednesday","ru":"среда","vi":"thứ Tư"},"stressed":"среда́"},{"id":"weekdays-3","phrase":{"en":"Thursday","ru":"четверг","vi":"thứ Năm"},"stressed":"четве́рг"},{"id":"weekdays-4","phrase":{"en":"Friday","ru":"пятница","vi":"thứ Sáu"},"stressed":"пя́тница"},{"id":"weekdays-5","phrase":{"en":"Saturday","ru":"суббота","vi":"thứ Bảy"},"stressed":"суббо́та"},{"id":"weekdays-6","phrase":{"en":"Sunday","ru":"воскресенье","vi":"Chủ nhật"},"stressed":"воскресе́нье"}]},{"id":"relative-days","title":{"en":"Relative days","ru":"Относительные даты"},"objective":{"en":"Learn relative days.","ru":"Учите относительные даты.","vi":"Học các ngày tương đối."},"rule":{"en":"Today has a special pronunciation.","ru":"Сегодня произносится особо.","vi":"Hôm nay có cách phát âm đặc biệt."},"examples":[{"id":"relative-days-0","phrase":{"en":"Yesterday","ru":"вчера","vi":"hôm qua"},"stressed":"вчера́"},{"id":"relative-days-1","phrase":{"en":"Today","ru":"сегодня","vi":"hôm nay"},"stressed":"сего́дня"},{"id":"relative-days-2","phrase":{"en":"Tomorrow","ru":"завтра","vi":"ngày mai"},"stressed":"за́втра"},{"id":"relative-days-3","phrase":{"en":"The day before yesterday","ru":"позавчера","vi":"hôm kia"},"stressed":"позавчера́"},{"id":"relative-days-4","phrase":{"en":"The day after tomorrow","ru":"послезавтра","vi":"ngày kia"},"stressed":"послеза́втра"}]}
];

const wordGlosses: readonly (readonly [string, string])[] = [
["learn|учите","học"],["days|дни","các ngày"],["week|недели","tuần"],["tuesday|вторнике","thứ Ba"],["has","có"],["devoicing|оглушение","vô thanh hóa"],["relative|относительные","tương đối"],["dates|даты","ngày tháng"],["today|сегодня","hôm nay"],["special|особо","đặc biệt"],["pronunciation|произносится","phát âm"],["in|во","trong"],["day","ngày"],["yesterday","hôm qua"],["tomorrow","ngày mai"],
  ["what|который", "gì, nào"], ["time|время|времени|временем", "thời gian hoặc giờ"],
  ["hour|hours|час", "giờ (số ít)"], ["часа", "giờ (dạng dùng sau 2, 3, 4)"], ["часов", "giờ (dạng số nhiều)"],
  ["is|has|are", "là, có"], ["it", "chủ ngữ giả trong câu chỉ giờ"], ["the|a|an", "mạo từ trong tiếng Anh"],
  ["does", "trợ động từ dùng để hỏi"], ["now|current|сейчас|текущее", "bây giờ, hiện tại"],
  ["at|в|во", "vào lúc"], ["how|как", "như thế nào"], ["much|сколько", "bao nhiêu"],
  ["lesson|урок", "tiết học"], ["meeting|встреча|встречи", "cuộc hẹn gặp"],
  ["start|starts|начала|начинается|начнётся", "bắt đầu"], ["left|осталось", "còn lại"],
  ["train|поезд", "tàu hỏa"], ["leaves|отправляется|отправится", "khởi hành"],
  ["let's|давай", "chúng ta hãy"], ["meet|встретимся", "gặp nhau"], ["scheduled|состоится", "được lên lịch, sẽ diễn ra"],
  ["one|одного", "một"], ["two|два|двух", "hai"], ["three|трёх", "ba"], ["four|четырёх", "bốn"],
  ["five|пять|пяти", "năm"], ["six|шесть", "sáu"], ["eight|восемь", "tám"],
  ["nine|девять|девяти", "chín"], ["девятого", "của giờ thứ chín"],
  ["fifteen|пятнадцать", "mười lăm"], ["twenty|двадцати", "hai mươi"], ["thirty|тридцать", "ba mươi"],
  ["forty|сорок", "bốn mươi"], ["o'clock", "đúng giờ"],
  ["half|половина|половине", "một nửa, giờ rưỡi"], ["quarter|четверть|четверти", "một phần tư giờ"],
  ["past", "qua giờ, hơn"], ["to|until|до", "đến, còn … nữa tới"], ["без", "kém (khi nói giờ)"],
  ["minutes|минут", "phút"], ["next|следующий", "tiếp theo"], ["means|значит", "có nghĩa là"],
  ["russian", "tiếng Nga"], ["names|назовите|называть", "gọi tên, nói"],
  ["ask|спросите|спросить", "hỏi"], ["event|события", "sự kiện"], ["when", "khi nào"],
  ["someone", "ai đó"], ["tell|скажите|say", "nói"], ["use|ставьте", "dùng, đặt"],
  ["for|для", "cho"], ["of", "của"], ["от", "từ"], ["с", "với"], ["right|нужную|нужна", "đúng, cần"],
  ["choose|выберите", "chọn"], ["form|форму|форма", "dạng"], ["word|слов|слова", "từ"],
  ["number|числительного", "số đếm"], ["after|после", "sau"], ["before|перед", "trước"],
  ["singular", "số ít"], ["plural", "số nhiều"], ["genitive", "cách hai (sở hữu cách)"],
  ["through", "đến hết"], ["take", "dùng, đi với"], ["exact|точным", "chính xác"], ["preposition", "giới từ"],
  ["distinguish|различайте", "phân biệt"], ["clock", "đồng hồ"], ["with|помощью", "bằng, với sự trợ giúp"],
  ["научитесь", "hãy học cách"], ["узнать", "biết, tìm hiểu"], ["чтобы", "để"], ["что", "rằng"],
  ["о|about", "về"], ["начале", "lúc bắt đầu"], ["and|и", "và"], ["or|или", "hoặc"],
];

const phrases: readonly (readonly [string, string])[] = [
  ["at what time|во сколько", "vào lúc mấy giờ"],
  ["what time is it now|сколько сейчас времени", "bây giờ là mấy giờ"],
  ["a quarter past eight|четверть девятого", "tám giờ mười lăm"],
  ["half past eight|половина девятого|полдевятого", "tám giờ rưỡi"],
  ["a quarter to nine|без четверти девять", "chín giờ kém mười lăm"],
  ["at half past eight|в половине девятого", "lúc tám giờ rưỡi"],
  ["два часа|two o'clock", "hai giờ"], ["пять часов|five o'clock", "năm giờ"],
  ["девять часов|nine o'clock", "chín giờ"], ["шесть сорок|six forty", "sáu giờ bốn mươi"],
];

function normalize(text: string) {
  return (text.normalize("NFC").replace(/\u0301/gu, "").toLowerCase().replaceAll("ё", "е").replaceAll("’", "'")
    .match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) ?? []).join(" ");
}

const glossary = new Map<string, string>();
for (const [variants, meaning] of [...wordGlosses, ...phrases]) {
  for (const word of variants.split("|")) glossary.set(normalize(word), meaning);
}
for (const lesson of timeLessons) {
  for (const entry of [lesson.objective, lesson.rule, ...lesson.examples.map(example => example.phrase)]) {
    glossary.set(normalize(entry.en), entry.vi);
    glossary.set(normalize(entry.ru), entry.vi);
  }
}

export function translatedWord(text: string) {
  return glossary.get(normalize(text));
}

export type Translation =
  | { kind: "exact"; meaning: string }
  | { kind: "words"; words: { text: string; meaning: string }[] }
  | { kind: "missing" };

export function translateStudyText(text: string): Translation {
  if (!text.trim() || text.length > 600) return { kind: "missing" };
  const exact = translatedWord(text);
  if (exact) return { kind: "exact", meaning: exact };
  const words = [...new Set(text.match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu) ?? [])]
    .flatMap(word => {
      const meaning = translatedWord(word);
      return meaning ? [{ text: word, meaning }] : [];
    });
  return words.length ? { kind: "words", words } : { kind: "missing" };
}
