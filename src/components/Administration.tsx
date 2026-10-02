import { useEffect, useState } from "react";
import { ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import {
  api,
  Badge,
  Button,
  Card,
  ErrorMessage,
  Field,
  PageHeader,
} from "./ui";
import { roles } from "./App";
export function Administration() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("users"),
    [form, setForm] = useState({
      name: "",
      email: "",
      password: "",
      role: "teacher",
    }),
    [teamName, setTeamName] = useState(""),
    [items, setItems] = useState<any[]>([]);
  async function load() {
    const d = await api("/admin");
    setData(d);
    setItems(
      structuredClone(
        d.templates?.find((t: any) => !t.publishedAt)?.items ||
          d.templates?.[0]?.items ||
          [],
      ),
    );
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function mutate(body: any) {
    setError("");
    try {
      await api("/admin", "POST", body);
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <>
      <PageHeader
        eyebrow="Platformbeheer"
        title="Een goed georganiseerde werkruimte."
        description="Beheer accounts, docententeams en de inhoudelijke controlechecklist."
      />
      <div className="tabs">
        {[
          ["users", "Accounts"],
          ["teams", "Docententeams"],
          ["templates", "Checklisttemplates"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={id === tab ? "active" : ""}
          >
            {label}
          </button>
        ))}
      </div>
      <ErrorMessage message={error} />
      {tab === "users" && (
        <>
          <Card
            title="Account toevoegen"
            description="Ieder account heeft precies één rol. Deel het tijdelijke wachtwoord via een veilige route."
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate({ action: "create-user", ...form }).then(() =>
                  setForm({ ...form, name: "", email: "", password: "" }),
                );
              }}
            >
              <div className="form-grid">
                <Field label="Naam">
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field>
                <Field label="E-mailadres">
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </Field>
                <Field label="Tijdelijk wachtwoord">
                  <input
                    required
                    minLength={12}
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                  />
                </Field>
                <Field label="Accountrol">
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    {Object.entries(roles).map(([id, label]) => (
                      <option value={id} key={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="form-actions">
                <Button type="submit">
                  <Plus size={14} />
                  Account aanmaken
                </Button>
              </div>
            </form>
          </Card>
          <Card title="Accounts">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>E-mailadres</th>
                    <th>Rol</th>
                    <th>Toegang</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.users?.map((u: any) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <select
                          aria-label={`Rol ${u.name}`}
                          value={u.role}
                          onChange={(e) =>
                            mutate({
                              action: "update-user",
                              userId: u.id,
                              role: e.target.value,
                            })
                          }
                        >
                          {Object.entries(roles).map(([id, label]) => (
                            <option value={id} key={id}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            mutate({
                              action: "update-user",
                              userId: u.id,
                              role: u.role,
                              banned: !u.banned,
                            })
                          }
                        >
                          {u.banned ? "Activeren" : "Blokkeren"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            const password = window.prompt(
                              "Nieuw tijdelijk wachtwoord voor " +
                                u.name +
                                " (minimaal 12 tekens)",
                            );
                            if (password)
                              mutate({
                                action: "reset-password",
                                userId: u.id,
                                password,
                              });
                          }}
                        >
                          Wachtwoord herstellen
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {tab === "teams" && (
        <>
          <Card title="Docententeam toevoegen">
            <form
              className="inline-actions"
              onSubmit={(e) => {
                e.preventDefault();
                mutate({ action: "create-team", name: teamName }).then(() =>
                  setTeamName(""),
                );
              }}
            >
              <input
                aria-label="Teamnaam"
                required
                style={{ flex: 1 }}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Naam van het docententeam"
              />
              <Button type="submit">
                <Plus size={14} />
                Team aanmaken
              </Button>
            </form>
          </Card>
          {data?.teams?.map((t: any) => (
            <Card
              key={t.id}
              title={t.name}
              description="Alleen docenten kunnen lid zijn van een docententeam."
            >
              {data.users
                .filter((u: any) => u.role === "teacher")
                .map((u: any) => (
                  <label className="checklist-item" key={u.id}>
                    <input
                      type="checkbox"
                      checked={data.memberships.some(
                        (m: any) => m.teamId === t.id && m.userId === u.id,
                      )}
                      onChange={(e) =>
                        mutate({
                          action: "membership",
                          teamId: t.id,
                          userId: u.id,
                          remove: !e.target.checked,
                        })
                      }
                    />
                    {u.name}
                    <span className="muted">{u.email}</span>
                  </label>
                ))}
            </Card>
          ))}
        </>
      )}
      {tab === "templates" && (
        <Card
          title="Inhoudelijke collegiale controle"
          description="Werk in een concept en publiceer een nieuwe versie. Bestaande examens behouden hun eigen checklist."
        >
          {items.map((item, i) => (
            <div className="question-card" key={item.id}>
              <div className="question-heading">
                <h3>Controlepunt {i + 1}</h3>
                <div className="inline-actions">
                  <button
                    className="icon-button"
                    aria-label="Controlepunt omhoog"
                    disabled={i === 0}
                    onClick={() => {
                      const x = [...items];
                      [x[i - 1], x[i]] = [x[i], x[i - 1]];
                      setItems(x);
                    }}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Controlepunt verwijderen"
                    onClick={() =>
                      setItems(items.filter((x) => x.id !== item.id))
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <Field label="Omschrijving">
                <input
                  value={item.text}
                  onChange={(e) =>
                    setItems(
                      items.map((x) =>
                        x.id === item.id ? { ...x, text: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
              <div className="spacer" />
              <Field label="Toelichting">
                <textarea
                  value={item.explanation}
                  onChange={(e) =>
                    setItems(
                      items.map((x) =>
                        x.id === item.id
                          ? { ...x, explanation: e.target.value }
                          : x,
                      ),
                    )
                  }
                />
              </Field>
              <div className="inline-actions" style={{ marginTop: 12 }}>
                <label className="small-text">
                  <input
                    type="checkbox"
                    checked={item.required}
                    onChange={(e) =>
                      setItems(
                        items.map((x) =>
                          x.id === item.id
                            ? { ...x, required: e.target.checked }
                            : x,
                        ),
                      )
                    }
                  />{" "}
                  Verplicht
                </label>
                <label className="small-text">
                  <input
                    type="checkbox"
                    checked={item.active}
                    onChange={(e) =>
                      setItems(
                        items.map((x) =>
                          x.id === item.id
                            ? { ...x, active: e.target.checked }
                            : x,
                        ),
                      )
                    }
                  />{" "}
                  Actief
                </label>
              </div>
            </div>
          ))}
          <Button
            variant="secondary"
            onClick={() =>
              setItems([
                ...items,
                {
                  id: crypto.randomUUID(),
                  text: "",
                  explanation: "",
                  required: true,
                  active: true,
                },
              ])
            }
          >
            <Plus size={14} />
            Controlepunt toevoegen
          </Button>
          <div className="form-actions">
            <Button
              variant="secondary"
              onClick={() =>
                mutate({ action: "template", items, publish: false })
              }
            >
              Concept opslaan
            </Button>
            <Button
              onClick={() =>
                mutate({ action: "template", items, publish: true })
              }
            >
              <Save size={14} />
              Nieuwe versie publiceren
            </Button>
          </div>
          <div className="spacer" />
          <h3>Versies</h3>
          {data?.templates?.map((t: any) => (
            <div className="admin-row small-text" key={t.id}>
              Versie {t.version} · {t.items.length} controlepunten ·{" "}
              {t.publishedAt ? "Gepubliceerd" : "Concept"}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
