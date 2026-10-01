"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./study-plan.module.css";
import {
  courses,
  program,
  semesterCourses,
  semesterMeta,
  yearCourses,
  type Assessment,
  type Course,
  type Language,
  type ViewMode,
} from "./study-plan-data";

const copy = {
  vi: {
    back: "← Trung tâm quản trị",
    title: "Phân tích kế hoạch học tập",
    subtitle: "Lịch học và phân tích chương trình Thạc sĩ Bauman 09.04.01/11",
    source: "Nguồn: kế hoạch đào tạo chính thức năm bắt đầu 2026",
    credits: "Tín chỉ",
    semesters: "Học kỳ",
    teachingWeeks: "Tuần học",
    avgLoad: "Tải trung bình",
    hoursWeek: "giờ/tuần",
    week: "Tuần",
    month: "Tháng",
    semester: "Học kỳ",
    year: "Năm",
    view: "Xem theo",
    chooseSemester: "Chọn học kỳ",
    chooseYear: "Chọn năm",
    weekOf: "Tuần học",
    academicMonth: "Tháng học",
    totalLoad: "Tổng tải",
    contact: "Học trực tiếp",
    selfStudy: "Tự học / nhiệm vụ",
    courses: "Môn học",
    assessment: "Đánh giá",
    hours: "Giờ",
    averagePerWeek: "TB/tuần",
    semesterSummary: "Tóm tắt học kỳ",
    yearSummary: "Tóm tắt năm học",
    analysis: "Phân tích",
    learning: "Học gì",
    prepare: "Nên chuẩn bị",
    outcome: "Đầu ra",
    officialData: "Dữ liệu chính thức",
    derived: "Phân bổ theo tuần/tháng là quy đổi để dễ theo dõi tải học, không phải thời khóa biểu ngày–tiết của trường.",
    analysisNote: "Phần “Học gì / Nên chuẩn bị / Đầu ra” là phân tích định hướng từ tên môn và vị trí trong chương trình; PDF không cung cấp syllabus chi tiết.",
    clickCourse: "Chọn một môn để xem phân tích chi tiết.",
    original: "Tên gốc tiếng Nga",
    semesterFocus: "Trọng tâm",
    semesterPrep: "Ưu tiên chuẩn bị",
    allYear: "Toàn bộ năm",
    yearOne: "Năm 1",
    yearTwo: "Năm 2",
    weeks: "tuần",
    direct: "trực tiếp",
    examCount: "môn thi",
    courseworkCount: "coursework",
    noExactDates: "Kế hoạch không nêu ngày bắt đầu từng tháng; mục Tháng dùng nhóm 4 tuần học.",
    activeAllTerm: "Học xuyên học kỳ",
    period: "Giai đoạn",
    select: "Xem chi tiết",
    programStructure: "Cấu trúc chương trình",
    programAnalysis: "Phân tích tổng thể",
    totalHours: "4.320 giờ học thuật",
    thesis: "Luận văn",
    research: "Nghiên cứu",
    practice: "Thực tập",
    elective: "Tự chọn",
    core: "Môn học",
  },
  en: {
    back: "← Management Center",
    title: "Study Plan Analysis",
    subtitle: "Bauman Master's curriculum and workload analysis · 09.04.01/11",
    source: "Source: official curriculum, start year 2026",
    credits: "Credits",
    semesters: "Semesters",
    teachingWeeks: "Teaching weeks",
    avgLoad: "Average load",
    hoursWeek: "hours/week",
    week: "Week",
    month: "Month",
    semester: "Semester",
    year: "Year",
    view: "View by",
    chooseSemester: "Choose semester",
    chooseYear: "Choose year",
    weekOf: "Academic week",
    academicMonth: "Study month",
    totalLoad: "Total load",
    contact: "Contact time",
    selfStudy: "Self-study / tasks",
    courses: "Courses",
    assessment: "Assessment",
    hours: "Hours",
    averagePerWeek: "Avg/week",
    semesterSummary: "Semester summary",
    yearSummary: "Year summary",
    analysis: "Analysis",
    learning: "What you learn",
    prepare: "Prepare first",
    outcome: "Expected outcome",
    officialData: "Official data",
    derived: "Week/month views convert the official workload for easier planning; they are not the university's day-by-day class timetable.",
    analysisNote: "“What you learn / Prepare first / Expected outcome” is guidance inferred from course titles and curriculum placement; the PDF does not provide detailed syllabi.",
    clickCourse: "Select a course to open its analysis.",
    original: "Original Russian title",
    semesterFocus: "Focus",
    semesterPrep: "Preparation priority",
    allYear: "Full year",
    yearOne: "Year 1",
    yearTwo: "Year 2",
    weeks: "weeks",
    direct: "contact",
    examCount: "exams",
    courseworkCount: "courseworks",
    noExactDates: "The plan does not provide exact calendar-month start dates; Month view uses 4-week academic blocks.",
    activeAllTerm: "Runs through semester",
    period: "Period",
    select: "View details",
    programStructure: "Program structure",
    programAnalysis: "Overall analysis",
    totalHours: "4,320 academic hours",
    thesis: "Thesis",
    research: "Research",
    practice: "Practice",
    elective: "Elective",
    core: "Course",
  },
} as const;

const semesterInsights = {
  1: {
    vi: {
      focus: "Nền tảng chuyển đổi: mô hình hệ thống + dữ liệu đa chiều + OOP + database + software engineering.",
      prep: "Python/OOP → SQL/Database → Đại số tuyến tính → Xác suất thống kê → Git.",
    },
    en: {
      focus: "Transition foundation: system models + multivariate data + OOP + databases + software engineering.",
      prep: "Python/OOP → SQL/Databases → Linear algebra → Probability & statistics → Git.",
    },
  },
  2: {
    vi: {
      focus: "Bắt đầu AI/ML thực sự: Machine Learning, neural network, độ tin cậy và database hậu quan hệ.",
      prep: "Củng cố Python data stack, toán ML, Linux và quy trình project.",
    },
    en: {
      focus: "The AI/ML core begins: machine learning, neural networks, reliability and post-relational databases.",
      prep: "Strengthen the Python data stack, ML mathematics, Linux and project workflow.",
    },
  },
  3: {
    vi: {
      focus: "AI phân tích dữ liệu chuyên sâu: time series, business analytics, ergonomics và research.",
      prep: "Statistics, time-series practice, data visualization, research design and security basics.",
    },
    en: {
      focus: "Advanced AI/data analysis: time series, business analytics, ergonomics and research.",
      prep: "Statistics, time-series practice, data visualization, research design and security basics.",
    },
  },
  4: {
    vi: {
      focus: "Hoàn thiện chuyên môn và luận văn: AI logic Mivar, vòng đời hệ thống, tự chọn, NIR và bảo vệ.",
      prep: "Chốt đề tài, dataset, metric, code tái lập, kết quả thí nghiệm và cấu trúc luận văn.",
    },
    en: {
      focus: "Specialization and thesis completion: Mivar logical AI, lifecycle, elective, research and defense.",
      prep: "Lock the topic, dataset, metrics, reproducible code, experiments and thesis structure.",
    },
  },
} as const;

const assessmentLabels: Record<Assessment, { vi: string; en: string }> = {
  credit: { vi: "Zachyot", en: "Credit / pass" },
  exam: { vi: "Thi", en: "Exam" },
  "exam-coursework": { vi: "Thi + coursework", en: "Exam + coursework" },
  "credit-coursework": { vi: "Zachyot + coursework", en: "Credit + coursework" },
  "graded-credit": { vi: "Zachyot có điểm", en: "Graded credit" },
  coursework: { vi: "Coursework", en: "Coursework" },
  none: { vi: "Theo tiến độ", en: "Progress-based" },
  defense: { vi: "Bảo vệ trước hội đồng", en: "Defense before commission" },
};

function kindLabel(course: Course, lang: Language) {
  const t = copy[lang];
  if (course.kind === "research") return t.research;
  if (course.kind === "practice") return t.practice;
  if (course.kind === "thesis") return t.thesis;
  if (course.kind === "elective") return t.elective;
  return t.core;
}

function kindTone(course: Course) {
  if (course.kind === "research") return "research";
  if (course.kind === "practice") return "practice";
  if (course.kind === "thesis") return "thesis";
  if (course.kind === "elective") return "elective";
  return "course";
}

function monthBlocks(weeks: number) {
  const result: Array<{ index: number; start: number; end: number; count: number }> = [];
  let start = 1;
  let index = 1;
  while (start <= weeks) {
    const end = Math.min(weeks, start + 3);
    result.push({ index, start, end, count: end - start + 1 });
    start = end + 1;
    index += 1;
  }
  return result;
}

function Stat({ value, label, sub }: { value: string | number; label: string; sub: string }) {
  return <article className={styles.stat}><strong>{value}</strong><span>{label}</span><small>{sub}</small></article>;
}

function CourseRow({ course, lang, selected, onSelect }: {
  course: Course;
  lang: Language;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = copy[lang];
  return <button type="button" className={styles.courseRow} data-selected={selected} onClick={onSelect}>
    <span className={styles.kindDot} data-kind={kindTone(course)} />
    <div className={styles.courseName}>
      <strong>{course.title[lang]}</strong>
      <small>{course.ru}</small>
    </div>
    <span className={styles.kindBadge} data-kind={kindTone(course)}>{kindLabel(course, lang)}</span>
    <b>{course.credits} {lang === "vi" ? "TC" : "cr"}</b>
    <span>{assessmentLabels[course.assessment][lang]}</span>
    <em>{t.select} →</em>
  </button>;
}

function DetailPanel({ course, lang }: { course: Course | null; lang: Language }) {
  const t = copy[lang];
  if (!course) {
    return <aside className={styles.detailPanel}>
      <div className={styles.emptyDetail}>
        <span>◎</span>
        <strong>{t.analysis}</strong>
        <p>{t.clickCourse}</p>
      </div>
    </aside>;
  }

  return <aside className={styles.detailPanel}>
    <div className={styles.detailHeader}>
      <span className={styles.detailKind} data-kind={kindTone(course)}>{kindLabel(course, lang)}</span>
      <h2>{course.title[lang]}</h2>
      <p>{course.ru}</p>
    </div>
    <div className={styles.officialGrid}>
      <div><small>{t.semester}</small><strong>{course.semester}</strong></div>
      <div><small>{t.credits}</small><strong>{course.credits}</strong></div>
      <div><small>{t.hours}</small><strong>{course.hours}</strong></div>
      <div><small>{t.contact}</small><strong>{course.contactHours}</strong></div>
    </div>
    <div className={styles.assessmentLine}><span>{t.assessment}</span><strong>{assessmentLabels[course.assessment][lang]}</strong></div>
    {course.officialNote ? <div className={styles.officialNote}><strong>{t.officialData}</strong><p>{course.officialNote[lang]}</p></div> : null}
    <div className={styles.analysisBlock}><h3>{t.learning}</h3><p>{course.analysis[lang]}</p></div>
    <div className={styles.analysisBlock}><h3>{t.prepare}</h3><p>{course.prepare[lang]}</p></div>
    <div className={styles.analysisBlock}><h3>{t.outcome}</h3><p>{course.outcome[lang]}</p></div>
    <p className={styles.analysisDisclaimer}>{t.analysisNote}</p>
  </aside>;
}

export default function StudyPlanTool({ user }: { user: { displayName: string; email: string } }) {
  const [lang, setLang] = useState<Language>("vi");
  const [mode, setMode] = useState<ViewMode>("semester");
  const [semester, setSemester] = useState<1 | 2 | 3 | 4>(1);
  const [year, setYear] = useState<1 | 2>(1);
  const [week, setWeek] = useState(1);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>("multivariate");

  const t = copy[lang];
  const meta = semesterMeta[semester];
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
  const visibleCourses = useMemo(() => {
    if (mode === "year") return yearCourses(year);
    return semesterCourses(semester);
  }, [mode, semester, year]);

  const selectSemester = (next: 1 | 2 | 3 | 4) => {
    setSemester(next);
    setWeek(1);
    const first = semesterCourses(next)[0];
    if (first) setSelectedCourseId(first.id);
  };

  const selectYear = (next: 1 | 2) => {
    setYear(next);
    const first = yearCourses(next)[0];
    if (first) setSelectedCourseId(first.id);
  };

  return <main className={styles.shell}>
    <header className={styles.topbar}>
      <Link href="/" className={styles.back}>{t.back}</Link>
      <div className={styles.language} aria-label="Language">
        <button type="button" data-active={lang === "vi"} onClick={() => setLang("vi")}>VI</button>
        <button type="button" data-active={lang === "en"} onClick={() => setLang("en")}>EN</button>
      </div>
      <div className={styles.user}><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{user.email}</small></div></div>
    </header>

    <section className={styles.hero}>
      <div>
        <span className={styles.eyebrow}>BAUMAN · {program.code} · {program.department}</span>
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
        <small>{t.source}</small>
      </div>
      <div className={styles.programCard}>
        <strong>{lang === "vi" ? program.universityVi : program.universityEn}</strong>
        <span>{program.universityRu}</span>
        <p>{lang === "vi" ? program.trackVi : program.trackEn}</p>
        <small>{program.degree[lang]} · {program.duration[lang]} · {program.startYear}</small>
      </div>
    </section>

    <section className={styles.stats}>
      <Stat value={program.credits} label={t.credits} sub={t.totalHours} />
      <Stat value={4} label={t.semesters} sub="30 + 30 + 30 + 30" />
      <Stat value={62} label={t.teachingWeeks} sub="17 + 17 + 17 + 11" />
      <Stat value="≈50" label={t.avgLoad} sub={t.hoursWeek} />
    </section>

    <section className={styles.controls}>
      <div className={styles.modeGroup}>
        <span>{t.view}</span>
        {(["week", "month", "semester", "year"] as ViewMode[]).map((item) =>
          <button key={item} type="button" data-active={mode === item} onClick={() => setMode(item)}>
            {item === "week" ? t.week : item === "month" ? t.month : item === "semester" ? t.semester : t.year}
          </button>
        )}
      </div>
      {mode !== "year" ? <label className={styles.selectLabel}>{t.chooseSemester}
        <select value={semester} onChange={(event) => selectSemester(Number(event.target.value) as 1 | 2 | 3 | 4)}>
          {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{t.semester} {value}</option>)}
        </select>
      </label> : <label className={styles.selectLabel}>{t.chooseYear}
        <select value={year} onChange={(event) => selectYear(Number(event.target.value) as 1 | 2)}>
          <option value={1}>{t.yearOne}</option>
          <option value={2}>{t.yearTwo}</option>
        </select>
      </label>}
    </section>

    <section className={styles.contentGrid}>
      <div className={styles.mainPanel}>
        {mode === "week" ? <>
          <div className={styles.sectionHeading}>
            <div><span>{t.weekOf}</span><h2>{t.semester} {semester} · {t.week} {week}/{meta.weeks}</h2></div>
            <select value={week} onChange={(event) => setWeek(Number(event.target.value))}>
              {Array.from({ length: meta.weeks }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{t.week} {value}</option>)}
            </select>
          </div>
          <div className={styles.loadStrip}>
            <div><small>{t.totalLoad}</small><strong>{meta.weeklyLoad} h</strong></div>
            <div><small>{t.contact}</small><strong>{meta.weeklyContact} h</strong></div>
            <div><small>{t.selfStudy}</small><strong>{Math.max(0, meta.weeklyLoad - meta.weeklyContact).toFixed(1)} h</strong></div>
          </div>
          <p className={styles.derivedNote}>{t.derived}</p>
          <div className={styles.weekCourseList}>
            {visibleCourses.map((course) => {
              const totalAvg = course.hours / meta.weeks;
              const contactAvg = course.contactHours / meta.weeks;
              return <button type="button" key={course.id} data-selected={selectedCourseId === course.id} onClick={() => setSelectedCourseId(course.id)}>
                <span className={styles.kindDot} data-kind={kindTone(course)} />
                <div><strong>{course.title[lang]}</strong><small>{course.ru}</small></div>
                <p><b>{totalAvg.toFixed(1)} h</b> {t.averagePerWeek}<small>{contactAvg.toFixed(1)} h {t.direct}</small></p>
                <em>{t.activeAllTerm}</em>
              </button>;
            })}
          </div>
        </> : null}

        {mode === "month" ? <>
          <div className={styles.sectionHeading}>
            <div><span>{t.academicMonth}</span><h2>{t.semester} {semester} · {meta.weeks} {t.weeks}</h2></div>
          </div>
          <p className={styles.derivedNote}>{t.noExactDates}</p>
          <div className={styles.monthGrid}>
            {monthBlocks(meta.weeks).map((block) => <article key={block.index}>
              <header><span>{t.academicMonth} {block.index}</span><strong>{t.week} {block.start}–{block.end}</strong></header>
              <div className={styles.monthNumbers}>
                <p><small>{t.totalLoad}</small><b>{(meta.weeklyLoad * block.count).toFixed(0)} h</b></p>
                <p><small>{t.contact}</small><b>{(meta.weeklyContact * block.count).toFixed(0)} h</b></p>
              </div>
              <div className={styles.monthCourses}>
                {semesterCourses(semester).map((course) => <button key={course.id} type="button" onClick={() => setSelectedCourseId(course.id)}>
                  <span data-kind={kindTone(course)} />
                  {course.title[lang]}
                </button>)}
              </div>
            </article>)}
          </div>
        </> : null}

        {mode === "semester" ? <>
          <div className={styles.sectionHeading}>
            <div><span>{t.semesterSummary}</span><h2>{t.semester} {semester}</h2></div>
            <div className={styles.semesterMetrics}>
              <b>30 {lang === "vi" ? "TC" : "cr"}</b>
              <span>{meta.weeks} {t.weeks}</span>
              <span>{meta.exams} {t.examCount}</span>
              <span>{meta.coursework} {t.courseworkCount}</span>
            </div>
          </div>
          <div className={styles.insight}>
            <div><small>{t.semesterFocus}</small><p>{semesterInsights[semester][lang].focus}</p></div>
            <div><small>{t.semesterPrep}</small><p>{semesterInsights[semester][lang].prep}</p></div>
          </div>
          <div className={styles.courseTableHeader}>
            <span>{t.courses}</span><span>{t.credits}</span><span>{t.assessment}</span><span />
          </div>
          <div className={styles.courseTable}>
            {visibleCourses.map((course) => <CourseRow key={course.id} course={course} lang={lang} selected={selectedCourseId === course.id} onSelect={() => setSelectedCourseId(course.id)} />)}
          </div>
        </> : null}

        {mode === "year" ? <>
          <div className={styles.sectionHeading}>
            <div><span>{t.yearSummary}</span><h2>{year === 1 ? t.yearOne : t.yearTwo}</h2></div>
            <div className={styles.semesterMetrics}><b>60 {lang === "vi" ? "TC" : "cr"}</b><span>2 {t.semesters.toLowerCase()}</span></div>
          </div>
          <div className={styles.yearSemesters}>
            {(year === 1 ? [1, 2] : [3, 4]).map((value) => {
              const sem = value as 1 | 2 | 3 | 4;
              const info = semesterMeta[sem];
              return <button key={sem} type="button" onClick={() => { setMode("semester"); selectSemester(sem); }}>
                <span>{t.semester} {sem}</span>
                <strong>30 {lang === "vi" ? "tín chỉ" : "credits"}</strong>
                <small>{info.weeks} {t.weeks} · {info.weeklyContact} h {t.direct}/{t.week.toLowerCase()}</small>
                <p>{semesterInsights[sem][lang].focus}</p>
              </button>;
            })}
          </div>
          <div className={styles.yearCourseGroups}>
            {visibleCourses.map((course) => <CourseRow key={course.id} course={course} lang={lang} selected={selectedCourseId === course.id} onSelect={() => setSelectedCourseId(course.id)} />)}
          </div>
        </> : null}
      </div>

      <DetailPanel course={selectedCourse} lang={lang} />
    </section>

    <section className={styles.overall}>
      <header><span>{t.programAnalysis}</span><h2>{t.programStructure}</h2></header>
      <div className={styles.overallGrid}>
        {[1, 2, 3, 4].map((value) => {
          const sem = value as 1 | 2 | 3 | 4;
          return <article key={sem}>
            <b>{sem}</b>
            <div><strong>{t.semester} {sem}</strong><p>{semesterInsights[sem][lang].focus}</p></div>
          </article>;
        })}
      </div>
      <p className={styles.sourceDisclaimer}>{t.derived} {t.analysisNote}</p>
    </section>
  </main>;
}
