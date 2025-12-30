export const createMarkdownTable = <TItem extends MarkdownTableItem>(items: TItem[], columns: (keyof TItem)[]): string => {
  const maxColumnWidths: Record<keyof TItem, number> = {} as Record<keyof TItem, number>;

  // Calculate maximum widths for each column.
  for (const column of columns) {
    const headerWidth = String(column).length;
    const maxItemWidth = Math.max(...items.map((item) => String(item[column] ?? "").length), 0);
    maxColumnWidths[column] = Math.max(headerWidth, maxItemWidth);
  }

  // Create the header row.
  const header = `| ${columns.map((column) => String(column).padEnd(maxColumnWidths[column], " ")).join(" | ")} |`;

  // Create the separator row.
  const separator = `| ${columns.map((column) => "-".repeat(maxColumnWidths[column])).join(" | ")} |`;

  // Create the data rows.
  const rows = items.map((item) => {
    return `| ${columns.map((column) => String(item[column] ?? "").padEnd(maxColumnWidths[column], " ")).join(" | ")} |`;
  });

  // Combine all parts into the final table string.
  return [header, separator, ...rows].join("\n");
};

type MarkdownTableItem = Record<string, string | boolean | number | undefined | null>;
