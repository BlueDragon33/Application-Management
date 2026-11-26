import type { Bilingual } from "./content";
export type AdaptiveSkill = "sound" | "context";
export type AdaptiveText = Bilingual & { vi: string; ipa?: string };
export type AdaptiveTask = {
  id: string; skill: AdaptiveSkill; stage: "foundation" | "dialogue" | "followup" | "sound";
  title: Bilingual; goal: Bilingual; prompt?: AdaptiveText; promptAudioId?: string;
  options: readonly AdaptiveText[]; correct: number; rule: Bilingual; requires?: string;
};
const text = (ru: string, en: string, vi: string, ipa?: string): AdaptiveText => ({ ru, en, vi, ...(ipa ? { ipa } : {}) });
const pair = (en: string, ru: string): Bilingual => ({ en, ru });
const context = (id: string, stage: "foundation" | "dialogue" | "followup", title: Bilingual, goal: Bilingual,
  options: readonly AdaptiveText[], correct: number, rule: Bilingual, prompt?: AdaptiveText, requires?: string, promptAudioId?: string): AdaptiveTask =>
  ({ id, skill: "context", stage, title, goal, options, correct, rule, prompt, requires, promptAudioId });

const relative = pair("Relative time", "Относительное время");
const meeting = pair("Meeting", "Встреча");
const weekday = pair("Weekday", "День недели");
const exam = pair("Exam", "Экзамен");
const routine = pair("Daily routine", "Распорядок дня");
const clock = pair("Clock time", "Время по часам");

// Owner-approved prototype scenarios, supplemental content pending linguistic review.
const contextTasks: readonly AdaptiveTask[] = [
  context("adaptive-meet-foundation", "foundation", relative, pair("Choose the next day.", "Выберите следующий день."),
    [text("вчера́","yesterday","hôm qua"),text("за́втра","tomorrow","ngày mai"),text("сего́дня","today","hôm nay")], 1,
    pair("Tomorrow refers to the next day, not the previous day.", "Завтра — следующий день, а не предыдущий.")),
  context("adaptive-meet-first", "dialogue", meeting, pair("Arrange a meeting for tomorrow.", "Договоритесь о встрече на следующий день."),
    [text("Дава́й встре́тимся за́втра.","Let's meet tomorrow.","Mình gặp nhau ngày mai nhé."),text("Мы встре́тились вчера́.","We met yesterday.","Chúng ta đã gặp hôm qua."),text("Сейча́с я чита́ю.","I am reading now.","Bây giờ tôi đang đọc.")], 0,
    pair("Use завтра for a future meeting; вчера refers to the past.", "Для будущей встречи используйте «завтра», а не «вчера»."),
    text("Когда́ мы встре́тимся?","When will we meet?","Khi nào chúng ta gặp nhau?"),"adaptive-meet-foundation"),
  context("adaptive-meet-follow", "followup", meeting, pair("Agree on 09:00.", "Назовите время встречи: 09:00."),
    [text("В де́вять часо́в.","At nine o'clock.","Lúc chín giờ."),text("Де́вять часо́в наза́д.","Nine hours ago.","Chín giờ trước."),text("Вчера́.","Yesterday.","Hôm qua.")], 0,
    pair("Use в + time for an appointment, not назад.", "Для времени встречи используйте «в», а не «назад»."),
    text("Во ско́лько?","At what time?","Lúc mấy giờ?"),"adaptive-meet-first"),
  context("adaptive-exam-foundation", "foundation", weekday, pair("Choose the expression for on Wednesday.", "Выберите форму для дня события: среда."),
    [text("среда́","Wednesday","thứ Tư"),text("в сре́ду","on Wednesday","vào thứ Tư"),text("в четве́рг","on Thursday","vào thứ Năm")], 1,
    pair("В среду uses the accusative and changes stress.", "В сре́ду — винительный падеж с изменением ударения.")),
  context("adaptive-exam-first", "dialogue", exam, pair("Your exam is on Wednesday.", "Экзамен в третий день недели."),
    [text("В сре́ду у меня́ экза́мен.","I have an exam on Wednesday.","Tôi có kỳ thi vào thứ Tư."),text("Я отдыха́ю в воскресе́нье.","I rest on Sunday.","Tôi nghỉ vào Chủ nhật."),text("У́тром я пью чай.","I drink tea in the morning.","Tôi uống trà buổi sáng.")],0,
    pair("Use в среду for an event on Wednesday.", "Для события в среду используйте форму «в сре́ду»."),
    text("Когда́ у тебя́ экза́мен?","When is your exam?","Khi nào bạn thi?"),"adaptive-exam-foundation"),
  context("adaptive-exam-follow", "followup", exam, pair("Say the exam is at 08:30.", "Назовите время экзамена: 08:30."),
    [text("В де́вять часо́в.","At nine o'clock.","Lúc chín giờ."),text("В полови́не девя́того.","At half past eight.","Lúc tám giờ rưỡi."),text("Полови́на восьмо́го.","Half past seven.","Bảy giờ rưỡi.")],1,
    pair("В половине девятого is at 8:30, half of the ninth hour.", "В полови́не девя́того — в 8:30."),
    text("А во ско́лько экза́мен?","And what time is the exam?","Kỳ thi lúc mấy giờ?"),"adaptive-exam-first"),
  context("adaptive-routine-foundation", "foundation", routine, pair("Choose in the morning, not the noun.", "Выберите обстоятельство времени для утра."),
    [text("у́тро","morning","buổi sáng"),text("у́тром","in the morning","vào buổi sáng"),text("ве́чером","in the evening","vào buổi tối")],1,
    pair("Утром specifies when; утро names a part of the day.", "У́тром обозначает время действия, у́тро — часть суток.")),
  context("adaptive-routine-first", "dialogue", routine, pair("Say you drink tea in the morning.", "Расскажите об утреннем чаепитии."),
    [text("У́тром я пью чай.","I drink tea in the morning.","Tôi uống trà buổi sáng."),text("Ве́чером я чита́ю.","I read in the evening.","Tôi đọc sách buổi tối."),text("За́втра у нас встре́ча.","We have a meeting tomorrow.","Ngày mai chúng tôi có cuộc hẹn.")],0,
    pair("Утром expresses when the action happens.", "У́тром — обстоятельство времени."),
    text("Что ты де́лаешь у́тром?","What do you do in the morning?","Bạn làm gì vào buổi sáng?"),"adaptive-routine-foundation"),
  context("adaptive-routine-follow", "followup", routine, pair("Say you read in the evening.", "Расскажите о чтении вечером."),
    [text("У́тром я пью чай.","I drink tea in the morning.","Tôi uống trà buổi sáng."),text("Ве́чер.","Evening.","Buổi tối."),text("Ве́чером я чита́ю.","I read in the evening.","Tôi đọc sách buổi tối.")],2,
    pair("Вечером describes when the reading takes place.", "Ве́чером обозначает время действия."),
    text("А ве́чером?","And in the evening?","Còn buổi tối?"),"adaptive-routine-first"),
  context("adaptive-clock-foundation", "foundation", clock, pair("Choose the expression for 08:30.", "Выберите выражение для 08:30."),
    [text("Полови́на девя́того.","Half past eight.","Tám giờ rưỡi."),text("Полови́на восьмо́го.","Half past seven.","Bảy giờ rưỡi."),text("Без че́тверти де́вять.","A quarter to nine.","Chín giờ kém mười lăm.")],0,
    pair("For half past, Russian names the next hour.", "В выражении с половиной называют следующий час.")),
  context("adaptive-clock-first", "dialogue", clock, pair("Tell someone it is 08:30.", "Назовите текущее время: 08:30."),
    [text("Сейча́с полови́на девя́того.","It is half past eight.","Bây giờ là tám giờ rưỡi."),text("Сейча́с де́вять часо́в.","It is nine o'clock.","Bây giờ là chín giờ."),text("Сейча́с без че́тверти де́вять.","It is a quarter to nine.","Bây giờ là chín giờ kém mười lăm.")],0,
    pair("Half of the ninth hour is 8:30.", "Полови́на девя́того — 8:30."),
    text("Кото́рый ча́с?","What time is it?","Bây giờ là mấy giờ?"),"adaptive-clock-foundation","what-time"),
  context("adaptive-clock-follow", "followup", clock, pair("Say the lesson starts at 09:00.", "Назовите время начала урока: 09:00."),
    [text("Уро́к начина́ется в де́вять часо́в.","The lesson starts at nine o'clock.","Tiết học bắt đầu lúc chín giờ."),text("Уро́к начина́ется вчера́.","The lesson starts yesterday.","Tiết học bắt đầu hôm qua."),text("Сейча́с полови́на девя́того.","It is half past eight.","Bây giờ là tám giờ rưỡi.")],0,
    pair("Use начинается в + time for a scheduled lesson.", "Для начала урока используйте «начинается в» и время."),
    text("Во ско́лько начина́ется уро́к?","At what time does the lesson start?","Tiết học bắt đầu lúc mấy giờ?"),"adaptive-clock-first","lesson-start"),
];
// Phonetic IPA: Russian hard lateral [ɫ], soft [lʲ]; see Yanushevskaya & Bunčić, JIPA, doi:10.1017/S0025100314000395.
const contrasts: readonly { id: string; title: Bilingual; options: readonly AdaptiveText[]; rule: Bilingual }[] = [
  { id: "hard-soft", title: pair("Hard / soft consonant", "Твёрдый / мягкий согласный"),
    options: [text("лук","onion / bow","hành / cung","ɫuk"),text("люк","hatch","cửa sập","lʲuk")],
    rule: pair("Hard [ɫ] contrasts with soft [lʲ]. Ю after л signals softness here.", "Твёрдый [л] противопоставлен мягкому [л’].") },
  { id: "final-soft", title: pair("Final consonant", "Конечный согласный"),
    options: [text("у́гол","corner","góc","ˈuɡəɫ"),text("у́голь","coal","than","ˈuɡəlʲ")],
    rule: pair("Final ь marks softness; it has no sound of its own.", "Мягкий знак обозначает мягкость конечного согласного.") },
  { id: "vowels", title: pair("Vowels and softness", "Гласные и мягкость"),
    options: [text("был","was","đã là","bɨɫ"),text("бил","hit","đã đánh","bʲiɫ")],
    rule: pair("Ы and и differ; б is also soft before и in this pair.", "Ы и и различаются; перед и согласный б мягкий.") },
  { id: "voicing", title: pair("Initial voicing", "Звонкость согласного"),
    options: [text("том","volume","tập sách","tom"),text("дом","house","ngôi nhà","dom")],
    rule: pair("Initial [t] is voiceless; [d] is voiced.", "[т] — глухой, [д] — звонкий.") },
];
export const adaptiveTasks: readonly AdaptiveTask[] = [
  ...contextTasks,
  ...contrasts.flatMap(contrast => contrast.options.map((_, correct): AdaptiveTask => ({
    id: "adaptive-sound-" + contrast.id + "-" + correct, skill: "sound", stage: "sound",
    title: contrast.title, goal: pair("Listen and select the word.", "Прослушайте и выберите слово."),
    options: contrast.options, correct, rule: contrast.rule,
  }))),
];
export const adaptiveTexts = adaptiveTasks.flatMap(task => [...task.options, ...(task.prompt ? [task.prompt] : [])]);
export function adaptiveTask(id: string | undefined) { return adaptiveTasks.find(task => task.id === id); }
