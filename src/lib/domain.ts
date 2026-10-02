import Decimal from "decimal.js";

export type Role = "teacher" | "committee" | "office" | "admin";
export type Status =
  | "draft"
  | "peer-reviewed"
  | "submitted"
  | "reviewing"
  | "released"
  | "withdrawn";
export type RTTI = "R" | "T1" | "T2" | "I";
export const CATEGORIES: RTTI[] = ["R", "T1", "T2", "I"];
export interface Actor {
  id: string;
  role: Role;
  teamIds: string[];
}
export interface PTA {
  schoolYear: string;
  programme: string;
  subject: string;
  code: string;
  material: string;
  duration: number;
  aids: string;
  weight: string;
  scheduled: string;
  resit: boolean;
  referenceFileId?: string;
}
export interface Goal {
  id: string;
  domain: string;
  description: string;
}
export interface MatrixVersion {
  version: number;
  goals?: Goal[];
  cells: Record<string, Record<RTTI, number>>;
  establishedBy?: string;
  establishedAt?: string;
}
export interface ChecklistItem {
  id: string;
  text: string;
  explanation: string;
  required: boolean;
  active: boolean;
}
export interface Template {
  id: string;
  version: number;
  title: string;
  items: ChecklistItem[];
  publishedAt?: string;
}
export interface Question {
  id: string;
  text: string;
  options: string[];
  correct: number;
  points: number;
  category: RTTI;
  allocations: Record<string, number>;
  rationale: string;
  passage: string;
}
export interface Finding {
  id: string;
  text: string;
  createdBy: string;
  createdAt: string;
  state: "open" | "resolved" | "closed";
  resolution?: string;
  closedBy?: string;
}
export interface Review {
  reviewerId: string;
  sectionVersion: number;
  templateVersion: number;
  templateId: string;
  answers: Record<string, boolean>;
  at: string;
}
export interface Section {
  id: string;
  title: string;
  text: string;
  source: string;
  authorId: string;
  reviewerId: string;
  contributors: string[];
  version: number;
  questions: Question[];
  review?: Review;
  findings: Finding[];
}
export interface Event {
  at: string;
  actorId: string;
  action: string;
  detail?: string;
}
export interface GradeRow {
  score: number;
  grade: string;
}
export interface NTermLock {
  value: string;
  method: string;
  at: string;
  actorId: string;
}
export interface Snapshot {
  revision: number;
  submittedAt: string;
  submittedBy: string;
  maxScore: number;
  grades: GradeRow[];
  content: Omit<Exam, "snapshots">;
  releasedAt?: string;
  releasedBy?: string;
  withdrawnAt?: string;
  withdrawalReason?: string;
}
export interface Exam {
  id: string;
  title: string;
  teamId: string;
  revision: number;
  status: Status;
  pta: PTA;
  goals: Goal[];
  matrixVersions: MatrixVersion[];
  activeMatrixVersion: number;
  sections: Section[];
  sectionContributors?: Record<string, string[]>;
  template: Template;
  nTerm: string;
  nTermLock?: NTermLock;
  snapshots: Snapshot[];
  events: Event[];
  sourceExamId?: string;
  committeeFindings: Finding[];
}
export const METHOD = "examenblad-boundaries-v1";
export function validNTerm(value: string): boolean {
  try {
    return value.trim() !== "" && new Decimal(value).isFinite();
  } catch {
    return false;
  }
}
export function calculateGrade(
  score: number,
  maximum: number,
  nTerm: string | number,
): string {
  if (
    !Number.isSafeInteger(maximum) ||
    maximum <= 0 ||
    !Number.isSafeInteger(score) ||
    score < 0 ||
    score > maximum ||
    !validNTerm(String(nTerm))
  )
    throw new Error("Ongeldige score of N-term");
  // Compare each half-step as integer/rational expressions. Division never occurs,
  // so recurring fractions and arbitrarily close decimal N-terms cannot flip a tie.
  const n = new Decimal(nTerm);
  const D = Decimal.clone({ precision: Math.max(64, n.sd() + 24) });
  const above = (tenths: number) => {
    // C >= (tenths - .5)/10. H >= threshold iff N*20L >= (2t-1)L - 180S.
    const thresholdNumerator = (2 * tenths - 1) * maximum;
    const head = new D(n)
      .mul(20 * maximum)
      .gte(thresholdNumerator - 180 * score);
    if (n.eq(1)) return head;
    if (n.gt(1))
      return (
        head &&
        20 * maximum + 360 * score >= thresholdNumerator &&
        110 * maximum + 90 * score >= thresholdNumerator
      );
    return (
      head ||
      20 * maximum + 90 * score >= thresholdNumerator ||
      -160 * maximum + 360 * score >= thresholdNumerator
    );
  };
  let rounded = 10;
  for (let tenths = 11; tenths <= 100; tenths++) {
    if (above(tenths)) rounded = tenths;
    else break;
  }
  return (rounded / 10).toFixed(1);
}
export function gradeTable(
  maximum: number,
  nTerm: string | number,
): GradeRow[] {
  if (!Number.isSafeInteger(maximum) || maximum <= 0 || maximum > 10000)
    throw new Error("Maximumscore moet tussen 1 en 10000 liggen");
  return Array.from({ length: maximum + 1 }, (_, score) => ({
    score,
    grade: calculateGrade(score, maximum, nTerm),
  }));
}
export function maximumScore(exam: Exam): number {
  return exam.sections
    .flatMap((s) => s.questions)
    .reduce((sum, q) => sum + q.points, 0);
}
export interface MatrixCell {
  goalId: string;
  category: RTTI;
  planned: number;
  actual: number;
  difference: number;
}
export function matrixComparison(exam: Exam): MatrixCell[] {
  const m = exam.matrixVersions.find(
    (m) => m.version === exam.activeMatrixVersion,
  );
  return exam.goals.flatMap((g) =>
    CATEGORIES.map((category) => {
      const planned = m?.cells[g.id]?.[category] ?? 0;
      const actual = exam.sections
        .flatMap((s) => s.questions)
        .filter((q) => q.category === category)
        .reduce((n, q) => n + (q.allocations[g.id] ?? 0), 0);
      return {
        goalId: g.id,
        category,
        planned,
        actual,
        difference: actual - planned,
      };
    }),
  );
}
export function validReview(s: Section, t: Template): boolean {
  const r = s.review;
  return (
    !!r &&
    r.reviewerId === s.reviewerId &&
    r.reviewerId !== s.authorId &&
    !s.contributors.includes(r.reviewerId) &&
    r.sectionVersion === s.version &&
    r.templateVersion === t.version &&
    r.templateId === t.id &&
    t.items
      .filter((i) => i.active && i.required)
      .every((i) => r.answers[i.id] === true) &&
    s.findings.every((f) => f.state === "closed")
  );
}
export function validateExam(e: Exam, requireReviews = true): string[] {
  const errors: string[] = [];
  const add = (ok: boolean, message: string) => {
    if (!ok) errors.push(message);
  };
  add(!!e.title.trim(), "Examentitel ontbreekt");
  for (const k of [
    "schoolYear",
    "programme",
    "subject",
    "code",
    "material",
    "aids",
    "weight",
    "scheduled",
  ] as const)
    add(!!e.pta[k]?.trim(), `PTA: ${k} ontbreekt`);
  add(
    Number.isSafeInteger(e.pta.duration) && e.pta.duration > 0,
    "PTA: ongeldige duur",
  );
  add(
    e.goals.length > 0 &&
      new Set(e.goals.map((g) => g.id)).size === e.goals.length &&
      e.goals.every((g) => !!g.domain.trim() && !!g.description.trim()),
    "Leerdoelen ontbreken of zijn ongeldig",
  );
  const matrix = e.matrixVersions.find(
    (m) => m.version === e.activeMatrixVersion,
  );
  add(!!matrix?.establishedAt, "Matrijs is niet vastgesteld");
  add(
    !!matrix &&
      e.goals.every((g) =>
        CATEGORIES.every(
          (c) =>
            Number.isSafeInteger(matrix.cells[g.id]?.[c]) &&
            matrix.cells[g.id][c] >= 0,
        ),
      ) &&
      Object.keys(matrix.cells).every((id) => e.goals.some((g) => g.id === id)),
    "Matrijscellen zijn ongeldig",
  );
  add(validNTerm(e.nTerm), "Ongeldige N-term");
  add(!e.nTermLock || e.nTerm === e.nTermLock.value, "N-term is vergrendeld");
  add(e.sections.length > 0, "Geen onderdelen");
  add(
    maximumScore(e) > 0 && maximumScore(e) <= 10000,
    "Maximumscore moet tussen 1 en 10000 liggen",
  );
  for (const s of e.sections) {
    add(
      !!s.title.trim() && !!s.text.trim() && !!s.source.trim(),
      `Onderdeel ${s.title}: tekst of bron ontbreekt`,
    );
    add(
      !!s.authorId &&
        !!s.reviewerId &&
        s.authorId !== s.reviewerId &&
        !s.contributors.includes(s.reviewerId),
      `Onderdeel ${s.title}: onafhankelijke reviewer vereist`,
    );
    add(s.questions.length > 0, `Onderdeel ${s.title}: geen vragen`);
    for (const q of s.questions) {
      add(
        !!q.text.trim() && !!q.rationale.trim() && !!q.passage.trim(),
        "Vraag, onderbouwing of tekstpassage ontbreekt",
      );
      add(
        q.options.length >= 2 &&
          q.options.every((o) => !!o.trim()) &&
          Number.isInteger(q.correct) &&
          q.correct >= 0 &&
          q.correct < q.options.length,
        "Precies één geldig antwoord vereist",
      );
      add(
        Number.isSafeInteger(q.points) && q.points > 0,
        "Vraagpunten moeten positieve gehele getallen zijn",
      );
      add(CATEGORIES.includes(q.category), "Ongeldige RTTI-categorie");
      add(
        Object.keys(q.allocations).length > 0 &&
          Object.entries(q.allocations).every(
            ([id, p]) =>
              e.goals.some((g) => g.id === id) &&
              Number.isSafeInteger(p) &&
              p >= 0,
          ) &&
          Object.values(q.allocations).reduce((a, b) => a + b, 0) === q.points,
        "Puntentoedeling moet exact gelijk zijn aan de vraagscore",
      );
    }
    add(
      s.findings.every((f) => f.state === "closed"),
      "Open collegiale bevindingen",
    );
    if (requireReviews)
      add(
        validReview(s, e.template),
        `Onderdeel ${s.title}: geldige collegiale controle ontbreekt`,
      );
  }
  add(
    matrixComparison(e).every((c) => c.difference === 0),
    "Examen wijkt af van de vastgestelde matrijs",
  );
  add(
    e.committeeFindings.every((f) => f.state !== "open"),
    "Open commissiebevindingen",
  );
  return errors;
}
export type Action =
  | {
      type: "update";
      title?: string;
      pta?: PTA;
      goals?: Goal[];
      nTerm?: string;
    }
  | { type: "save-section"; section: Section }
  | {
      type: "assign-section";
      sectionId: string;
      authorId: string;
      reviewerId: string;
      title?: string;
    }
  | { type: "remove-section"; sectionId: string }
  | { type: "reorder"; sectionIds: string[] }
  | { type: "save-matrix"; cells: MatrixVersion["cells"] }
  | { type: "establish-matrix" }
  | { type: "switch-template"; template: Template }
  | { type: "review"; sectionId: string; answers: Record<string, boolean> }
  | { type: "finding"; sectionId?: string; text: string }
  | {
      type: "resolve-finding";
      sectionId?: string;
      findingId: string;
      resolution: string;
    }
  | { type: "close-finding"; sectionId: string; findingId: string }
  | { type: "withdraw-revision"; revision: number; reason: string }
  | { type: "submit" }
  | { type: "start-review" }
  | { type: "release" }
  | { type: "return"; reason: string }
  | { type: "withdraw"; reason: string }
  | { type: "new-revision" };
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function applyAction(
  input: Exam,
  actor: Actor,
  action: Action,
  now = new Date().toISOString(),
): Exam {
  assertActionShape(action);
  const e = structuredClone(input);
  e.sectionContributors ??= {};
  for (const s of e.sections)
    e.sectionContributors[s.id] = [
      ...new Set([...(e.sectionContributors[s.id] ?? []), ...s.contributors]),
    ];
  const teacher = actor.role === "teacher" && actor.teamIds.includes(e.teamId);
  const committee = actor.role === "committee";
  const editable = e.status === "draft" || e.status === "peer-reviewed";
  const editing = [
    "update",
    "save-section",
    "assign-section",
    "remove-section",
    "reorder",
    "save-matrix",
    "establish-matrix",
    "switch-template",
    "review",
    "close-finding",
    "submit",
  ].includes(action.type);
  if (editing) {
    assert(teacher, "Alleen docenten van dit team hebben toegang");
    assert(editable, "Deze examenversie is niet bewerkbaar");
  }
  const section = (id: string) => {
    const s = e.sections.find((s) => s.id === id);
    assert(s, "Onderdeel niet gevonden");
    return s;
  };
  const invalidate = () => {
    e.status = "draft";
  };
  switch (action.type) {
    case "update":
      if (action.nTerm !== undefined) {
        assert(validNTerm(action.nTerm), "Ongeldige N-term");
        assert(
          !e.nTermLock || action.nTerm === e.nTermLock.value,
          "N-term is definitief vergrendeld",
        );
        e.nTerm = action.nTerm;
      }
      if (action.title !== undefined) e.title = action.title;
      if (action.pta) e.pta = action.pta;
      if (action.goals) {
        e.goals = structuredClone(action.goals);
        const old = e.matrixVersions.find(
          (m) => m.version === e.activeMatrixVersion,
        );
        const version =
          Math.max(0, ...e.matrixVersions.map((m) => m.version)) + 1;
        e.matrixVersions.push({
          version,
          goals: structuredClone(e.goals),
          cells: Object.fromEntries(
            e.goals.map((g) => [
              g.id,
              structuredClone(old?.cells[g.id] ?? { R: 0, T1: 0, T2: 0, I: 0 }),
            ]),
          ),
        });
        e.activeMatrixVersion = version;
      }
      e.sections.forEach((s) => {
        delete s.review;
      });
      invalidate();
      break;
    case "save-section": {
      const old = e.sections.find((s) => s.id === action.section.id);
      assert(
        old ? old.authorId === actor.id : action.section.authorId === actor.id,
        "Alleen de toegewezen auteur mag inhoud bewerken",
      );
      const s = structuredClone(action.section);
      s.version = (old?.version ?? 0) + 1;
      s.contributors = [
        ...new Set([
          ...(e.sectionContributors?.[s.id] ?? []),
          ...(old?.contributors ?? []),
          actor.id,
        ]),
      ];
      e.sectionContributors![s.id] = s.contributors;
      s.findings = old?.findings ?? [];
      delete s.review;
      assert(
        s.authorId !== s.reviewerId && !s.contributors.includes(s.reviewerId),
        "Een bijdrager kan het eigen werk niet controleren",
      );
      if (old) e.sections[e.sections.indexOf(old)] = s;
      else e.sections.push(s);
      invalidate();
      break;
    }
    case "assign-section": {
      const old = e.sections.find((s) => s.id === action.sectionId);
      const contributors =
        e.sectionContributors?.[action.sectionId] ?? old?.contributors ?? [];
      assert(
        action.authorId !== action.reviewerId &&
          !contributors.includes(action.reviewerId),
        "Een bijdrager kan het eigen werk niet controleren",
      );
      if (old) {
        old.authorId = action.authorId;
        old.reviewerId = action.reviewerId;
        old.version++;
        delete old.review;
      } else
        e.sections.push({
          id: action.sectionId,
          title: action.title ?? "Nieuw onderdeel",
          text: "",
          source: "",
          authorId: action.authorId,
          reviewerId: action.reviewerId,
          contributors: [...contributors],
          version: 1,
          questions: [],
          findings: [],
        });
      invalidate();
      break;
    }
    case "remove-section":
      e.sections = e.sections.filter((s) => s.id !== action.sectionId);
      invalidate();
      break;
    case "reorder":
      assert(
        action.sectionIds.length === e.sections.length &&
          new Set(action.sectionIds).size === e.sections.length &&
          action.sectionIds.every((id) => e.sections.some((s) => s.id === id)),
        "Ongeldige volgorde",
      );
      e.sections = action.sectionIds.map(section);
      e.sections.forEach((s) => {
        delete s.review;
      });
      invalidate();
      break;
    case "save-matrix": {
      const version =
        Math.max(0, ...e.matrixVersions.map((m) => m.version)) + 1;
      e.matrixVersions.push({
        version,
        goals: structuredClone(e.goals),
        cells: structuredClone(action.cells),
      });
      e.activeMatrixVersion = version;
      invalidate();
      break;
    }
    case "establish-matrix": {
      const m = e.matrixVersions.find(
        (m) => m.version === e.activeMatrixVersion,
      );
      assert(m, "Matrijs ontbreekt");
      assert(
        e.goals.length > 0 &&
          e.goals.every((g) =>
            CATEGORIES.every(
              (c) =>
                Number.isSafeInteger(m.cells[g.id]?.[c]) &&
                m.cells[g.id][c] >= 0,
            ),
          ) &&
          Object.keys(m.cells).every((id) => e.goals.some((g) => g.id === id)),
        "Ongeldige matrijs",
      );
      assert(
        Object.values(m.cells)
          .flatMap(Object.values)
          .reduce((a, b) => a + b, 0) > 0,
        "Lege matrijs",
      );
      assert(!m.establishedAt, "Matrijs is al vastgesteld");
      m.goals = structuredClone(e.goals);
      m.establishedBy = actor.id;
      m.establishedAt = now;
      break;
    }
    case "switch-template":
      assert(
        action.template.publishedAt &&
          action.template.items.some((i) => i.active && i.required),
        "Gepubliceerde template met verplichte controle vereist",
      );
      e.template = structuredClone(action.template);
      e.sections.forEach((s) => {
        delete s.review;
      });
      invalidate();
      break;
    case "review": {
      const s = section(action.sectionId);
      assert(
        s.reviewerId === actor.id &&
          s.authorId !== actor.id &&
          !s.contributors.includes(actor.id),
        "Eigen werk controleren is niet toegestaan",
      );
      assert(
        e.template.items
          .filter((i) => i.active && i.required)
          .every((i) => action.answers[i.id] === true),
        "Verplichte checklist is niet afgehandeld",
      );
      assert(
        s.findings.every((f) => f.state === "closed"),
        "Open bevindingen blokkeren controle",
      );
      s.review = {
        reviewerId: actor.id,
        sectionVersion: s.version,
        templateVersion: e.template.version,
        templateId: e.template.id,
        answers: structuredClone(action.answers),
        at: now,
      };
      if (e.sections.every((s) => validReview(s, e.template)))
        e.status = "peer-reviewed";
      break;
    }
    case "finding": {
      assert(action.text.trim(), "Bevinding ontbreekt");
      const f: Finding = {
        id: crypto.randomUUID(),
        text: action.text,
        createdBy: actor.id,
        createdAt: now,
        state: "open",
      };
      if (action.sectionId) {
        assert(teacher && editable, "Geen toegang");
        const s = section(action.sectionId);
        assert(
          s.reviewerId === actor.id && !s.contributors.includes(actor.id),
          "Alleen onafhankelijke reviewer",
        );
        s.findings.push(f);
        delete s.review;
        invalidate();
      } else {
        assert(
          committee && ["submitted", "reviewing"].includes(e.status),
          "Geen commissiebeoordeling actief",
        );
        e.committeeFindings.push(f);
      }
      break;
    }
    case "resolve-finding": {
      assert(teacher && editable, "Geen toegang");
      const s = action.sectionId ? section(action.sectionId) : undefined;
      const f = (s?.findings ?? e.committeeFindings).find(
        (f) => f.id === action.findingId,
      );
      assert(f && f.state === "open", "Open bevinding niet gevonden");
      assert(
        !s || s.authorId === actor.id,
        "Alleen de auteur verwerkt de bevinding",
      );
      assert(action.resolution.trim(), "Beschrijf de oplossing");
      f.state = "resolved";
      f.resolution = action.resolution;
      break;
    }
    case "close-finding": {
      const s = section(action.sectionId);
      assert(
        s.reviewerId === actor.id && !s.contributors.includes(actor.id),
        "Alleen onafhankelijke reviewer",
      );
      const f = s.findings.find((f) => f.id === action.findingId);
      assert(f && f.state === "resolved", "Bevinding is nog niet opgelost");
      f.state = "closed";
      f.closedBy = actor.id;
      break;
    }
    case "submit": {
      const errors = validateExam(e);
      assert(errors.length === 0, errors.join("; "));
      e.nTermLock ??= {
        value: e.nTerm,
        method: METHOD,
        at: now,
        actorId: actor.id,
      };
      e.status = "submitted";
      const { snapshots, ...content } = structuredClone(e);
      e.snapshots.push({
        revision: e.revision,
        submittedAt: now,
        submittedBy: actor.id,
        maxScore: maximumScore(e),
        grades: gradeTable(maximumScore(e), e.nTerm),
        content,
      });
      break;
    }
    case "start-review":
      assert(
        committee && e.status === "submitted",
        "Alleen commissie kan de ingediende versie beoordelen",
      );
      e.status = "reviewing";
      break;
    case "release": {
      assert(
        committee && ["submitted", "reviewing"].includes(e.status),
        "Alleen commissie kan ingediende examens vrijgeven",
      );
      const errors = validateExam(e);
      assert(errors.length === 0, errors.join("; "));
      assert(e.nTermLock, "Normering ontbreekt");
      const s = e.snapshots.find((s) => s.revision === e.revision);
      assert(s, "Ingediende versie ontbreekt");
      s.releasedAt = now;
      s.releasedBy = actor.id;
      e.committeeFindings.forEach((f) => {
        if (f.state === "resolved") {
          f.state = "closed";
          f.closedBy = actor.id;
        }
      });
      e.status = "released";
      break;
    }
    case "return":
      assert(
        committee && ["submitted", "reviewing"].includes(e.status),
        "Geen ingediende versie",
      );
      assert(action.reason.trim(), "Reden is verplicht");
      e.committeeFindings.push({
        id: crypto.randomUUID(),
        text: action.reason,
        createdAt: now,
        createdBy: actor.id,
        state: "open",
      });
      e.revision++;
      e.status = "draft";
      break;
    case "withdraw-revision": {
      assert(committee, "Alleen commissie kan vrijgave intrekken");
      assert(action.reason.trim(), "Reden is verplicht");
      const s = e.snapshots.find((s) => s.revision === action.revision);
      assert(
        s?.releasedAt && !s.withdrawnAt,
        "Vrijgegeven versie ontbreekt of is al ingetrokken",
      );
      s.withdrawnAt = now;
      s.withdrawalReason = action.reason;
      if (e.revision === action.revision && e.status === "released")
        e.status = "withdrawn";
      break;
    }
    case "withdraw": {
      assert(
        committee && e.status === "released",
        "Alleen commissie kan vrijgave intrekken",
      );
      assert(action.reason.trim(), "Reden is verplicht");
      const s = e.snapshots.find((s) => s.revision === e.revision);
      assert(s, "Versie ontbreekt");
      s.withdrawnAt = now;
      s.withdrawalReason = action.reason;
      e.status = "withdrawn";
      break;
    }
    case "new-revision":
      assert(
        teacher && ["released", "withdrawn"].includes(e.status),
        "Nieuwe revisie niet toegestaan",
      );
      e.revision++;
      e.status = "draft";
      break;
    default:
      throw new Error("Onbekende examenactie");
  }
  e.events.push({
    at: now,
    actorId: actor.id,
    action: action.type,
    detail: "reason" in action ? action.reason : undefined,
  });
  return e;
}
export function copyExam(
  source: Exam,
  actor: Actor,
  template: Template,
  id: string = crypto.randomUUID(),
): Exam {
  assert(
    actor.role === "teacher" && actor.teamIds.includes(source.teamId),
    "Geen toegang",
  );
  const e = structuredClone(source);
  e.id = id;
  e.title = `${source.title} — kopie`;
  e.sourceExamId = source.id;
  e.revision = 1;
  e.status = "draft";
  e.snapshots = [];
  e.events = [];
  e.committeeFindings = [];
  delete e.nTermLock;
  e.template = structuredClone(template);
  e.matrixVersions = [
    {
      version: 1,
      cells: structuredClone(
        source.matrixVersions.find(
          (m) => m.version === source.activeMatrixVersion,
        )?.cells ?? {},
      ),
    },
  ];
  e.activeMatrixVersion = 1;
  e.sections.forEach((s) => {
    delete s.review;
    s.findings = [];
    s.version = 1;
  });
  return e;
}
export const DEFAULT_TEMPLATE: Template = {
  id: "standard",
  version: 1,
  title: "Inhoudelijke collegiale controle",
  publishedAt: "2026-01-01T00:00:00.000Z",
  items: [
    "De tekst, bronvermelding en afbeeldingen zijn volledig en leesbaar.",
    "De vraag is eenduidig en met de tekst te beantwoorden.",
    "Precies één antwoord is verdedigbaar; afleiders zijn plausibel en geven geen onbedoelde aanwijzingen.",
    "De onderbouwing en tekstpassage ondersteunen het juiste antwoord.",
    "Leerdoelen, RTTI-indeling en puntentoedeling passen inhoudelijk bij de vraag.",
    "Taalniveau, omvang en beschikbare examentijd passen bij de doelgroep en het PTA.",
    "Nummering, instructies en paginaopmaak zijn bruikbaar voor afname.",
  ].map((text, i) => ({
    id: `check-${i + 1}`,
    text,
    explanation:
      "Controleer dit punt inhoudelijk en leg eventuele bevindingen vast.",
    required: true,
    active: true,
  })),
};

export function createExam(
  id: string,
  teamId: string,
  title: string,
  template: Template = DEFAULT_TEMPLATE,
): Exam {
  return {
    id,
    teamId,
    title,
    revision: 1,
    status: "draft",
    pta: {
      schoolYear: "2026–2027",
      programme: "vmbo-tl / vavo",
      subject: "Engels",
      code: "",
      material: "",
      duration: 60,
      aids: "Woordenboek Engels–Nederlands",
      weight: "",
      scheduled: "",
      resit: true,
    },
    goals: [],
    matrixVersions: [{ version: 1, cells: {} }],
    activeMatrixVersion: 1,
    sections: [],
    template: structuredClone(template),
    nTerm: "1",
    snapshots: [],
    events: [],
    committeeFindings: [],
  };
}

/** Runtime boundary: JSON input must not corrupt a document before semantic validation. */
export function assertActionShape(action: unknown): asserts action is Action {
  const obj = (v: unknown): v is Record<string, any> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const strings = (v: Record<string, any>, keys: string[]) =>
    keys.every((k) => typeof v[k] === "string");
  assert(
    obj(action) && typeof action.type === "string",
    "Ongeldige examenactie",
  );
  const a = action;
  const integer = (n: unknown) => Number.isSafeInteger(n);
  if (a.type === "update") {
    for (const k of ["title", "nTerm"])
      assert(
        a[k] === undefined || typeof a[k] === "string",
        "Ongeldig tekstveld",
      );
    if (a.pta !== undefined)
      assert(
        obj(a.pta) &&
          strings(a.pta, [
            "schoolYear",
            "programme",
            "subject",
            "code",
            "material",
            "aids",
            "weight",
            "scheduled",
          ]) &&
          integer(a.pta.duration) &&
          typeof a.pta.resit === "boolean" &&
          (a.pta.referenceFileId === undefined ||
            typeof a.pta.referenceFileId === "string"),
        "Ongeldige PTA-gegevens",
      );
    if (a.goals !== undefined)
      assert(
        Array.isArray(a.goals) &&
          a.goals.every(
            (g: unknown) =>
              obj(g) &&
              strings(g, ["id", "domain", "description"]) &&
              g.id.length > 0,
          ) &&
          new Set(a.goals.map((g: any) => g.id)).size === a.goals.length,
        "Ongeldige leerdoelen",
      );
  } else if (a.type === "assign-section") {
    assert(
      strings(a, ["sectionId", "authorId", "reviewerId"]) &&
        a.sectionId.length > 0 &&
        (a.title === undefined || typeof a.title === "string"),
      "Ongeldige taakverdeling",
    );
  } else if (a.type === "save-section") {
    const s = a.section;
    assert(
      obj(s) &&
        strings(s, [
          "id",
          "title",
          "text",
          "source",
          "authorId",
          "reviewerId",
        ]) &&
        s.id.length > 0 &&
        Array.isArray(s.questions),
      "Ongeldig onderdeel",
    );
    assert(
      s.questions.every(
        (q: unknown) =>
          obj(q) &&
          strings(q, ["id", "text", "category", "rationale", "passage"]) &&
          q.id.length > 0 &&
          Array.isArray(q.options) &&
          q.options.every((o: unknown) => typeof o === "string") &&
          integer(q.correct) &&
          integer(q.points) &&
          obj(q.allocations) &&
          Object.values(q.allocations).every(integer),
      ),
      "Ongeldige vraaggegevens",
    );
    assert(
      new Set(s.questions.map((q: any) => q.id)).size === s.questions.length,
      "Dubbele vraagidentificatie",
    );
  } else if (a.type === "save-matrix") {
    assert(
      obj(a.cells) &&
        Object.values(a.cells).every(
          (v: unknown) =>
            obj(v) && CATEGORIES.every((c) => integer(v[c]) && v[c] >= 0),
        ),
      "Ongeldige matrijscellen",
    );
  } else if (a.type === "reorder")
    assert(
      Array.isArray(a.sectionIds) &&
        a.sectionIds.every((id: unknown) => typeof id === "string"),
      "Ongeldige volgorde",
    );
  else if (["remove-section", "review", "close-finding"].includes(a.type)) {
    assert(typeof a.sectionId === "string", "Onderdeel ontbreekt");
    if (a.type === "review")
      assert(
        obj(a.answers) &&
          Object.values(a.answers).every((v) => typeof v === "boolean"),
        "Ongeldige checklistantwoorden",
      );
    if (a.type === "close-finding")
      assert(typeof a.findingId === "string", "Bevinding ontbreekt");
  } else if (a.type === "finding")
    assert(
      typeof a.text === "string" &&
        (a.sectionId === undefined || typeof a.sectionId === "string"),
      "Ongeldige bevinding",
    );
  else if (a.type === "resolve-finding")
    assert(
      strings(a, ["findingId", "resolution"]) &&
        (a.sectionId === undefined || typeof a.sectionId === "string"),
      "Ongeldige oplossing",
    );
  else if (a.type === "withdraw-revision")
    assert(
      integer(a.revision) && a.revision > 0 && typeof a.reason === "string",
      "Ongeldige intrekking",
    );
  else if (a.type === "return" || a.type === "withdraw")
    assert(typeof a.reason === "string", "Reden ontbreekt");
  else if (a.type === "switch-template") {
    const t = a.template;
    assert(
      obj(t) &&
        strings(t, ["id", "title"]) &&
        integer(t.version) &&
        Array.isArray(t.items) &&
        t.items.every(
          (i: unknown) =>
            obj(i) &&
            strings(i, ["id", "text", "explanation"]) &&
            typeof i.active === "boolean" &&
            typeof i.required === "boolean",
        ),
      "Ongeldige checklisttemplate",
    );
  } else
    assert(
      [
        "establish-matrix",
        "submit",
        "start-review",
        "release",
        "new-revision",
      ].includes(a.type),
      "Onbekende examenactie",
    );
}
