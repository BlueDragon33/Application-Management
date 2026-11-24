import type { Bilingual } from "./content";

type FormInput = readonly [stressed: string, ipa: string, en: string, vi: string];
type ExampleInput = readonly [ru: string, en: string, vi: string];

export const categories = {
  relative: { en: "Time expressions", ru: "Выражения времени" },
  day: { en: "Times of day", ru: "Части суток" },
  week: { en: "Weekdays", ru: "Дни недели" },
  season: { en: "Seasons", ru: "Времена года" },
  month: { en: "Months", ru: "Месяцы" },
} satisfies Record<string, Bilingual>;

export const soundNotes = {
  reduce: { en: "Unstressed о often sounds closer to [ɐ] just before the stress and [ə] elsewhere.", ru: "Безударное о часто звучит ближе к [ɐ] перед ударением и к [ə] в других позициях." },
  soft: { en: "The superscript [ʲ] marks a soft consonant. Final ь marks softness and has no sound of its own.", ru: "Знак [ʲ] обозначает мягкость согласного. Конечный ь смягчает согласный и не имеет своего звука." },
  today: { en: "In сегодня, г is pronounced [v].", ru: "В слове «сегодня» буква г произносится как [v]." },
  devoicing: { en: "Final г in четверг sounds like [k]. Before a voiceless consonant, в can sound like [f].", ru: "Конечное г в слове «четверг» звучит как [k]. Перед глухим согласным в может звучать как [f]." },
  silent: { en: "In поздно, д is usually silent.", ru: "В слове «поздно» буква д обычно не произносится." },
  stress: { en: "Keep the marked vowel clear. The acute accent is a learning aid and is normally omitted in writing.", ru: "Чётко произносите ударную гласную. Знак ударения помогает при обучении, а на письме обычно опускается." },
} satisfies Record<string, Bilingual>;

type Category = keyof typeof categories;
type Sound = keyof typeof soundNotes;

function group(id: string, category: Category, cue: string, sound: Sound, example: ExampleInput, ...forms: FormInput[]) {
  return {
    id, category, cue, sound,
    forms: forms.map(([stressed, ipa, en, vi], index) => ({
      id: id + "-" + (index + 1), ru: stressed.replaceAll("\u0301", ""), stressed, ipa, en, vi,
    })),
    example: { id: id + "-example", ru: example[0], en: example[1], vi: example[2] },
  };
}

export const calendarGroups = [
  group("day-before", "relative", "−2", "devoicing", ["Мы виделись позавчера.", "We saw each other the day before yesterday.", "Chúng tôi gặp nhau hôm kia."],
    ["позавчера́", "pəzəftɕɪˈra", "the day before yesterday", "hôm kia"]),
  group("yesterday", "relative", "−1", "devoicing", ["Вчера был урок.", "There was a lesson yesterday.", "Hôm qua có tiết học."],
    ["вчера́", "ftɕɪˈra", "yesterday", "hôm qua"]),
  group("today", "relative", "0", "today", ["Сегодня у нас встреча.", "We have a meeting today.", "Hôm nay chúng tôi có cuộc hẹn."],
    ["сего́дня", "sʲɪˈvodʲnʲə", "today", "hôm nay"]),
  group("tomorrow", "relative", "+1", "stress", ["Увидимся завтра.", "See you tomorrow.", "Hẹn gặp ngày mai."],
    ["за́втра", "ˈzaftrə", "tomorrow", "ngày mai"]),
  group("day-after", "relative", "+2", "devoicing", ["Я уезжаю послезавтра.", "I leave the day after tomorrow.", "Tôi đi vào ngày kia."],
    ["послеза́втра", "pəslʲɪˈzaftrə", "the day after tomorrow", "ngày kia"]),
  group("now", "relative", "⏱", "stress", ["Я сейчас дома.", "I am at home now.", "Bây giờ tôi đang ở nhà."],
    ["сейча́с", "sʲɪjˈtɕas", "now", "bây giờ"]),
  group("early", "relative", "🌄", "stress", ["Я встаю рано.", "I get up early.", "Tôi dậy sớm."],
    ["ра́но", "ˈranə", "early", "sớm"]),
  group("late", "relative", "🌃", "silent", ["Я вернусь поздно.", "I will be back late.", "Tôi sẽ về muộn."],
    ["по́здно", "ˈpoznə", "late", "muộn"]),
  group("morning", "day", "🌅", "stress", ["Утром я пью чай.", "I drink tea in the morning.", "Buổi sáng tôi uống trà."],
    ["у́тро", "ˈutrə", "morning", "buổi sáng"], ["у́тром", "ˈutrəm", "in the morning", "vào buổi sáng"]),
  group("daytime", "day", "☀️", "soft", ["Днём у меня занятия.", "I have classes during the day.", "Ban ngày tôi có lớp."],
    ["де́нь", "dʲenʲ", "daytime", "ban ngày"], ["днём", "dnʲɵm", "during the day", "vào ban ngày"]),
  group("evening", "day", "🌇", "stress", ["Вечером я читаю.", "I read in the evening.", "Buổi tối tôi đọc sách."],
    ["ве́чер", "ˈvʲetɕɪr", "evening", "buổi tối"], ["ве́чером", "ˈvʲetɕɪrəm", "in the evening", "vào buổi tối"]),
  group("night", "day", "🌙", "soft", ["Ночью город тихий.", "The city is quiet at night.", "Ban đêm thành phố yên tĩnh."],
    ["но́чь", "notɕ", "night", "ban đêm"], ["но́чью", "ˈnotɕjʊ", "at night", "vào ban đêm"]),
  group("monday", "week", "1", "reduce", ["В понедельник у нас урок.", "We have a lesson on Monday.", "Thứ Hai chúng tôi có tiết học."],
    ["понеде́льник", "pənʲɪˈdʲelʲnʲɪk", "Monday", "thứ Hai"], ["в понеде́льник", "fpənʲɪˈdʲelʲnʲɪk", "on Monday", "vào thứ Hai"]),
  group("tuesday", "week", "2", "devoicing", ["Во вторник я работаю.", "I work on Tuesday.", "Thứ Ba tôi làm việc."],
    ["вто́рник", "ˈftornʲɪk", "Tuesday", "thứ Ba"], ["во вто́рник", "vɐˈftornʲɪk", "on Tuesday", "vào thứ Ba"]),
  group("wednesday", "week", "3", "stress", ["В среду у меня экзамен.", "I have an exam on Wednesday.", "Thứ Tư tôi có một kỳ thi."],
    ["среда́", "srʲɪˈda", "Wednesday", "thứ Tư"], ["в сре́ду", "ˈfsrʲedʊ", "on Wednesday", "vào thứ Tư"]),
  group("thursday", "week", "4", "devoicing", ["В четверг мы идём в музей.", "We are going to the museum on Thursday.", "Thứ Năm chúng tôi đi bảo tàng."],
    ["четве́рг", "tɕɪtˈvʲerk", "Thursday", "thứ Năm"], ["в четве́рг", "ftɕɪtˈvʲerk", "on Thursday", "vào thứ Năm"]),
  group("friday", "week", "5", "soft", ["В пятницу я свободен.", "I am free on Friday.", "Thứ Sáu tôi rảnh."],
    ["пя́тница", "ˈpʲatʲnʲɪt͡sə", "Friday", "thứ Sáu"], ["в пя́тницу", "ˈfpʲatʲnʲɪt͡sʊ", "on Friday", "vào thứ Sáu"]),
  group("saturday", "week", "6", "stress", ["В субботу мы гуляем.", "We go for a walk on Saturday.", "Thứ Bảy chúng tôi đi dạo."],
    ["суббо́та", "sʊˈbotə", "Saturday", "thứ Bảy"], ["в суббо́ту", "fsʊˈbotʊ", "on Saturday", "vào thứ Bảy"]),
  group("sunday", "week", "7", "soft", ["В воскресенье я отдыхаю.", "I rest on Sunday.", "Chủ nhật tôi nghỉ ngơi."],
    ["воскресе́нье", "vəskrʲɪˈsʲenʲjə", "Sunday", "Chủ nhật"], ["в воскресе́нье", "vvəskrʲɪˈsʲenʲjə", "on Sunday", "vào Chủ nhật"]),
  group("spring", "season", "🌱", "stress", ["Весной тает снег.", "Snow melts in spring.", "Mùa xuân tuyết tan."],
    ["весна́", "vʲɪˈsna", "spring", "mùa xuân"], ["весно́й", "vʲɪˈsnoj", "in spring", "vào mùa xuân"]),
  group("summer", "season", "☀️", "stress", ["Летом мы плаваем.", "We swim in summer.", "Mùa hè chúng tôi bơi."],
    ["ле́то", "ˈlʲetə", "summer", "mùa hè"], ["ле́том", "ˈlʲetəm", "in summer", "vào mùa hè"]),
  group("autumn", "season", "🍂", "soft", ["Осенью часто идёт дождь.", "It often rains in autumn.", "Mùa thu thường có mưa."],
    ["о́сень", "ˈosʲɪnʲ", "autumn", "mùa thu"], ["о́сенью", "ˈosʲɪnʲjʊ", "in autumn", "vào mùa thu"]),
  group("winter", "season", "❄️", "stress", ["Зимой здесь холодно.", "It is cold here in winter.", "Mùa đông ở đây lạnh."],
    ["зима́", "zʲɪˈma", "winter", "mùa đông"], ["зимо́й", "zʲɪˈmoj", "in winter", "vào mùa đông"]),
  group("jan", "month", "01", "soft", ["В январе у нас каникулы.", "We have a break in January.", "Tháng Một chúng tôi được nghỉ."],
    ["янва́рь", "jɪnˈvarʲ", "January", "tháng Một"], ["в январе́", "vjɪnvɐˈrʲe", "in January", "vào tháng Một"]),
  group("feb", "month", "02", "soft", ["В феврале ещё холодно.", "It is still cold in February.", "Tháng Hai trời vẫn lạnh."],
    ["февра́ль", "fʲɪvˈralʲ", "February", "tháng Hai"], ["в феврале́", "ffʲɪvrɐˈlʲe", "in February", "vào tháng Hai"]),
  group("mar", "month", "03", "stress", ["Снег тает в марте.", "Snow melts in March.", "Tuyết tan vào tháng Ba."],
    ["ма́рт", "mart", "March", "tháng Ba"], ["в ма́рте", "ˈvmartʲɪ", "in March", "vào tháng Ba"]),
  group("apr", "month", "04", "soft", ["В апреле здесь тепло.", "It is warm here in April.", "Tháng Tư ở đây ấm áp."],
    ["апре́ль", "ɐˈprʲelʲ", "April", "tháng Tư"], ["в апре́ле", "vɐˈprʲelʲɪ", "in April", "vào tháng Tư"]),
  group("may", "month", "05", "stress", ["В мае начинается курс.", "The course begins in May.", "Khóa học bắt đầu vào tháng Năm."],
    ["ма́й", "maj", "May", "tháng Năm"], ["в ма́е", "ˈvmajɪ", "in May", "vào tháng Năm"]),
  group("jun", "month", "06", "soft", ["В июне я еду домой.", "I am going home in June.", "Tháng Sáu tôi về nhà."],
    ["ию́нь", "ɪˈjunʲ", "June", "tháng Sáu"], ["в ию́не", "vɨˈjunʲɪ", "in June", "vào tháng Sáu"]),
  group("jul", "month", "07", "soft", ["В июле мы едем на море.", "We are going to the seaside in July.", "Tháng Bảy chúng tôi đi biển."],
    ["ию́ль", "ɪˈjulʲ", "July", "tháng Bảy"], ["в ию́ле", "vɨˈjulʲɪ", "in July", "vào tháng Bảy"]),
  group("aug", "month", "08", "stress", ["У нас отпуск в августе.", "Our vacation is in August.", "Kỳ nghỉ của chúng tôi vào tháng Tám."],
    ["а́вгуст", "ˈavɡʊst", "August", "tháng Tám"], ["в а́вгусте", "ˈvavɡʊsʲtʲɪ", "in August", "vào tháng Tám"]),
  group("sep", "month", "09", "soft", ["Учёба начинается в сентябре.", "Classes start in September.", "Việc học bắt đầu vào tháng Chín."],
    ["сентя́брь", "sʲɪnʲˈtʲabrʲ", "September", "tháng Chín"], ["в сентябре́", "fsʲɪnʲtʲɪˈbrʲe", "in September", "vào tháng Chín"]),
  group("oct", "month", "10", "soft", ["В октябре листья желтеют.", "Leaves turn yellow in October.", "Lá chuyển vàng vào tháng Mười."],
    ["октя́брь", "ɐkˈtʲabrʲ", "October", "tháng Mười"], ["в октябре́", "vəktʲɪˈbrʲe", "in October", "vào tháng Mười"]),
  group("nov", "month", "11", "soft", ["В ноябре дни короткие.", "The days are short in November.", "Tháng Mười Một có ngày ngắn."],
    ["ноя́брь", "nɐˈjabrʲ", "November", "tháng Mười Một"], ["в ноябре́", "vnəjɪˈbrʲe", "in November", "vào tháng Mười Một"]),
  group("dec", "month", "12", "soft", ["В декабре уже зима.", "It is already winter in December.", "Tháng Mười Hai đã vào mùa đông."],
    ["дека́брь", "dʲɪˈkabrʲ", "December", "tháng Mười Hai"], ["в декабре́", "vdʲɪkɐˈbrʲe", "in December", "vào tháng Mười Hai"]),
];

export type CalendarGroup = typeof calendarGroups[number];
export const calendarForms = calendarGroups.flatMap(item => item.forms.map(form => ({ ...form, group: item })));
