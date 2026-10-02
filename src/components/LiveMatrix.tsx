import {
  CATEGORIES,
  matrixComparison,
  maximumScore,
  type Exam,
  type MatrixCell,
} from "../lib/domain";

/** Uses the complete exam, including a caller's unsaved section, without double counting goals. */
export function LiveMatrix({
  exam,
  unsaved = false,
  sticky = false,
}: {
  exam: Exam;
  unsaved?: boolean;
  sticky?: boolean;
}) {
  const cells = matrixComparison(exam);
  const planned = cells.reduce((sum, c) => sum + c.planned, 0);
  const actual = cells.reduce((sum, c) => sum + c.actual, 0);
  const missing = cells.reduce((sum, c) => sum + Math.max(0, -c.difference), 0);
  const excess = cells.reduce((sum, c) => sum + Math.max(0, c.difference), 0);
  const points = maximumScore(exam);
  const matrix = exam.matrixVersions.find(
    (m) => m.version === exam.activeMatrixVersion,
  );
  const domains = [...new Set(exam.goals.map((g) => g.domain))];
  const style = {
    padding: "7px 10px",
    borderBottom: "1px solid #e0e7e3",
    verticalAlign: "top" as const,
    textAlign: "left" as const,
  };
  function value(rows: MatrixCell[]) {
    const wanted = rows.reduce((sum, c) => sum + c.planned, 0),
      realized = rows.reduce((sum, c) => sum + c.actual, 0);
    const short = rows.reduce((sum, c) => sum + Math.max(0, -c.difference), 0),
      over = rows.reduce((sum, c) => sum + Math.max(0, c.difference), 0);
    return (
      <>
        <strong>
          {realized} / {wanted}
        </strong>
        <small
          style={{
            display: "block",
            color: short || over ? "#9b3a28" : "#376c55",
            whiteSpace: "nowrap",
          }}
        >
          {short || over
            ? [short ? `${short} ontbreekt` : "", over ? `${over} teveel` : ""]
                .filter(Boolean)
                .join(" · ")
            : "Exact"}
        </small>
      </>
    );
  }
  return (
    <aside
      aria-label="Live matrijsvergelijking"
      className="panel"
      style={{
        padding: 14,
        margin: "16px 0",
        background: "#fff",
        ...(sticky
          ? {
              position: "sticky",
              top: 12,
              zIndex: 4,
              boxShadow: "0 3px 14px #18372c15",
            }
          : {}),
      }}
    >
      <div
        className="inline-actions"
        style={{
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <h3 style={{ margin: 0 }}>Live matrijsvergelijking</h3>
        <span className="small-text muted">
          Matrijs v{exam.activeMatrixVersion} ·{" "}
          {matrix?.establishedAt ? "Vastgesteld" : "Concept"}
          {unsaved ? " · Inclusief niet-opgeslagen wijzigingen" : ""}
        </span>
      </div>
      <p className="small-text" style={{ margin: "6px 0" }}>
        Gerealiseerd / gewenst per cel. Een gekoppeld doel met nul punten telt
        niet mee.
      </p>
      <p
        className="small-text"
        role="status"
        aria-live="polite"
        style={{ margin: "6px 0" }}
      >
        <strong>
          {actual} / {planned} punten toegedeeld
        </strong>{" "}
        · {missing} ontbreekt · {excess} teveel · Vraagscore: {points}
        {actual !== points
          ? " — puntentoedeling wijkt af van de vraagscore"
          : ""}
      </p>
      {exam.goals.length === 0 ? (
        <p className="small-text muted">
          Voeg eerst leerdoelen en gewenste punten toe in de toetsmatrijs.
        </p>
      ) : (
        <div
          style={{ overflow: "auto", maxHeight: sticky ? "30vh" : undefined }}
        >
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}
          >
            <caption
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
              }}
            >
              Gerealiseerde en gewenste punten per leerdoel en RTTI-categorie,
              met ontbrekende en overtollige punten.
            </caption>
            <thead>
              <tr>
                <th scope="col" style={style}>
                  Leerdoel / domein
                </th>
                {CATEGORIES.map((c) => (
                  <th scope="col" style={style} key={c}>
                    {c}
                  </th>
                ))}
                <th scope="col" style={style}>
                  Totaal
                </th>
              </tr>
            </thead>
            {domains.map((domain) => (
              <tbody key={domain}>
                {exam.goals
                  .filter((g) => g.domain === domain)
                  .map((g) => (
                    <tr key={g.id} data-goal-id={g.id}>
                      <th
                        scope="row"
                        style={{ ...style, minWidth: 150, fontWeight: 400 }}
                      >
                        <small className="muted">{domain}</small>
                        <br />
                        {g.description}
                      </th>
                      {CATEGORIES.map((category) => (
                        <td
                          style={style}
                          key={category}
                          data-category={category}
                        >
                          {value(
                            cells.filter(
                              (c) =>
                                c.goalId === g.id && c.category === category,
                            ),
                          )}
                        </td>
                      ))}
                      <td style={style}>
                        {value(cells.filter((c) => c.goalId === g.id))}
                      </td>
                    </tr>
                  ))}
                <tr style={{ background: "#f4f7f4" }}>
                  <th scope="row" style={style}>
                    Subtotaal {domain}
                  </th>
                  {CATEGORIES.map((category) => (
                    <td key={category} style={style}>
                      {value(
                        cells.filter(
                          (c) =>
                            c.category === category &&
                            exam.goals.some(
                              (g) => g.id === c.goalId && g.domain === domain,
                            ),
                        ),
                      )}
                    </td>
                  ))}
                  <td style={style}>
                    {value(
                      cells.filter((c) =>
                        exam.goals.some(
                          (g) => g.id === c.goalId && g.domain === domain,
                        ),
                      ),
                    )}
                  </td>
                </tr>
              </tbody>
            ))}
            <tfoot>
              <tr>
                <th scope="row" style={style}>
                  Examentotaal
                </th>
                {CATEGORIES.map((category) => (
                  <td key={category} style={style}>
                    {value(cells.filter((c) => c.category === category))}
                  </td>
                ))}
                <td style={style}>{value(cells)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </aside>
  );
}
