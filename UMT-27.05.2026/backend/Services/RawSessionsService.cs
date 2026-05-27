using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MySqlConnector;
using Newtonsoft.Json;
using UMT.Backend.Models;

namespace UMT.Backend.Services
{
    public class RawSessionsService
    {
        private readonly MySqlConnectionFactory _factory;
        private static readonly SemaphoreSlim GenerateLock = new SemaphoreSlim(1, 1);

        public RawSessionsService(MySqlConnectionFactory factory)
        {
            _factory = factory;
        }

        public async Task GenerateJson()
        {
            await GenerateLock.WaitAsync();
            try
            {
                await GenerateJsonCore();
            }
            finally
            {
                GenerateLock.Release();
            }
        }

        private async Task GenerateJsonCore()
        {
            var rows = LoadData();

            // ✅ RAW JSON (your original format)
            var rawJson = rows;

            // ✅ COMPACT JSON with required format
            var compact = rows
                .Select((r, i) => ToCompactRowV2(r, i + 1))
                .ToList();

                
            var compactRows = compact.Cast<object[]>().ToList();
            var vdi = BuildVdiUsers(compactRows);
            var domains = BuildDomains(compactRows);


            // ✅ Read env path
            string basePath = Environment.GetEnvironmentVariable("DASHBOARD_STATIC_DIR");

            if (string.IsNullOrEmpty(basePath))
                basePath = AppDomain.CurrentDomain.BaseDirectory;

            if (!Directory.Exists(basePath))
                Directory.CreateDirectory(basePath);

            // ✅ Write files
            await Task.WhenAll(
                WriteJsonAsync(Path.Combine(basePath, "raw-sessions.json"), rawJson),
                WriteJsonAsync(Path.Combine(basePath, "raw-sessions-compact.json"), compact),
                WriteJsonAsync(Path.Combine(basePath, "vdi.json"), vdi),
                WriteJsonAsync(Path.Combine(basePath, "domains.json"), domains)
            );

        }


        private List<RawUsageRow> LoadData()
        {
            var rows = new List<RawUsageRow>();

            using (var conn = _factory.CreateConnection())
            {
                conn.Open();

                string sql = "SELECT * FROM " + _factory.TableName("mst_tool_usage") + " ORDER BY StartTime DESC";

                using (var cmd = new MySqlCommand(sql, conn))
                using (var reader = cmd.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        rows.Add(RawUsageRow.FromReader(reader));
                    }
                }
            }

            return rows;
        }

        private object[] ToCompactRow(RawUsageRow row, int index)
        {
            var start = Convert.ToDateTime(row.StartTime);

            return new object[]
            {
                "sess-" + (index + 1),
                row.SrNo,
                row.ApplicationName,
                row.Functionality,
                row.CadTool,
                row.UserID,
                row.MachineID,
                row.Domain,
                row.Region,
                row.ProductLine,
                start.ToString("yyyy-MM-dd HH:mm:ss"),
                start.Year,
                start.Month - 1,
                IsTruthy(row.IsVDI) ? "VDI" : "Non-VDI"
            };
        }

        private List<object> BuildVdiUsers(List<object[]> rows)
        {
            return rows
                .Where(r => Convert.ToString(r[20]) == "VDI")
                .GroupBy(r => Convert.ToString(r[5]).ToLower())
                .Where(g => !string.IsNullOrWhiteSpace(g.Key))
                .Select(g => g.OrderByDescending(r => ToLong(r[12])).First())
                .Select((row, i) => new
                {
                    id = "vdi-" + (i + 1).ToString("D3"),
                    fullName = ToDisplayName(row[5]),
                    email = ToEmail(row[5]),
                    domain = Convert.ToString(row[7]),
                    region = EmptyToDefault(row[8], "NA"),
                    hostname = Convert.ToString(row[6]),
                    status = ToVdiStatus(row[19]),
                    lastSeen = ToIsoDate(row[12])
                })
                .Cast<object>()
                .ToList();
        }

        private List<object> BuildDomains(List<object[]> rows)
        {
            return rows
                .GroupBy(r => Convert.ToString(r[7]))
                .Where(g => !string.IsNullOrWhiteSpace(g.Key))
                .OrderBy(g => g.Key)
                .Select((g, i) => new
                {
                    id = "dom-" + (i + 1).ToString("D3"),
                    technicalDomain = g.Key,
                    corporateGroup = ToTitleCase(g.Key),
                    region = MostCommon(g.Select(x => Convert.ToString(x[8]))),
                    users = g.Select(x => x[5]).Distinct().Count(),
                    active = g.Any(x => ToLong(x[12]) > 0)
                })
                .Cast<object>()
                .ToList();
        }

        private static string EmptyToDefault(object value, string fallback)
        {
            var text = Convert.ToString(value);
            return string.IsNullOrWhiteSpace(text) ? fallback : text;
        }

        private static long ToLong(object value)
        {
            if (value == null)
                return 0;

            long result;
            return long.TryParse(Convert.ToString(value), out result) ? result : 0;
        }

        private static string ToTitleCase(object value)
        {
            var text = Convert.ToString(value);
            if (string.IsNullOrWhiteSpace(text))
                return "Unknown";

            var words = text.Split(new[] { ' ', '_', '.', '-' }, StringSplitOptions.RemoveEmptyEntries);
            return string.Join(" ", words.Select(word =>
                char.ToUpperInvariant(word[0]) + word.Substring(1).ToLowerInvariant()));
        }

        private static string ToDisplayName(object userId)
        {
            var text = Convert.ToString(userId);
            if (string.IsNullOrWhiteSpace(text))
                return "Unknown User";

            return ToTitleCase(text.Split('@')[0]);
        }

        private static string ToEmail(object userId)
        {
            var text = Convert.ToString(userId);
            if (string.IsNullOrWhiteSpace(text))
                return "unknown@cooperstandard.com";

            return text.Contains("@") ? text : text.ToLowerInvariant() + "@cooperstandard.com";
        }

        private static string ToVdiStatus(object status)
        {
            var text = MapStatus(status);
            if (text == "Active")
                return "Active";
            if (text == "Failed")
                return "Disabled";
            return "Inactive";
        }

        private static string MapStatus(object status)
        {
            var text = Convert.ToString(status)?.ToUpperInvariant();
            if (text == "SUCCESS")
                return "Completed";
            if (text == "FAILED")
                return "Failed";
            if (text == "STOPPED")
                return "Stopped";
            if (text == "ACTIVE")
                return "Active";
            return "Completed";
        }

        private static bool IsTruthy(object value)
        {
            if (value == null)
                return false;

            var text = Convert.ToString(value);
            return text == "1" || string.Equals(text, "true", StringComparison.OrdinalIgnoreCase);
        }

        private static string ToIsoDate(object epochMs)
        {
            var ms = ToLong(epochMs);
            if (ms <= 0)
                return DateTime.UtcNow.ToString("o");

            return DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime.ToString("o");
        }

        private static string MostCommon(IEnumerable<string> values)
        {
            return values
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .GroupBy(value => value)
                .OrderByDescending(g => g.Count())
                .ThenBy(g => g.Key)
                .Select(g => g.Key)
                .FirstOrDefault() ?? "NA";
        }

        private async Task WriteJsonAsync<T>(string fullPath, T data)
        {
            var temp = fullPath + ".tmp";

            var json = JsonConvert.SerializeObject(data);

            File.WriteAllText(temp, json);

            if (File.Exists(fullPath))
                File.Delete(fullPath);

            File.Move(temp, fullPath);

            await Task.CompletedTask;
        }

        private object[] ToCompactRowV2(RawUsageRow row, int index)
        {
            DateTime start;
            DateTime stop;

            // ✅ Safe parsing
            bool validStart = DateTime.TryParse(row.StartTime?.ToString(), out start) && start > DateTime.MinValue;
            bool validStop = DateTime.TryParse(row.StopTime?.ToString(), out stop) && stop > DateTime.MinValue;

            if (!validStart) start = DateTime.MinValue;
            if (!validStop) stop = start;

            // ✅ Epoch (safe)
            long startMs = validStart ? new DateTimeOffset(start).ToUnixTimeMilliseconds() : 0;
            long? stopMs = validStop ? new DateTimeOffset(stop).ToUnixTimeMilliseconds() : (long?)null;

            return new object[]
            {
                "sess-" + index.ToString("D4"),                  // 0 id ✅
                row.SrNo,                                        // 1
                row.ApplicationName,                             // 2
                row.Functionality,                               // 3
                row.CadTool,                                     // 4
                row.UserID,                                      // 5
                row.MachineID,                                   // 6
                row.Domain,                                      // 7
                row.Region,                                      // 8
                row.ProductLine,                                 // 9

                validStart ? start.ToString("yyyy-MM-dd HH:mm:ss.fff") : null,   // 10
                validStop ? stop.ToString("yyyy-MM-dd HH:mm:ss.fff") : null,     // 11

                startMs,                                         // 12
                stopMs,                                          // 13

                validStart ? start.Year : 0,                     // 14
                validStart ? start.Month - 1 : 0,                // 15 ✅ 0-based
                validStart ? start.Day - 1 : 0,                  // 16 0-based day index

                validStart ? start.ToString("yyyy-MM") : null,   // 17
                validStart ? start.ToString("MMM ''yy") : null,  // 18 ✅ EXACT FORMAT (Jan '19)

                MapStatus(row.Status),                          // 19

                IsTruthy(row.IsVDI)
                    ? "VDI"
                    : "Non-VDI",                                // 20 ✅ matches frontend type

                IsTruthy(row.IsProd)                             // 21 BOOLEAN
            };
        }
    }
}
