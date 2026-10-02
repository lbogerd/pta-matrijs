import { useEffect, useState, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  FileText,
  Lock,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  api,
  Badge,
  Button,
  Card,
  Empty,
  ErrorMessage,
  Field,
  Modal,
  PageHeader,
  date,
} from "./ui";
import {
  CATEGORIES,
  gradeTable,
  maximumScore,
  matrixComparison,
  validNTerm,
  validateExam,
  type Exam,
  type PTA,
  type Goal,
  type MatrixVersion,
} from "../lib/domain";
import { Sections } from "./Sections";
type Model = Exam & { version: number };
export function ExamDetail({
  id,
  user,
  dashboard,
  onBack,
  onRefresh,
}: {
  id: string;
  user: any;
  dashboard: any;
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [data, setData] = useState<any>(null),
    [tab, setTab] = useState("pta"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function load() {
    setData(await api("/exams/" + id));
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);
  const exam: Model = data?.exam;
  const versionRef = useRef(0);
  versionRef.current = exam?.version || 0;
  async function act(action: any) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const d = await api("/exams/" + id, "POST", {
        version: versionRef.current,
        action,
      });
      if (action.type === "copy") {
        setNotice("De kopie staat in het examenoverzicht.");
        await onRefresh();
      } else {
        versionRef.current = d.exam.version;
        setData({ ...data, exam: d.exam });
        setNotice("Wijzigingen opgeslagen.");
      }
      return d.exam;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const run = (a: any) => void act(a).catch(() => {});
  if (!exam)
    return (
      <>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft size={14} />
          Terug
        </Button>
        <ErrorMessage message={error} />
        <Empty title="Examendossier laden…" />
      </>
    );
  if (user.role === "office")
    return <OfficeDetail exam={exam as any} onBack={onBack} />;
  const editable =
    user.role === "teacher" && ["draft", "peer-reviewed"].includes(exam.status);
  return (
    <>
      <Button
        variant="ghost"
        onClick={onBack}
        style={{ paddingLeft: 0, marginBottom: 20 }}
      >
        <ArrowLeft size={14} />
        Alle examens
      </Button>
      <PageHeader
        eyebrow={`Examendossier · versie ${exam.revision}`}
        title={exam.title}
      >
        <Badge status={exam.status} />
        {user.role === "teacher" && (
          <Button variant="secondary" onClick={() => run({ type: "copy" })}>
            <Copy size={14} />
            Kopiëren
          </Button>
        )}
      </PageHeader>
      <div className="detail-summary">
        <span>
          {exam.pta.subject || "Engels"} ·{" "}
          {exam.pta.programme || "Opleiding nog invullen"}
        </span>
        <span>{exam.pta.schoolYear || "Schooljaar nog invullen"}</span>
        <span>{maximumScore(exam)} punten</span>
        <span>Checklist v{exam.template.version}</span>
      </div>
      <div className="tabs">
        {[
          ["pta", "PTA & gegevens"],
          ["matrix", "Toetsmatrijs"],
          ["content", "Teksten & vragen"],
          ["review", "Collegiale controle"],
          ["grades", "Normering"],
          ["preview", "Pagina-preview"],
          ["publish", "Vaststelling & vrijgave"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <ErrorMessage message={error} />
      {notice && (
        <div className="alert" role="status">
          {notice}
        </div>
      )}
      {exam.status === "withdrawn" && (
        <div className="alert error">
          Dit examen is ingetrokken. Downloads zijn geblokkeerd.{" "}
          {
            exam.snapshots.find((s) => s.revision === exam.revision)
              ?.withdrawalReason
          }
        </div>
      )}
      {tab === "pta" && (
        <PTAEditor
          key={exam.version}
          exam={exam}
          editable={editable}
          act={act}
        />
      )}
      {tab === "matrix" && (
        <MatrixEditor
          key={exam.version}
          exam={exam}
          editable={editable}
          act={act}
        />
      )}
      {(tab === "content" || tab === "review") && (
        <Sections
          key={exam.version}
          exam={exam}
          user={user}
          members={data.members || dashboard.members || []}
          editable={editable}
          reviewMode={tab === "review"}
          act={act}
        />
      )}{" "}
      {tab === "grades" && (
        <Grades key={exam.version} exam={exam} editable={editable} act={act} />
      )}{" "}
      {tab === "preview" && user.role !== "office" && user.role !== "admin" && (
        <Preview exam={exam} />
      )}{" "}
      {tab === "publish" && (
        <Publish exam={exam} user={user} editable={editable} act={act} />
      )}{" "}
      {tab === "preview" && user.role === "office" && (
        <Empty title="Officiële bestanden">
          <p>De vrijgegeven bestanden staan onder Vaststelling & vrijgave.</p>
        </Empty>
      )}
      <div className="footer-note">
        <ShieldCheck size={12} />
        Wijzigingen worden vastgelegd. Eerdere examenversies blijven bewaard.
      </div>
    </>
  );
}
function PTAEditor({
  exam,
  editable,
  act,
}: {
  exam: Model;
  editable: boolean;
  act: (a: any) => Promise<any>;
}) {
  const [pta, setPta] = useState<PTA>(exam.pta),
    [title, setTitle] = useState(exam.title),
    [busy, setBusy] = useState(false);
  const change = (k: keyof PTA, v: any) => setPta({ ...pta, [k]: v });
  return (
    <Card
      title="De basis van je examen"
      description="Neem de gegevens handmatig over uit het PTA. De PTA-weging staat los van de vraagpunten."
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await act({ type: "update", pta, title });
          } catch {
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <div className="full">
            <Field label="Examentitel">
              <input
                disabled={!editable}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </Field>
          </div>
          {(
            [
              ["schoolYear", "Schooljaar", "2026–2027"],
              ["programme", "Opleiding", "Vavo vmbo-tl"],
              ["subject", "Vak", "Engels"],
              ["code", "PTA-onderdeelcode", "EN-SE1"],
              ["duration", "Duur (minuten)", "90"],
              ["weight", "Weging in het PTA", "25%"],
              ["scheduled", "Afnamemoment", "Periode 2"],
              [
                "aids",
                "Toegestane hulpmiddelen",
                "Woordenboek Engels–Nederlands",
              ],
            ] as const
          ).map(([key, label, placeholder]) => (
            <Field key={key} label={label}>
              <input
                disabled={!editable}
                type={key === "duration" ? "number" : "text"}
                min={1}
                value={pta[key]}
                placeholder={placeholder}
                onChange={(e) =>
                  change(
                    key,
                    key === "duration"
                      ? Number(e.target.value)
                      : e.target.value,
                  )
                }
                required
              />
            </Field>
          ))}
          <div className="full">
            <Field label="Leerstof">
              <textarea
                disabled={!editable}
                value={pta.material}
                onChange={(e) => change("material", e.target.value)}
                required
              />
            </Field>
          </div>
          <Field label="Herkansbaarheid">
            <select
              disabled={!editable}
              value={pta.resit ? "yes" : "no"}
              onChange={(e) => change("resit", e.target.value === "yes")}
            >
              <option value="yes">Herkansbaar</option>
              <option value="no">Niet herkansbaar</option>
            </select>
          </Field>
          <Field
            label="PTA-brondocument"
            hint="Het document wordt privé bewaard bij dit examen."
          >
            <input
              type="file"
              disabled={!editable}
              accept=".pdf,.docx,.png,.jpg,.jpeg"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const form = new FormData();
                form.append("file", file);
                form.append("examId", exam.id);
                try {
                  const res = await fetch("/api/exams/" + exam.id + "/files", {
                    method: "POST",
                    body: form,
                  });
                  const d = await res.json();
                  if (!res.ok) throw new Error(d.error || "Upload mislukt");
                  change("referenceFileId", d.id || d.fileId);
                } catch (e: any) {
                  window.alert(e.message);
                }
              }}
            />
            {pta.referenceFileId && (
              <a
                className="small-text"
                target="_blank"
                href={"/api/files/" + pta.referenceFileId}
              >
                Opgeslagen brondocument openen ↗
              </a>
            )}
          </Field>
        </div>
        {editable && (
          <div className="form-actions">
            <Button type="submit" loading={busy}>
              <Save size={14} />
              Gegevens opslaan
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}
function MatrixEditor({
  exam,
  editable,
  act,
}: {
  exam: Model;
  editable: boolean;
  act: (a: any) => Promise<any>;
}) {
  const [goals, setGoals] = useState<Goal[]>(exam.goals),
    [cells, setCells] = useState<MatrixVersion["cells"]>(
      structuredClone(
        exam.matrixVersions.find((m) => m.version === exam.activeMatrixVersion)
          ?.cells || {},
      ),
    ),
    [busy, setBusy] = useState(false);
  const matrix = exam.matrixVersions.find(
      (m) => m.version === exam.activeMatrixVersion,
    ),
    comparison = matrixComparison(exam);
  const total = Object.values(cells).reduce(
    (s, c) => s + Object.values(c).reduce((x, v) => x + v, 0),
    0,
  );
  return (
    <>
      <Card
        title="Een doelgerichte toetsmatrijs"
        description="Plan gehele punten per leerdoel en RTTI-categorie. Onder de invoer zie je de gerealiseerde punten."
        action={
          <Badge>
            {matrix?.establishedAt ? "Vastgesteld" : "Concept"} · v
            {exam.activeMatrixVersion}
          </Badge>
        }
      >
        <div className="table-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th>Domein & leerdoel</th>
                {CATEGORIES.map((c) => (
                  <th key={c}>{c}</th>
                ))}
                <th>Totaal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {goals.map((g) => (
                <tr key={g.id}>
                  <td style={{ minWidth: 210 }}>
                    <input
                      aria-label="Domein"
                      disabled={!editable}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        marginBottom: 6,
                      }}
                      placeholder="Domein"
                      value={g.domain}
                      onChange={(e) =>
                        setGoals(
                          goals.map((x) =>
                            x.id === g.id
                              ? { ...x, domain: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                    <input
                      aria-label="Leerdoel"
                      disabled={!editable}
                      style={{ width: "100%", textAlign: "left" }}
                      placeholder="Omschrijving leerdoel"
                      value={g.description}
                      onChange={(e) =>
                        setGoals(
                          goals.map((x) =>
                            x.id === g.id
                              ? { ...x, description: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </td>
                  {CATEGORIES.map((c) => {
                    const actual =
                        comparison.find(
                          (x) => x.goalId === g.id && x.category === c,
                        )?.actual || 0,
                      planned = cells[g.id]?.[c] || 0;
                    return (
                      <td key={c}>
                        <input
                          aria-label={`${g.description || "Leerdoel"} ${c}`}
                          type="number"
                          min={0}
                          step={1}
                          disabled={!editable}
                          value={planned}
                          onChange={(e) =>
                            setCells({
                              ...cells,
                              [g.id]: {
                                ...(cells[g.id] || {
                                  R: 0,
                                  T1: 0,
                                  T2: 0,
                                  I: 0,
                                }),
                                [c]: Number(e.target.value),
                              },
                            })
                          }
                        />
                        <span
                          className={`difference ${actual === planned ? "match" : ""}`}
                        >
                          {actual} gemaakt{" "}
                          {actual === planned
                            ? "✓"
                            : `(${actual - planned > 0 ? "+" : ""}${actual - planned})`}
                        </span>
                      </td>
                    );
                  })}
                  <td>
                    <strong>
                      {Object.values(cells[g.id] || {}).reduce(
                        (a, b) => a + b,
                        0,
                      )}
                    </strong>
                    <span className="difference">
                      {total
                        ? Math.round(
                            (Object.values(cells[g.id] || {}).reduce(
                              (a, b) => a + b,
                              0,
                            ) /
                              total) *
                              100,
                          )
                        : 0}
                      %
                    </span>
                  </td>
                  <td>
                    {editable && (
                      <button
                        aria-label="Leerdoel verwijderen"
                        className="icon-button"
                        onClick={() => {
                          setGoals(goals.filter((x) => x.id !== g.id));
                          const next = { ...cells };
                          delete next[g.id];
                          setCells(next);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {[...new Set(goals.map((g) => g.domain))]
                .filter(Boolean)
                .map((domain) => (
                  <tr key={domain} style={{ background: "#f8faf3" }}>
                    <td className="small-text">Domeintotaal · {domain}</td>
                    {CATEGORIES.map((c) => (
                      <td key={c}>
                        {goals
                          .filter((g) => g.domain === domain)
                          .reduce((sum, g) => sum + (cells[g.id]?.[c] || 0), 0)}
                      </td>
                    ))}
                    <td>
                      {goals
                        .filter((g) => g.domain === domain)
                        .reduce(
                          (sum, g) =>
                            sum +
                            Object.values(cells[g.id] || {}).reduce(
                              (a, b) => a + b,
                              0,
                            ),
                          0,
                        )}
                    </td>
                    <td />
                  </tr>
                ))}
              <tr className="matrix-total">
                <td>Totaal gepland</td>
                {CATEGORIES.map((c) => (
                  <td key={c}>
                    {Object.values(cells).reduce((s, x) => s + (x[c] || 0), 0)}
                  </td>
                ))}
                <td>{total}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {editable && (
          <div
            className="form-actions"
            style={{ justifyContent: "space-between" }}
          >
            <Button
              variant="secondary"
              onClick={() => {
                const id = crypto.randomUUID();
                setGoals([...goals, { id, domain: "", description: "" }]);
                setCells({ ...cells, [id]: { R: 0, T1: 0, T2: 0, I: 0 } });
              }}
            >
              <Plus size={14} />
              Leerdoel
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  let updated = exam;
                  if (JSON.stringify(goals) !== JSON.stringify(exam.goals))
                    updated = await act({ type: "update", goals });
                  await act({ type: "save-matrix", cells });
                } catch {
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Save size={14} />
              Nieuwe matrijsversie opslaan
            </Button>
          </div>
        )}
      </Card>
      <div className="split">
        <Card
          title="Vaststelling"
          description="Iedere docent van het team kan de matrijs vaststellen."
        >
          {matrix?.establishedAt ? (
            <p className="small-text">
              Versie {matrix.version} vastgesteld op{" "}
              {date(matrix.establishedAt)}. Wijzigingen worden als nieuwe
              conceptversie opgeslagen.
            </p>
          ) : (
            <>
              <p className="small-text">
                Sla de doelen en geplande punten eerst op. Na vaststelling moet
                het examen per cel exact aansluiten.
              </p>
              {editable && (
                <div className="form-actions">
                  <Button
                    onClick={() =>
                      act({ type: "establish-matrix" }).catch(() => {})
                    }
                  >
                    <Check size={14} />
                    Matrijs vaststellen
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
        <Card title="Versiegeschiedenis">
          {exam.matrixVersions
            .slice()
            .reverse()
            .map((m, i) => (
              <div className="version-list" key={m.version}>
                Versie {m.version} ·{" "}
                {m.establishedAt
                  ? `vastgesteld ${date(m.establishedAt)}`
                  : "concept"}{" "}
                ·{" "}
                {Object.values(m.cells)
                  .flatMap(Object.values)
                  .reduce((a, b) => a + b, 0)}{" "}
                punten
                {(() => {
                  const previous = exam.matrixVersions.find(
                    (p) => p.version === m.version - 1,
                  );
                  if (!previous) return null;
                  const changes = Object.entries(m.cells).flatMap(([id, cs]) =>
                    CATEGORIES.filter(
                      (c) => (previous.cells[id]?.[c] || 0) !== cs[c],
                    ).map(
                      (c) =>
                        `${m.goals?.find((g) => g.id === id)?.description || exam.goals.find((g) => g.id === id)?.description || "Leerdoel"} ${c}: ${previous.cells[id]?.[c] || 0} → ${cs[c]}`,
                    ),
                  );
                  return (
                    <p className="small-text">
                      {changes.length
                        ? changes.join(" · ")
                        : "Geen puntenverschil met de vorige versie."}
                    </p>
                  );
                })()}
              </div>
            ))}
        </Card>
      </div>
    </>
  );
}
function Grades({
  exam,
  editable,
  act,
}: {
  exam: Model;
  editable: boolean;
  act: (a: any) => Promise<any>;
}) {
  const [n, setN] = useState(exam.nTerm);
  const maximum = maximumScore(exam);
  const grades =
    maximum > 0 && maximum <= 10000 && validNTerm(n)
      ? gradeTable(maximum, n)
      : [];
  return (
    <Card
      title="Normering & score-cijfertabel"
      description="Hoofdrelatie met grensrelaties volgens de gekozen Examenblad-rekenmethode. Afronding op één decimaal."
    >
      <div className="form-grid">
        <Field
          label="N-term"
          hint={
            exam.nTermLock
              ? "Definitief vergrendeld bij de eerste teamvaststelling."
              : "Decimalen zijn toegestaan. De tabel wordt direct herberekend."
          }
        >
          <input
            aria-label="N-term"
            type="number"
            step="any"
            value={n}
            disabled={!editable || !!exam.nTermLock}
            onChange={(e) => setN(e.target.value)}
          />
        </Field>
        <Field label="Maximumscore">
          <input readOnly value={`${maximum} punten`} />
        </Field>
      </div>
      {exam.nTermLock && (
        <div className="alert">
          <Lock size={12} /> Vastgesteld op {date(exam.nTermLock.at)}. Deze
          N-term blijft ook bij nieuwe revisies gelijk.
        </div>
      )}
      {editable && !exam.nTermLock && (
        <div className="form-actions">
          <Button
            onClick={() => act({ type: "update", nTerm: n }).catch(() => {})}
          >
            N-term opslaan
          </Button>
        </div>
      )}
      <div className="spacer" />
      {grades.length ? (
        <div className="grade-grid">
          {grades.map((g) => (
            <div className="grade-cell" key={g.score}>
              <span>{g.score} pt</span>
              <strong>{g.grade.replace(".", ",")}</strong>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="Nog geen score-cijfertabel">
          <p>Voeg vragen met punten en een geldige N-term toe.</p>
        </Empty>
      )}
    </Card>
  );
}
function Preview({ exam }: { exam: Model }) {
  const [kind, setKind] = useState("exam");
  return (
    <Card
      title="Pagina-preview"
      description="Dezelfde opmaak wordt gebruikt voor de officiële publicatie."
      action={
        <select
          aria-label="Previewversie"
          style={{ width: 190 }}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="exam">Kandidatenexamen</option>
          <option value="answers">Correctiemodel</option>
        </select>
      }
    >
      <iframe
        title={
          kind === "exam"
            ? "Preview kandidatenexamen"
            : "Preview correctiemodel"
        }
        className="preview-frame"
        src={`/api/exams/${exam.id}/preview?kind=${kind}`}
      />
    </Card>
  );
}
function Publish({
  exam,
  user,
  editable,
  act,
}: {
  exam: Model;
  user: any;
  editable: boolean;
  act: (a: any) => Promise<any>;
}) {
  const [reason, setReason] = useState(""),
    [modal, setModal] = useState("");
  const errors = validateExam(exam);
  return (
    <>
      <Card
        title="Van gecontroleerd naar vrijgegeven"
        description="Elke beslissing hoort bij één vastgelegde examenversie."
      >
        <div className="inline-actions">
          <Badge status={exam.status} />
          <span className="small-text muted">
            Revisie {exam.revision} · {maximumScore(exam)} punten · N-term{" "}
            {exam.nTerm}
          </span>
        </div>
        {editable && (
          <>
            {errors.length ? (
              <div className="alert">
                <strong>Nog af te ronden</strong>
                <ul>
                  {errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="alert">
                Alle procescontroles zijn geslaagd. Het examen kan worden
                vastgesteld en ingediend.
              </div>
            )}
            <p className="small-text">
              Bij de eerste teamvaststelling wordt de N-term definitief
              vergrendeld. Controleer de volledige score-cijfertabel onder
              Normering voordat je indient.
            </p>
            <div className="form-actions">
              <Button
                disabled={errors.length > 0}
                onClick={() => setModal("submit")}
              >
                <ShieldCheck size={14} />
                Vaststellen & indienen
              </Button>
            </div>
          </>
        )}
        {user.role === "committee" &&
          ["submitted", "reviewing"].includes(exam.status) && (
            <>
              <div className="spacer" />
              <Field label="Commissiebevinding of reden">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Beschrijf je bevinding of de reden voor terugsturen."
                />
              </Field>
              <div className="form-actions">
                <Button
                  variant="secondary"
                  disabled={!reason.trim()}
                  onClick={() =>
                    act({ type: "finding", text: reason })
                      .then(() => setReason(""))
                      .catch(() => {})
                  }
                >
                  Bevinding toevoegen
                </Button>
                <Button
                  variant="secondary"
                  disabled={!reason.trim()}
                  onClick={() =>
                    act({ type: "return", reason }).catch(() => {})
                  }
                >
                  Terugsturen
                </Button>
                <Button
                  onClick={() => act({ type: "release" }).catch(() => {})}
                >
                  <Check size={14} />
                  Examen vrijgeven
                </Button>
              </div>
            </>
          )}
        {user.role === "committee" && exam.status === "released" && (
          <>
            <div className="spacer" />
            <Field label="Reden voor intrekken (verplicht)">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <div className="form-actions">
              <Button
                variant="danger"
                disabled={!reason.trim()}
                onClick={() => setModal("withdraw")}
              >
                Vrijgave intrekken
              </Button>
            </div>
          </>
        )}
        {user.role === "teacher" &&
          ["released", "withdrawn"].includes(exam.status) && (
            <div className="form-actions">
              <Button
                variant="secondary"
                onClick={() => act({ type: "new-revision" }).catch(() => {})}
              >
                Nieuwe conceptrevisie
              </Button>
            </div>
          )}
        {user.role === "office" &&
          (exam.status === "released" ? (
            <div className="form-actions">
              <a
                className="button secondary"
                href={`/api/exams/${exam.id}/download?kind=exam`}
              >
                <Download size={14} />
                Examen · PDF
              </a>
              <a
                className="button"
                href={`/api/exams/${exam.id}/download?kind=answers`}
              >
                <Download size={14} />
                Correctiemodel · PDF
              </a>
            </div>
          ) : (
            <div className="alert error">
              Dit examen is niet beschikbaar voor download.
            </div>
          ))}
      </Card>
      {exam.committeeFindings.length > 0 && (
        <Card title="Commissiebevindingen">
          {exam.committeeFindings.map((f) => (
            <FindingRow
              key={f.id}
              finding={f}
              editable={editable}
              onResolve={(resolution) =>
                act({ type: "resolve-finding", findingId: f.id, resolution })
              }
            />
          ))}
        </Card>
      )}
      {exam.snapshots.some((s) => s.releasedAt) && (
        <Card title="Gepubliceerde versies">
          {exam.snapshots
            .filter((s) => s.releasedAt)
            .map((s) => (
              <div className="admin-row" key={s.revision}>
                <div className="inline-actions">
                  <strong className="small-text">Revisie {s.revision}</strong>
                  <Badge status={s.withdrawnAt ? "withdrawn" : "released"} />
                  <span className="small-text muted">{date(s.releasedAt)}</span>
                </div>
                {s.withdrawnAt ? (
                  <p className="small-text">{s.withdrawalReason}</p>
                ) : (
                  <div className="form-actions">
                    {user.role === "office" && (
                      <>
                        <a
                          className="button secondary"
                          href={`/api/exams/${exam.id}/download?kind=exam&revision=${s.revision}`}
                        >
                          <Download size={14} />
                          Examen v{s.revision}
                        </a>
                        <a
                          className="button"
                          href={`/api/exams/${exam.id}/download?kind=answers&revision=${s.revision}`}
                        >
                          <Download size={14} />
                          Correctiemodel v{s.revision}
                        </a>
                      </>
                    )}
                    {user.role === "committee" && (
                      <Button
                        variant="danger"
                        onClick={() => {
                          const reason = window.prompt(
                            "Verplichte reden voor intrekken van revisie " +
                              s.revision,
                          );
                          if (reason?.trim())
                            act({
                              type: "withdraw-revision",
                              revision: s.revision,
                              reason,
                            }).catch(() => {});
                        }}
                      >
                        Versie {s.revision} intrekken
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
        </Card>
      )}
      <Card title="Dossierhistorie">
        {exam.events
          .slice()
          .reverse()
          .map((e, i) => (
            <div className="admin-row small-text" key={i}>
              <strong>
                {(
                  {
                    update: "Gegevens gewijzigd",
                    "save-section": "Onderdeel opgeslagen",
                    "save-matrix": "Nieuwe matrijsversie",
                    "establish-matrix": "Matrijs vastgesteld",
                    review: "Collegiale controle afgerond",
                    submit: "Vastgesteld en ingediend",
                    release: "Examen vrijgegeven",
                    return: "Teruggestuurd",
                    withdraw: "Vrijgave ingetrokken",
                    "new-revision": "Nieuwe revisie",
                  } as any
                )[e.action] || e.action}
              </strong>
              <span className="muted">
                {" "}
                · {new Date(e.at).toLocaleString("nl-NL")}
              </span>
              {e.detail && <p>{e.detail}</p>}
            </div>
          ))}
      </Card>
      {modal && (
        <Modal
          title={
            modal === "submit"
              ? "Examen vaststellen en indienen?"
              : "Vrijgave intrekken?"
          }
          onClose={() => setModal("")}
        >
          <p className="small-text">
            {modal === "submit"
              ? `Je stelt revisie ${exam.revision} vast met ${maximumScore(exam)} punten en N-term ${exam.nTerm}. De N-term kan daarna niet meer worden gewijzigd.`
              : "Verdere downloads worden onmiddellijk geblokkeerd. Eerder gedownloade bestanden kunnen niet worden teruggehaald."}
          </p>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setModal("")}>
              Annuleren
            </Button>
            <Button
              variant={modal === "withdraw" ? "danger" : ""}
              onClick={() =>
                act(
                  modal === "submit"
                    ? { type: "submit" }
                    : { type: "withdraw", reason },
                )
                  .then(() => setModal(""))
                  .catch(() => {})
              }
            >
              Bevestigen
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function FindingRow({
  finding: f,
  editable,
  onResolve,
  onClose,
}: {
  finding: any;
  editable: boolean;
  onResolve: (s: string) => Promise<any>;
  onClose?: () => Promise<any>;
}) {
  const [text, setText] = useState("");
  return (
    <div className={`finding ${f.state !== "open" ? "resolved" : ""}`}>
      <strong>
        {f.state === "closed"
          ? "Afgesloten"
          : f.state === "resolved"
            ? "Oplossing ter controle"
            : "Open bevinding"}
      </strong>
      <p>{f.text}</p>
      {f.resolution && <p>Oplossing: {f.resolution}</p>}
      {editable && f.state === "open" && (
        <>
          <input
            aria-label="Oplossing"
            placeholder="Beschrijf je oplossing"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={!text.trim()}
            onClick={() => onResolve(text).catch(() => {})}
          >
            Oplossing vastleggen
          </Button>
        </>
      )}
      {onClose && f.state === "resolved" && (
        <Button variant="secondary" onClick={() => onClose().catch(() => {})}>
          Oplossing goedkeuren & sluiten
        </Button>
      )}
    </div>
  );
}

function OfficeDetail({ exam, onBack }: { exam: any; onBack: () => void }) {
  return (
    <>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft size={14} />
        Alle examens
      </Button>
      <div className="spacer" />
      <PageHeader
        eyebrow="Examenbureau"
        title={exam.title}
        description={`${exam.pta.subject} · ${exam.pta.programme} · ${exam.pta.schoolYear}`}
      />
      <Card
        title="Vrijgegeven bestanden"
        description="Elke download wordt geregistreerd. Beide documenten horen bij exact dezelfde vrijgegeven revisie."
      >
        {exam.activeReleasedRevisions.length ? (
          exam.activeReleasedRevisions.map((s: any) => (
            <div className="admin-row" key={s.revision}>
              <div className="inline-actions">
                <strong>Revisie {s.revision}</strong>
                <Badge status="released" />
                <span className="small-text muted">{date(s.releasedAt)}</span>
              </div>
              <div className="form-actions">
                <a
                  className="button secondary"
                  href={`/api/exams/${exam.id}/download?kind=exam&revision=${s.revision}`}
                >
                  <Download size={14} />
                  Examen · PDF
                </a>
                <a
                  className="button"
                  href={`/api/exams/${exam.id}/download?kind=answers&revision=${s.revision}`}
                >
                  <Download size={14} />
                  Correctiemodel · PDF
                </a>
              </div>
            </div>
          ))
        ) : (
          <Empty title="Geen actieve vrijgave">
            <p>Voor dit examen zijn momenteel geen bestanden beschikbaar.</p>
          </Empty>
        )}
      </Card>
      {exam.withdrawals?.length > 0 && (
        <Card title="Ingetrokken versies">
          {exam.withdrawals.map((s: any) => (
            <div className="alert error" key={s.revision}>
              <strong>
                Revisie {s.revision} ingetrokken op {date(s.withdrawnAt)}
              </strong>
              <p>{s.reason}</p>Downloads zijn geblokkeerd. Eerder gedownloade
              bestanden kunnen niet worden teruggehaald.
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
