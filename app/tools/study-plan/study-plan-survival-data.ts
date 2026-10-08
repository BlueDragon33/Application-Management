import type { Course, LocalizedText } from "./study-plan-data";

/**
 * Personal IU5 preparation guidance, NOT an official BMSTU syllabus, prerequisite
 * or academic timetable. Stable IDs are intentionally independent of the legacy
 * 12-week preparation checklist.
 */
export type SurvivalPhaseId = "python" | "oop" | "database" | "data" | "ml" | "integration";
export type SurvivalWeek = {
  id: string;
  number: number;
  phase: SurvivalPhaseId;
  title: LocalizedText;
  exercise: LocalizedText;
  checkpoint: LocalizedText;
  artifact: LocalizedText;
  russianTerms: readonly string[];
  recommendedHours: number;
  targetCourseIds: readonly string[];
};
export type SurvivalEvidenceState = "not_assessed" | "self_reported" | "submitted";
export type SurvivalEvidence = {
  state: SurvivalEvidenceState;
  note: string;
};
export type PersonalAssessment = { dueDate: string; status: "planned" | "working" | "self_done"; note: string };
export type AssessmentKind = "exam" | "rating-exam" | "credit" | "graded-credit" | "coursework" | "defense";
export type SurvivalPersonalState = {
  version: 2;
  variant: "compact12" | "standard24";
  selectedWeek: number;
  availableHoursPerWeek: number;
  exerciseDone: Record<string, boolean>;
  evidence: Record<string, SurvivalEvidence>;
  assessmentPlans: Record<string, PersonalAssessment>;
};

export const survivalStorageKey = "application-management:study-plan-survival:v2";

export const survivalPhases: Readonly<Record<SurvivalPhaseId, {
  label: LocalizedText;
  purpose: LocalizedText;
  courseIds: readonly string[];
}>> = {
  python: {
    label: { vi: "Python nền tảng", en: "Python foundations" },
    purpose: { vi: "Tự viết, chạy và sửa chương trình đơn giản", en: "Write, execute and debug basic programs" },
    courseIds: ["oop","software-1","multivariate","ml"],
  },
  oop: {
    label: { vi: "Thiết kế hướng đối tượng", en: "Object-oriented design" },
    purpose: { vi: "Biến chương trình rời thành phần mềm có cấu trúc", en: "Turn standalone scripts into structured software" },
    courseIds: ["oop","software-1","software-2"],
  },
  database: {
    label: { vi: "SQL và cơ sở dữ liệu", en: "SQL and databases" },
    purpose: { vi: "Lưu trữ, truy vấn và giải thích cách tối ưu dữ liệu", en: "Store, query and reason about data optimization" },
    courseIds: ["db-optimization","postrelational","elective-2"],
  },
  data: {
    label: { vi: "Toán và phân tích dữ liệu", en: "Mathematics and data analysis" },
    purpose: { vi: "Hiểu ma trận, thống kê và làm sạch dữ liệu", en: "Understand matrices, statistics and data preparation" },
    courseIds: ["multivariate","ml","time-series","reliability"],
  },
  ml: {
    label: { vi: "Machine Learning cơ bản", en: "Machine learning foundations" },
    purpose: { vi: "Huấn luyện mô hình có kiểm chứng, không chỉ chạy ví dụ", en: "Train reproducible models rather than merely running demos" },
    courseIds: ["ml","neural","business-ai","time-series"],
  },
  integration: {
    label: { vi: "Dự án và bảo vệ thử", en: "Integration and mock defense" },
    purpose: { vi: "Nối code, dữ liệu và kết quả thành báo cáo kỹ thuật", en: "Combine code, data and evidence into a technical report" },
    courseIds: ["nir-1","nir-2","nir-3","nir-4","nir-data","thesis"],
  },
};


/** Recommended, *not official*, cross-phase foundation dependencies. */
export const survivalPhaseDependencies: Readonly<Record<SurvivalPhaseId, readonly SurvivalPhaseId[]>> = {
  python: [],
  oop: ["python"],
  database: [],
  data: ["python"],
  ml: ["python", "data"],
  integration: ["oop", "database", "ml"],
};

/** An absent submitted reference is an evidence gap, not proof of poor ability. */
export function prerequisiteEvidenceGaps(phase: SurvivalPhaseId, state: SurvivalPersonalState) {
  return survivalPhaseDependencies[phase].filter(dependency => {
    const terminal = [...survivalWeeks].reverse().find(w => w.phase === dependency);
    return !terminal || state.evidence[terminal.id]?.state !== "submitted";
  });
}

type WeekSeed = readonly [
  SurvivalPhaseId, string, string, string, string, string, string, string, string, string
];
const seeds: readonly WeekSeed[] = [
  ["python","Biến, kiểu dữ liệu và nhập xuất","Variables, data types and I/O","Viết chương trình đọc 10 giá trị cảm biến giả lập","Write a program reading 10 simulated sensor values","Giải thích biến, kiểu và kết quả chạy không nhìn mẫu","Explain variables, types and output without a template","Tệp Python chạy được","Executable Python file","переменная · данные"],
  ["python","Vòng lặp, điều kiện và hàm","Loops, conditions and functions","Tính min/max/trung bình và đánh dấu dữ liệu bất thường","Compute min/max/mean and flag outliers","Tự viết hàm mới theo một yêu cầu thay đổi","Adapt a function to a new requirement independently","Tệp hàm + kết quả thử","Functions and test output","цикл · функция"],
  ["python","Collection và CSV/JSON","Collections and CSV/JSON","Đọc tệp CSV, chuyển sang JSON rồi kiểm tra số bản ghi","Read CSV, convert it to JSON and check record counts","Tìm và xử lý hàng dữ liệu thiếu hoặc sai định dạng","Find and handle missing or malformed rows","Tệp CSV/JSON mẫu","Sample CSV/JSON files","массив · файл"],
  ["python","Module, ngoại lệ và kiểm thử","Modules, errors and tests","Chia chương trình thành module, thêm pytest hoặc unittest","Split a program into modules; add pytest or unittest","Bài chạy độc lập, xử lý lỗi và có test tái lập","Standalone program handles errors with repeatable tests","Mini project Python v1","Python mini-project v1","модуль · исключение"],
  ["oop","Class, object và constructor","Classes, objects and constructors","Tạo Sensor/Measurement với thuộc tính và phương thức","Create Sensor/Measurement classes with methods","Giải thích state của object và chạy ví dụ tự viết","Explain object state using an original example","Mô hình lớp đơn giản","Simple class model","класс · объект"],
  ["oop","Composition và abstraction","Composition and abstraction","Ghép nhiều cảm biến vào trạm thu thập dữ liệu","Compose several sensors into a data station","Thay cảm biến mà không sửa thuật toán tổng hợp","Swap sensors without rewriting aggregation logic","Class diagram + code","Class diagram and code","состав · абстракция"],
  ["oop","Interface và inheritance","Interfaces and inheritance","Thiết kế hai nguồn dữ liệu dùng giao diện chung","Design two data sources using a common interface","Giải thích lúc nào dùng composition thay inheritance","Explain when composition is preferable to inheritance","Module mở rộng + test","Extensible module and tests","интерфейс · наследование"],
  ["oop","Thiết kế module và Git","Modular design and Git","Refactor project, tạo nhánh Git, viết test hồi quy","Refactor project, create a Git branch and regression tests","Chứng minh thay đổi yêu cầu không phá chức năng cũ","Show a change does not break existing functionality","Project OOP có README","OOP project with README","проектирование · тест"],
  ["database","SQL SELECT, WHERE, GROUP BY","SQL SELECT, WHERE and GROUP BY","Tạo bảng mẫu cho dữ liệu cảm biến và truy vấn thống kê","Create sample sensor data tables and aggregate queries","Tự viết truy vấn đúng trên bộ dữ liệu mới","Write correct queries against a fresh dataset","Tập truy vấn SQL","SQL query set","запрос · таблица"],
  ["database","JOIN và khóa quan hệ","JOINs and relational keys","Nối bảng sensors, stations và measurements","Join sensors, stations and measurements tables","Giải thích PK/FK và tự sửa một JOIN sai","Explain PK/FK and repair a faulty JOIN","Schema + JOIN queries","Schema and JOIN queries","ключ · связь"],
  ["database","CTE, chuẩn hóa và transaction","CTEs, normalization and transactions","Chuẩn hóa schema rồi viết truy vấn CTE và transaction","Normalize a schema and write CTE/transaction queries","Nhận diện dữ liệu lặp và tình huống rollback","Identify redundant data and a rollback scenario","SQL migration nhỏ","Small SQL migration","транзакция · нормализация"],
  ["database","Index và EXPLAIN","Indexing and EXPLAIN","So sánh query plan trước và sau khi thêm index","Compare query plans before and after adding an index","Giải thích trade-off thay vì chỉ đo thời gian","Explain indexing trade-offs rather than speed alone","Báo cáo tối ưu truy vấn","Query optimization report","индекс · оптимизация"],
  ["data","Vector và phép toán ma trận","Vectors and matrix operations","Tính nhân ma trận và biến đổi dữ liệu bằng NumPy","Compute matrix products and transform data with NumPy","Đối chiếu một phép tính tay với kết quả máy","Cross-check one hand calculation against code","Notebook đại số tuyến tính","Linear algebra notebook","вектор · матрица"],
  ["data","Xác suất và thống kê mô tả","Probability and descriptive statistics","Tính mean/variance/distribution trên dữ liệu cảm biến","Compute mean/variance/distribution for sensor data","Phân biệt biến thiên dữ liệu và sai số đo","Explain observed variation versus measurement error","Bảng thống kê có diễn giải","Interpreted statistics sheet","вероятность · дисперсия"],
  ["data","Pandas và làm sạch dữ liệu","Pandas and data cleaning","Xử lý NaN, dữ liệu trùng và ngoại lệ có kiểm soát","Handle NaN, duplicates and outliers with explicit rules","Nêu rõ những hàng bị xóa/sửa và nguyên nhân","Explain every category of row removed or changed","Dataset card và notebook","Dataset card and notebook","обработка · выборка"],
  ["data","Correlation và PCA nhập môn","Correlation and introductory PCA","Tính ma trận tương quan, thử PCA và vẽ biểu đồ","Calculate correlations, try PCA and create plots","Giải thích vì sao tương quan không chứng minh nhân quả","Explain why correlation does not establish causation","Báo cáo phân tích đa chiều","Multivariate analysis report","корреляция · компонент"],
  ["ml","Train/validation/test và baseline","Train/validation/test and baseline","Tách dữ liệu, huấn luyện baseline regression","Split data and train a regression baseline","Chứng minh không fit preprocessing trên test set","Show preprocessing is not fitted to the test set","Pipeline huấn luyện đầu tiên","First training pipeline","обучение · проверка"],
  ["ml","Phân loại và metrics","Classification and metrics","Huấn luyện 2 bộ phân loại và so sánh precision/recall","Train two classifiers and compare precision/recall","Lựa chọn metric phù hợp dữ liệu mất cân bằng","Choose a suitable metric for imbalanced data","Bảng metrics hai mô hình","Two-model metrics table","точность · полнота"],
  ["ml","Clustering, feature và overfitting","Clustering, features and overfitting","Thử clustering và phân tích train-vs-validation gap","Try clustering and analyze train/validation gap","Chỉ ra ít nhất một lỗi overfit và cách giảm nó","Identify an overfitting symptom and mitigation","Phân tích lỗi thực nghiệm","Experiment error analysis","переобучение · признак"],
  ["ml","ML reproducibility và đánh giá","ML reproducibility and evaluation","Chạy lại pipeline từ seed, ghi version và báo cáo giới hạn","Rerun pipeline from seed, record versions and limitations","Người khác có thể tái lập chỉ từ README + dữ liệu","Another person can reproduce results from README and data","Báo cáo ML baseline","Baseline ML report","модель · результат"],
  ["integration","Nối Python/OOP với PostgreSQL","Python/OOP to PostgreSQL integration","Viết lớp lưu dữ liệu, migration schema và bài test đọc/ghi","Write a data-access class, schema migration and read/write tests","Demo luồng dữ liệu vào–ra không dùng file hardcode","Demonstrate non-hardcoded end-to-end data flow","Project tích hợp v2","Integrated project v2","система · база данных"],
  ["integration","Hồ sơ thực nghiệm và phương pháp","Experiment and methodology record","Ghi giả thuyết, dataset, metric, phiên bản và rủi ro","Record hypothesis, dataset, metrics, versions and risks","Phân biệt kết quả quan sát với kết luận suy diễn","Separate observed result from speculative conclusion","Research log + dataset card","Research log and dataset card","исследование · метод"],
  ["integration","Báo cáo và thuật ngữ Nga","Report and Russian terminology","Viết báo cáo 2–4 trang kèm thuật ngữ Nga–Việt","Write a 2–4 page technical report and Russian/Vietnamese glossary","Trình bày problem/data/method/results/limits có nguồn","Present sourced problem/data/method/results/limitations","README + báo cáo kỹ thuật","README and technical report","доклад · вывод"],
  ["integration","Bảo vệ thử và tổng kết thiếu nền","Mock defense and gap review","Thuyết trình 5–7 phút, trả lời phản biện và tổng kết lỗi","Give a 5–7 minute talk, answer questions and review errors","Tự giải thích quyết định thiết kế và nêu giới hạn","Justify design choices and explain limitations","Slides + ghi âm bảo vệ thử","Slides and mock defense recording","защита · курсовая работа"],
];
export const survivalWeeks: readonly SurvivalWeek[] = seeds.map((seed, index) => {
  const [phase, viTitle, enTitle, viExercise, enExercise, viCheckpoint, enCheckpoint, viArtifact, enArtifact, terms] = seed;
  const number = index + 1;
  return {
    id: "iu5-pre24-w" + String(number).padStart(2, "0"),
    number,
    phase,
    title: {vi: viTitle, en: enTitle},
    exercise: {vi: viExercise, en: enExercise},
    checkpoint: {vi: viCheckpoint, en: enCheckpoint},
    artifact: {vi: viArtifact, en: enArtifact},
    russianTerms: terms.split(" · "),
    recommendedHours: phase === "integration" ? 10 : 8,
    targetCourseIds: survivalPhases[phase].courseIds,
  };
});

export function defaultSurvivalState(): SurvivalPersonalState {
  return { version: 2, variant: "compact12", selectedWeek: 1, availableHoursPerWeek: 8, exerciseDone: {}, evidence: {}, assessmentPlans: {} };
}

/** Defensive parsing; existing legacy 12-week data stays in its original v1 key. */
export function parseSurvivalState(raw: string | null): SurvivalPersonalState {
  const fallback = defaultSurvivalState();
  if (!raw) return fallback;
  try {
    const obj: unknown = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return fallback;
    const data = obj as Partial<SurvivalPersonalState>;
    if (data.version !== 2) return fallback;
    const ids = new Set(survivalWeeks.map(w => w.id));
    const exerciseDone: Record<string, boolean> = {};
    const evidence: Record<string, SurvivalEvidence> = {};
    if (data.exerciseDone && typeof data.exerciseDone === "object") {
      Object.entries(data.exerciseDone).forEach(([id, value]) => { if (ids.has(id) && value === true) exerciseDone[id] = true; });
    }
    if (data.evidence && typeof data.evidence === "object") {
      Object.entries(data.evidence).forEach(([id, value]) => {
        if (!ids.has(id) || !value || typeof value !== "object") return;
        const e = value as SurvivalEvidence;
        if (e.state !== "self_reported" && e.state !== "submitted" && e.state !== "not_assessed") return;
        evidence[id] = {state: e.state, note: typeof e.note === "string" ? e.note.slice(0, 1000) : ""};
      });
    }
    const assessmentPlans: Record<string, PersonalAssessment> = {};
    if (data.assessmentPlans && typeof data.assessmentPlans === "object") {
      Object.entries(data.assessmentPlans).forEach(([key, value]) => {
        if (!/^[a-z0-9-]{1,80}:(exam|rating-exam|credit|graded-credit|coursework|defense)$/.test(key) || !value || typeof value !== "object") return;
        const p = value as PersonalAssessment;
        assessmentPlans[key] = {
          dueDate: typeof p.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.dueDate) ? p.dueDate : "",
          status: p.status === "working" || p.status === "self_done" ? p.status : "planned",
          note: typeof p.note === "string" ? p.note.slice(0, 300) : "",
        };
      });
    }
    return {
      version: 2,
      variant: data.variant === "standard24" ? "standard24" : "compact12",
      selectedWeek: Number.isInteger(data.selectedWeek) ? Math.min(24, Math.max(1, data.selectedWeek as number)) : 1,
      availableHoursPerWeek: Number.isFinite(data.availableHoursPerWeek)
        ? Math.min(40, Math.max(1, data.availableHoursPerWeek as number)) : 8,
      exerciseDone,
      evidence,
      assessmentPlans,
    };
  } catch {
    return fallback;
  }
}

export function weekEvidenceSummary(state: SurvivalPersonalState) {
  return {
    practiced: survivalWeeks.filter(w => state.exerciseDone[w.id] === true).length,
    evidenceSubmitted: survivalWeeks.filter(w => state.evidence[w.id]?.state === "submitted").length,
    verified: 0, // This tool has no authorized independent assessment verifier.
  };
}


/** Required assessment deliverables from existing curriculum entries (not actual exam dates). */
export function courseAssessmentParts(course: Pick<Course, "id" | "assessment">): readonly AssessmentKind[] {
  switch (course.assessment) {
    case "exam": return ["exam"];
    case "rating-exam": return ["rating-exam"];
    case "credit": return ["credit"];
    case "graded-credit": return ["graded-credit"];
    case "exam-coursework": return ["exam", "coursework"];
    case "credit-coursework": return ["credit", "coursework"];
    case "coursework": return ["coursework"];
    case "defense": return ["defense"];
    default: return [];
  }
}

/** Personal-date collision only. No official Bauman timetable source is implied. */
export function personalDeadlineCollisions(plans: Record<string, PersonalAssessment>): readonly string[] {
  const dates = new Map<string, number>();
  for (const item of Object.values(plans)) {
    if (!item.dueDate || item.status === "self_done") continue;
    dates.set(item.dueDate, (dates.get(item.dueDate) || 0) + 1);
  }
  return [...dates].filter(([, count]) => count >= 2).map(([date]) => date).sort();
}
