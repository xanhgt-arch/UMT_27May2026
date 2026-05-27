import type { RawSessionRow, CadTool, Region, SessionStatus } from "../types";

type NewRawSession = {
  SrNo: number;
  ApplicationName: string;
  Functionality: string;
  StartTime: string;
  StopTime?: string;
  UserID: string;
  MachineID: string;
  Region: string;
  CadTool: string;
  ProductLine: string;
  Status: string;
  Domain: string;
  IsVDI: boolean | null;
  IsProd: boolean | null;
};

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function mapStatus(status: string): SessionStatus {
  const u = status.toUpperCase();

  if (u === "SUCCESS") return "Completed";
  if (u === "FAILED") return "Failed";
  if (u === "STOPPED") return "Stopped";
  if (u === "ACTIVE") return "Active";

  return "Completed"; // fallback
}

export function mapToRawSessionRow(
  s: NewRawSession,
  index: number,
): RawSessionRow {
  const start = new Date(s.StartTime);
  const stop = s.StopTime ? new Date(s.StopTime) : null;
  const year = start.getFullYear();
  const monthIndex = start.getMonth();
  const dayIndex = start.getDate() - 1;
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const monthLabel = `${MONTH_LABELS[monthIndex] ?? ""} '${String(year).slice(2)}`;

  return {
    id: `sess-${String(index + 1).padStart(4, "0")}`,
    srNo: s.SrNo,

    application: s.ApplicationName,
    functionality: s.Functionality,

    cad: s.CadTool as CadTool,
    user: s.UserID,
    machine: s.MachineID,

    domain: s.Domain,
    region: s.Region as Region,
    productLine: s.ProductLine,

    startTime: s.StartTime.replace("T", " ").replace("Z", ""),
    stopTime: s.StopTime
      ? s.StopTime.replace("T", " ").replace("Z", "")
      : null,
    startMs: start.getTime(),
    stopMs: stop ? stop.getTime() : null,
    year,
    monthIndex,
    dayIndex,
    monthKey,
    monthLabel,

    status: mapStatus(s.Status),

    hardware: s.IsVDI ? "VDI" : "Non-VDI",

    isProd: s.IsProd ?? false,
  };
}
