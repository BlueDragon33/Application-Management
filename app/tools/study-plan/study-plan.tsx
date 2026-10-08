"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { BaumanRegistryStatus, BaumanStudyModule } from "./bauman-module-registry";
import styles from "./study-plan.module.css";
import { defaultSurvivalState, parseSurvivalState, survivalPhases, survivalStorageKey, survivalWeeks, weekEvidenceSummary, type SurvivalPersonalState } from "./study-plan-survival-data";
import {
  courses,
  preBaumanRoadmap,
  program,
  readinessByCourse,
  semesterCourses,
  semesterMeta,
  yearCourses,
  type Assessment,
  type Course,
  type CourseKind,
  type Language,
  type ReadinessLevel,
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
    creditStructureTitle: "Cơ cấu 120 tín chỉ",
    creditStructureSubtitle: "Tính trực tiếp từ loại học phần và số tín chỉ đang có trong kế hoạch đào tạo.",
    structureItems: "mục",
    exportPdf: "Xuất PDF",
    workloadTitle: "Phân tích tải học theo học kỳ",
    workloadSubtitle: "So sánh tổng giờ học chính thức, giờ tiếp xúc và khối lượng tự học/nhiệm vụ.",
    workloadTotal: "Tổng giờ",
    workloadContact: "Tiếp xúc",
    workloadSelf: "Tự học / nhiệm vụ",
    printNote: "Bản PDF dùng dữ liệu chương trình hiện đang hiển thị; phần tuần/tháng vẫn là phân bổ quy đổi, không phải thời khóa biểu ngày–tiết.",
    thesis: "Luận văn",
    research: "Nghiên cứu",
    practice: "Thực tập",
    elective: "Tự chọn",
    core: "Môn học",
    prepRoadmap: "Lộ trình chuẩn bị trước môn",
    progress: "Tiến độ chuẩn bị",
    done: "Đã đánh dấu",
    markDone: "Đánh dấu đã thực hành",
    savedLocal: "Tiến độ chỉ lưu trên trình duyệt của thiết bị này.",
    preStudy: "Lộ trình chuẩn bị trước khi vào học",
    preStudySub: "Thứ tự nền tảng để giảm tải mạnh cho học kỳ 1 và các môn AI phía sau.",
    resetProgress: "Đặt lại tiến độ",
    baumanLearning: "Học liệu Bauman liên quan",
    relatedModule: "Có học liệu liên quan",
    relatedWorkflow: "Có workflow thực hành liên quan",
    noModule: "Chưa có học liệu riêng",
    openModule: "Mở học liệu",
    openWorkflow: "Mở workflow",
    moduleNote: "Nguồn này là học liệu liên quan trong Bauman Hub, không thay thế syllabus chính thức của môn.",
    workflowNote: "Nguồn này là workflow checklist/nhật ký/minh chứng cho thực tập, không giả lập thành môn lý thuyết độc lập.",
    noModuleNote: "Hệ thống Bauman hiện chưa có học liệu hoặc workflow phù hợp cho mục này nên không tạo nút mở giả.",
    autoRegistry: "Tự đồng bộ từ subject-manifest.json",
    registryUnavailable: "Không đọc được registry Bauman lúc này; các nút module tạm ẩn để tránh dẫn sai.",
    directOpenBlocked: "Contract Bauman không cho Application Management mở trực tiếp learning runtime. Hãy mở module từ Bauman Hub.",
    coverageTitle: "Độ phủ học liệu",
    coverageSubtitle: "Theo các mục học phần đang hiển thị trong kế hoạch 4 học kỳ.",
    coveredCourses: "Đã có học liệu/workflow",
    missingCourses: "Chưa có học liệu",
    moduleCount: "Nguồn đang nối",
    coverageRate: "Độ phủ",
    coverageBySemester: "Độ phủ theo học kỳ",
    missingList: "Các học phần còn thiếu học liệu",
    openCourseAnalysis: "Mở phân tích",
    coverageUnknown: "Chưa xác định do registry Bauman đang không khả dụng.",
    allCovered: "Tất cả học phần đã có học liệu hoặc workflow liên quan.",
    gapPlanTitle: "Phân loại phần còn thiếu",
    gapPlanSub: "Không tạo module hàng loạt. Mỗi học phần thiếu được phân theo loại hành động phù hợp.",
    createModule: "Cần tạo module riêng",
    existingMaterial: "Chỉ dùng/liên kết học liệu hiện có",
    practiceNoModule: "Thực tập không cần module độc lập",
    decisionRequired: "Chờ xác nhận trước khi tạo/liên kết",
    createModuleNote: "Có nội dung học thuật riêng, nên có module chuyên biệt.",
    existingMaterialNote: "Không cần tạo mới nếu học liệu hiện có đã đủ gần và đúng mục tiêu.",
    practiceNoModuleNote: "Nên quản lý bằng checklist, nhiệm vụ, nhật ký và minh chứng thực tập thay vì tạo môn học riêng.",
    decisionRequiredNote: "Tên môn hoặc nhánh tự chọn chưa đủ để xác định đúng học liệu; cần chốt trước để tránh xây sai.",
    nextBuildOrder: "Thứ tự tạo module mới theo học kỳ",
    noItems: "Hiện không có học phần nào trong nhóm này.",
    missingHandled: "Đã có phương án xử lý",
    explorerTitle: "Danh sách & tra cứu môn học",
    explorerSubtitle: "Tìm nhanh theo tên Việt/Anh/Nga, học kỳ, loại học phần và mức nền cá nhân.",
    searchCourses: "Tìm tên môn học...",
    allSemesters: "Tất cả học kỳ",
    allKinds: "Tất cả loại",
    allReadiness: "Tất cả mức nền",
    sortBy: "Sắp xếp",
    sortSemester: "Theo học kỳ",
    sortCredits: "Tín chỉ cao → thấp",
    sortReadiness: "Ưu tiên cần bù",
    results: "kết quả",
    noResults: "Không có học phần phù hợp bộ lọc.",
    clearFilters: "Xóa bộ lọc",
    skillsTitle: "Kỹ năng & định hướng",
    skillsSubtitle: "Gom các học phần thành nhóm năng lực và tự động xác định khu vực mạnh, cần ôn và khoảng trống nền.",
    skillStrong: "Nhóm đã có nền",
    skillReview: "Nhóm cần củng cố",
    skillGap: "Nhóm cần ưu tiên bù",
    priorityNext: "Ưu tiên tiếp theo",
    openPriorityCourse: "Mở môn ưu tiên",
    skillCourses: "môn liên quan",
    navSchedule: "Lịch học",
    navCourses: "Môn học",
    navSkills: "Kỹ năng & định hướng",
    navAnalysis: "Phân tích chương trình",
    navPreparation: "Lộ trình chuẩn bị",
    navScheduleSub: "Tuần · tháng · học kỳ · năm",
    navCoursesSub: "Tìm và lọc 33 học phần",
    navSkillsSub: "6 nhóm năng lực chính",
    navAnalysisSub: "120 tín chỉ · 4.320 giờ",
    navPreparationSub: "Kế hoạch chuẩn bị 12 hoặc 24 tuần",
    workspaceTitle: "Chọn khu vực làm việc",
    workspaceHint: "Bấm một mục để mở đúng phần cần xem — không phải cuộn cả trang.",
    quickFind: "Tìm nhanh môn học",
    quickFindPlaceholder: "Gõ tên môn bằng Việt / English / Русский...",
    quickFindHint: "Enter để mở danh sách kết quả",
    quickExplore: "Khám phá",
    quickRoadmap: "Lộ trình 12/24 tuần",
    quickCoverage: "Độ phủ học liệu",
    quickSkills: "Năng lực",
    baumanAdmin: "Bauman Admin",
    integrationTitle: "Liên kết Application Management ↔ Bauman Hub",
    integrationParent: "Ứng dụng cha",
    integrationRegistry: "Registry học liệu",
    integrationCoverage: "Độ phủ chương trình",
    registryLive: "Live · tự đồng bộ manifest",
    registryFallback: "Không khả dụng · fail-closed",
    integrationNote: "Study Plan là Tool nội bộ của App-Manager; Bauman Hub là nguồn contract/manifest để nối từng học phần với học liệu hoặc workflow.",
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
    creditStructureTitle: "120-credit structure",
    creditStructureSubtitle: "Calculated directly from the course type and credits encoded in the curriculum.",
    structureItems: "entries",
    exportPdf: "Export PDF",
    workloadTitle: "Semester workload analysis",
    workloadSubtitle: "Compare official total hours, contact time and self-study/task load.",
    workloadTotal: "Total hours",
    workloadContact: "Contact",
    workloadSelf: "Self-study / tasks",
    printNote: "The PDF uses the curriculum data currently shown; week/month values remain derived planning views, not a day-by-day university timetable.",
    thesis: "Thesis",
    research: "Research",
    practice: "Practice",
    elective: "Elective",
    core: "Course",
    prepRoadmap: "Pre-course preparation roadmap",
    progress: "Preparation progress",
    done: "Ready",
    markDone: "Mark as ready",
    savedLocal: "Progress is stored only in this browser on this device.",
    preStudy: "Pre-study roadmap",
    preStudySub: "Foundation order designed to reduce the load in semester 1 and later AI courses.",
    resetProgress: "Reset progress",
    baumanLearning: "Related Bauman learning module",
    relatedModule: "Related learning resource available",
    relatedWorkflow: "Related practice workflow available",
    noModule: "No dedicated learning resource yet",
    openModule: "Open learning resource",
    openWorkflow: "Open workflow",
    moduleNote: "This is related Bauman learning material, not a replacement for the official course syllabus.",
    workflowNote: "This is a checklist/log/evidence workflow for practice activity, not a standalone theory-course substitute.",
    noModuleNote: "The Bauman system does not currently have a suitable learning resource or workflow for this entry, so no fake launch button is shown.",
    autoRegistry: "Auto-synced from subject-manifest.json",
    registryUnavailable: "The Bauman registry is temporarily unavailable; module launch buttons are hidden to avoid incorrect links.",
    directOpenBlocked: "The Bauman contract does not allow Application Management to open the learning runtime directly. Open the module from Bauman Hub.",
    coverageTitle: "Learning coverage",
    coverageSubtitle: "Measured against the course entries currently shown across the four-semester plan.",
    coveredCourses: "Learning resource/workflow available",
    missingCourses: "No learning resource yet",
    moduleCount: "Connected resources",
    coverageRate: "Coverage",
    coverageBySemester: "Coverage by semester",
    missingList: "Course entries still missing a learning resource",
    openCourseAnalysis: "Open analysis",
    coverageUnknown: "Coverage cannot be calculated while the Bauman registry is unavailable.",
    allCovered: "All course entries have related learning material or a practice workflow.",
    gapPlanTitle: "Gap classification",
    gapPlanSub: "Do not create modules in bulk. Each uncovered course is classified by the action it actually needs.",
    createModule: "Create a dedicated module",
    existingMaterial: "Use/link existing material only",
    practiceNoModule: "Practice: no standalone module",
    decisionRequired: "Needs confirmation before linking/building",
    createModuleNote: "The course has distinct academic content and benefits from a dedicated module.",
    existingMaterialNote: "No new module is needed when existing material already matches the learning goal.",
    practiceNoModuleNote: "Manage with checklists, tasks, logs and evidence rather than a standalone course module.",
    decisionRequiredNote: "The course label or elective branch is not specific enough yet; confirm it first to avoid building the wrong thing.",
    nextBuildOrder: "New-module build order by semester",
    noItems: "No current course entries in this group.",
    missingHandled: "Gap has an action plan",
    explorerTitle: "Course list & search",
    explorerSubtitle: "Search by Vietnamese/English/Russian title, semester, course type and personal readiness.",
    searchCourses: "Search courses...",
    allSemesters: "All semesters",
    allKinds: "All types",
    allReadiness: "All readiness levels",
    sortBy: "Sort",
    sortSemester: "By semester",
    sortCredits: "Credits high → low",
    sortReadiness: "Foundation-gap priority",
    results: "results",
    noResults: "No courses match the current filters.",
    clearFilters: "Clear filters",
    skillsTitle: "Skills & direction",
    skillsSubtitle: "Groups the curriculum into competency areas and derives strengths, review needs and foundation gaps.",
    skillStrong: "Strong foundation groups",
    skillReview: "Groups to reinforce",
    skillGap: "Priority foundation gaps",
    priorityNext: "Next priority",
    openPriorityCourse: "Open priority course",
    skillCourses: "related courses",
    navSchedule: "Schedule",
    navCourses: "Courses",
    navSkills: "Skills & direction",
    navAnalysis: "Program analysis",
    navPreparation: "Preparation roadmap",
    navScheduleSub: "Week · month · semester · year",
    navCoursesSub: "Search and filter 33 entries",
    navSkillsSub: "6 core competency areas",
    navAnalysisSub: "120 credits · 4,320 hours",
    navPreparationSub: "12- or 24-week preparation plan",
    workspaceTitle: "Choose a workspace",
    workspaceHint: "Open only the section you need instead of scrolling through the full page.",
    quickFind: "Quick course search",
    quickFindPlaceholder: "Type a course in Vietnamese / English / Русский...",
    quickFindHint: "Press Enter to open the result list",
    quickExplore: "Explore",
    quickRoadmap: "12/24-week roadmap",
    quickCoverage: "Learning coverage",
    quickSkills: "Skills",
    baumanAdmin: "Bauman Admin",
    integrationTitle: "Application Management ↔ Bauman Hub linkage",
    integrationParent: "Parent app",
    integrationRegistry: "Learning registry",
    integrationCoverage: "Curriculum coverage",
    registryLive: "Live · manifest-synced",
    registryFallback: "Unavailable · fail-closed",
    integrationNote: "Study Plan is an internal App-Manager tool; Bauman Hub supplies the contract/manifests that map each curriculum entry to learning material or a workflow.",
  },
} as const;

const programKindOrder: readonly CourseKind[] = ["course", "research", "practice", "elective", "thesis"];

const programKindLabels = {
  vi: {
    course: "Học phần",
    research: "Nghiên cứu (NIR)",
    practice: "Thực tập",
    elective: "Tự chọn",
    thesis: "Luận văn (VKR)",
  },
  en: {
    course: "Courses",
    research: "Research (NIR)",
    practice: "Practice",
    elective: "Electives",
    thesis: "Thesis (VKR)",
  },
} as const;

type WorkspaceSection = "schedule" | "courses" | "skills" | "analysis" | "roadmap";
type StudyFontScale = "normal" | "large" | "xlarge";
type ExplorerSemester = "all" | "1" | "2" | "3" | "4";
type ExplorerKind = "all" | CourseKind;
type ExplorerReadiness = "all" | ReadinessLevel;
type ExplorerSort = "semester" | "credits" | "readiness";

function WorkspaceIcon({ section }: { section: WorkspaceSection }) {
  if (section === "schedule") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4.5 8.5h15M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M8 12h3v3H8zM13.5 12h2.5M13.5 15h2.5"/></svg>;
  if (section === "courses") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3V4.5Z"/><path d="M8 8h7M8 11h6M18 9.5h1.5a1.5 1.5 0 0 1 0 3H18"/></svg>;
  if (section === "skills") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 14.1 8l4.9.6-3.6 3.4.9 4.8-4.3-2.4-4.3 2.4.9-4.8L5 8.6 9.9 8 12 3.5Z"/><path d="m8.5 19 3.5 1.5 3.5-1.5"/></svg>;
  if (section === "analysis") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M10 19V5M15 19v-7M20 19V3"/><path d="M3.5 19.5h18"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c3-6 5-9 9-12l4-3 2 2-3 4c-3 4-6 6-12 9Z"/><path d="m11 13 3 3M6 17l-2 3 3-1"/></svg>;
}

const readinessWeight: Record<ReadinessLevel, number> = {
  red: 0,
  yellow: 1,
  green: 2,
};

const skillClusterDefinitions = [
  {
    id: "software",
    label: { vi: "Lập trình & kỹ nghệ phần mềm", en: "Programming & software engineering" },
    direction: { vi: "Ưu tiên Python/OOP, Git, testing và kiến trúc module.", en: "Prioritize Python/OOP, Git, testing and modular architecture." },
    courseIds: ["oop", "software-1", "software-2"],
  },
  {
    id: "data",
    label: { vi: "Dữ liệu & cơ sở dữ liệu", en: "Data & databases" },
    direction: { vi: "Ưu tiên SQL, NumPy/Pandas, thống kê và pipeline dữ liệu.", en: "Prioritize SQL, NumPy/Pandas, statistics and data pipelines." },
    courseIds: ["multivariate", "db-optimization", "postrelational", "time-series", "nir-data"],
  },
  {
    id: "ai",
    label: { vi: "AI & hệ thống thông minh", en: "AI & intelligent systems" },
    direction: { vi: "Đi từ ML nền tảng → neural → AI ứng dụng → reasoning logic.", en: "Progress from ML foundations → neural systems → applied AI → logical reasoning." },
    courseIds: ["ml", "neural", "business-ai", "mivar"],
  },
  {
    id: "systems",
    label: { vi: "Hệ thống, độ tin cậy & vòng đời", en: "Systems, reliability & lifecycle" },
    direction: { vi: "Tận dụng nền Điều khiển/Tự động hóa để nối sang ASOIU, reliability và lifecycle.", en: "Leverage Control/Automation foundations for AIPCS, reliability and lifecycle." },
    courseIds: ["analytical-models", "reliability", "is-management", "lifecycle", "operations-practice"],
  },
  {
    id: "research",
    label: { vi: "Nghiên cứu & giao tiếp học thuật", en: "Research & academic communication" },
    direction: { vi: "Xây research workflow, thuật ngữ Nga/Anh, viết và bảo vệ kết quả từ sớm.", en: "Build research workflow, Russian/English terminology, writing and defense skills early." },
    courseIds: ["foreign-1", "foreign-2", "methodology", "nir-1", "nir-2", "nir-3", "nir-4", "prediploma", "thesis"],
  },
  {
    id: "human-project",
    label: { vi: "HMI, bảo mật & triển khai dự án", en: "HMI, security & project delivery" },
    direction: { vi: "Bổ sung HMI/usability, security, thực tập và tư duy sản phẩm để hoàn thiện hệ thống thật.", en: "Add HMI/usability, security, practice and product thinking for real-system delivery." },
    courseIds: ["entrepreneurship", "project-practice", "pedagogy-1", "pedagogy-2", "ergonomics", "elective-1", "elective-2"],
  },
] as const;

type GapAction = "create" | "existing" | "practice" | "confirm";

const gapActionByCourse: Partial<Record<string, GapAction>> = {
  "foreign-1": "confirm",
  "foreign-2": "confirm",
  entrepreneurship: "create",
  "project-practice": "practice",
  "operations-practice": "practice",
  "pedagogy-1": "practice",
  ergonomics: "create",
  "elective-1": "confirm",
  "pedagogy-2": "practice",
  mivar: "create",
  "elective-2": "confirm",
};

const gapActionOrder: readonly GapAction[] = ["create", "existing", "practice", "confirm"];

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

type PrepItem = { vi: string; en: string };

const preparationGroups = {
  language: [
    { vi: "Từ vựng học thuật và thuật ngữ chuyên ngành", en: "Academic vocabulary and technical terminology" },
    { vi: "Nghe bài giảng và ghi chú ý chính", en: "Lecture listening and structured note-taking" },
    { vi: "Đọc tài liệu kỹ thuật, paper và đề bài", en: "Read technical texts, papers and assignments" },
    { vi: "Trình bày ngắn và hỏi–đáp học thuật", en: "Short presentations and academic Q&A" },
  ],
  research: [
    { vi: "Cách tìm và đọc paper theo câu hỏi nghiên cứu", en: "Find and read papers around a research question" },
    { vi: "Ghi nguồn, trích dẫn và quản lý tài liệu", en: "Source tracking, citation and literature management" },
    { vi: "Đặt giả thuyết, biến đo và tiêu chí đánh giá", en: "Define hypotheses, measured variables and evaluation criteria" },
    { vi: "Ghi nhật ký thí nghiệm và viết báo cáo ngắn", en: "Keep experiment logs and write concise reports" },
  ],
  systems: [
    { vi: "Đại số tuyến tính: vector, ma trận, hệ phương trình", en: "Linear algebra: vectors, matrices and linear systems" },
    { vi: "Toán kỹ thuật và mô hình đầu vào–đầu ra", en: "Engineering mathematics and input–output models" },
    { vi: "Mô hình trạng thái và tư duy hệ thống", en: "State-space models and systems thinking" },
    { vi: "Xác suất cơ bản cho độ tin cậy và đánh giá hệ thống", en: "Basic probability for reliability and system evaluation" },
  ],
  data: [
    { vi: "Python cơ bản và thao tác dữ liệu", en: "Python fundamentals and data manipulation" },
    { vi: "NumPy/Pandas và làm sạch dữ liệu", en: "NumPy/Pandas and data cleaning" },
    { vi: "Đại số tuyến tính cho dữ liệu nhiều chiều", en: "Linear algebra for high-dimensional data" },
    { vi: "Xác suất thống kê, correlation và đánh giá mô hình", en: "Probability/statistics, correlation and model evaluation" },
  ],
  programming: [
    { vi: "Python hoặc ngôn ngữ chính: biến, hàm, module, file", en: "Primary language basics: variables, functions, modules and files" },
    { vi: "OOP: class, object, encapsulation, inheritance, polymorphism", en: "OOP: classes, objects, encapsulation, inheritance and polymorphism" },
    { vi: "Git/GitHub, branch, commit và review thay đổi", en: "Git/GitHub, branches, commits and change review" },
    { vi: "UML, interface, testing và tổ chức project", en: "UML, interfaces, testing and project structure" },
  ],
  database: [
    { vi: "SQL: SELECT, JOIN, GROUP BY và subquery", en: "SQL: SELECT, JOIN, GROUP BY and subqueries" },
    { vi: "Thiết kế bảng, khóa và normalization", en: "Table design, keys and normalization" },
    { vi: "Index, transaction và query plan", en: "Indexes, transactions and query plans" },
    { vi: "NoSQL/document/graph và luồng dữ liệu cho ML", en: "NoSQL/document/graph models and ML data flows" },
  ],
  ai: [
    { vi: "Python + NumPy/Pandas đủ để tự viết pipeline dữ liệu", en: "Python + NumPy/Pandas sufficient for a data pipeline" },
    { vi: "Đại số tuyến tính, xác suất và đạo hàm/gradient", en: "Linear algebra, probability and derivatives/gradients" },
    { vi: "Regression, classification, clustering và train/test", en: "Regression, classification, clustering and train/test workflow" },
    { vi: "Metric, overfitting và cách so sánh mô hình", en: "Metrics, overfitting and model comparison" },
  ],
  operations: [
    { vi: "Linux command line và cấu trúc file", en: "Linux command line and filesystem basics" },
    { vi: "Log, cấu hình, process và network cơ bản", en: "Logs, configuration, processes and basic networking" },
    { vi: "Git, issue/task và làm việc theo milestone", en: "Git, issue/task tracking and milestone-based work" },
    { vi: "Troubleshooting và viết báo cáo vận hành", en: "Troubleshooting and operational reporting" },
  ],
  pedagogy: [
    { vi: "Chia nội dung thành mục tiêu → ví dụ → bài tập", en: "Structure content as objective → example → exercise" },
    { vi: "Slide ngắn, rõ và ít chữ", en: "Short, clear and low-text slides" },
    { vi: "Giải thích một khái niệm bằng nhiều mức độ", en: "Explain one concept at multiple levels" },
    { vi: "Nhận phản hồi và điều chỉnh cách trình bày", en: "Use feedback to improve presentation" },
  ],
  hmi: [
    { vi: "Nguyên tắc HMI/UI và hierarchy thông tin", en: "HMI/UI principles and information hierarchy" },
    { vi: "Usability, accessibility và tải nhận thức", en: "Usability, accessibility and cognitive load" },
    { vi: "Biểu đồ, dashboard và cách hiển thị trạng thái", en: "Charts, dashboards and state visualization" },
    { vi: "Đánh giá giao diện bằng tình huống sử dụng", en: "Evaluate interfaces through usage scenarios" },
  ],
  security: [
    { vi: "Network cơ bản và mô hình client/server", en: "Basic networking and client/server models" },
    { vi: "Authentication, authorization và session", en: "Authentication, authorization and sessions" },
    { vi: "Threat model, dữ liệu nhạy cảm và nguyên tắc least privilege", en: "Threat modeling, sensitive data and least privilege" },
    { vi: "Log/audit và xử lý sự cố bảo mật cơ bản", en: "Logging/audit and basic security incident handling" },
  ],
  logic: [
    { vi: "Logic mệnh đề và logic vị từ cơ bản", en: "Basic propositional and predicate logic" },
    { vi: "Biểu diễn tri thức bằng rule/graph", en: "Knowledge representation with rules/graphs" },
    { vi: "Suy diễn, dependency và chuỗi luật", en: "Inference, dependencies and rule chains" },
    { vi: "So sánh AI logic với ML/neural để hiểu đúng vai trò", en: "Contrast logical AI with ML/neural methods" },
  ],
  thesis: [
    { vi: "Chốt câu hỏi nghiên cứu, phạm vi và đóng góp", en: "Lock the research question, scope and contribution" },
    { vi: "Dataset, baseline, metric và kế hoạch thí nghiệm", en: "Dataset, baseline, metrics and experiment plan" },
    { vi: "Code tái lập, quản lý phiên bản và lưu bằng chứng", en: "Reproducible code, versioning and evidence tracking" },
    { vi: "Viết luận văn, slide, demo và luyện phản biện", en: "Thesis writing, slides, demo and defense practice" },
  ],
  entrepreneurship: [
    { vi: "Xác định người dùng và vấn đề cần giải quyết", en: "Identify users and the problem to solve" },
    { vi: "Mô tả giá trị của sản phẩm/giải pháp", en: "Describe the value proposition" },
    { vi: "Chi phí, nguồn lực và mô hình doanh thu cơ bản", en: "Basic cost, resources and revenue model" },
    { vi: "Pitch ngắn bằng dữ liệu và ví dụ", en: "Build a short evidence-based pitch" },
  ],
  elective: [
    { vi: "Xác định nhánh tự chọn sẽ học", en: "Choose the elective branch" },
    { vi: "Ôn nền tảng gần nhất với nhánh đã chọn", en: "Review the closest foundation for that branch" },
    { vi: "Làm một mini-project nhỏ trước khi vào môn", en: "Build a small mini-project before the course" },
    { vi: "Ghi lại thuật ngữ Nga–Anh–Việt quan trọng", en: "Record key Russian–English–Vietnamese terminology" },
  ],
} as const;

const preparationGroupByCourse: Record<string, keyof typeof preparationGroups> = {
  "foreign-1": "language",
  "foreign-2": "language",
  methodology: "research",
  "nir-1": "research",
  "nir-2": "research",
  "nir-3": "research",
  "nir-4": "research",
  "nir-data": "research",
  "analytical-models": "systems",
  reliability: "systems",
  lifecycle: "systems",
  multivariate: "data",
  "time-series": "data",
  "business-ai": "data",
  oop: "programming",
  "software-1": "programming",
  "software-2": "programming",
  "db-optimization": "database",
  postrelational: "database",
  ml: "ai",
  neural: "ai",
  "project-practice": "operations",
  "operations-practice": "operations",
  "pedagogy-1": "pedagogy",
  "pedagogy-2": "pedagogy",
  ergonomics: "hmi",
  "elective-1": "security",
  mivar: "logic",
  "elective-2": "elective",
  prediploma: "thesis",
  thesis: "thesis",
  entrepreneurship: "entrepreneurship",
};

function preparationSteps(course: Course): readonly PrepItem[] {
  return preparationGroups[preparationGroupByCourse[course.id] ?? "research"];
}

function baumanModuleFor(course: Course, modules: readonly BaumanStudyModule[]) {
  return modules.find((module) => module.courseIds.includes(course.id)) ?? null;
}

const readinessLabels: Record<ReadinessLevel, { vi: string; en: string }> = {
  green: { vi: "🟢 Đã có nền", en: "🟢 Existing foundation" },
  yellow: { vi: "🟡 Cần ôn/bổ sung", en: "🟡 Review / reinforce" },
  red: { vi: "🔴 Chưa có nền đủ", en: "🔴 Foundation gap" },
};

const readinessLegend = {
  vi: {
    title: "Định hướng bù nền (chưa kiểm chứng)",
    note: "Phân loại tham khảo được biên soạn trước, không phải điểm thi, kết quả chẩn đoán hay bằng chứng đã nắm vững.",
    priority: "Ưu tiên bù",
  },
  en: {
    title: "Suggested preparation (unverified)",
    note: "Authored preparation categories, not exam grades, diagnostic results or evidence of mastery.",
    priority: "Priority",
  },
} as const;

const assessmentLabels: Record<Assessment, { vi: string; en: string }> = {
  "rating-exam": { vi: "РЭкз · Thi theo rating", en: "РЭкз · Rating exam" },
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
  const readiness = readinessByCourse[course.id];
  return <button type="button" className={styles.courseRow} data-selected={selected} onClick={onSelect}>
    <span className={styles.kindDot} data-kind={kindTone(course)} />
    <div className={styles.courseName}>
      <strong>{course.title[lang]}</strong>
      <small>{course.ru}</small>
      <span className={styles.readinessBadge} data-level={readiness.level}>{readinessLabels[readiness.level][lang]}</span>
    </div>
    <span className={styles.kindBadge} data-kind={kindTone(course)}>{kindLabel(course, lang)}</span>
    <b>{course.credits} {lang === "vi" ? "TC" : "cr"}</b>
    <span>{assessmentLabels[course.assessment][lang]}</span>
    <em>{t.select} →</em>
  </button>;
}

function DetailPanel({ course, lang, completed, toggleStep, baumanModules, baumanRegistryStatus, mayOpenLearningRuntimeDirectly }: {
  course: Course | null;
  lang: Language;
  completed: Record<string, boolean>;
  toggleStep: (key: string) => void;
  baumanModules: readonly BaumanStudyModule[];
  baumanRegistryStatus: BaumanRegistryStatus;
  mayOpenLearningRuntimeDirectly: boolean;
}) {
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

  const relatedModule = baumanModuleFor(course, baumanModules);
  const relatedIsWorkflow = relatedModule?.kind === "workflow";
  const readiness = readinessByCourse[course.id];

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
    <div className={styles.readinessCard} data-level={readiness.level}>
      <div className={styles.readinessCardHead}>
        <small>{readinessLegend[lang].title}</small>
        <strong>{readinessLabels[readiness.level][lang]}</strong>
      </div>
      <p>{readiness.reason[lang]}</p>
      <div className={styles.readinessPriority}><span>{readinessLegend[lang].priority}</span><b>{readiness.priority[lang]}</b></div>
    </div>
    <div className={styles.analysisBlock}><h3>{t.learning}</h3><p>{course.analysis[lang]}</p></div>
    <div className={styles.analysisBlock}><h3>{t.prepare}</h3><p>{course.prepare[lang]}</p></div>
    <div className={styles.moduleBridge}>
      <div className={styles.moduleBridgeHead}>
        <div>
          <small>{t.baumanLearning}</small>
          <strong>{baumanRegistryStatus === "live" ? (relatedModule ? (relatedIsWorkflow ? t.relatedWorkflow : t.relatedModule) : t.noModule) : t.noModule}</strong>
          <em>{t.autoRegistry}</em>
        </div>
        <span data-ready={Boolean(relatedModule) && baumanRegistryStatus === "live"}>{relatedModule && baumanRegistryStatus === "live" ? "●" : "○"}</span>
      </div>
      {baumanRegistryStatus !== "live"
        ? <p className={styles.moduleMissing}>{t.registryUnavailable}</p>
        : relatedModule
          ? <div className={styles.moduleBridgeBody}>
              <div><b>{lang === "vi" ? relatedModule.labelVi : relatedModule.labelEn}</b><p>{relatedIsWorkflow ? t.workflowNote : t.moduleNote}</p></div>
              {mayOpenLearningRuntimeDirectly && relatedModule.href
                ? <a href={relatedModule.href} target="_blank" rel="noreferrer">{relatedIsWorkflow ? t.openWorkflow : t.openModule} ↗</a>
                : <span>{t.directOpenBlocked}</span>}
            </div>
          : <p className={styles.moduleMissing}>{t.noModuleNote}</p>}
    </div>
    <div className={styles.prepRoadmap}>
      <div className={styles.prepRoadmapHeader}>
        <div><h3>{t.prepRoadmap}</h3><small>{t.savedLocal}</small></div>
        <strong>{preparationSteps(course).filter((_, index) => completed[`${course.id}:${index}`]).length}/{preparationSteps(course).length}</strong>
      </div>
      <div className={styles.prepSteps}>
        {preparationSteps(course).map((step, index) => {
          const key = `${course.id}:${index}`;
          const done = Boolean(completed[key]);
          return <button key={key} type="button" data-done={done} onClick={() => toggleStep(key)}>
            <span>{done ? "✓" : index + 1}</span>
            <p>{step[lang]}</p>
            <small>{done ? t.done : t.markDone}</small>
          </button>;
        })}
      </div>
    </div>
    <div className={styles.analysisBlock}><h3>{t.outcome}</h3><p>{course.outcome[lang]}</p></div>
    <p className={styles.analysisDisclaimer}>{t.analysisNote}</p>
  </aside>;
}


const preStudyCopy = {
  vi: {
    eyebrow: "KẾ HOẠCH BÙ NỀN CÁ NHÂN",
    title: "12 tuần trước Bauman",
    subtitle: "Gom các khoảng trống 🔴/🟡 thành 7 giai đoạn nền tảng để tránh học trùng và ưu tiên đúng thứ tự phụ thuộc.",
    progress: "Tiến độ checklist (chưa kiểm định)",
    coverage: "Phủ môn cần chuẩn bị",
    workload: "Tải dự kiến",
    week: "Tuần",
    hoursWeek: "giờ/tuần",
    tasks: "Việc phải hoàn thành",
    impact: "Môn được hỗ trợ",
    checkpoint: "Mốc đạt",
    done: "Hoàn thành",
    open: "Mở môn",
    reset: "Đặt lại tiến độ",
  },
  en: {
    eyebrow: "PERSONAL FOUNDATION PLAN",
    title: "12 weeks before Bauman",
    subtitle: "Consolidates 🔴/🟡 gaps into seven foundation phases to avoid duplicated study and respect prerequisite order.",
    progress: "Checklist progress (unverified)",
    coverage: "Courses covered",
    workload: "Planned load",
    week: "Week",
    hoursWeek: "hours/week",
    tasks: "Tasks to complete",
    impact: "Supported courses",
    checkpoint: "Checkpoint",
    done: "Checked off",
    open: "Open course",
    reset: "Reset progress",
  },
} as const;

function PreStudyRoadmap({
  lang,
  completed,
  toggleStep,
  onOpenCourse,
  onReset,
}: {
  lang: Language;
  completed: Record<string, boolean>;
  toggleStep: (key: string) => void;
  onOpenCourse: (course: Course) => void;
  onReset: () => void;
}) {
  const t = preStudyCopy[lang];
  const totalTasks = preBaumanRoadmap.reduce((sum, phase) => sum + phase.tasks.length, 0);
  const doneTasks = preBaumanRoadmap.reduce(
    (sum, phase) => sum + phase.tasks.filter((_, index) => completed[`prebauman:${phase.id}:${index}`]).length,
    0,
  );
  const percent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const targetIds = new Set(preBaumanRoadmap.flatMap((phase) => phase.targetCourseIds));
  const nonGreenCourses = courses.filter((course) => readinessByCourse[course.id].level !== "green");
  const coveredNonGreen = nonGreenCourses.filter((course) => targetIds.has(course.id)).length;
  const averageHours = Math.round(
    preBaumanRoadmap.reduce((sum, phase) => {
      const weekCount = phase.weeks[1] - phase.weeks[0] + 1;
      return sum + phase.hoursPerWeek * weekCount;
    }, 0) / 12,
  );

  return <section className={styles.preBaumanRoadmap}>
    <header className={styles.preBaumanHeader}>
      <div>
        <span>{t.eyebrow}</span>
        <h2>{t.title}</h2>
        <p>{t.subtitle}</p>
      </div>
      <div className={styles.preBaumanSummary}>
        <article>
          <small>{t.progress}</small>
          <strong>{percent}%</strong>
          <span>{doneTasks}/{totalTasks}</span>
        </article>
        <article>
          <small>{t.coverage}</small>
          <strong>{coveredNonGreen}/{nonGreenCourses.length}</strong>
          <span>🟡 + 🔴</span>
        </article>
        <article>
          <small>{t.workload}</small>
          <strong>≈{averageHours}</strong>
          <span>{t.hoursWeek}</span>
        </article>
        <button type="button" className={styles.preBaumanReset} onClick={onReset}>{t.reset}</button>
      </div>
    </header>

    <div className={styles.preBaumanOverallBar} aria-label={t.progress}>
      <span style={{ width: `${percent}%` }} />
    </div>

    <div className={styles.preBaumanPhases}>
      {preBaumanRoadmap.map((phase, phaseIndex) => {
        const phaseDone = phase.tasks.filter((_, index) => completed[`prebauman:${phase.id}:${index}`]).length;
        const phasePercent = Math.round((phaseDone / phase.tasks.length) * 100);
        const impactedCourses = phase.targetCourseIds
          .map((id) => courses.find((course) => course.id === id))
          .filter((course): course is Course => Boolean(course));

        return <article key={phase.id} className={styles.preBaumanPhase} data-complete={phaseDone === phase.tasks.length}>
          <header>
            <div className={styles.phaseNumber}>{phaseIndex + 1}</div>
            <div>
              <small>{t.week} {phase.weeks[0]}{phase.weeks[1] !== phase.weeks[0] ? `–${phase.weeks[1]}` : ""} · {phase.hoursPerWeek} {t.hoursWeek}</small>
              <h3>{phase.title[lang]}</h3>
            </div>
            <strong>{phasePercent}%</strong>
          </header>

          <div className={styles.phaseBar}><span style={{ width: `${phasePercent}%` }} /></div>
          <p className={styles.phaseFocus}>{phase.focus[lang]}</p>
          <p className={styles.phaseWhy}>{phase.why[lang]}</p>

          <section className={styles.phaseTasks}>
            <h4>{t.tasks}</h4>
            {phase.tasks.map((task, index) => {
              const key = `prebauman:${phase.id}:${index}`;
              const done = Boolean(completed[key]);
              return <button type="button" key={key} data-done={done} onClick={() => toggleStep(key)}>
                <b>{done ? "✓" : index + 1}</b>
                <span>{task[lang]}</span>
                <small>{done ? t.done : "○"}</small>
              </button>;
            })}
          </section>

          <div className={styles.phaseCheckpoint}>
            <small>{t.checkpoint}</small>
            <p>{phase.checkpoint[lang]}</p>
          </div>

          <div className={styles.phaseImpact}>
            <small>{t.impact}</small>
            <div>
              {impactedCourses.map((course) => {
                const readiness = readinessByCourse[course.id];
                return <button
                  type="button"
                  key={course.id}
                  data-level={readiness.level}
                  onClick={() => onOpenCourse(course)}
                  title={`${t.open}: ${course.title[lang]}`}
                >
                  {readiness.level === "red" ? "🔴" : readiness.level === "yellow" ? "🟡" : "🟢"} {course.title[lang]}
                </button>;
              })}
            </div>
          </div>
        </article>;
      })}
    </div>
  </section>;
}

/** Preparation-only view: never claims an official BMSTU grade or externally verified mastery. */
function StandardSurvivalRoadmap({
  lang, progress, onProgressChange, onOpenCourse,
}: {
  lang: Language;
  progress: SurvivalPersonalState;
  onProgressChange: (update: (prior: SurvivalPersonalState) => SurvivalPersonalState) => void;
  onOpenCourse: (course: Course) => void;
}) {
  const week = survivalWeeks[progress.selectedWeek - 1] ?? survivalWeeks[0];
  const phase = survivalPhases[week.phase];
  const evidence = progress.evidence[week.id] ?? { state: "not_assessed" as const, note: "" };
  const summary = weekEvidenceSummary(progress);
  const isVi = lang === "vi";
  const linkedCourses = week.targetCourseIds.map(id => courses.find(c => c.id === id))
    .filter((course): course is Course => Boolean(course));
  const editEvidence = (note: string) => onProgressChange(prior => ({
    ...prior,
    evidence: { ...prior.evidence, [week.id]: { state: "not_assessed", note: note.slice(0, 1000) } },
  }));
  const setEvidenceState = (state: "self_reported" | "submitted") => onProgressChange(prior => ({
    ...prior,
    evidence: { ...prior.evidence, [week.id]: { state, note: prior.evidence[week.id]?.note ?? "" } },
  }));
  const evidenceStatus = evidence.state === "submitted"
    ? (isVi ? "Đã ghi minh chứng · chờ kiểm tra" : "Evidence recorded · awaiting review")
    : evidence.state === "self_reported"
      ? (isVi ? "Tự đánh giá · chưa xác minh" : "Self-reported · not verified")
      : (isVi ? "Chưa được đánh giá" : "Not assessed");
  return <section className={styles.survivalWeek} aria-label={isVi ? "Chuẩn bị 24 tuần" : "24-week preparation"}>
    <header className={styles.survivalWeekHeader}>
      <div>
        <span>{isVi ? "LỘ TRÌNH CHUẨN BỊ · KHÔNG PHẢI LỊCH CHÍNH THỨC" : "PERSONAL PREPARATION · NOT AN OFFICIAL TIMETABLE"}</span>
        <h2>{isVi ? "24 tuần xây nền IU5" : "IU5 24-week foundations"}</h2>
        <p>{isVi ? "Mỗi tuần một bài thực hành và một tiêu chí kiểm tra. Đã làm không đồng nghĩa đã nắm vững." : "Each week has practice and a checkpoint. Completed practice does not imply verified mastery."}</p>
      </div>
      <div className={styles.survivalStats}>
        <span>{summary.practiced}/24 <small>{isVi ? "đã thực hành" : "practiced"}</small></span>
        <span>{summary.evidenceSubmitted}/24 <small>{isVi ? "minh chứng" : "evidence"}</small></span>
      </div>
    </header>
    <div className={styles.survivalSettings}>
      <label>{isVi ? "Tuần đang xem" : "Selected week"}
        <select value={week.number} onChange={e => onProgressChange(p => ({ ...p, selectedWeek: Number(e.target.value) }))}>
          {survivalWeeks.map(w => <option key={w.id} value={w.number}>
            {isVi ? "Tuần" : "Week"} {w.number} · {w.title[lang]}
          </option>)}
        </select>
      </label>
      <label>{isVi ? "Thời gian học có thể dành (giờ/tuần)" : "Available study time (hours/week)"}
        <input type="number" min={1} max={40} step={1}
          value={progress.availableHoursPerWeek}
          onChange={e => {
            const hours = Number(e.target.value);
            if (Number.isFinite(hours) && hours >= 1 && hours <= 40)
              onProgressChange(p => ({ ...p, availableHoursPerWeek: hours }));
          }} />
      </label>
    </div>
    <div className={styles.survivalWeekBody}>
      <div className={styles.survivalWeekPrimary}>
        <small>{survivalPhases[week.phase].label[lang]} · {isVi ? "Tuần" : "Week"} {week.number}/24</small>
        <h3>{week.title[lang]}</h3>
        <p>{phase.purpose[lang]}</p>
        <h4>{isVi ? "Bài thực hành" : "Practical exercise"}</h4>
        <p>{week.exercise[lang]}</p>
        <h4>{isVi ? "Cổng kiểm tra đề xuất" : "Suggested checkpoint"}</h4>
        <p>{week.checkpoint[lang]}</p>
        <h4>{isVi ? "Sản phẩm cần có" : "Expected artifact"}</h4>
        <p>{week.artifact[lang]}</p>
        <p className={styles.survivalTerms}><b>{isVi ? "Từ Nga" : "Russian terms"}:</b> {week.russianTerms.join(" · ")}</p>
        <label className={styles.survivalPractice}>
          <input type="checkbox" checked={progress.exerciseDone[week.id] === true}
            onChange={e => { const checked = e.target.checked; onProgressChange(p => ({ ...p, exerciseDone: { ...p.exerciseDone, [week.id]: checked } })); }} />
          {isVi ? "Tôi đã làm bài thực hành (chưa chứng nhận năng lực)" : "I completed the practice (not a mastery certificate)"}
        </label>
      </div>
      <aside className={styles.survivalWeekAside}>
        <strong>{isVi ? "Bằng chứng và mức sẵn sàng" : "Evidence and readiness"}</strong>
        <p>{evidenceStatus}</p>
        <label>{isVi ? "Ghi chú kết quả / đường dẫn minh chứng cá nhân" : "Result note / personal evidence reference"}
          <textarea rows={3} maxLength={1000} value={evidence.note}
            onChange={e => editEvidence(e.target.value)}
            placeholder={isVi ? "Ví dụ: tên repo, bài test đã chạy, lỗi còn tồn tại..." : "Example: repository, test result, remaining errors..."} />
        </label>
        <div className={styles.survivalEvidenceActions}>
          <button type="button" onClick={() => setEvidenceState("self_reported")}>
            {isVi ? "Tự đánh giá" : "Self-report"}
          </button>
          <button type="button" disabled={!evidence.note.trim()} onClick={() => setEvidenceState("submitted")}>
            {isVi ? "Ghi nhận minh chứng" : "Record evidence"}
          </button>
        </div>
        <p className={styles.survivalCaution}>
          {isVi ? "Ứng dụng chưa có người/bộ kiểm tra độc lập được ủy quyền. Không tự cấp trạng thái 'đạt chuẩn', điểm hay kết quả thi Bauman." : "No authorized external assessor is connected; the tool cannot award verified mastery or official BMSTU grades."}
        </p>
        {progress.availableHoursPerWeek < week.recommendedHours && <p className={styles.survivalWarning} role="status">
          {isVi ? "Tải đề xuất cao hơn thời gian bạn có. Hãy kéo dài giai đoạn hoặc giảm bài bổ trợ." : "Recommended effort exceeds available time. Extend the phase or reduce optional practice."}
        </p>}
        <strong>{isVi ? "Môn chính khóa liên quan" : "Related IU5 courses"}</strong>
        <div className={styles.survivalCourseLinks}>
          {linkedCourses.map(course => <button key={course.id} type="button" onClick={() => onOpenCourse(course)}>
            {course.title[lang]} · {isVi ? "HK" : "S"}{course.semester}
          </button>)}
        </div>
        <p className={styles.survivalCaution}>{isVi ? "Liên kết mang tính khuyến nghị sư phạm, không phải điều kiện tiên quyết chính thức." : "These are pedagogical links, not official academic prerequisites."}</p>
      </aside>
    </div>
    <footer className={styles.survivalPager}>
      <button type="button" disabled={week.number === 1} onClick={() => onProgressChange(p => ({ ...p, selectedWeek: Math.max(1, p.selectedWeek - 1) }))}>← {isVi ? "Tuần trước" : "Previous week"}</button>
      <button type="button" disabled={week.number === 24} onClick={() => onProgressChange(p => ({ ...p, selectedWeek: Math.min(24, p.selectedWeek + 1) }))}>{isVi ? "Tuần sau" : "Next week"} →</button>
    </footer>
  </section>;
}

export default function StudyPlanTool({
  user,
  baumanModules,
  baumanRegistryStatus,
  mayOpenLearningRuntimeDirectly,
}: {
  user: { displayName: string; email: string };
  baumanModules: BaumanStudyModule[];
  baumanRegistryStatus: BaumanRegistryStatus;
  mayOpenLearningRuntimeDirectly: boolean;
}) {
  const [lang, setLang] = useState<Language>("vi");
  const [mode, setMode] = useState<ViewMode>("semester");
  const [semester, setSemester] = useState<1 | 2 | 3 | 4>(1);
  const [year, setYear] = useState<1 | 2>(1);
  const [week, setWeek] = useState(1);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>("multivariate");
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSection>("schedule");
  const [fontScale, setFontScale] = useState<StudyFontScale>("normal");
  const [courseQuery, setCourseQuery] = useState("");
  const [courseSemesterFilter, setCourseSemesterFilter] = useState<ExplorerSemester>("all");
  const [courseKindFilter, setCourseKindFilter] = useState<ExplorerKind>("all");
  const [courseReadinessFilter, setCourseReadinessFilter] = useState<ExplorerReadiness>("all");
  const [courseSort, setCourseSort] = useState<ExplorerSort>("semester");
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [survival, setSurvival] = useState<SurvivalPersonalState>(defaultSurvivalState);
  const [survivalOwner, setSurvivalOwner] = useState<string | null>(null);
  const [survivalSaved, setSurvivalSaved] = useState(true);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("application-management:study-plan-font-scale:v1");
      if (saved === "normal" || saved === "large" || saved === "xlarge") setFontScale(saved);
    } catch {
      // Font preference is device-local and optional.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("application-management:study-plan-font-scale:v1", fontScale);
    } catch {
      // Font preference is device-local and optional.
    }
  }, [fontScale]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("application-management:study-plan-progress:v1");
      if (raw) setCompleted(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      // Invalid local progress must never block the study-plan tool.
    } finally {
      setProgressLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!progressLoaded) return;
    try {
      window.localStorage.setItem("application-management:study-plan-progress:v1", JSON.stringify(completed));
    } catch {
      // Local progress is optional and the tool remains fully usable without storage.
    }
  }, [completed, progressLoaded]);

  useEffect(() => {
    setSurvivalOwner(null);
    try {
      setSurvival(parseSurvivalState(window.localStorage.getItem(survivalStorageKey + ":" + encodeURIComponent(user.email.toLowerCase()))));
      setSurvivalSaved(true);
    } catch {
      setSurvival(defaultSurvivalState());
      setSurvivalSaved(false);
    } finally {
      setSurvivalOwner(user.email);
    }
  }, [user.email]);

  useEffect(() => {
    if (survivalOwner !== user.email) return; // Never write another account's progress on account switch.
    try {
      window.localStorage.setItem(survivalStorageKey + ":" + encodeURIComponent(user.email.toLowerCase()), JSON.stringify(survival));
      setSurvivalSaved(true);
    } catch {
      setSurvivalSaved(false);
    }
  }, [survival, survivalOwner, user.email]);

  const toggleStep = (key: string) => setCompleted((current) => ({ ...current, [key]: !current[key] }));
  const resetProgress = () => setCompleted({});
  const printStudyPlan = () => window.print();

  const t = copy[lang];
  const workspaceItems: Array<{ id: WorkspaceSection; label: string; sub: string; badge: string }> = [
    { id: "schedule", label: t.navSchedule, sub: t.navScheduleSub, badge: "4 HK" },
    { id: "courses", label: t.navCourses, sub: t.navCoursesSub, badge: String(courses.length) },
    { id: "skills", label: t.navSkills, sub: t.navSkillsSub, badge: String(skillClusterDefinitions.length) },
    { id: "analysis", label: t.navAnalysis, sub: t.navAnalysisSub, badge: String(program.credits) },
    { id: "roadmap", label: t.navPreparation, sub: t.navPreparationSub, badge: survival.variant === "compact12" ? "12" : "24" },
  ];
  const meta = semesterMeta[semester];
  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
  const visibleCourses = useMemo(() => {
    if (mode === "year") return yearCourses(year);
    return semesterCourses(semester);
  }, [mode, semester, year]);

  const moduleCoverage = useMemo(() => {
    const coveredIds = new Set(baumanModules.flatMap((module) => module.courseIds));
    const covered = courses.filter((course) => coveredIds.has(course.id));
    const missing = courses.filter((course) => !coveredIds.has(course.id));
    const bySemester = ([1, 2, 3, 4] as const).map((semesterNumber) => {
      const semesterItems = courses.filter((course) => course.semester === semesterNumber);
      const coveredCount = semesterItems.filter((course) => coveredIds.has(course.id)).length;
      return {
        semester: semesterNumber,
        total: semesterItems.length,
        covered: coveredCount,
      };
    });
    return {
      covered,
      missing,
      bySemester,
      percent: courses.length > 0 ? Math.round((covered.length / courses.length) * 100) : 0,
    };
  }, [baumanModules]);

  const explorerCourses = useMemo(() => {
    const normalizedQuery = courseQuery.trim().toLocaleLowerCase();
    const filtered = courses.filter((course) => {
      const readiness = readinessByCourse[course.id].level;
      const matchesQuery = !normalizedQuery || [
        course.ru,
        course.title.vi,
        course.title.en,
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      const matchesSemester = courseSemesterFilter === "all" || String(course.semester) === courseSemesterFilter;
      const matchesKind = courseKindFilter === "all" || course.kind === courseKindFilter;
      const matchesReadiness = courseReadinessFilter === "all" || readiness === courseReadinessFilter;
      return matchesQuery && matchesSemester && matchesKind && matchesReadiness;
    });
    return [...filtered].sort((a, b) => {
      if (courseSort === "credits") return b.credits - a.credits || a.semester - b.semester;
      if (courseSort === "readiness") {
        const readinessDelta = readinessWeight[readinessByCourse[a.id].level] - readinessWeight[readinessByCourse[b.id].level];
        return readinessDelta || a.semester - b.semester || a.id.localeCompare(b.id);
      }
      return a.semester - b.semester || a.id.localeCompare(b.id);
    });
  }, [courseKindFilter, courseQuery, courseReadinessFilter, courseSemesterFilter, courseSort]);

  const skillAnalysis = useMemo(() => skillClusterDefinitions.map((cluster) => {
    const clusterCourses = cluster.courseIds
      .map((id) => courses.find((course) => course.id === id))
      .filter((course): course is Course => Boolean(course));
    const counts = clusterCourses.reduce((acc, course) => {
      acc[readinessByCourse[course.id].level] += 1;
      return acc;
    }, { green: 0, yellow: 0, red: 0 } as Record<ReadinessLevel, number>);
    const priorityCourse = [...clusterCourses].sort((a, b) =>
      readinessWeight[readinessByCourse[a.id].level] - readinessWeight[readinessByCourse[b.id].level] ||
      a.semester - b.semester ||
      b.credits - a.credits
    )[0] ?? null;
    const level: ReadinessLevel = counts.red > 0 ? "red" : counts.yellow > 0 ? "yellow" : "green";
    return { ...cluster, clusterCourses, counts, priorityCourse, level };
  }), []);

  const skillSummary = useMemo(() => ({
    green: skillAnalysis.filter((cluster) => cluster.level === "green").length,
    yellow: skillAnalysis.filter((cluster) => cluster.level === "yellow").length,
    red: skillAnalysis.filter((cluster) => cluster.level === "red").length,
  }), [skillAnalysis]);

  const creditStructure = useMemo(() => programKindOrder.map((kind) => {
    const items = courses.filter((course) => course.kind === kind);
    const credits = items.reduce((sum, course) => sum + course.credits, 0);
    const hours = items.reduce((sum, course) => sum + course.hours, 0);
    return {
      kind,
      count: items.length,
      credits,
      hours,
      percent: program.credits > 0 ? (credits / program.credits) * 100 : 0,
    };
  }), []);

  const workloadBySemester = useMemo(() => ([1, 2, 3, 4] as const).map((semesterNumber) => {
    const items = semesterCourses(semesterNumber);
    const totalHours = items.reduce((sum, course) => sum + course.hours, 0);
    const contactHours = items.reduce((sum, course) => sum + course.contactHours, 0);
    return {
      semester: semesterNumber,
      totalHours,
      contactHours,
      selfStudyHours: Math.max(0, totalHours - contactHours),
    };
  }), []);

  const gapPlan = useMemo(() => {
    const missingIds = new Set(moduleCoverage.missing.map((course) => course.id));
    const groups = Object.fromEntries(
      gapActionOrder.map((action) => [action, [] as Course[]]),
    ) as Record<GapAction, Course[]>;

    for (const course of courses) {
      if (!missingIds.has(course.id)) continue;
      const action = gapActionByCourse[course.id] ?? "confirm";
      groups[action].push(course);
    }

    for (const action of gapActionOrder) {
      groups[action].sort((a, b) => a.semester - b.semester || a.id.localeCompare(b.id));
    }

    return groups;
  }, [moduleCoverage.missing]);

  const openCoverageCourse = (course: Course) => {
    setActiveWorkspace("schedule");
    setSemester(course.semester);
    setYear(course.semester <= 2 ? 1 : 2);
    setMode("semester");
    setSelectedCourseId(course.id);
    window.requestAnimationFrame(() => {
      document.getElementById("study-plan-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

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

  const openCourseFromAnalysis = (course: Course) => {
    setActiveWorkspace("schedule");
    setSemester(course.semester);
    setYear(course.semester <= 2 ? 1 : 2);
    setMode("semester");
    setSelectedCourseId(course.id);
    window.requestAnimationFrame(() => {
      document.getElementById("study-plan-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const clearCourseFilters = () => {
    setCourseQuery("");
    setCourseSemesterFilter("all");
    setCourseKindFilter("all");
    setCourseReadinessFilter("all");
    setCourseSort("semester");
  };

  const switchWorkspace = (next: WorkspaceSection) => {
    setActiveWorkspace(next);
    window.requestAnimationFrame(() => {
      document.getElementById("workspace-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const jumpToCourseExplorer = () => {
    setActiveWorkspace("courses");
    window.requestAnimationFrame(() => {
      document.getElementById("workspace-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return <main className={styles.shell} id="study-plan-top" data-workspace={activeWorkspace} data-font-scale={fontScale}>
    <header className={styles.topbar}>
      <div className={styles.contextNav}>
        <Link href="/" className={styles.back}>{t.back}</Link>
        <Link href="/apps/bauman-master-ai" className={styles.baumanAdminLink}>{t.baumanAdmin}</Link>
      </div>
      <div className={styles.language} aria-label="Language">
        <button type="button" data-active={lang === "vi"} onClick={() => setLang("vi")}>VI</button>
        <button type="button" data-active={lang === "en"} onClick={() => setLang("en")}>EN</button>
      </div>
      <div className={styles.fontControl} aria-label={lang === "vi" ? "Cỡ chữ" : "Text size"}>
        <button type="button" data-active={fontScale === "normal"} aria-label={lang === "vi" ? "Cỡ chữ chuẩn" : "Normal text size"} onClick={() => setFontScale("normal")}>A</button>
        <button type="button" data-active={fontScale === "large"} aria-label={lang === "vi" ? "Cỡ chữ lớn" : "Large text size"} onClick={() => setFontScale("large")}>A+</button>
        <button type="button" data-active={fontScale === "xlarge"} aria-label={lang === "vi" ? "Cỡ chữ rất lớn" : "Extra large text size"} onClick={() => setFontScale("xlarge")}>A++</button>
      </div>
      <button type="button" className={styles.printButton} onClick={printStudyPlan}>{t.exportPdf}</button>
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

    <section className={styles.commandBar} aria-label={t.quickFind}>
      <label className={styles.commandSearch}>
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={courseQuery}
          onChange={(event) => setCourseQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") jumpToCourseExplorer();
          }}
          placeholder={t.quickFindPlaceholder}
          aria-label={t.quickFind}
        />
        <button type="button" onClick={jumpToCourseExplorer}>{t.quickExplore} →</button>
      </label>
      <div className={styles.commandShortcuts}>
        <a href="#pre-bauman-roadmap"><span>{survival.variant === "compact12" ? "12" : "24"}</span><small>{t.quickRoadmap}</small></a>
        <a href="#learning-coverage"><span>{moduleCoverage.percent}%</span><small>{t.quickCoverage}</small></a>
        <a href="#skills-direction"><span>{skillAnalysis.length}</span><small>{t.quickSkills}</small></a>
      </div>
      <small className={styles.commandHint}>{t.quickFindHint}</small>
    </section>

    <section className={styles.workspaceLauncher} aria-labelledby="workspace-launcher-title">
      <header>
        <div>
          <span id="workspace-launcher-title">{t.workspaceTitle}</span>
          <p>{t.workspaceHint}</p>
        </div>
      </header>
      <nav className={styles.studySections} aria-label={t.title}>
        {workspaceItems.map((item) => <button
          key={item.id}
          type="button"
          data-active={activeWorkspace === item.id}
          aria-pressed={activeWorkspace === item.id}
          onClick={() => switchWorkspace(item.id)}
        >
          <span className={styles.workspaceIcon}><WorkspaceIcon section={item.id}/></span>
          <div><strong>{item.label}</strong><small>{item.sub}</small></div>
          <b>{item.badge}</b>
        </button>)}
      </nav>
    </section>
    <div id="workspace-content" className={styles.workspaceContentAnchor} aria-hidden="true" />

    <section className={styles.readinessLegend}>
      <div>
        <strong>{readinessLegend[lang].title}</strong>
        <p>{readinessLegend[lang].note}</p>
      </div>
      <div className={styles.readinessLegendItems}>
        {(["green", "yellow", "red"] as ReadinessLevel[]).map((level) => <span key={level} data-level={level}>{readinessLabels[level][lang]}</span>)}
      </div>
    </section>

    <section className={styles.survivalSelector} id="pre-bauman-roadmap" aria-label={lang === "vi" ? "Chế độ lộ trình chuẩn bị" : "Preparation mode"}>
      {!survivalSaved && <p role="alert">{lang === "vi" ? "Không lưu được tiến độ 24 tuần trên thiết bị này. Hãy kiểm tra quyền lưu trữ của trình duyệt." : "Could not save 24-week progress on this device. Check browser storage permissions."}</p>}
      <span>{lang === "vi" ? "Lộ trình chuẩn bị" : "Preparation roadmap"}</span>
      <div>
        <button type="button" data-active={survival.variant === "compact12"}
          aria-pressed={survival.variant === "compact12"}
          onClick={() => setSurvival(p => ({ ...p, variant: "compact12" }))}>
          {lang === "vi" ? "12 tuần · Rút gọn" : "12 weeks · Compact"}
        </button>
        <button type="button" data-active={survival.variant === "standard24"}
          aria-pressed={survival.variant === "standard24"}
          onClick={() => setSurvival(p => ({ ...p, variant: "standard24" }))}>
          {lang === "vi" ? "24 tuần · Chi tiết" : "24 weeks · Detailed"}
        </button>
      </div>
    </section>
    {survival.variant === "compact12"
      ? <PreStudyRoadmap lang={lang} completed={completed} toggleStep={toggleStep} onOpenCourse={openCoverageCourse} onReset={resetProgress} />
      : <StandardSurvivalRoadmap lang={lang} progress={survival} onProgressChange={setSurvival} onOpenCourse={openCoverageCourse} />}

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

    <section className={styles.contentGrid} id="study-plan-content">
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

      <DetailPanel
        course={selectedCourse}
        lang={lang}
        completed={completed}
        toggleStep={toggleStep}
        baumanModules={baumanModules}
        baumanRegistryStatus={baumanRegistryStatus}
        mayOpenLearningRuntimeDirectly={mayOpenLearningRuntimeDirectly}
      />
    </section>

    <section className={styles.courseExplorer} id="course-explorer" aria-labelledby="course-explorer-title">
      <header className={styles.courseExplorerHeader}>
        <div>
          <span id="course-explorer-title">{t.explorerTitle}</span>
          <p>{t.explorerSubtitle}</p>
        </div>
        <strong>{explorerCourses.length}/{courses.length} {t.results}</strong>
      </header>
      <div className={styles.courseExplorerFilters}>
        <label className={styles.courseSearch}>
          <span>⌕</span>
          <input
            type="search"
            value={courseQuery}
            onChange={(event) => setCourseQuery(event.target.value)}
            placeholder={t.searchCourses}
            aria-label={t.searchCourses}
          />
        </label>
        <select value={courseSemesterFilter} onChange={(event) => setCourseSemesterFilter(event.target.value as ExplorerSemester)} aria-label={t.allSemesters}>
          <option value="all">{t.allSemesters}</option>
          {[1, 2, 3, 4].map((value) => <option key={value} value={String(value)}>{t.semester} {value}</option>)}
        </select>
        <select value={courseKindFilter} onChange={(event) => setCourseKindFilter(event.target.value as ExplorerKind)} aria-label={t.allKinds}>
          <option value="all">{t.allKinds}</option>
          {programKindOrder.map((kind) => <option key={kind} value={kind}>{programKindLabels[lang][kind]}</option>)}
        </select>
        <select value={courseReadinessFilter} onChange={(event) => setCourseReadinessFilter(event.target.value as ExplorerReadiness)} aria-label={t.allReadiness}>
          <option value="all">{t.allReadiness}</option>
          {(["green", "yellow", "red"] as ReadinessLevel[]).map((level) => <option key={level} value={level}>{readinessLabels[level][lang]}</option>)}
        </select>
        <select value={courseSort} onChange={(event) => setCourseSort(event.target.value as ExplorerSort)} aria-label={t.sortBy}>
          <option value="semester">{t.sortSemester}</option>
          <option value="credits">{t.sortCredits}</option>
          <option value="readiness">{t.sortReadiness}</option>
        </select>
        <button type="button" onClick={clearCourseFilters}>{t.clearFilters}</button>
      </div>
      <div className={styles.courseExplorerResults}>
        {explorerCourses.length === 0
          ? <p className={styles.courseExplorerEmpty}>{t.noResults}</p>
          : explorerCourses.map((course) => <CourseRow
              key={course.id}
              course={course}
              lang={lang}
              selected={selectedCourseId === course.id}
              onSelect={() => openCourseFromAnalysis(course)}
            />)}
      </div>
    </section>

    <section className={styles.skillsDirection} id="skills-direction" aria-labelledby="skills-direction-title">
      <header className={styles.skillsHeader}>
        <div>
          <span id="skills-direction-title">{t.skillsTitle}</span>
          <p>{t.skillsSubtitle}</p>
        </div>
        <div className={styles.skillSummary}>
          <span data-level="green">🟢 {skillSummary.green} · {t.skillStrong}</span>
          <span data-level="yellow">🟡 {skillSummary.yellow} · {t.skillReview}</span>
          <span data-level="red">🔴 {skillSummary.red} · {t.skillGap}</span>
        </div>
      </header>
      <div className={styles.skillGrid}>
        {skillAnalysis.map((cluster) => <article key={cluster.id} data-level={cluster.level}>
          <header>
            <div>
              <span>{readinessLabels[cluster.level][lang]}</span>
              <h3>{cluster.label[lang]}</h3>
            </div>
            <strong>{cluster.clusterCourses.length}</strong>
          </header>
          <p>{cluster.direction[lang]}</p>
          <div className={styles.skillReadinessCounts}>
            <span data-level="green">🟢 {cluster.counts.green}</span>
            <span data-level="yellow">🟡 {cluster.counts.yellow}</span>
            <span data-level="red">🔴 {cluster.counts.red}</span>
            <small>{t.skillCourses}</small>
          </div>
          {cluster.priorityCourse ? <div className={styles.skillPriority}>
            <small>{t.priorityNext}</small>
            <strong>{cluster.priorityCourse.title[lang]}</strong>
            <button type="button" onClick={() => openCourseFromAnalysis(cluster.priorityCourse as Course)}>{t.openPriorityCourse} →</button>
          </div> : null}
        </article>)}
      </div>
    </section>

    <section className={styles.integrationBridge} aria-label={t.integrationTitle}>
      <div className={styles.integrationLead}>
        <span>{t.integrationTitle}</span>
        <p>{t.integrationNote}</p>
      </div>
      <div className={styles.integrationFacts}>
        <article><small>{t.integrationParent}</small><strong>Bauman Hub</strong><Link href="/apps/bauman-master-ai">{t.baumanAdmin} →</Link></article>
        <article><small>{t.integrationRegistry}</small><strong data-live={baumanRegistryStatus === "live"}>{baumanRegistryStatus === "live" ? t.registryLive : t.registryFallback}</strong><span>{baumanModules.length} {lang === "vi" ? "nguồn nối" : "connected resources"}</span></article>
        <article><small>{t.integrationCoverage}</small><strong>{moduleCoverage.covered.length}/{courses.length}</strong><span>{moduleCoverage.percent}%</span></article>
      </div>
    </section>

    <section className={styles.stats}>
      <Stat value={program.credits} label={t.credits} sub={t.totalHours} />
      <Stat value={4} label={t.semesters} sub="30 + 30 + 30 + 30" />
      <Stat value={62} label={t.teachingWeeks} sub="17 + 17 + 17 + 11" />
      <Stat value="≈51" label={t.avgLoad} sub={t.hoursWeek} />
    </section>

    <section className={styles.overall} id="program-analysis">
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
      <section className={styles.creditStructure} aria-labelledby="study-plan-credit-structure-title">
        <div className={styles.creditStructureHeading}>
          <div>
            <span id="study-plan-credit-structure-title">{t.creditStructureTitle}</span>
            <p>{t.creditStructureSubtitle}</p>
          </div>
          <strong>{program.credits} {t.credits.toLowerCase()}</strong>
        </div>
        <div className={styles.creditStack} aria-label={t.creditStructureTitle}>
          {creditStructure.map((item) => <span
            key={item.kind}
            data-kind={item.kind}
            style={{ width: `${item.percent}%` }}
            title={`${programKindLabels[lang][item.kind]}: ${item.credits} ${t.credits.toLowerCase()}`}
          />)}
        </div>
        <div className={styles.creditStructureGrid}>
          {creditStructure.map((item) => <article key={item.kind} data-kind={item.kind}>
            <i />
            <div>
              <span>{programKindLabels[lang][item.kind]}</span>
              <small>{item.count} {t.structureItems} · {item.hours.toLocaleString(lang === "vi" ? "vi-VN" : "en-US")} h</small>
            </div>
            <strong>{item.credits}</strong>
            <em>{item.percent.toFixed(1)}%</em>
          </article>)}
        </div>
      </section>

      <section className={styles.workloadAnalysis} aria-labelledby="study-plan-workload-title">
        <div className={styles.workloadHeading}>
          <div>
            <span id="study-plan-workload-title">{t.workloadTitle}</span>
            <p>{t.workloadSubtitle}</p>
          </div>
          <strong>{program.hours.toLocaleString(lang === "vi" ? "vi-VN" : "en-US")} h</strong>
        </div>
        <div className={styles.workloadGrid}>
          {workloadBySemester.map((item) => {
            const contactPct = item.totalHours > 0 ? (item.contactHours / item.totalHours) * 100 : 0;
            const selfPct = Math.max(0, 100 - contactPct);
            return <article key={item.semester}>
              <header>
                <div><span>{t.semester} {item.semester}</span><strong>{item.totalHours} h</strong></div>
                <small>{semesterMeta[item.semester].credits} {lang === "vi" ? "tín chỉ" : "credits"}</small>
              </header>
              <div className={styles.workloadBar} aria-label={`${t.semester} ${item.semester}: ${item.contactHours}h ${t.workloadContact}, ${item.selfStudyHours}h ${t.workloadSelf}`}>
                <span className={styles.workloadContactBar} style={{ width: `${contactPct}%` }} />
                <span className={styles.workloadSelfBar} style={{ width: `${selfPct}%` }} />
              </div>
              <div className={styles.workloadLegend}>
                <p><i data-kind="contact" /><span>{t.workloadContact}</span><b>{item.contactHours} h</b></p>
                <p><i data-kind="self" /><span>{t.workloadSelf}</span><b>{item.selfStudyHours} h</b></p>
              </div>
            </article>;
          })}
        </div>
        <p className={styles.printNote}>{t.printNote}</p>
      </section>

      <div className={styles.coverage} id="learning-coverage">
        <div className={styles.coverageHeader}>
          <div>
            <span>{t.coverageTitle}</span>
            <p>{t.coverageSubtitle}</p>
          </div>
          <div className={styles.coverageRegistry} data-live={baumanRegistryStatus === "live"}>
            <i />
            {baumanRegistryStatus === "live" ? t.autoRegistry : t.registryUnavailable}
          </div>
        </div>

        {baumanRegistryStatus === "live" ? <>
          <div className={styles.coverageStats}>
            <article>
              <small>{t.coverageRate}</small>
              <strong>{moduleCoverage.percent}%</strong>
              <div className={styles.coverageBar}><span style={{ width: `${moduleCoverage.percent}%` }} /></div>
            </article>
            <article><small>{t.coveredCourses}</small><strong>{moduleCoverage.covered.length}/{courses.length}</strong></article>
            <article><small>{t.missingCourses}</small><strong>{moduleCoverage.missing.length}</strong></article>
            <article><small>{t.moduleCount}</small><strong>{baumanModules.length}</strong></article>
          </div>

          <div className={styles.semesterCoverage}>
            <h3>{t.coverageBySemester}</h3>
            <div>
              {moduleCoverage.bySemester.map((item) => {
                const pct = item.total > 0 ? Math.round((item.covered / item.total) * 100) : 0;
                return <article key={item.semester}>
                  <header><strong>{t.semester} {item.semester}</strong><span>{item.covered}/{item.total}</span></header>
                  <div><span style={{ width: `${pct}%` }} /></div>
                  <small>{pct}%</small>
                </article>;
              })}
            </div>
          </div>

          <div className={styles.missingCourses}>
            <h3>{t.missingList}</h3>
            {moduleCoverage.missing.length === 0
              ? <p className={styles.allCovered}>{t.allCovered}</p>
              : <div>
                  {moduleCoverage.missing.map((course) => <button key={course.id} type="button" onClick={() => openCoverageCourse(course)}>
                    <span>{t.semester} {course.semester}</span>
                    <strong>{course.title[lang]}</strong>
                    <small>{course.ru}</small>
                    <em>{t.openCourseAnalysis} →</em>
                  </button>)}
                </div>}
          </div>

          {moduleCoverage.missing.length > 0 ? <div className={styles.gapPlan}>
            <div className={styles.gapPlanHeader}>
              <div><h3>{t.gapPlanTitle}</h3><p>{t.gapPlanSub}</p></div>
              <span>{moduleCoverage.missing.length} · {t.missingHandled}</span>
            </div>

            <div className={styles.gapGroups}>
              {gapActionOrder.map((action) => {
                const label =
                  action === "create" ? t.createModule :
                  action === "existing" ? t.existingMaterial :
                  action === "practice" ? t.practiceNoModule :
                  t.decisionRequired;
                const note =
                  action === "create" ? t.createModuleNote :
                  action === "existing" ? t.existingMaterialNote :
                  action === "practice" ? t.practiceNoModuleNote :
                  t.decisionRequiredNote;
                const items = gapPlan[action];

                return <section key={action} data-action={action}>
                  <header>
                    <div><strong>{label}</strong><p>{note}</p></div>
                    <b>{items.length}</b>
                  </header>
                  {items.length === 0
                    ? <p className={styles.gapEmpty}>{t.noItems}</p>
                    : <div className={styles.gapItems}>
                        {items.map((course) => <button key={course.id} type="button" onClick={() => openCoverageCourse(course)}>
                          <span>{t.semester} {course.semester}</span>
                          <div><strong>{course.title[lang]}</strong><small>{course.ru}</small></div>
                          <em>→</em>
                        </button>)}
                      </div>}
                </section>;
              })}
            </div>

            {gapPlan.create.length > 0 ? <div className={styles.buildOrder}>
              <strong>{t.nextBuildOrder}</strong>
              <div>
                {gapPlan.create.map((course, index) => <button type="button" key={course.id} onClick={() => openCoverageCourse(course)}>
                  <b>{index + 1}</b>
                  <span>{course.title[lang]}</span>
                  <small>{t.semester} {course.semester}</small>
                </button>)}
              </div>
            </div> : null}
          </div> : null}
        </> : <p className={styles.coverageUnknown}>{t.coverageUnknown}</p>}
      </div>
      <p className={styles.sourceDisclaimer}>{t.derived} {t.analysisNote}</p>
    </section>
  </main>;
}
