import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CheckCheck,
  ChevronRight,
  ClipboardCheck,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  LoaderCircle,
  Bell,
  GraduationCap,
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
import { ExamDetail } from "./ExamDetail";
import { Administration } from "./Administration";
export const roles: Record<string, string> = {
  teacher: "Docent",
  committee: "Examencommissie",
  office: "Examenbureau",
  admin: "Platformbeheerder",
};
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>
        matrijs<small>VAN PLAN NAAR EXAMEN</small>
      </span>
    </div>
  );
}
export function App() {
  const [user, setUser] = useState<any>(undefined),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [page, setPage] = useState("dashboard"),
    [examId, setExamId] = useState<string | null>(null),
    [passwordOpen, setPasswordOpen] = useState(false),
    [creating, setCreating] = useState(false),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  async function refresh() {
    const d = await api("/dashboard");
    setData(d);
    setUser(d.user);
  }
  useEffect(() => {
    api("/session")
      .then((d) => {
        setUser(d.user);
        if (d.user) refresh().catch((e) => setError(e.message));
      })
      .catch((e) => {
        setUser(null);
        setError(e.message);
      });
  }, []);
  if (user === undefined)
    return (
      <div className="loading-page">
        <LoaderCircle className="spin" />
      </div>
    );
  if (!user) return <Login onLogin={refresh} />;
  const exams = data?.exams || [];
  const nav = (id: string) => {
    setPage(id);
    setExamId(null);
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace">
          <div className="workspace-icon">
            <GraduationCap size={17} />
          </div>
          <div>
            <strong>{data?.teams?.[0]?.name || "Examenwerkplaats"}</strong>
            <span className="muted">Vavo · voortgezet onderwijs</span>
          </div>
        </div>
        <div className="nav-label">Werkruimte</div>
        <nav>
          <button
            className={page === "dashboard" && !examId ? "active" : ""}
            onClick={() => nav("dashboard")}
          >
            <LayoutDashboard size={17} />
            Overzicht
          </button>
          <button
            className={page === "exams" || examId ? "active" : ""}
            onClick={() => nav("exams")}
          >
            <FolderOpen size={17} />
            Mijn examens
          </button>
          {user.role === "admin" && (
            <button
              className={page === "admin" ? "active" : ""}
              onClick={() => nav("admin")}
            >
              <Settings2 size={17} />
              Platformbeheer
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={20} />
            <h3>Zorgvuldig, samen gemaakt.</h3>
            <p>
              Van leerdoel tot vrijgave. Iedere stap inzichtelijk, iedere versie
              bewaard.
            </p>
          </div>
          <div className="profile">
            <div className="avatar">
              {user.name
                ?.split(" ")
                .map((x: string) => x[0])
                .slice(0, 2)
                .join("")}
            </div>
            <button
              className="icon-button"
              style={{ display: "block", textAlign: "left" }}
              title="Wachtwoord wijzigen"
              onClick={() => setPasswordOpen(true)}
            >
              <strong>{user.name}</strong>
              <small>{roles[user.role]}</small>
            </button>
            <button
              className="icon-button"
              aria-label="Uitloggen"
              onClick={async () => {
                await api("/auth/sign-out", "POST", {});
                setUser(null);
                setData(null);
                setExamId(null);
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <span>
            Werkruimte <ChevronRight size={10} />{" "}
            {examId
              ? "Examendossier"
              : page === "admin"
                ? "Platformbeheer"
                : "Overzicht"}
          </span>
          <div className="topbar-right">
            <span>
              <span className="live-dot" />
              Beveiligde omgeving
            </span>
            <span>
              {new Date().toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        <div className="content">
          <ErrorMessage message={error} />
          {examId ? (
            <ExamDetail
              id={examId}
              user={user}
              dashboard={data}
              onBack={() => {
                setExamId(null);
                refresh();
              }}
              onRefresh={refresh}
            />
          ) : page === "admin" ? (
            <Administration />
          ) : (
            <>
              <PageHeader
                eyebrow="Jouw examenwerkplaats"
                title={
                  page === "dashboard"
                    ? `Goed aan het werk${user.name ? ", " + user.name.split(" ")[0] : ""}.`
                    : "Alle examens"
                }
                description="Een helder overzicht. Van de eerste leerdoelen tot het laatste akkoord."
              >
                {user.role === "teacher" && (
                  <Button onClick={() => setCreating(true)}>
                    <Plus size={15} />
                    Nieuw examen
                  </Button>
                )}
              </PageHeader>
              <div className="stats">
                {[
                  {
                    label: "Examens in overzicht",
                    value: exams.length,
                    note: "Alles op één plek",
                    icon: FileText,
                  },
                  {
                    label: "In ontwikkeling",
                    value: exams.filter((e: any) =>
                      ["draft", "peer-reviewed"].includes(e.status),
                    ).length,
                    note: "Samen werken aan kwaliteit",
                    icon: BookOpen,
                  },
                  {
                    label: "Bij de commissie",
                    value: exams.filter((e: any) =>
                      ["submitted", "reviewing"].includes(e.status),
                    ).length,
                    note: "Klaar voor de volgende stap",
                    icon: ClipboardCheck,
                  },
                  {
                    label: "Vrijgegeven",
                    value: exams.filter((e: any) => e.status === "released")
                      .length,
                    note: "Gereed voor het examenbureau",
                    icon: CheckCheck,
                  },
                ].map((s) => (
                  <div className="stat" key={s.label}>
                    <span className="stat-icon">
                      <s.icon size={16} />
                    </span>
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-number">
                      {s.value.toString().padStart(2, "0")}
                    </div>
                    <small>{s.note}</small>
                  </div>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Examens in jouw werkruimte</h2>
                      <p>De actuele stand van zaken, per examen.</p>
                    </div>
                    <span className="badge">{exams.length} examens</span>
                  </div>
                  <div className="filters">
                    {[
                      ["all", "Alle examens"],
                      ["draft", "Concept"],
                      ["submitted", "Ter beoordeling"],
                      ["released", "Vrijgegeven"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        className={`filter ${filter === id ? "active" : ""}`}
                        onClick={() => setFilter(id)}
                      >
                        {label}
                      </button>
                    ))}
                    <div className="search">
                      <Search size={14} />
                      <input
                        aria-label="Zoek examen"
                        placeholder="Zoek een examen…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  {!data ? (
                    <Empty title="Examens laden…" />
                  ) : exams.filter(
                      (e: any) =>
                        (filter === "all" ||
                          e.status === filter ||
                          (filter === "submitted" &&
                            e.status === "reviewing")) &&
                        e.title.toLowerCase().includes(search.toLowerCase()),
                    ).length === 0 ? (
                    <Empty title="Ruimte voor een goed examen">
                      <p>
                        {search
                          ? "Geen examens gevonden. Pas je zoekopdracht aan."
                          : "Hier komen de examens van jouw werkruimte te staan."}
                      </p>
                      {user.role === "teacher" && (
                        <Button
                          variant="secondary"
                          onClick={() => setCreating(true)}
                        >
                          <Plus size={14} />
                          Maak een examen
                        </Button>
                      )}
                    </Empty>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Examen</th>
                            <th>Status</th>
                            <th>Schooljaar</th>
                            <th>Versie</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {exams
                            .filter(
                              (e: any) =>
                                (filter === "all" ||
                                  e.status === filter ||
                                  (filter === "submitted" &&
                                    e.status === "reviewing")) &&
                                e.title
                                  .toLowerCase()
                                  .includes(search.toLowerCase()),
                            )
                            .map((e: any) => (
                              <tr
                                className="clickable-row"
                                key={e.id}
                                onClick={() => setExamId(e.id)}
                              >
                                <td>
                                  <div className="exam-title">
                                    <span className="exam-icon">
                                      <FileText size={17} />
                                    </span>
                                    <span>
                                      {e.title}
                                      <small>
                                        {e.pta?.subject || "Engels"} ·{" "}
                                        {e.pta?.programme ||
                                          "PTA nog aanvullen"}
                                      </small>
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <Badge status={e.status} />
                                </td>
                                <td className="muted">
                                  {e.pta?.schoolYear || "—"}
                                </td>
                                <td className="muted">v{e.revision}</td>
                                <td>
                                  <button
                                    aria-label={`Open ${e.title}`}
                                    className="icon-button"
                                  >
                                    <ArrowRight size={15} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="footer-note">
                    <LockKeyhole size={11} />
                    Alleen toegankelijk voor bevoegde accounts.
                  </div>
                </section>
                <aside className="dashboard-aside">
                  <section className="panel callout">
                    <span className="eyebrow">
                      Kwaliteit begint bij het plan
                    </span>
                    <h2>
                      Van leerdoel naar
                      <br />
                      een sterk examen.
                    </h2>
                    <p>
                      Een vastgestelde matrijs geeft richting. Collegiale
                      controle geeft vertrouwen.
                    </p>
                    {user.role === "teacher" && (
                      <Button
                        variant="secondary"
                        onClick={() => setCreating(true)}
                      >
                        Aan de slag <ArrowRight size={13} />
                      </Button>
                    )}
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>De route naar vrijgave</h2>
                    </div>
                    {[
                      ["Ontwerpen", "PTA, matrijs en vragen in balans."],
                      ["Samen controleren", "Een frisse blik van een collega."],
                      [
                        "Vaststellen & indienen",
                        "Een complete, vaste examenversie.",
                      ],
                      ["Vrijgeven", "Akkoord van de examencommissie."],
                    ].map(([t, d], i) => (
                      <div className="process-item" key={t}>
                        <span className="process-number">{i + 1}</span>
                        <div>
                          <h3>{t}</h3>
                          <p>{d}</p>
                        </div>
                      </div>
                    ))}
                  </section>
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
      {passwordOpen && (
        <PasswordChange onClose={() => setPasswordOpen(false)} />
      )}{" "}
      {creating && (
        <CreateExam
          teams={data?.teams || []}
          onClose={() => setCreating(false)}
          onCreate={(id) => {
            setCreating(false);
            setExamId(id);
            refresh();
          }}
        />
      )}
    </div>
  );
}
function Login({ onLogin }: { onLogin: () => Promise<void> }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div>
          <div className="eyebrow">Samen naar een zorgvuldig examen</div>
          <h1>
            Een goed examen
            <br />
            begint met
            <br />
            een helder plan.
          </h1>
          <p>
            Verbind je PTA, toetsmatrijs en collegiale controle in één rustige
            werkplek.
          </p>
          <div className="login-art">
            {Array.from({ length: 16 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        </div>
        <small className="muted">
          Ontworpen voor docenten. Gebouwd op vertrouwen.
        </small>
      </section>
      <section className="login-form-wrap">
        <form
          className="login-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("/auth/sign-in/email", "POST", { email, password });
              await onLogin();
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 14 }}>
            Welkom in Matrijs
          </div>
          <h2>Verder waar je was.</h2>
          <p>Log in met je schoolaccount om je werkruimte te openen.</p>
          <Field label="E-mailadres">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              placeholder="naam@school.nl"
            />
          </Field>
          <Field label="Wachtwoord">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="Je wachtwoord"
            />
          </Field>
          <ErrorMessage message={error} />
          <Button type="submit" loading={busy}>
            Inloggen <ArrowRight size={15} />
          </Button>
          <p style={{ textAlign: "center", marginTop: 20 }}>
            <a href="/demo/">Bekijk de productdemo →</a>
          </p>
          <div className="login-security">
            <LockKeyhole size={12} />
            Je examenmateriaal blijft in veilige handen.
          </div>
          <p style={{ textAlign: "center", marginTop: 24, fontSize: 10 }}>
            Nog geen account? Neem contact op met je platformbeheerder.
          </p>
        </form>
      </section>
    </main>
  );
}
function CreateExam({
  teams,
  onClose,
  onCreate,
}: {
  teams: any[];
  onClose: () => void;
  onCreate: (id: string) => void;
}) {
  const [title, setTitle] = useState(""),
    [teamId, setTeam] = useState(teams[0]?.id || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Een nieuw examen" onClose={onClose}>
      <p className="small-text">
        Begin met een naam en team. De actuele controlechecklist wordt
        automatisch gekoppeld.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const d = await api("/exams", "POST", { title, teamId });
            onCreate(d.exam.id);
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="spacer" />
        <Field label="Examentitel">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bijvoorbeeld: Engels leesvaardigheid SE 1"
          />
        </Field>
        <div className="spacer" />
        <Field label="Docententeam">
          <select
            value={teamId}
            onChange={(e) => setTeam(e.target.value)}
            required
          >
            <option value="" disabled>
              Kies een team
            </option>
            {teams.map((t) => (
              <option value={t.id} key={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <ErrorMessage message={error} />
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuleren
          </Button>
          <Button loading={busy} type="submit">
            Examen aanmaken <ArrowRight size={14} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordChange({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrent] = useState(""),
    [newPassword, setNew] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Wachtwoord wijzigen" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/auth/change-password", "POST", {
              currentPassword,
              newPassword,
              revokeOtherSessions: true,
            });
            onClose();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Huidig wachtwoord">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <div className="spacer" />
        <Field
          label="Nieuw wachtwoord"
          hint="Gebruik minimaal twaalf tekens. Andere sessies worden uitgelogd."
        >
          <input
            type="password"
            minLength={12}
            required
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
        </Field>
        <ErrorMessage message={error} />
        <div className="form-actions">
          <Button loading={busy} type="submit">
            Wachtwoord opslaan
          </Button>
        </div>
      </form>
    </Modal>
  );
}
