import type { ReportPersonLabel } from '@loane/shared';

/**
 * "About @her", "From @her" — a girl's current name in a table cell,
 * clickable through to her page under Users when the dashboard has her
 * loaded. Labels come from reportPersonLabel / personLabelWithCopy, which
 * look her up by account id so renames and deletions always show right.
 */
export function PersonLink({
  prefix,
  person,
  onOpen,
}: {
  prefix?: string;
  person: ReportPersonLabel;
  onOpen: (uid: string) => void;
}) {
  const openUid = person.openUid;
  return (
    <div className="cell-note">
      {prefix ? `${prefix} ` : null}
      {openUid ? (
        <button className="text-button" onClick={() => onOpen(openUid)}>
          {person.label}
        </button>
      ) : (
        person.label
      )}
    </div>
  );
}
