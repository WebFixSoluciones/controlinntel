type TableColumnsProps = {
  weights: Readonly<Record<string, number>>;
  actionIcons: number;
  actionLabelWidth?: number;
};

/** Reparte el espacio de datos después de reservar el ancho de las acciones. */
export function TableColumns({ weights, actionIcons, actionLabelWidth = 0 }: TableColumnsProps) {
  const columns = Object.entries(weights);
  const totalWeight = columns.reduce((total, [, weight]) => total + weight, 0);
  const gaps = actionLabelWidth > 0 ? actionIcons : actionIcons - 1;
  const actionWidth = `max(60px, ${actionIcons} * var(--ui-row-control, 26px) + ${gaps} * var(--ui-action-gap, 4px) + 2 * var(--ui-cell-inline-padding, 8px) + ${actionLabelWidth}px)`;

  return (
    <colgroup>
      {columns.map(([name, weight]) => (
        <col key={name} style={{ width: `${weight / totalWeight * 100}%` }} />
      ))}
      <col style={{ width: actionWidth }} />
    </colgroup>
  );
}
