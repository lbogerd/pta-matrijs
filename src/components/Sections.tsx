import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Check,
  ImagePlus,
  Italic,
  Lock,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  CATEGORIES,
  validReview,
  type Exam,
  type Section,
  type Question,
} from "../lib/domain";
import { api, Badge, Button, Card, Empty, Field, Modal } from "./ui";
import { FindingRow } from "./ExamDetail";
import { LiveMatrix } from "./LiveMatrix";
export function Sections({
  exam,
  user,
  members,
  editable,
  reviewMode,
  act,
}: {
  exam: Exam;
  user: any;
  members: any[];
  editable: boolean;
  reviewMode: boolean;
  act: (a: any) => Promise<any>;
}) {
  const [editing, setEditing] = useState<Section | null>(null),
    [err, setErr] = useState(""),
    [assignment, setAssignment] = useState<any>(null);
  const teachers = members.filter((m) => !m.role || m.role === "teacher");
  async function edit(s: Section) {
    try {
      await api(`/exams/${exam.id}/lock`, "POST", { sectionId: s.id });
      setEditing(structuredClone(s));
      setErr("");
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <>
      {!editing && <LiveMatrix exam={exam} />}
      <Card
        title={reviewMode ? "Een tweede paar ogen" : "Teksten & vragen"}
        description={
          reviewMode
            ? `Checklistversie ${exam.template.version}. Een onafhankelijke collega controleert ieder onderdeel.`
            : "Verdeel het werk in teksten met bijbehorende vragen. Ieder onderdeel krijgt een auteur en reviewer."
        }
        action={
          editable &&
          !reviewMode && (
            <div className="inline-actions">
              <Button
                variant="secondary"
                onClick={() =>
                  setAssignment({
                    sectionId: crypto.randomUUID(),
                    title: "",
                    authorId: user.id,
                    reviewerId:
                      teachers.find((m) => m.id !== user.id)?.id || "",
                  })
                }
              >
                Werk toewijzen
              </Button>
              <Button
                onClick={() =>
                  edit({
                    id: crypto.randomUUID(),
                    title: "",
                    text: "<p></p>",
                    source: "",
                    authorId: user.id,
                    reviewerId:
                      teachers.find((m) => m.id !== user.id)?.id || "",
                    contributors: [],
                    version: 0,
                    questions: [],
                    findings: [],
                  })
                }
              >
                <Plus size={14} />
                Onderdeel toevoegen
              </Button>
            </div>
          )
        }
      >
        {err && <div className="alert error">{err}</div>}
        {editing ? (
          <SectionEditor
            exam={exam}
            section={editing}
            members={teachers}
            onCancel={async () => {
              await api(`/exams/${exam.id}/unlock`, "POST", {
                sectionId: editing.id,
              });
              setEditing(null);
            }}
            onSave={async (section) => {
              await act({ type: "save-section", section });
              await api(`/exams/${exam.id}/unlock`, "POST", {
                sectionId: section.id,
              });
              setEditing(null);
            }}
          />
        ) : exam.sections.length === 0 ? (
          <Empty title="Het eerste onderdeel wacht op je">
            <p>Begin met een tekst, voeg vragen toe en wijs een collega aan.</p>
          </Empty>
        ) : (
          exam.sections.map((s, i) => (
            <div className="section-card" key={s.id}>
              <div className="section-card-header">
                <span className="process-number">{i + 1}</span>
                <h3>{s.title}</h3>
                <Badge
                  status={validReview(s, exam.template) ? "released" : "draft"}
                >
                  {validReview(s, exam.template)
                    ? "Gecontroleerd"
                    : "Controle nodig"}
                </Badge>
                {editable && !reviewMode && (
                  <>
                    <button
                      className="icon-button"
                      aria-label="Onderdeel omhoog"
                      disabled={i === 0}
                      onClick={() => {
                        const ids = exam.sections.map((x) => x.id);
                        [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                        act({ type: "reorder", sectionIds: ids }).catch(
                          () => {},
                        );
                      }}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setAssignment({
                          sectionId: s.id,
                          title: s.title,
                          authorId: s.authorId,
                          reviewerId: s.reviewerId,
                        })
                      }
                    >
                      Toewijzen
                    </Button>
                    {s.authorId === user.id && (
                      <Button variant="secondary" onClick={() => edit(s)}>
                        Bewerken
                      </Button>
                    )}
                    <button
                      className="icon-button"
                      aria-label="Onderdeel verwijderen"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Dit onderdeel en de bijbehorende vragen verwijderen?",
                          )
                        )
                          act({
                            type: "remove-section",
                            sectionId: s.id,
                          }).catch(() => {});
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
              <div className="section-card-body">
                <p className="small-text">
                  Auteur:{" "}
                  {members.find((m) => m.id === s.authorId)?.name || s.authorId}{" "}
                  · Reviewer:{" "}
                  {members.find((m) => m.id === s.reviewerId)?.name ||
                    "Niet toegewezen"}{" "}
                  · {s.questions.length} vragen · versie {s.version}
                </p>
                <div
                  className="rich-content"
                  dangerouslySetInnerHTML={{ __html: s.text }}
                />
                <p className="small-text">Bron: {s.source}</p>
                {s.questions.map((q, j) => (
                  <div className="question-card" key={q.id}>
                    <h3>
                      {j + 1}. {q.text}
                    </h3>
                    <p className="small-text">
                      {q.points} punten · {q.category}
                    </p>
                    {q.options.map((o, k) => (
                      <div className="option-row small-text" key={k}>
                        <span className="option-letter">
                          {String.fromCharCode(65 + k)}
                        </span>
                        {o}
                        {q.correct === k && <Check size={12} />}
                      </div>
                    ))}
                    <p className="small-text">Onderbouwing: {q.rationale}</p>
                    <p className="small-text">Tekstpassage: {q.passage}</p>
                    <p className="small-text">
                      Doelen:{" "}
                      {Object.entries(q.allocations)
                        .map(
                          ([id, p]) =>
                            `${exam.goals.find((g) => g.id === id)?.description || id}: ${p} pt${p === 0 ? " (inhoudelijk betrokken)" : ""}`,
                        )
                        .join(" · ")}
                    </p>
                  </div>
                ))}
                {reviewMode && (
                  <ReviewPanel
                    exam={exam}
                    section={s}
                    user={user}
                    editable={editable}
                    act={act}
                  />
                )}
              </div>
            </div>
          ))
        )}
      </Card>
      {reviewMode && editable && (
        <Card
          title="Controletemplate"
          description="Dit examen houdt zijn eigen checklistversie. Overstappen maakt bestaande beoordelingen ongeldig."
        >
          <Button
            variant="secondary"
            onClick={() => {
              if (
                window.confirm(
                  "Overstappen naar de actuele checklist? Alle collegiale controles moeten opnieuw worden uitgevoerd.",
                )
              )
                act({ type: "switch-template" }).catch(() => {});
            }}
          >
            Actuele template overnemen
          </Button>
        </Card>
      )}
      {assignment && (
        <Modal
          title="Schrijfwerk toewijzen"
          onClose={() => setAssignment(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act({ type: "assign-section", ...assignment })
                .then(() => setAssignment(null))
                .catch(() => {});
            }}
          >
            <Field label="Onderdeeltitel">
              <input
                required
                value={assignment.title}
                onChange={(e) =>
                  setAssignment({ ...assignment, title: e.target.value })
                }
              />
            </Field>
            <div className="spacer" />
            <Field label="Toegewezen auteur">
              <select
                value={assignment.authorId}
                onChange={(e) =>
                  setAssignment({ ...assignment, authorId: e.target.value })
                }
              >
                {teachers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="spacer" />
            <Field label="Toegewezen reviewer">
              <select
                required
                value={assignment.reviewerId}
                onChange={(e) =>
                  setAssignment({ ...assignment, reviewerId: e.target.value })
                }
              >
                <option value="">Kies een reviewer</option>
                {teachers
                  .filter((m) => m.id !== assignment.authorId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="form-actions">
              <Button type="submit">Toewijzing opslaan</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function SectionEditor({
  exam,
  section,
  members,
  onCancel,
  onSave,
}: {
  exam: Exam;
  section: Section;
  members: any[];
  onCancel: () => void;
  onSave: (s: Section) => Promise<void>;
}) {
  const [s, setS] = useState(section),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const editor = useRef<HTMLDivElement>(null);
  const liveExam: Exam = {
    ...exam,
    sections: exam.sections.some((existing) => existing.id === s.id)
      ? exam.sections.map((existing) => (existing.id === s.id ? s : existing))
      : [...exam.sections, s],
  };
  function updateQ(q: Question) {
    setS({ ...s, questions: s.questions.map((x) => (x.id === q.id ? q : x)) });
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave({ ...s, text: editor.current?.innerHTML || s.text });
        } catch (e: any) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="alert">
        <Lock size={12} /> Dit onderdeel is tijdelijk voor jou vergrendeld. Sla
        binnen tien minuten op.
      </div>
      <LiveMatrix exam={liveExam} unsaved sticky />
      <div className="form-grid">
        <div className="full">
          <Field label="Titel van het onderdeel">
            <input
              required
              value={s.title}
              onChange={(e) => setS({ ...s, title: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Auteur">
          <select
            value={s.authorId}
            onChange={(e) => setS({ ...s, authorId: e.target.value })}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reviewer (andere docent)">
          <select
            required
            value={s.reviewerId}
            onChange={(e) => setS({ ...s, reviewerId: e.target.value })}
          >
            <option value="">Kies een reviewer</option>
            {members
              .filter(
                (m) => m.id !== s.authorId && !s.contributors.includes(m.id),
              )
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </Field>
        <div className="full">
          <Field label="Tekst met automatische alineanummers">
            <div className="rich-editor">
              <div className="rich-toolbar">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Vet"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => document.execCommand("bold")}
                >
                  <Bold size={14} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Cursief"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => document.execCommand("italic")}
                >
                  <Italic size={14} />
                </button>
                <label className="icon-button" title="Afbeelding toevoegen">
                  <ImagePlus size={15} />
                  <input
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const form = new FormData();
                      form.append("file", file);
                      form.append("examId", exam.id);
                      try {
                        const res = await fetch(
                          "/api/exams/" + exam.id + "/files",
                          { method: "POST", body: form },
                        );
                        const d = await res.json();
                        if (!res.ok)
                          throw new Error(d.error || "Upload mislukt");
                        editor.current?.focus();
                        document.execCommand(
                          "insertImage",
                          false,
                          "/api/files/" + (d.id || d.fileId),
                        );
                      } catch (e: any) {
                        setError(e.message);
                      }
                    }}
                  />
                </label>
              </div>
              <div
                role="textbox"
                aria-label="Onderdeeltekst"
                contentEditable
                suppressContentEditableWarning
                ref={editor}
                className="rich-content"
                dangerouslySetInnerHTML={{ __html: section.text }}
              />
            </div>
          </Field>
        </div>
        <div className="full">
          <Field label="Bronvermelding">
            <input
              required
              value={s.source}
              onChange={(e) => setS({ ...s, source: e.target.value })}
              placeholder="Auteur, titel, publicatie en datum"
            />
          </Field>
        </div>
      </div>
      <div className="spacer" />
      {s.questions.map((q, i) => (
        <div className="question-card" key={q.id}>
          <div className="question-heading">
            <h3>Vraag {i + 1}</h3>
            <div className="inline-actions">
              <button
                type="button"
                disabled={i === 0}
                className="icon-button"
                aria-label="Vraag omhoog"
                onClick={() => {
                  const qs = [...s.questions];
                  [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]];
                  setS({ ...s, questions: qs });
                }}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label="Vraag verwijderen"
                onClick={() =>
                  setS({
                    ...s,
                    questions: s.questions.filter((x) => x.id !== q.id),
                  })
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <Field label="Vraagtekst">
            <textarea
              required
              value={q.text}
              onChange={(e) => updateQ({ ...q, text: e.target.value })}
            />
          </Field>
          <div className="spacer" />
          <Field label="Antwoordopties — selecteer het juiste antwoord">
            <div>
              {q.options.map((o, j) => (
                <div className="option-row" key={j}>
                  <input
                    aria-label={`Antwoord ${String.fromCharCode(65 + j)} is juist`}
                    type="radio"
                    name={"answer-" + q.id}
                    checked={q.correct === j}
                    onChange={() => updateQ({ ...q, correct: j })}
                  />
                  <span className="option-letter">
                    {String.fromCharCode(65 + j)}
                  </span>
                  <input
                    required
                    aria-label={`Optie ${String.fromCharCode(65 + j)}`}
                    value={o}
                    onChange={(e) =>
                      updateQ({
                        ...q,
                        options: q.options.map((x, k) =>
                          k === j ? e.target.value : x,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    disabled={q.options.length <= 2}
                    className="icon-button"
                    aria-label="Optie verwijderen"
                    onClick={() =>
                      updateQ({
                        ...q,
                        options: q.options.filter((_, k) => k !== j),
                        correct:
                          q.correct === j
                            ? 0
                            : q.correct > j
                              ? q.correct - 1
                              : q.correct,
                      })
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                onClick={() => updateQ({ ...q, options: [...q.options, ""] })}
              >
                <Plus size={12} />
                Antwoordoptie
              </Button>
            </div>
          </Field>
          <div className="form-grid">
            <Field label="Vraagpunten">
              <input
                type="number"
                min={1}
                step={1}
                required
                value={q.points}
                onChange={(e) =>
                  updateQ({ ...q, points: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="RTTI-categorie">
              <select
                value={q.category}
                onChange={(e) =>
                  updateQ({ ...q, category: e.target.value as any })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="spacer" />
          <Field
            label="Punten per leerdoel"
            hint="Vink betrokken doelen aan. Nul punten betekent inhoudelijk betrokken zonder dubbeltelling."
          >
            <div>
              {exam.goals.map((g) => (
                <div className="allocation-row" key={g.id}>
                  <input
                    type="checkbox"
                    aria-label={`Koppel ${g.description}`}
                    checked={g.id in q.allocations}
                    onChange={(e) => {
                      const allocations = { ...q.allocations };
                      if (e.target.checked) allocations[g.id] = 0;
                      else delete allocations[g.id];
                      updateQ({ ...q, allocations });
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 11 }}>{g.description}</span>
                  {g.id in q.allocations && (
                    <input
                      aria-label={`Punten ${g.description}`}
                      type="number"
                      min={0}
                      step={1}
                      value={q.allocations[g.id]}
                      onChange={(e) =>
                        updateQ({
                          ...q,
                          allocations: {
                            ...q.allocations,
                            [g.id]: Number(e.target.value),
                          },
                        })
                      }
                    />
                  )}
                </div>
              ))}
              <p className="small-text">
                Toebedeeld:{" "}
                {Object.values(q.allocations).reduce((a, b) => a + b, 0)} van{" "}
                {q.points} punten
              </p>
            </div>
          </Field>
          <div className="spacer" />
          <div className="form-grid">
            <Field label="Onderbouwing juiste antwoord">
              <textarea
                required
                value={q.rationale}
                onChange={(e) => updateQ({ ...q, rationale: e.target.value })}
              />
            </Field>
            <Field label="Relevante tekstpassage">
              <textarea
                required
                value={q.passage}
                onChange={(e) => updateQ({ ...q, passage: e.target.value })}
              />
            </Field>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          setS({
            ...s,
            questions: [
              ...s.questions,
              {
                id: crypto.randomUUID(),
                text: "",
                options: ["", "", "", ""],
                correct: 0,
                points: 1,
                category: "R",
                allocations: {},
                rationale: "",
                passage: "",
              },
            ],
          })
        }
      >
        <Plus size={14} />
        Vraag toevoegen
      </Button>
      {error && <div className="alert error">{error}</div>}
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Annuleren
        </Button>
        <Button type="submit" loading={busy}>
          <Save size={14} />
          Onderdeel opslaan
        </Button>
      </div>
    </form>
  );
}
function ReviewPanel({
  exam,
  section: s,
  user,
  editable,
  act,
}: {
  exam: Exam;
  section: Section;
  user: any;
  editable: boolean;
  act: (a: any) => Promise<any>;
}) {
  const [answers, setAnswers] = useState<Record<string, boolean>>(
      s.review?.answers || {},
    ),
    [finding, setFinding] = useState("");
  const reviewer =
    editable && s.reviewerId === user.id && !s.contributors.includes(user.id);
  return (
    <>
      <div className="spacer" />
      <h3>Inhoudelijke controle</h3>
      {exam.template.items
        .filter((i) => i.active)
        .map((item) => (
          <label className="checklist-item" key={item.id}>
            <input
              disabled={!reviewer}
              type="checkbox"
              checked={answers[item.id] || false}
              onChange={(e) =>
                setAnswers({ ...answers, [item.id]: e.target.checked })
              }
            />
            <span>
              {item.text}
              <small>
                {item.required ? "Verplicht" : "Optioneel"} · {item.explanation}
              </small>
            </span>
          </label>
        ))}
      {s.findings.map((f) => (
        <FindingRow
          key={f.id}
          finding={f}
          editable={editable && s.authorId === user.id}
          onResolve={(resolution) =>
            act({
              type: "resolve-finding",
              sectionId: s.id,
              findingId: f.id,
              resolution,
            })
          }
          onClose={
            reviewer
              ? () =>
                  act({
                    type: "close-finding",
                    sectionId: s.id,
                    findingId: f.id,
                  })
              : undefined
          }
        />
      ))}
      {reviewer && (
        <>
          <div className="spacer" />
          <Field label="Nieuwe bevinding">
            <textarea
              value={finding}
              onChange={(e) => setFinding(e.target.value)}
              placeholder="Leg concreet vast wat moet worden verbeterd."
            />
          </Field>
          <div className="form-actions">
            <Button
              variant="secondary"
              disabled={!finding.trim()}
              onClick={() =>
                act({ type: "finding", sectionId: s.id, text: finding }).catch(
                  () => {},
                )
              }
            >
              Bevinding toevoegen
            </Button>
            <Button
              onClick={() =>
                act({ type: "review", sectionId: s.id, answers }).catch(
                  () => {},
                )
              }
            >
              <Check size={14} />
              Controle afronden
            </Button>
          </div>
        </>
      )}
      {!reviewer && !validReview(s, exam.template) && (
        <p className="small-text" style={{ marginTop: 15 }}>
          Alleen de toegewezen onafhankelijke reviewer kan deze controle
          afronden.
        </p>
      )}
    </>
  );
}
